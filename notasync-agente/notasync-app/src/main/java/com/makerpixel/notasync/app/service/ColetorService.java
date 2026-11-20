package com.makerpixel.notasync.app.service;

import com.makerpixel.notasync.app.domain.DocumentoEntity;
import com.makerpixel.notasync.app.domain.EmpresaEntity;
import com.makerpixel.notasync.app.domain.EstadoFonteEntity;
import com.makerpixel.notasync.app.domain.ExecucaoEntity;
import com.makerpixel.notasync.app.repository.DocumentoRepository;
import com.makerpixel.notasync.app.repository.EmpresaRepository;
import com.makerpixel.notasync.app.repository.EstadoFonteRepository;
import com.makerpixel.notasync.app.repository.ExecucaoRepository;
import com.makerpixel.notasync.core.fonte.FonteDeNotas;
import com.makerpixel.notasync.core.fonte.SefScNfceFonte;
import com.makerpixel.notasync.core.modelo.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

@Service
public class ColetorService {

    private static final Logger log = LoggerFactory.getLogger(ColetorService.class);

    private final EmpresaRepository empresaRepository;
    private final EstadoFonteRepository estadoFonteRepository;
    private final DocumentoRepository documentoRepository;
    private final ExecucaoRepository execucaoRepository;
    private final XmlStorageService xmlStorageService;
    private final SincronizadorCentralService sincronizadorCentralService;

    private final Map<String, FonteDeNotas> fontesDisponiveis = new HashMap<>();

    public record ResumoColeta(
            String cnpj,
            String fonteId,
            int cStat,
            String xMotivo,
            int qtdDocumentos,
            long ultNsu,
            Instant proximaConsulta,
            long duracaoMs,
            String status
    ) {}

    public static class EsperaAtivaException extends RuntimeException {
        private final Instant permitidoAPartirDe;

        public EsperaAtivaException(Instant permitidoAPartirDe) {
            super("Consulta não permitida antes do prazo regulamentar. Permitido a partir de: " + permitidoAPartirDe);
            this.permitidoAPartirDe = permitidoAPartirDe;
        }

        public Instant getPermitidoAPartirDe() {
            return permitidoAPartirDe;
        }
    }

    public ColetorService(
            EmpresaRepository empresaRepository,
            EstadoFonteRepository estadoFonteRepository,
            DocumentoRepository documentoRepository,
            ExecucaoRepository execucaoRepository,
            XmlStorageService xmlStorageService,
            SincronizadorCentralService sincronizadorCentralService,
            @Value("${notasync.sef.url:https://dfe.sat.sef.sc.gov.br/nfce/ws/distribuicao/DistribuicaoNfceDownload.asmx}") String urlSef
    ) {
        this.empresaRepository = empresaRepository;
        this.estadoFonteRepository = estadoFonteRepository;
        this.documentoRepository = documentoRepository;
        this.execucaoRepository = execucaoRepository;
        this.xmlStorageService = xmlStorageService;
        this.sincronizadorCentralService = sincronizadorCentralService;

        // Registra a fonte oficial SEF/SC NFC-e
        SefScNfceFonte sefFonte = new SefScNfceFonte(urlSef);
        this.fontesDisponiveis.put(sefFonte.id(), sefFonte);
    }

    public void registrarFonte(FonteDeNotas fonte) {
        this.fontesDisponiveis.put(fonte.id(), fonte);
    }

    @Transactional
    public ResumoColeta sincronizarEmpresa(String cnpj, boolean forcar) {
        String cnpjLimpo = (cnpj != null) ? cnpj.replaceAll("\\D", "") : "";
        if (cnpjLimpo.isBlank()) {
            throw new IllegalArgumentException("CNPJ não informado para coleta");
        }

        EmpresaEntity empresa = empresaRepository.findByCnpj(cnpjLimpo)
                .orElseGet(() -> empresaRepository.save(new EmpresaEntity(cnpjLimpo, "Empresa " + cnpjLimpo)));

        String fonteId = SefScNfceFonte.ID;
        FonteDeNotas fonte = fontesDisponiveis.get(fonteId);
        if (fonte == null) {
            throw new IllegalStateException("Fonte não registrada: " + fonteId);
        }

        EstadoFonteEntity estadoFonte = estadoFonteRepository.findByEmpresaCnpjAndFonteId(cnpjLimpo, fonteId)
                .orElseGet(() -> estadoFonteRepository.save(new EstadoFonteEntity(cnpjLimpo, fonteId)));

        Instant agora = Instant.now();
        if (!forcar && estadoFonte.getProximaConsulta() != null && agora.isBefore(estadoFonte.getProximaConsulta())) {
            log.warn("Tentativa de consulta antecipada para o CNPJ {}. Permitido apenas após {}", cnpjLimpo, estadoFonte.getProximaConsulta());
            throw new EsperaAtivaException(estadoFonte.getProximaConsulta());
        }

        long inicioMs = System.currentTimeMillis();
        EstadoEmpresa estadoDominio = new EstadoEmpresa(
                cnpjLimpo,
                estadoFonte.getUltNsu(),
                estadoFonte.getProximaConsulta(),
                estadoFonte.getTentativasIguais(),
                estadoFonte.getUltimoCStat()
        );

        Credencial cred = montarCredencial(empresa);

        ResultadoConsulta resultado;
        try {
            resultado = fonte.consultar(estadoDominio, cred);
        } catch (Exception e) {
            long duracao = System.currentTimeMillis() - inicioMs;
            log.error("Erro na comunicação com a fonte {} para o CNPJ {}: {}", fonteId, cnpjLimpo, e.getMessage());
            salvarExecucao(cnpjLimpo, fonteId, 9999, e.getMessage(), 0, duracao, "ERRO");
            return new ResumoColeta(cnpjLimpo, fonteId, 9999, e.getMessage(), 0, estadoFonte.getUltNsu(), agora.plusSeconds(900), duracao, "ERRO");
        }

        long duracao = System.currentTimeMillis() - inicioMs;

        // 1. Processa e deduplica documentos
        List<Documento> docsSalvos = new ArrayList<>();
        List<Documento> novosDocs = resultado.documentos();
        List<String> xmls = resultado.xmlsBrutos();

        for (int i = 0; i < novosDocs.size(); i++) {
            Documento doc = novosDocs.get(i);
            String xmlBruto = (i < xmls.size()) ? xmls.get(i) : null;

            // Grava o arquivo físico em disco
            String caminhoSalvo = xmlStorageService.salvarXml(doc, xmlBruto);

            // Deduplicação na base local
            Optional<DocumentoEntity> existenteOpt = documentoRepository.findById(doc.chave());
            DocumentoEntity entidade;
            if (existenteOpt.isPresent()) {
                entidade = existenteOpt.get();
                if (doc.situacao() == SituacaoDocumento.CANCELADA) {
                    entidade.setSituacao("CANCELADA");
                    entidade.setMotivoCancelamento(doc.motivoCancelamento());
                }
                if (doc.nsu() > entidade.getNsu()) {
                    entidade.setNsu(doc.nsu());
                }
                if (caminhoSalvo != null) {
                    entidade.setCaminhoXml(caminhoSalvo);
                }
            } else {
                entidade = new DocumentoEntity();
                entidade.setChave(doc.chave());
                entidade.setModelo(doc.modelo().getCodigo());
                entidade.setCnpjEmitente(doc.cnpjEmitente());
                entidade.setDataEmissao(doc.dataEmissao());
                entidade.setValorTotal(doc.valorTotal());
                entidade.setSituacao(doc.situacao().name());
                entidade.setNsu(doc.nsu());
                entidade.setFonte(doc.fonte());
                entidade.setCaminhoXml(caminhoSalvo);
                entidade.setMotivoCancelamento(doc.motivoCancelamento());
                entidade.setDataGravacao(Instant.now());
            }

            documentoRepository.save(entidade);
            docsSalvos.add(doc);
        }

        // 2. Atualiza estado de esperas e NSU
        Instant proximaConsulta;
        if (resultado.acaoRecomendada() instanceof AcaoConsumo.Aguardar aguardar) {
            proximaConsulta = aguardar.ate();
        } else if (resultado.acaoRecomendada() instanceof AcaoConsumo.BuscarJa) {
            proximaConsulta = agora;
        } else {
            proximaConsulta = agora.plusSeconds(86400); // Parar -> aguarda 24h
        }

        estadoFonte.setUltNsu(Math.max(estadoFonte.getUltNsu(), resultado.ultNuNSURet()));
        estadoFonte.setProximaConsulta(proximaConsulta);
        estadoFonte.setUltimoCStat(resultado.cStat());
        estadoFonte.setUltimoMotivo(resultado.xMotivo());
        estadoFonte.setTentativasIguais(resultado.sucesso() ? 0 : estadoFonte.getTentativasIguais() + 1);
        estadoFonteRepository.save(estadoFonte);

        // 3. Registra execução
        String statusStr = resultado.sucesso() ? "SUCESSO" : (resultado.cStat() == 8002 ? "PENDENTE_VINCULO_SAT" : "ATENCAO");
        salvarExecucao(cnpjLimpo, fonteId, resultado.cStat(), resultado.xMotivo(), docsSalvos.size(), duracao, statusStr);

        // 4. Envia metadados à Central Contábil
        sincronizadorCentralService.sincronizarMetadados(docsSalvos);

        return new ResumoColeta(
                cnpjLimpo,
                fonteId,
                resultado.cStat(),
                resultado.xMotivo(),
                docsSalvos.size(),
                estadoFonte.getUltNsu(),
                proximaConsulta,
                duracao,
                statusStr
        );
    }

    private Credencial montarCredencial(EmpresaEntity empresa) {
        if (empresa.getCaminhoCertificado() != null && empresa.getSenhaCertificado() != null) {
            return Credencial.daEmpresa(
                    empresa.getCnpj(),
                    Paths.get(empresa.getCaminhoCertificado()),
                    empresa.getSenhaCertificado()
            );
        }
        // Fallback para certificado padrão do contador configurado em ambiente
        String envCertPath = System.getenv("NOTASYNC_CERT_PATH");
        String envCertSenha = System.getenv("NOTASYNC_CERT_SENHA");
        if (envCertPath != null && !envCertPath.isBlank()) {
            return Credencial.doContador(
                    empresa.getCnpj(),
                    Paths.get(envCertPath),
                    envCertSenha != null ? envCertSenha : ""
            );
        }
        return Credencial.doContador(empresa.getCnpj(), null, "");
    }

    private void salvarExecucao(String cnpj, String fonteId, int cStat, String motivo, int qtd, long duracaoMs, String status) {
        ExecucaoEntity exec = new ExecucaoEntity();
        exec.setDataHora(Instant.now());
        exec.setCnpj(cnpj);
        exec.setFonteId(fonteId);
        exec.setCStat(cStat);
        exec.setXMotivo(motivo);
        exec.setQtdDocumentos(qtd);
        exec.setDuracaoMs(duracaoMs);
        exec.setStatus(status);
        execucaoRepository.save(exec);
    }
}

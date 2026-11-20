package com.makerpixel.notasync.app.api;

import com.makerpixel.notasync.app.domain.DocumentoEntity;
import com.makerpixel.notasync.app.domain.EmpresaEntity;
import com.makerpixel.notasync.app.domain.ExecucaoEntity;
import com.makerpixel.notasync.app.repository.DocumentoRepository;
import com.makerpixel.notasync.app.repository.EmpresaRepository;
import com.makerpixel.notasync.app.repository.ExecucaoRepository;
import com.makerpixel.notasync.app.service.ColetorService;
import com.makerpixel.notasync.app.service.SincronizadorCentralService;
import com.makerpixel.notasync.app.service.XmlStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class AgenteApiController {

    private final EmpresaRepository empresaRepository;
    private final DocumentoRepository documentoRepository;
    private final ExecucaoRepository execucaoRepository;
    private final ColetorService coletorService;
    private final XmlStorageService xmlStorageService;
    private final SincronizadorCentralService sincronizadorCentralService;

    @Value("${notasync.modo:simulador}")
    private String modo;

    public AgenteApiController(
            EmpresaRepository empresaRepository,
            DocumentoRepository documentoRepository,
            ExecucaoRepository execucaoRepository,
            ColetorService coletorService,
            XmlStorageService xmlStorageService,
            SincronizadorCentralService sincronizadorCentralService
    ) {
        this.empresaRepository = empresaRepository;
        this.documentoRepository = documentoRepository;
        this.execucaoRepository = execucaoRepository;
        this.coletorService = coletorService;
        this.xmlStorageService = xmlStorageService;
        this.sincronizadorCentralService = sincronizadorCentralService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("agente", "NotaSync");
        resp.put("versao", "2.1.0");
        resp.put("status", "OPERACIONAL");
        resp.put("modo", modo);
        resp.put("empresasCadastradas", empresaRepository.count());
        resp.put("documentosArmazenados", documentoRepository.count());
        resp.put("diretorioXml", xmlStorageService.getDiretorioBase().toString());
        resp.put("acessoCentralBloqueado", sincronizadorCentralService.isAcessoBloqueado());
        resp.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/empresas")
    public ResponseEntity<List<EmpresaEntity>> listarEmpresas() {
        return ResponseEntity.ok(empresaRepository.findAll());
    }

    @PostMapping("/empresas")
    public ResponseEntity<EmpresaEntity> cadastrarEmpresa(@RequestBody EmpresaEntity dto) {
        if (dto.getCnpj() == null || dto.getCnpj().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String limpo = dto.getCnpj().replaceAll("\\D", "");
        EmpresaEntity salva = empresaRepository.findByCnpj(limpo)
                .map(existente -> {
                    if (dto.getNome() != null) existente.setNome(dto.getNome());
                    existente.setAtivo(dto.isAtivo());
                    if (dto.getFontesHabilitadas() != null) existente.setFontesHabilitadas(dto.getFontesHabilitadas());
                    return empresaRepository.save(existente);
                })
                .orElseGet(() -> {
                    dto.setCnpj(limpo);
                    return empresaRepository.save(dto);
                });
        return ResponseEntity.status(HttpStatus.CREATED).body(salva);
    }

    @GetMapping("/documentos")
    public ResponseEntity<List<DocumentoEntity>> listarDocumentos(
            @RequestParam(required = false) String cnpj,
            @RequestParam(required = false) String mes,
            @RequestParam(required = false) String modelo
    ) {
        String cnpjLimpo = (cnpj != null && !cnpj.isBlank()) ? cnpj.replaceAll("\\D", "") : null;
        String modLimpo = (modelo != null && !modelo.isBlank()) ? modelo.trim() : null;

        Instant inicio = null;
        Instant fim = null;

        if (mes != null && mes.matches("^\\d{4}-\\d{2}$")) {
            YearMonth ym = YearMonth.parse(mes, DateTimeFormatter.ofPattern("yyyy-MM"));
            ZoneId zone = ZoneId.of("America/Sao_Paulo");
            inicio = ym.atDay(1).atStartOfDay(zone).toInstant();
            fim = ym.atEndOfMonth().atTime(23, 59, 59, 999_000_000).atZone(zone).toInstant();
        }

        List<DocumentoEntity> lista = documentoRepository.pesquisarDocumentos(cnpjLimpo, modLimpo, inicio, fim);
        return ResponseEntity.ok(lista);
    }

    @GetMapping("/execucoes")
    public ResponseEntity<List<ExecucaoEntity>> listarExecucoes() {
        return ResponseEntity.ok(execucaoRepository.findTop50ByOrderByDataHoraDesc());
    }

    @PostMapping("/buscar-agora/{cnpj}")
    public ResponseEntity<?> buscarAgora(
            @PathVariable String cnpj,
            @RequestParam(defaultValue = "false") boolean forcar
    ) {
        String cnpjLimpo = cnpj.replaceAll("\\D", "");

        try {
            ColetorService.ResumoColeta resumo = coletorService.sincronizarEmpresa(cnpjLimpo, forcar);
            return ResponseEntity.ok(resumo);

        } catch (ColetorService.EsperaAtivaException e) {
            Instant permitido = e.getPermitidoAPartirDe();
            long esperaSegundos = Math.max(0, Duration.between(Instant.now(), permitido).toSeconds());

            Map<String, Object> err = new HashMap<>();
            err.put("erro", "Consulta antes do prazo regulamentar da SEF/SC");
            err.put("cnpj", cnpjLimpo);
            err.put("permitidoAPartirDe", permitido.toString());
            err.put("esperaSegundos", esperaSegundos);
            err.put("instrucao", "Aguarde a liberação da janela ou passe '?forcar=true' se estritamente necessário.");

            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(err);

        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("erro", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }
}

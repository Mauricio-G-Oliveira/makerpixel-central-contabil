package com.makerpixel.notasync.app.service;

import com.makerpixel.notasync.core.modelo.Documento;
import com.makerpixel.notasync.core.modelo.SituacaoDocumento;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Serviço responsável por gravar fisicamente os XMLs dos documentos fiscais em disco de forma organizada.
 * Estrutura:
 * xml-saida/{CNPJ}/{AAAA-MM}/{chave}.xml
 * xml-saida/{CNPJ}/{AAAA-MM}/eventos/{chave}_evento_{nsu}.xml
 */
@Service
public class XmlStorageService {

    private static final Logger log = LoggerFactory.getLogger(XmlStorageService.class);
    private static final DateTimeFormatter FORMATO_ANO_MES = DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneId.of("America/Sao_Paulo"));

    private final Path diretorioBase;

    public XmlStorageService(@Value("${notasync.saida:./xml-saida}") String saidaDir) {
        this.diretorioBase = Paths.get(saidaDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.diretorioBase);
        } catch (IOException e) {
            log.error("Não foi possível criar o diretório base de XMLs: {}", diretorioBase, e);
        }
    }

    public Path getDiretorioBase() {
        return diretorioBase;
    }

    /**
     * Grava o XML no disco e retorna o caminho salvo.
     */
    public String salvarXml(Documento doc, String xmlBruto) {
        if (doc == null || xmlBruto == null || xmlBruto.isBlank()) {
            return null;
        }

        try {
            String cnpj = doc.cnpjEmitente() != null ? doc.cnpjEmitente().replaceAll("\\D", "") : "00000000000000";
            String anoMes = FORMATO_ANO_MES.format(doc.dataEmissao() != null ? doc.dataEmissao() : java.time.Instant.now());

            Path pastaMes = diretorioBase.resolve(cnpj).resolve(anoMes);

            Path arquivoFinal;
            if (doc.situacao() == SituacaoDocumento.CANCELADA || xmlBruto.contains("procEventoNFe")) {
                Path pastaEventos = pastaMes.resolve("eventos");
                Files.createDirectories(pastaEventos);
                arquivoFinal = pastaEventos.resolve(doc.chave() + "_evento_" + doc.nsu() + ".xml");
            } else {
                Files.createDirectories(pastaMes);
                arquivoFinal = pastaMes.resolve(doc.chave() + ".xml");
            }

            Files.writeString(arquivoFinal, xmlBruto, StandardCharsets.UTF_8);
            return arquivoFinal.toString();

        } catch (Exception e) {
            log.error("Erro ao gravar arquivo XML em disco para a chave {}: {}", doc.chave(), e.getMessage());
            return null;
        }
    }
}

package com.makerpixel.notasync.app.service;

import com.makerpixel.notasync.core.modelo.Documento;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Serviço responsável por sincronizar metadados contábeis com a nuvem da Central Contábil.
 * Protegido contra bloqueios de licença (402/403): grava pendências em 'sync-pendente.json'
 * sem interromper a coleta nem o armazenamento local dos XMLs.
 */
@Service
public class SincronizadorCentralService {

    private static final Logger log = LoggerFactory.getLogger(SincronizadorCentralService.class);

    @Value("${notasync.central.url:http://localhost:8080/api/v1/notasync/lote}")
    private String centralUrl;

    @Value("${notasync.central.token:}")
    private String centralToken;

    private final Path arquivoPendencias = Paths.get("./data/sync-pendente.json");
    private boolean acessoBloqueado = false;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public boolean isAcessoBloqueado() {
        return acessoBloqueado;
    }

    public void sincronizarMetadados(List<Documento> documentos) {
        if (documentos == null || documentos.isEmpty()) {
            return;
        }

        if (centralToken == null || centralToken.isBlank()) {
            log.info("Token da Central Contábil não configurado. Gravando metadados em {}", arquivoPendencias);
            salvarEmPendencias(documentos);
            return;
        }

        if (acessoBloqueado) {
            log.warn("[ALERTA NOTASYNC] Envio suspenso: acesso vencido ou bloqueado na Central Contábil. Metadados salvos localmente.");
            salvarEmPendencias(documentos);
            return;
        }

        try {
            String payloadJson = montarPayloadJson(documentos);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(centralUrl))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("Authorization", "Bearer " + centralToken.trim())
                    .header("NOTASYNC_CENTRAL_TOKEN", centralToken.trim())
                    .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            int status = response.statusCode();

            if (status == 402 || status == 403) {
                acessoBloqueado = true;
                log.error("[ALERTA NOTASYNC] Acesso vencido ou módulo não contratado (HTTP {}) — contatar a MakerPixel.", status);
                salvarEmPendencias(documentos);
            } else if (status >= 200 && status < 300) {
                log.info("Metadados de {} documento(s) sincronizados com a Central Contábil com sucesso.", documentos.size());
            } else {
                log.warn("Central Contábil retornou status HTTP {}. Salvando em fila pendente local.", status);
                salvarEmPendencias(documentos);
            }

        } catch (Exception e) {
            log.warn("Não foi possível conectar à Central Contábil ({}). Salvando metadados localmente.", e.getMessage());
            salvarEmPendencias(documentos);
        }
    }

    private synchronized void salvarEmPendencias(List<Documento> documentos) {
        try {
            if (arquivoPendencias.getParent() != null) {
                Files.createDirectories(arquivoPendencias.getParent());
            }

            List<String> linhas = new ArrayList<>();
            for (Documento doc : documentos) {
                linhas.add(String.format("{\"chave\":\"%s\",\"modelo\":\"%s\",\"cnpj\":\"%s\",\"valor\":%s,\"situacao\":\"%s\",\"nsu\":%d}",
                        doc.chave(),
                        doc.modelo().getCodigo(),
                        doc.cnpjEmitente(),
                        doc.valorTotal() != null ? doc.valorTotal().toPlainString() : "0.00",
                        doc.situacao().name(),
                        doc.nsu()));
            }

            String conteudo = "[\n  " + String.join(",\n  ", linhas) + "\n]\n";
            Files.writeString(arquivoPendencias, conteudo, StandardCharsets.UTF_8);

        } catch (IOException e) {
            log.error("Erro ao salvar pendências em disco: {}", e.getMessage());
        }
    }

    private String montarPayloadJson(List<Documento> documentos) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"documentos\":[");
        for (int i = 0; i < documentos.size(); i++) {
            Documento d = documentos.get(i);
            if (i > 0) sb.append(",");
            sb.append(String.format("{\"chave\":\"%s\",\"modelo\":\"%s\",\"cnpjEmitente\":\"%s\",\"dataEmissao\":\"%s\",\"valorTotal\":%s,\"situacao\":\"%s\",\"nsu\":%d}",
                    d.chave(),
                    d.modelo().getCodigo(),
                    d.cnpjEmitente(),
                    d.dataEmissao() != null ? d.dataEmissao().toString() : "",
                    d.valorTotal() != null ? d.valorTotal().toPlainString() : "0.00",
                    d.situacao().name(),
                    d.nsu()));
        }
        sb.append("]}");
        return sb.toString();
    }
}

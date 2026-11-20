package com.makerpixel.notasync.simulador.controller;

import com.makerpixel.notasync.core.codec.LoteCodec;
import com.makerpixel.notasync.core.modelo.Documento;
import com.makerpixel.notasync.simulador.cenario.GeradorCenarios;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Controller que emula fielmente o endpoint SOAP da SEF/SC (DistribuicaoNfceDownload.asmx).
 */
@RestController
public class SimuladorSefScController {

    private final GeradorCenarios geradorCenarios;
    private final LoteCodec loteCodec = new LoteCodec();

    private Integer cenarioForcado = null;
    private int contadorConsultas = 0;

    public SimuladorSefScController(GeradorCenarios geradorCenarios) {
        this.geradorCenarios = geradorCenarios;
    }

    @PostMapping(
            value = {
                    "/nfce/ws/distribuicao/DistribuicaoNfceDownload.asmx",
                    "/simulador/soap"
            },
            consumes = {MediaType.ALL_VALUE},
            produces = {"application/soap+xml; charset=utf-8", "text/xml; charset=utf-8"}
    )
    public String processarDownloadSoap(@RequestBody(required = false) String corpoSoap) throws Exception {
        contadorConsultas++;

        String cnpj = extrairTagRegex(corpoSoap, "CNPJ");
        if (cnpj == null || cnpj.isBlank()) {
            cnpj = "11222333000181";
        }
        cnpj = cnpj.replaceAll("\\D", "");

        String nsuStr = extrairTagRegex(corpoSoap, "ultNuNSU");
        long ultNuNSU = (nsuStr != null && !nsuStr.isBlank()) ? Long.parseLong(nsuStr) : 0L;

        // 1. Cenário forçado manualmente via API do simulador
        if (cenarioForcado != null) {
            return gerarEnvelopeRetorno(cenarioForcado, "Cenário simulado: " + cenarioForcado, ultNuNSU, 0, "");
        }

        // 2. CNPJ sem vínculo no SAT (retorna 8002)
        if (GeradorCenarios.CNPJ_SEM_VINCULO_SAT.equals(cnpj)) {
            return gerarEnvelopeRetorno(
                    8002,
                    "Contador transmissor não consta como Contabilista Vinculado no SAT da SEF/SC",
                    ultNuNSU,
                    0,
                    ""
            );
        }

        // 3. Regras de distribuição normais por CNPJ
        int qtDfeRet = 0;
        long novoUltNsu = ultNuNSU;
        List<Documento> docs;

        if ("11222333000181".equals(cnpj)) {
            if (ultNuNSU == 0) {
                // Primeiro lote cheio de 50 notas
                docs = geradorCenarios.gerarLote(cnpj, 1L, 50);
                qtDfeRet = 50;
                novoUltNsu = 50L;
            } else if (ultNuNSU == 50) {
                // Segundo lote parcial de 20 notas
                docs = geradorCenarios.gerarLote(cnpj, 51L, 20);
                qtDfeRet = 20;
                novoUltNsu = 70L;
            } else {
                // Sincronizado
                return gerarEnvelopeRetorno(117, "Fim do lote de notas para este CNPJ", ultNuNSU, 0, "");
            }
        } else if ("44555666000177".equals(cnpj)) {
            if (ultNuNSU == 0) {
                docs = geradorCenarios.gerarLote(cnpj, 1L, 35);
                qtDfeRet = 35;
                novoUltNsu = 35L;
            } else {
                return gerarEnvelopeRetorno(117, "Fim do lote de notas para este CNPJ", ultNuNSU, 0, "");
            }
        } else if ("77888999000155".equals(cnpj)) {
            if (ultNuNSU == 0) {
                docs = geradorCenarios.gerarLote(cnpj, 1L, 15);
                qtDfeRet = 15;
                novoUltNsu = 15L;
            } else {
                return gerarEnvelopeRetorno(117, "Fim do lote de notas para este CNPJ", ultNuNSU, 0, "");
            }
        } else {
            // Empresa avulsa
            if (ultNuNSU == 0) {
                docs = geradorCenarios.gerarLote(cnpj, 1L, 10);
                qtDfeRet = 10;
                novoUltNsu = 10L;
            } else {
                return gerarEnvelopeRetorno(117, "Fim do lote de notas para este CNPJ", ultNuNSU, 0, "");
            }
        }

        String loteDistComp = loteCodec.empacotarLote(docs);
        return gerarEnvelopeRetorno(118, "Lote de documentos localizado com sucesso", novoUltNsu, qtDfeRet, loteDistComp);
    }

    @GetMapping("/simulador/status")
    public Map<String, Object> status() {
        Map<String, Object> res = new HashMap<>();
        res.put("status", "ONLINE");
        res.put("porta", 8089);
        res.put("consultasRecebidas", contadorConsultas);
        res.put("cenarioForcado", cenarioForcado);
        return res;
    }

    @PostMapping("/simulador/cenario/{cenario}")
    public Map<String, Object> forcarCenario(@PathVariable int cenario) {
        this.cenarioForcado = (cenario == 0) ? null : cenario;
        return Map.of("cenarioForcado", cenarioForcado != null ? cenarioForcado : "NENHUM");
    }

    @PostMapping("/simulador/reset")
    public Map<String, Object> reset() {
        this.cenarioForcado = null;
        this.contadorConsultas = 0;
        return Map.of("mensagem", "Simulador reiniciado com sucesso");
    }

    private String gerarEnvelopeRetorno(int cStat, String xMotivo, long ultNuNSURet, int qtDfeRet, String loteDistComp) {
        String dhResp = Instant.now().toString();
        String tagLote = (loteDistComp != null && !loteDistComp.isBlank())
                ? "<loteDistComp>" + loteDistComp + "</loteDistComp>"
                : "";

        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<soap12:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap12=\"http://www.w3.org/2003/05/soap-envelope\">"
                + "<soap12:Body>"
                + "<retDistNFCeSC xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">"
                + "<cStat>" + cStat + "</cStat>"
                + "<xMotivo>" + xMotivo + "</xMotivo>"
                + "<dhResp>" + dhResp + "</dhResp>"
                + "<ultNuNSURet>" + ultNuNSURet + "</ultNuNSURet>"
                + "<qtDfeRet>" + qtDfeRet + "</qtDfeRet>"
                + tagLote
                + "</retDistNFCeSC>"
                + "</soap12:Body>"
                + "</soap12:Envelope>";
    }

    private String extrairTagRegex(String xml, String tag) {
        if (xml == null) return null;
        Pattern p = Pattern.compile("<(?:[a-zA-Z0-9]+:)?" + tag + "[^>]*>([^<]+)</(?:[a-zA-Z0-9]+:)?" + tag + ">");
        Matcher m = p.matcher(xml);
        if (m.find()) {
            return m.group(1).trim();
        }
        return null;
    }
}

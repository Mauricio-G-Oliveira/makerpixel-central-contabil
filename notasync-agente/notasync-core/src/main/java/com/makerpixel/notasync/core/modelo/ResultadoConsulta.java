package com.makerpixel.notasync.core.modelo;

import java.util.List;

/**
 * Resultado completo obtido após uma consulta a uma fonte de notas fiscais.
 */
public record ResultadoConsulta(
        int cStat,
        String xMotivo,
        long ultNuNSURet,
        int qtDfeRet,
        List<Documento> documentos,
        List<String> xmlsBrutos,
        AcaoConsumo acaoRecomendada
) {

    public ResultadoConsulta {
        documentos = documentos != null ? List.copyOf(documentos) : List.of();
        xmlsBrutos = xmlsBrutos != null ? List.copyOf(xmlsBrutos) : List.of();
    }

    public boolean sucesso() {
        return cStat == 118 || cStat == 117;
    }
}

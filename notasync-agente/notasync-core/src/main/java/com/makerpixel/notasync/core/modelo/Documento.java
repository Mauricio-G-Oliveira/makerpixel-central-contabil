package com.makerpixel.notasync.core.modelo;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Record que representa um documento fiscal processado pelo agente NotaSync.
 */
public record Documento(
        String chave,
        ModeloDocumento modelo,
        String cnpjEmitente,
        Instant dataEmissao,
        BigDecimal valorTotal,
        SituacaoDocumento situacao,
        long nsu,
        String fonte,
        String caminhoXml,
        String motivoCancelamento
) {

    public Documento withSituacaoCancelada(String motivo, String novoCaminhoXml) {
        return new Documento(
                chave,
                modelo,
                cnpjEmitente,
                dataEmissao,
                valorTotal,
                SituacaoDocumento.CANCELADA,
                nsu,
                fonte,
                novoCaminhoXml != null ? novoCaminhoXml : caminhoXml,
                motivo != null ? motivo : "Cancelada na SEF/SC"
        );
    }
}

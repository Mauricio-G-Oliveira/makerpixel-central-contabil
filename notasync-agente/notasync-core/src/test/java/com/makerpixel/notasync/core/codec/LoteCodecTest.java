package com.makerpixel.notasync.core.codec;

import com.makerpixel.notasync.core.modelo.ChaveAcesso;
import com.makerpixel.notasync.core.modelo.Documento;
import com.makerpixel.notasync.core.modelo.ModeloDocumento;
import com.makerpixel.notasync.core.modelo.SituacaoDocumento;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LoteCodecTest {

    private final LoteCodec codec = new LoteCodec();

    @Test
    @DisplayName("Deve empacotar documentos em gzip + base64 e desempacotar perfeitamente")
    void deveEmpacotarEDesempacotarLoteComSucesso() throws Exception {
        String raiz1 = "4226111122233300018165001000000001110000001";
        String ch1 = raiz1 + ChaveAcesso.calcularDv(raiz1);

        String raiz2 = "4226111122233300018165001000000002110000002";
        String ch2 = raiz2 + ChaveAcesso.calcularDv(raiz2);

        Documento doc1 = new Documento(
                ch1,
                ModeloDocumento.NFCE_65,
                "11222333000181",
                Instant.parse("2026-11-17T10:00:00Z"),
                new BigDecimal("150.75"),
                SituacaoDocumento.AUTORIZADA,
                1001L,
                "sef-sc-nfce",
                null,
                null
        );

        Documento doc2 = new Documento(
                ch2,
                ModeloDocumento.NFCE_65,
                "11222333000181",
                Instant.parse("2026-11-17T11:30:00Z"),
                new BigDecimal("49.90"),
                SituacaoDocumento.CANCELADA,
                1002L,
                "sef-sc-nfce",
                null,
                "Cancelamento homologado"
        );

        // Empacota em gzip + base64
        String base64Gzip = codec.empacotarLote(List.of(doc1, doc2));
        assertThat(base64Gzip).isNotBlank();

        // Desempacota
        List<LoteCodec.ItemLote> itens = codec.desempacotarLote(base64Gzip, "sef-sc-nfce");

        assertThat(itens).hasSize(2);

        Documento d1 = itens.get(0).documento();
        assertThat(d1.chave()).isEqualTo(ch1);
        assertThat(d1.nsu()).isEqualTo(1001L);
        assertThat(d1.valorTotal()).isEqualByComparingTo("150.75");
        assertThat(d1.situacao()).isEqualTo(SituacaoDocumento.AUTORIZADA);
        assertThat(itens.get(0).xmlBruto()).contains(ch1);

        Documento d2 = itens.get(1).documento();
        assertThat(d2.chave()).isEqualTo(ch2);
        assertThat(d2.nsu()).isEqualTo(1002L);
        assertThat(d2.situacao()).isEqualTo(SituacaoDocumento.CANCELADA);
        assertThat(itens.get(1).xmlBruto()).contains("110111");
    }

    @Test
    @DisplayName("Deve retornar lista vazia para base64 nulo ou em branco")
    void deveRetornarVazioParaEntradaNulaOuBranca() throws Exception {
        assertThat(codec.desempacotarLote(null, "sef-sc-nfce")).isEmpty();
        assertThat(codec.desempacotarLote("", "sef-sc-nfce")).isEmpty();
        assertThat(codec.desempacotarLote("   ", "sef-sc-nfce")).isEmpty();
    }
}

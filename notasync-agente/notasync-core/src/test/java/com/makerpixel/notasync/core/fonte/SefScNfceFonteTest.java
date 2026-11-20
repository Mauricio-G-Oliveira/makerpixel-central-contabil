package com.makerpixel.notasync.core.fonte;

import com.makerpixel.notasync.core.codec.LoteCodec;
import com.makerpixel.notasync.core.modelo.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SefScNfceFonteTest {

    private final SefScNfceFonte fonte = new SefScNfceFonte();
    private final LoteCodec loteCodec = new LoteCodec();

    @Test
    @DisplayName("Metadados da fonte SEF/SC NFC-e devem estar corretos")
    void deveConferirMetadadosDaFonte() {
        assertThat(fonte.id()).isEqualTo("sef-sc-nfce");
        assertThat(fonte.modelos()).containsExactly(ModeloDocumento.NFCE_65);
        assertThat(fonte.certificadoExigido()).isEqualTo(TipoCertificado.CONTADOR);
    }

    @Test
    @DisplayName("Deve gerar o envelope SOAP 1.2 oficial sem prefixos na tag distNFCeSC e com namespace satnfce")
    void deveMontarEnvelopeSoapCorretamente() {
        EstadoEmpresa estado = new EstadoEmpresa("11222333000181", 450L, Instant.now(), 0, 0);
        Credencial cred = Credencial.doContador("00011122233", null, null);

        String envelope = fonte.montarEnvelopeDistNfce(estado, cred);

        assertThat(envelope).contains("soap12:Envelope");
        assertThat(envelope).contains("<nfceDownloadContab xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">");
        assertThat(envelope).contains("<distNFCeSC versao=\"1.00\" xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">");
        assertThat(envelope).contains("<cUF>42</cUF>");
        assertThat(envelope).contains("<CNPJ>11222333000181</CNPJ>");
        assertThat(envelope).contains("<ultNuNSU>450</ultNuNSU>");
    }

    @Test
    @DisplayName("Deve processar resposta SOAP com loteDistComp e converter em ResultadoConsulta")
    void deveProcessarRespostaSoapComSucesso() throws Exception {
        String raiz1 = "4226111122233300018165001000000001110000001";
        String ch1 = raiz1 + ChaveAcesso.calcularDv(raiz1);

        Documento doc = new Documento(
                ch1,
                ModeloDocumento.NFCE_65,
                "11222333000181",
                Instant.parse("2026-11-17T10:00:00Z"),
                new BigDecimal("99.50"),
                SituacaoDocumento.AUTORIZADA,
                500L,
                "sef-sc-nfce",
                null,
                null
        );

        String loteBase64 = loteCodec.empacotarLote(List.of(doc));

        String soapXml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<soap12:Envelope xmlns:soap12=\"http://www.w3.org/2003/05/soap-envelope\">"
                + "<soap12:Body>"
                + "<retDistNFCeSC xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">"
                + "<cStat>118</cStat>"
                + "<xMotivo>Lote de documentos localizado com sucesso</xMotivo>"
                + "<ultNuNSURet>500</ultNuNSURet>"
                + "<qtDfeRet>1</qtDfeRet>"
                + "<loteDistComp>" + loteBase64 + "</loteDistComp>"
                + "</retDistNFCeSC>"
                + "</soap12:Body>"
                + "</soap12:Envelope>";

        EstadoEmpresa estado = new EstadoEmpresa("11222333000181", 450L, Instant.now(), 0, 0);
        ResultadoConsulta resultado = fonte.processarRespostaSoap(soapXml, estado);

        assertThat(resultado.cStat()).isEqualTo(118);
        assertThat(resultado.ultNuNSURet()).isEqualTo(500L);
        assertThat(resultado.qtDfeRet()).isEqualTo(1);
        assertThat(resultado.documentos()).hasSize(1);
        assertThat(resultado.documentos().get(0).chave()).isEqualTo(ch1);
        assertThat(resultado.acaoRecomendada()).isInstanceOf(AcaoConsumo.Aguardar.class); // 1 < 50 docs -> aguardar 12h
    }
}

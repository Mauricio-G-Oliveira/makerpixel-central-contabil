package com.makerpixel.notasync.simulador.controller;

import com.makerpixel.notasync.simulador.cenario.GeradorCenarios;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SimuladorSefScControllerTest {

    private final GeradorCenarios gerador = new GeradorCenarios();
    private final SimuladorSefScController controller = new SimuladorSefScController(gerador);

    @Test
    @DisplayName("Cenário 8002: CNPJ sem vínculo no SAT deve retornar cStat 8002")
    void deveRetornarCStat8002ParaCnpjSemVinculo() throws Exception {
        String soapEnvelope = "<soap12:Envelope><soap12:Body><nfceDownloadContab><nfceDadosMsg>"
                + "<distNFCeSC><CNPJ>" + GeradorCenarios.CNPJ_SEM_VINCULO_SAT + "</CNPJ><ultNuNSU>0</ultNuNSU></distNFCeSC>"
                + "</nfceDadosMsg></nfceDownloadContab></soap12:Body></soap12:Envelope>";

        String resposta = controller.processarDownloadSoap(soapEnvelope);

        assertThat(resposta).contains("<cStat>8002</cStat>");
        assertThat(resposta).contains("Contabilista Vinculado no SAT da SEF/SC");
    }

    @Test
    @DisplayName("Cenário 110: Uso indevido deve retornar cStat 110")
    void deveRetornarCStat110ParaUsoIndevido() throws Exception {
        String soapEnvelope = "<soap12:Envelope><soap12:Body><nfceDownloadContab><nfceDadosMsg>"
                + "<distNFCeSC><CNPJ>" + GeradorCenarios.CNPJ_USO_INDEVIDO_110 + "</CNPJ><ultNuNSU>0</ultNuNSU></distNFCeSC>"
                + "</nfceDadosMsg></nfceDownloadContab></soap12:Body></soap12:Envelope>";

        String resposta = controller.processarDownloadSoap(soapEnvelope);

        assertThat(resposta).contains("<cStat>110</cStat>");
        assertThat(resposta).contains("Uso indevido");
    }

    @Test
    @DisplayName("Cenário 657: Bloqueio por excesso deve retornar cStat 657")
    void deveRetornarCStat657ParaBloqueioExcesso() throws Exception {
        String soapEnvelope = "<soap12:Envelope><soap12:Body><nfceDownloadContab><nfceDadosMsg>"
                + "<distNFCeSC><CNPJ>" + GeradorCenarios.CNPJ_BLOQUEIO_657 + "</CNPJ><ultNuNSU>0</ultNuNSU></distNFCeSC>"
                + "</nfceDadosMsg></nfceDownloadContab></soap12:Body></soap12:Envelope>";

        String resposta = controller.processarDownloadSoap(soapEnvelope);

        assertThat(resposta).contains("<cStat>657</cStat>");
        assertThat(resposta).contains("Bloqueio temporário por excesso");
    }

    @Test
    @DisplayName("Cenário 117: Empresa sincronizada sem notas novas deve retornar cStat 117")
    void deveRetornarCStat117ParaEmpresaSemNotas() throws Exception {
        String soapEnvelope = "<soap12:Envelope><soap12:Body><nfceDownloadContab><nfceDadosMsg>"
                + "<distNFCeSC><CNPJ>" + GeradorCenarios.CNPJ_SEM_NOTAS_117 + "</CNPJ><ultNuNSU>0</ultNuNSU></distNFCeSC>"
                + "</nfceDadosMsg></nfceDownloadContab></soap12:Body></soap12:Envelope>";

        String resposta = controller.processarDownloadSoap(soapEnvelope);

        assertThat(resposta).contains("<cStat>117</cStat>");
    }

    @Test
    @DisplayName("Cenário 118: Primeiro lote com 50 notas e loteDistComp compactado")
    void deveRetornarLoteCom50NotasParaPrimeiraBusca() throws Exception {
        String soapEnvelope = "<soap12:Envelope><soap12:Body><nfceDownloadContab><nfceDadosMsg>"
                + "<distNFCeSC><CNPJ>11222333000181</CNPJ><ultNuNSU>0</ultNuNSU></distNFCeSC>"
                + "</nfceDadosMsg></nfceDownloadContab></soap12:Body></soap12:Envelope>";

        String resposta = controller.processarDownloadSoap(soapEnvelope);

        assertThat(resposta).contains("<cStat>118</cStat>");
        assertThat(resposta).contains("<qtDfeRet>50</qtDfeRet>");
        assertThat(resposta).contains("<ultNuNSURet>50</ultNuNSURet>");
        assertThat(resposta).contains("<loteDistComp>");
    }

    @Test
    @DisplayName("Status do simulador deve reportar porta 8089 e estado ONLINE")
    void deveReportarStatusCorretamente() {
        var status = controller.status();
        assertThat(status.get("status")).isEqualTo("ONLINE");
        assertThat(status.get("porta")).isEqualTo(8089);
    }
}

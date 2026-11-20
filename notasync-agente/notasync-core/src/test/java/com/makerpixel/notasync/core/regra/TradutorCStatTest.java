package com.makerpixel.notasync.core.regra;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class TradutorCStatTest {

    @ParameterizedTest
    @CsvSource({
            "108, SEF fora do ar, Tentar mais tarde",
            "109, SEF fora do ar, Tentar mais tarde",
            "110, Reprocessamento / uso indevido, Aguardar 1 hora",
            "116, Chave não encontrada ou fora do prazo, Conferir a chave e o período",
            "117, Nenhuma nota nova, Próxima busca em 12 horas",
            "118, Notas encontradas, —",
            "252, Ambiente errado, Conferir tpAmb",
            "280, Problema no certificado (inválido), Trocar ou renovar",
            "281, Problema no certificado (vencido), Renovar o certificado",
            "657, Bloqueio por excesso de consultas, Aguardar de 1 a 12 horas",
            "8002, Contador não é contabilista desse CNPJ no SAT, Vincular o CPF do contador no SAT da SEF/SC",
            "9999, Erro na SEF, Tentar mais tarde"
    })
    @DisplayName("Deve traduzir códigos cStat oficiais da SEF/SC com precisão")
    void deveTraduzirCodigosOficiais(int cStat, String textoEsperado, String acaoEsperada) {
        TradutorCStat.Traducao traducao = TradutorCStat.traduzir(cStat, "");

        assertThat(traducao.cStat()).isEqualTo(cStat);
        assertThat(traducao.paraUsuario()).containsIgnoringCase(textoEsperado);
        assertThat(traducao.acao()).containsIgnoringCase(acaoEsperada);
    }

    @Test
    @DisplayName("Erro 8002 deve possuir destaque=true para ação no portal SAT")
    void deveDestacarErro8002() {
        TradutorCStat.Traducao t = TradutorCStat.traduzir(8002, "Transmissor sem vínculo");
        assertThat(t.destaque()).isTrue();
        assertThat(t.severidade()).isEqualTo(TradutorCStat.Severidade.ATENCAO);
    }

    @Test
    @DisplayName("Códigos de erro de schema 214 a 238 devem indicar bug do agente")
    void deveTratarErrosDeSchema() {
        TradutorCStat.Traducao t = TradutorCStat.traduzir(225, "Falha de Schema XML");
        assertThat(t.paraUsuario()).contains("Erro de formato");
        assertThat(t.acao()).contains("Bug do agente");
    }
}

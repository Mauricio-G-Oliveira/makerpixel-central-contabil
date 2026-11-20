package com.makerpixel.notasync.core.modelo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChaveAcessoTest {

    // Raiz fictícia: UF 42 (SC), AAMM 2611, CNPJ 11222333000181, Mod 65, Série 001, Num 000000001, tpEmis 1, cNF 10000001
    // Raiz de 43 dígitos para cálculo
    private static final String RAIZ_43 = "4226111122233300018165001000000001110000001";

    @Test
    @DisplayName("Deve validar cálculo de DV pelo Módulo 11 com pesos de 2 a 9")
    void deveCalcularDvModulo11Corretamente() {
        int dv = ChaveAcesso.calcularDv(RAIZ_43);
        assertThat(dv).isBetween(0, 9);

        String chaveCompleta = RAIZ_43 + dv;
        assertThat(ChaveAcesso.isValida(chaveCompleta)).isTrue();
    }

    @Test
    @DisplayName("Deve rejeitar chaves com DV incorreto ou tamanho diferente de 44")
    void deveRejeitarChaveInvalida() {
        int dv = ChaveAcesso.calcularDv(RAIZ_43);
        int dvIncorreto = (dv + 1) % 10;
        String chaveComDvInvalido = RAIZ_43 + dvIncorreto;

        assertThat(ChaveAcesso.isValida(chaveComDvInvalido)).isFalse();
        assertThat(ChaveAcesso.isValida(null)).isFalse();
        assertThat(ChaveAcesso.isValida("")).isFalse();
        assertThat(ChaveAcesso.isValida("12345")).isFalse();
        assertThat(ChaveAcesso.isValida(RAIZ_43)).isFalse(); // 43 dígitos
    }

    @Test
    @DisplayName("Deve extrair com precisão os metadados da chave de acesso")
    void deveDecomporChaveDeAcesso() {
        int dv = ChaveAcesso.calcularDv(RAIZ_43);
        String chaveCompleta = RAIZ_43 + dv;

        ChaveAcesso parsed = ChaveAcesso.parse(chaveCompleta);

        assertThat(parsed.cUf()).isEqualTo("42");
        assertThat(parsed.anoMes()).isEqualTo("2611");
        assertThat(parsed.cnpjEmitente()).isEqualTo("11222333000181");
        assertThat(parsed.modelo()).isEqualTo(ModeloDocumento.NFCE_65);
        assertThat(parsed.serie()).isEqualTo(1);
        assertThat(parsed.numero()).isEqualTo(1L);
        assertThat(parsed.tpEmis()).isEqualTo("1");
        assertThat(parsed.codigoNumerico()).isEqualTo("10000001");
        assertThat(parsed.cDv()).isEqualTo(dv);
    }

    @Test
    @DisplayName("Deve formatar a chave de 44 dígitos em blocos legíveis de 4 caracteres")
    void deveFormatarChaveLegivel() {
        int dv = ChaveAcesso.calcularDv(RAIZ_43);
        String chaveCompleta = RAIZ_43 + dv;

        ChaveAcesso parsed = ChaveAcesso.parse(chaveCompleta);
        String formatada = parsed.formatada();

        assertThat(formatada).startsWith("4226 1111 2223");
        assertThat(formatada.split(" ")).hasSize(11);
    }

    @Test
    @DisplayName("Deve lançar exceção ao instanciar record ChaveAcesso com valor inválido")
    void deveLancarExcecaoParaChaveInvalida() {
        assertThatThrownBy(() -> ChaveAcesso.parse("42000000000000000000000000000000000000000000"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

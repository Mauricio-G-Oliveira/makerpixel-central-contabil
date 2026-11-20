package com.makerpixel.notasync.core.modelo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class DvTest {

    @ParameterizedTest
    @CsvSource({
            "4226111122233300018165001000000001110000001",
            "4226114455566600017765001000000002110000002",
            "4226117788899900015565001000000003110000003",
            "4226111234567800019565001000000004110000004"
    })
    @DisplayName("Deve calcular dígito verificador consistente e aceitar a chave gerada")
    void deveCalcularDvsValidos(String raiz43) {
        int dv = ChaveAcesso.calcularDv(raiz43);
        assertThat(dv).isBetween(0, 9);

        String chaveCompleta = raiz43 + dv;
        assertThat(ChaveAcesso.isValida(chaveCompleta)).isTrue();
    }

    @Test
    @DisplayName("Deve retornar 0 para entradas nulas ou com tamanho inválido")
    void deveRetornarZeroParaEntradaInvalida() {
        assertThat(ChaveAcesso.calcularDv(null)).isZero();
        assertThat(ChaveAcesso.calcularDv("")).isZero();
        assertThat(ChaveAcesso.calcularDv("123")).isZero();
    }
}

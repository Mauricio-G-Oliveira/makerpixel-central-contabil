package com.makerpixel.notasync.core.regra;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class PeriodoDisponivelTest {

    private final Instant agora = Instant.parse("2026-11-20T12:00:00Z");

    @Test
    @DisplayName("Notas do mês atual (Nov/2026) devem ser válidas")
    void deveAceitarMesAtual() {
        Instant dataMesAtual = Instant.parse("2026-11-05T14:30:00Z");
        assertThat(PeriodoDisponivel.isDisponivel(dataMesAtual, agora)).isTrue();
    }

    @Test
    @DisplayName("Notas de 1 mês atrás (Out/2026) devem ser válidas")
    void deveAceitarUmMesAtras() {
        Instant dataOutubro = Instant.parse("2026-10-15T09:00:00Z");
        assertThat(PeriodoDisponivel.isDisponivel(dataOutubro, agora)).isTrue();
    }

    @Test
    @DisplayName("Notas de 2 meses atrás (Set/2026) devem ser válidas (início do mês)")
    void deveAceitarDoisMesesAtras() {
        Instant dataSetembro = Instant.parse("2026-09-01T04:00:00Z");
        assertThat(PeriodoDisponivel.isDisponivel(dataSetembro, agora)).isTrue();
    }

    @Test
    @DisplayName("Notas de 3 meses atrás (Ago/2026) devem ser rejeitadas como expiradas na SEF/SC")
    void deveRejeitarTresMesesAtras() {
        Instant dataAgosto = Instant.parse("2026-08-31T23:59:59Z");
        PeriodoDisponivel.Resultado res = PeriodoDisponivel.validar(dataAgosto, agora);
        assertThat(res.disponivel()).isFalse();
        assertThat(res.motivo()).contains("apenas mês atual e 2 anteriores");
    }

    @Test
    @DisplayName("Tolerância de 1 dia para notas com emissão ligeiramente adiantada (fuso/relógio)")
    void deveAplicarToleranciaDeUmDiaFuturo() {
        // 12 horas no futuro (dentro de 1 dia): aceita
        Instant futuro12h = agora.plus(12, ChronoUnit.HOURS);
        assertThat(PeriodoDisponivel.isDisponivel(futuro12h, agora)).isTrue();

        // 3 dias no futuro: rejeita
        Instant futuro3d = agora.plus(3, ChronoUnit.DAYS);
        PeriodoDisponivel.Resultado res = PeriodoDisponivel.validar(futuro3d, agora);
        assertThat(res.disponivel()).isFalse();
        assertThat(res.motivo()).contains("além da tolerância máxima permitida de 1 dia");
    }
}

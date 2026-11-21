package com.makerpixel.notasync.core.regra;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/**
 * Validação da janela de retenção regulamentar da SEF/SC (Boletim Técnico 2026/003):
 * Ficam disponíveis para download o mês atual e os 2 meses anteriores, com até 1 dia de tolerância.
 */
public class PeriodoDisponivel {

    public static final ZoneId FUSO_SC = ZoneId.of("America/Sao_Paulo");

    public record Resultado(boolean disponivel, String motivo) {}

    public static Resultado validar(Instant dataEmissao, Instant agora) {
        if (dataEmissao == null) {
            return new Resultado(false, "Data de emissão não informada");
        }
        if (agora == null) {
            agora = Instant.now();
        }

        // Tolerância futura de 1 dia (atraso de relógio/emissão)
        Instant limiteFuturo = agora.plus(1, ChronoUnit.DAYS);
        if (dataEmissao.isAfter(limiteFuturo)) {
            return new Resultado(false, "Data de emissão além da tolerância máxima permitida de 1 dia");
        }

        LocalDate dataDoc = dataEmissao.atZone(FUSO_SC).toLocalDate();
        LocalDate dataRef = agora.atZone(FUSO_SC).toLocalDate();

        // Primeiro dia do segundo mês anterior ao mês de referência
        LocalDate inicioJanela = dataRef.withDayOfMonth(1).minusMonths(2);

        if (dataDoc.isBefore(inicioJanela)) {
            return new Resultado(false, "Documento anterior à janela disponível na SEF/SC (apenas mês atual e 2 anteriores)");
        }

        return new Resultado(true, "Dentro da janela regulamentar SEF/SC");
    }

    public static boolean isDisponivel(Instant dataEmissao, Instant agora) {
        return validar(dataEmissao, agora).disponivel();
    }
}

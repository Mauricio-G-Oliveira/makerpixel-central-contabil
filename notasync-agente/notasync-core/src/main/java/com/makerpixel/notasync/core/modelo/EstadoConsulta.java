package com.makerpixel.notasync.core.modelo;

import java.time.Instant;

/**
 * Estado atual da consulta e controle de NSU / janelas de consumo perante uma fonte fiscal.
 * Em conformidade com a especificação Central Contábil v3 Fase 2.
 */
public record EstadoConsulta(
        String cnpj,
        long ultNsu,
        Instant proximaConsultaPermitida,
        int tentativasIguais,
        int ultimoCStat
) {

    public static EstadoConsulta inicial(String cnpj) {
        return new EstadoConsulta(cnpj, 0L, Instant.EPOCH, 0, 0);
    }

    public EstadoConsulta withUltNsu(long novoUltNsu) {
        return new EstadoConsulta(cnpj, Math.max(this.ultNsu, novoUltNsu), proximaConsultaPermitida, tentativasIguais, ultimoCStat);
    }

    public EstadoConsulta withConsulta(Instant proximaConsulta, int cStat, boolean incrementarTentativas) {
        int novasTentativas = incrementarTentativas ? (this.tentativasIguais + 1) : 0;
        return new EstadoConsulta(cnpj, ultNsu, proximaConsulta, novasTentativas, cStat);
    }

    public boolean podeConsultarEm(Instant agora) {
        return proximaConsultaPermitida == null || !agora.isBefore(proximaConsultaPermitida);
    }

    public EstadoEmpresa toEstadoEmpresa() {
        return new EstadoEmpresa(cnpj, ultNsu, proximaConsultaPermitida, tentativasIguais, ultimoCStat);
    }

    public static EstadoConsulta fromEstadoEmpresa(EstadoEmpresa ee) {
        if (ee == null) return null;
        return new EstadoConsulta(ee.cnpj(), ee.ultNsu(), ee.proximaConsultaPermitida(), ee.tentativasIguais(), ee.ultimoCStat());
    }
}

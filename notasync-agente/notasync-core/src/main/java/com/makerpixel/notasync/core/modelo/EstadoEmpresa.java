package com.makerpixel.notasync.core.modelo;

import java.time.Instant;

/**
 * Estado atual da empresa e controle de NSU / janelas de consumo perante uma fonte fiscal.
 */
public record EstadoEmpresa(
        String cnpj,
        long ultNsu,
        Instant proximaConsultaPermitida,
        int tentativasIguais,
        int ultimoCStat
) {

    public static EstadoEmpresa inicial(String cnpj) {
        return new EstadoEmpresa(cnpj, 0L, Instant.EPOCH, 0, 0);
    }

    public EstadoEmpresa withUltNsu(long novoUltNsu) {
        return new EstadoEmpresa(cnpj, Math.max(this.ultNsu, novoUltNsu), proximaConsultaPermitida, tentativasIguais, ultimoCStat);
    }

    public EstadoEmpresa withConsulta(Instant proximaConsulta, int cStat, boolean incrementarTentativas) {
        int novasTentativas = incrementarTentativas ? (this.tentativasIguais + 1) : 0;
        return new EstadoEmpresa(cnpj, ultNsu, proximaConsulta, novasTentativas, cStat);
    }

    public boolean podeConsultarEm(Instant agora) {
        return proximaConsultaPermitida == null || !agora.isBefore(proximaConsultaPermitida);
    }
}

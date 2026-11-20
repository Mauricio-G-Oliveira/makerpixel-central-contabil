package com.makerpixel.notasync.core.modelo;

import java.time.Duration;
import java.time.Instant;

/**
 * Ação determinada pela máquina de esperas para a empresa / fonte após uma requisição.
 */
public sealed interface AcaoConsumo permits AcaoConsumo.BuscarJa, AcaoConsumo.Aguardar, AcaoConsumo.Parar {

    enum Tipo {
        BUSCAR_JA,
        AGUARDAR,
        PARAR
    }

    Tipo tipo();
    String motivo();

    record BuscarJa(String motivo) implements AcaoConsumo {
        public BuscarJa() {
            this("Lote com 50 documentos retornado — buscar próximo lote imediatamente.");
        }
        @Override
        public Tipo tipo() {
            return Tipo.BUSCAR_JA;
        }
    }

    record Aguardar(Instant ate, Duration duracao, String motivo) implements AcaoConsumo {
        @Override
        public Tipo tipo() {
            return Tipo.AGUARDAR;
        }
    }

    record Parar(String motivo, boolean exigeAcaoHumana) implements AcaoConsumo {
        @Override
        public Tipo tipo() {
            return Tipo.PARAR;
        }
    }

    static AcaoConsumo buscarJa() {
        return new BuscarJa();
    }

    static AcaoConsumo aguardar(Instant ate, Duration duracao, String motivo) {
        return new Aguardar(ate, duracao, motivo);
    }

    static AcaoConsumo parar(String motivo, boolean exigeAcaoHumana) {
        return new Parar(motivo, exigeAcaoHumana);
    }
}

package com.makerpixel.notasync.core.regra;

import com.makerpixel.notasync.core.modelo.AcaoConsumo;
import com.makerpixel.notasync.core.modelo.EstadoEmpresa;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MaquinaDeEsperasTest {

    private final MaquinaDeEsperas maquina = new MaquinaDeEsperas();
    private final Instant agora = Instant.parse("2026-11-17T12:00:00Z");
    private final String cnpj = "11222333000181";

    @Test
    @DisplayName("cStat 118 com 50 documentos: deve determinar busca imediata do próximo lote")
    void deveBuscarProximoLoteImediatamenteQuandoLoteCheio() {
        EstadoEmpresa estado = EstadoEmpresa.inicial(cnpj);
        AcaoConsumo acao = maquina.decidirProximaAcao(118, 50, estado, agora);

        assertThat(acao).isInstanceOf(AcaoConsumo.BuscarJa.class);
        assertThat(acao.tipo()).isEqualTo(AcaoConsumo.Tipo.BUSCAR_JA);
    }

    @Test
    @DisplayName("cStat 118 com menos de 50 documentos: sincronizado, deve aguardar 12 horas")
    void deveAguardar12HorasQuandoFimDaFilaParcial() {
        EstadoEmpresa estado = EstadoEmpresa.inicial(cnpj);
        AcaoConsumo acao = maquina.decidirProximaAcao(118, 35, estado, agora);

        assertThat(acao).isInstanceOf(AcaoConsumo.Aguardar.class);
        AcaoConsumo.Aguardar aguardar = (AcaoConsumo.Aguardar) acao;
        assertThat(aguardar.duracao()).isEqualTo(Duration.ofHours(12));
        assertThat(aguardar.ate()).isEqualTo(agora.plus(Duration.ofHours(12)));
    }

    @Test
    @DisplayName("cStat 117 (sem novas notas): sincronizado, deve aguardar 12 horas")
    void deveAguardar12HorasQuandoSemNovasNotas() {
        EstadoEmpresa estado = EstadoEmpresa.inicial(cnpj);
        AcaoConsumo acao = maquina.decidirProximaAcao(117, 0, estado, agora);

        assertThat(acao).isInstanceOf(AcaoConsumo.Aguardar.class);
        AcaoConsumo.Aguardar aguardar = (AcaoConsumo.Aguardar) acao;
        assertThat(aguardar.duracao()).isEqualTo(Duration.ofHours(12));
    }

    @Test
    @DisplayName("cStat 110 (uso indevido): deve aguardar intervalo obrigatório de 1 hora")
    void deveAguardar1HoraParaUsoIndevido() {
        EstadoEmpresa estado = EstadoEmpresa.inicial(cnpj);
        AcaoConsumo acao = maquina.decidirProximaAcao(110, 0, estado, agora);

        assertThat(acao).isInstanceOf(AcaoConsumo.Aguardar.class);
        AcaoConsumo.Aguardar aguardar = (AcaoConsumo.Aguardar) acao;
        assertThat(aguardar.duracao()).isEqualTo(Duration.ofHours(1));
    }

    @Test
    @DisplayName("cStat 657 (bloqueio por excesso): aguarda de 1 a 12 horas e para após 3 tentativas")
    void deveTratarBloqueioPorExcesso657() {
        // Tentativa 1
        EstadoEmpresa estado1 = new EstadoEmpresa(cnpj, 100L, agora, 0, 657);
        AcaoConsumo acao1 = maquina.decidirProximaAcao(657, 0, estado1, agora);
        assertThat(acao1).isInstanceOf(AcaoConsumo.Aguardar.class);

        // Tentativa 3 (atingiu o limite)
        EstadoEmpresa estado3 = new EstadoEmpresa(cnpj, 100L, agora, 2, 657);
        AcaoConsumo acao3 = maquina.decidirProximaAcao(657, 0, estado3, agora);
        assertThat(acao3).isInstanceOf(AcaoConsumo.Parar.class);
        AcaoConsumo.Parar parar = (AcaoConsumo.Parar) acao3;
        assertThat(parar.exigeAcaoHumana()).isTrue();
        assertThat(parar.motivo()).contains("limite de 3 tentativas");
    }

    @Test
    @DisplayName("cStat 8002 (sem vínculo SAT): deve parar imediatamente com instrução para vincular no SAT")
    void devePararParaErro8002SemVinculoSat() {
        EstadoEmpresa estado = EstadoEmpresa.inicial(cnpj);
        AcaoConsumo acao = maquina.decidirProximaAcao(8002, 0, estado, agora);

        assertThat(acao).isInstanceOf(AcaoConsumo.Parar.class);
        AcaoConsumo.Parar parar = (AcaoConsumo.Parar) acao;
        assertThat(parar.exigeAcaoHumana()).isTrue();
        assertThat(parar.motivo()).contains("SAT da SEF/SC");
    }
}

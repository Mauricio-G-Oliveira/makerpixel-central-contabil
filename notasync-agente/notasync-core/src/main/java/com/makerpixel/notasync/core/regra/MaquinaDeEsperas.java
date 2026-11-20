package com.makerpixel.notasync.core.regra;

import com.makerpixel.notasync.core.modelo.AcaoConsumo;
import com.makerpixel.notasync.core.modelo.EstadoEmpresa;

import java.time.Duration;
import java.time.Instant;

/**
 * Máquina de regras de consumo em conformidade com o Boletim Técnico SEF/SC 2026/003 v1.00-1.
 * Determina o comportamento de espera, backoff ou parada de requisições por CNPJ.
 */
public class MaquinaDeEsperas {

    public static final Duration ESPERA_SINCRONIZADO = Duration.ofHours(12);
    public static final Duration ESPERA_USO_INDEVIDO = Duration.ofHours(1);
    public static final int MAX_TENTATIVAS_BLOQUEIO = 3;

    /**
     * Avalia o retorno da consulta e o histórico recente para determinar a próxima ação.
     *
     * @param cStat Código de status retornado pela SEF/SC
     * @param qtdDocumentosRetornados Quantidade de documentos fiscais no lote retornado
     * @param estado Estado atual de consumo da empresa
     * @param agora Momento atual de referência
     * @return Ação recomendada (BUSCAR_JA, AGUARDAR ou PARAR)
     */
    public AcaoConsumo decidirProximaAcao(int cStat, int qtdDocumentosRetornados, EstadoEmpresa estado, Instant agora) {
        if (agora == null) {
            agora = Instant.now();
        }

        // 1. Sucesso com lote cheio (50 docs): busca contínua imediata do próximo lote
        if (cStat == 118 && qtdDocumentosRetornados >= 50) {
            return AcaoConsumo.buscarJa();
        }

        // 2. Fim da fila: lote parcial (<50 docs) ou cStat 117 (sem novas notas) -> sincronizado, aguardar 12h
        if ((cStat == 118 && qtdDocumentosRetornados < 50) || cStat == 117) {
            return AcaoConsumo.aguardar(
                    agora.plus(ESPERA_SINCRONIZADO),
                    ESPERA_SINCRONIZADO,
                    "Empresa sincronizada na SEF/SC. Próxima busca agendada para daqui a 12 horas."
            );
        }

        // 3. Uso indevido (cStat 110): consultas repetidas sem intervalo -> aguardar 1h
        if (cStat == 110) {
            return AcaoConsumo.aguardar(
                    agora.plus(ESPERA_USO_INDEVIDO),
                    ESPERA_USO_INDEVIDO,
                    "Uso indevido do web service (cStat 110). Intervalo obrigatório de 1 hora."
            );
        }

        // 4. Bloqueio por excesso de requisições (cStat 657)
        if (cStat == 657) {
            int tentativas = (estado != null) ? estado.tentativasIguais() + 1 : 1;
            if (tentativas >= MAX_TENTATIVAS_BLOQUEIO) {
                return AcaoConsumo.parar(
                        "Bloqueio por excesso (cStat 657): limite de " + MAX_TENTATIVAS_BLOQUEIO + " tentativas consecutivas atingido. Processo suspenso para este CNPJ.",
                        true
                );
            }
            // Espera progressiva de 1 a 12 horas (ex.: 1h, 4h)
            long horasEspera = Math.min(12, Math.max(1, (long) tentativas * 2));
            Duration espera = Duration.ofHours(horasEspera);
            return AcaoConsumo.aguardar(
                    agora.plus(espera),
                    espera,
                    "Bloqueio temporário por excesso na SEF/SC (cStat 657). Aguardar " + horasEspera + " hora(s) antes de nova tentativa (" + tentativas + "/" + MAX_TENTATIVAS_BLOQUEIO + ")."
            );
        }

        // 5. Erro 8002: contador não é contabilista vinculado no SAT da SEF/SC -> Parar e exigir ação humana
        if (cStat == 8002) {
            return AcaoConsumo.parar(
                    "Contador transmissor não consta como contabilista vinculado no SAT da SEF/SC para este CNPJ. É necessário vincular no portal SAT.",
                    true
            );
        }

        // 6. Demais falhas / erros de rede / manutenção (ex.: 108, 109, 9999)
        int tentativas = (estado != null) ? estado.tentativasIguais() + 1 : 1;
        if (tentativas >= MAX_TENTATIVAS_BLOQUEIO) {
            Duration esperaLonga = Duration.ofHours(12);
            return AcaoConsumo.aguardar(
                    agora.plus(esperaLonga),
                    esperaLonga,
                    "Limite de " + MAX_TENTATIVAS_BLOQUEIO + " tentativas excedido para status " + cStat + ". Pausando consultas por 12 horas."
            );
        }

        // Backoff de 15 minutos por tentativa
        Duration backoff = Duration.ofMinutes(15L * tentativas);
        return AcaoConsumo.aguardar(
                agora.plus(backoff),
                backoff,
                "Erro temporário na SEF/SC (" + cStat + "). Nova tentativa em " + backoff.toMinutes() + " minutos (" + tentativas + "/" + MAX_TENTATIVAS_BLOQUEIO + ")."
        );
    }
}

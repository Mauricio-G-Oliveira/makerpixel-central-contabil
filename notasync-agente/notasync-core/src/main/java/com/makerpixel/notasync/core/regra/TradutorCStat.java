package com.makerpixel.notasync.core.regra;

/**
 * Tradutor dos códigos de status (cStat) oficiais da SEF/SC e DF-e para linguagem contábil clara com ação recomendada.
 */
public class TradutorCStat {

    public enum Severidade {
        OK,
        AVISO,
        ATENCAO,
        ERRO,
        BLOQUEIO
    }

    public record Traducao(
            int cStat,
            String paraUsuario,
            String acao,
            Severidade severidade,
            boolean destaque
    ) {}

    public static Traducao traduzir(int cStat, String xMotivoOriginal) {
        return switch (cStat) {
            case 108, 109 -> new Traducao(
                    cStat,
                    "SEF fora do ar",
                    "Tentar mais tarde",
                    Severidade.AVISO,
                    false
            );
            case 110 -> new Traducao(
                    cStat,
                    "Reprocessamento / uso indevido",
                    "Aguardar 1 hora",
                    Severidade.ATENCAO,
                    false
            );
            case 116 -> new Traducao(
                    cStat,
                    "Chave não encontrada ou fora do prazo",
                    "Conferir a chave e o período",
                    Severidade.AVISO,
                    false
            );
            case 117 -> new Traducao(
                    cStat,
                    "Nenhuma nota nova",
                    "Próxima busca em 12 horas",
                    Severidade.OK,
                    false
            );
            case 118 -> new Traducao(
                    cStat,
                    "Notas encontradas",
                    "—",
                    Severidade.OK,
                    false
            );
            case 252 -> new Traducao(
                    cStat,
                    "Ambiente errado",
                    "Conferir tpAmb (o web service da SEF/SC opera somente em produção tpAmb=1)",
                    Severidade.ERRO,
                    false
            );
            case 280 -> new Traducao(
                    cStat,
                    "Problema no certificado (inválido)",
                    "Trocar ou renovar o certificado digital A1 do escritório",
                    Severidade.ERRO,
                    false
            );
            case 281 -> new Traducao(
                    cStat,
                    "Problema no certificado (vencido)",
                    "Renovar o certificado digital A1 do escritório",
                    Severidade.ERRO,
                    false
            );
            case 284 -> new Traducao(
                    cStat,
                    "Problema no certificado (revogado)",
                    "Emitir novo certificado junto à autoridade certificadora",
                    Severidade.ERRO,
                    false
            );
            case 486, 487, 489 -> new Traducao(
                    cStat,
                    "CNPJ/CPF faltando, duplicado ou inválido",
                    "Conferir o cadastro da empresa",
                    Severidade.ERRO,
                    false
            );
            case 589, 632 -> new Traducao(
                    cStat,
                    "NSU ou documento fora do período disponível",
                    "Só ficam disponíveis o mês atual e os 2 anteriores",
                    Severidade.AVISO,
                    false
            );
            case 657 -> new Traducao(
                    cStat,
                    "Bloqueio por excesso de consultas",
                    "Aguardar de 1 a 12 horas",
                    Severidade.BLOQUEIO,
                    false
            );
            case 8001, 8004 -> new Traducao(
                    cStat,
                    "CNPJ sem vínculo com o NSU ou a chave",
                    "Conferir a empresa consultada",
                    Severidade.ATENCAO,
                    false
            );
            case 8002 -> new Traducao(
                    cStat,
                    "Contador não é contabilista desse CNPJ no SAT",
                    "Vincular o CPF do contador no SAT da SEF/SC",
                    Severidade.ATENCAO,
                    true
            );
            case 9999 -> new Traducao(
                    cStat,
                    "Erro na SEF",
                    "Tentar mais tarde",
                    Severidade.ERRO,
                    false
            );
            default -> {
                if ((cStat >= 214 && cStat <= 238) || cStat == 402 || cStat == 404 || cStat == 516 || cStat == 517 || cStat == 587 || cStat == 588) {
                    yield new Traducao(
                            cStat,
                            "Erro de formato da mensagem",
                            "Bug do agente: registrar e avisar",
                            Severidade.ERRO,
                            false
                    );
                }
                if (cStat >= 282 && cStat <= 286) {
                    yield new Traducao(
                            cStat,
                            "Problema no certificado (cadeia / não ICP-Brasil)",
                            "Trocar ou renovar o certificado",
                            Severidade.ERRO,
                            false
                    );
                }
                String motivo = (xMotivoOriginal != null && !xMotivoOriginal.isBlank()) ? xMotivoOriginal : "Código SEF " + cStat;
                yield new Traducao(
                        cStat,
                        motivo,
                        "Consultar suporte técnico ou log do agente",
                        cStat < 200 ? Severidade.OK : Severidade.ATENCAO,
                        false
                );
            }
        };
    }
}

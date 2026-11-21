package com.makerpixel.notasync.simulador.cenario;

import com.makerpixel.notasync.core.modelo.ChaveAcesso;
import com.makerpixel.notasync.core.modelo.Documento;
import com.makerpixel.notasync.core.modelo.ModeloDocumento;
import com.makerpixel.notasync.core.modelo.SituacaoDocumento;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Gerador de cenários e documentos fictícios com chaves de 44 dígitos válidas (Módulo 11) para o simulador SEF/SC.
 */
@Component
public class GeradorCenarios {

    public static final String CNPJ_SEM_VINCULO_SAT = "12345678000195"; // Cenário 8002
    public static final String CNPJ_USO_INDEVIDO_110 = "22333444000199"; // Cenário 110
    public static final String CNPJ_BLOQUEIO_657 = "33444555000188"; // Cenário 657
    public static final String CNPJ_SEM_NOTAS_117 = "55666777000122"; // Cenário 117 direto


    /**
     * Gera lista de documentos fictícios para simulação de lote.
     *
     * @param cnpj CNPJ da empresa emitente
     * @param nsuInicial Primeiro NSU a ser emitido no lote
     * @param quantidade Quantidade de notas a gerar (ex.: 50, 35, 15)
     */
    public List<Documento> gerarLote(String cnpj, long nsuInicial, int quantidade) {
        String cnpjLimpo = (cnpj != null) ? cnpj.replaceAll("\\D", "") : "11222333000181";
        List<Documento> docs = new ArrayList<>();

        for (int i = 0; i < quantidade; i++) {
            long nsu = nsuInicial + i;
            long numero = nsu;
            int serie = 1;
            boolean cancelada = (i == 6 || i == 21); // algumas notas canceladas

            // Monta chave válida: UF(42) + AAMM(2611) + CNPJ(14) + Mod(65) + Serie(001) + Num(9 digitos) + tpEmis(1) + cNF(8 digitos)
            String uf = "42";
            String aamm = "2611";
            String serieStr = String.format("%03d", serie);
            String numStr = String.format("%09d", numero);
            String tpEmis = "1";
            String cNf = String.format("%08d", (10000000L + nsu) % 100000000L);

            String raiz43 = uf + aamm + cnpjLimpo + "65" + serieStr + numStr + tpEmis + cNf;
            int dv = ChaveAcesso.calcularDv(raiz43);
            String chaveCompleta = raiz43 + dv;

            BigDecimal valor = BigDecimal.valueOf(18.50 + ((nsu * 11.75) % 450.0)).setScale(2, java.math.RoundingMode.HALF_UP);
            Instant dhEmi = Instant.parse("2026-11-17T10:00:00Z").minusSeconds(3600L * (quantidade - i));

            Documento doc = new Documento(
                    chaveCompleta,
                    ModeloDocumento.NFCE_65,
                    cnpjLimpo,
                    dhEmi,
                    valor,
                    cancelada ? SituacaoDocumento.CANCELADA : SituacaoDocumento.AUTORIZADA,
                    nsu,
                    "sef-sc-nfce",
                    null,
                    cancelada ? "Cancelamento homologado na SEF/SC (evento 110111)" : null
            );

            docs.add(doc);
        }

        return docs;
    }
}

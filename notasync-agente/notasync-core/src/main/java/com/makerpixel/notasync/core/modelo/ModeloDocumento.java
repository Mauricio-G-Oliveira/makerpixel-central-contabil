package com.makerpixel.notasync.core.modelo;

import java.util.Arrays;

/**
 * Modelos de documentos fiscais suportados pela arquitetura plugável do NotaSync.
 */
public enum ModeloDocumento {
    NFCE_65("65", "NFC-e", "Nota Fiscal de Consumidor Eletrônica"),
    NFE_55("55", "NF-e", "Nota Fiscal Eletrônica"),
    CTE_57("57", "CT-e", "Conhecimento de Transporte Eletrônico"),
    NFSE("NFS", "NFS-e", "Nota Fiscal de Serviços Eletrônica");

    private final String codigo;
    private final String sigla;
    private final String descricao;

    ModeloDocumento(String codigo, String sigla, String descricao) {
        this.codigo = codigo;
        this.sigla = sigla;
        this.descricao = descricao;
    }

    public String getCodigo() {
        return codigo;
    }

    public String getSigla() {
        return sigla;
    }

    public String getDescricao() {
        return descricao;
    }

    public static ModeloDocumento fromCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return NFCE_65;
        }
        String limpo = codigo.trim();
        return Arrays.stream(values())
                .filter(m -> m.codigo.equalsIgnoreCase(limpo) || m.sigla.equalsIgnoreCase(limpo) || m.name().equalsIgnoreCase(limpo))
                .findFirst()
                .orElse(NFCE_65);
    }
}

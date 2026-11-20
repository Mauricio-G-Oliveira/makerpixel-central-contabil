package com.makerpixel.notasync.core.modelo;

/**
 * Tipo de certificado exigido pela fonte de captura fiscal.
 */
public enum TipoCertificado {
    CONTADOR("Certificado do Contador (e-CPF ou e-CNPJ do escritório)"),
    EMPRESA("Certificado da própria Empresa cliente");

    private final String descricao;

    TipoCertificado(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}

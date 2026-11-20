package com.makerpixel.notasync.core.modelo;

import java.nio.file.Path;

/**
 * Credenciais e certificado digital para autenticação mTLS junto à autoridade fiscal.
 */
public record Credencial(
        String identificadorTransmissor, // CNPJ ou CPF do transmissor
        Path caminhoCertificado,        // Arquivo PKCS12 (.pfx / .p12)
        String senhaCertificado,        // Senha da chave privada (nunca gravada em log)
        TipoCertificado tipo
) {

    public static Credencial doContador(String cpfOuCnpj, Path caminhoCertificado, String senha) {
        return new Credencial(cpfOuCnpj, caminhoCertificado, senha, TipoCertificado.CONTADOR);
    }

    public static Credencial daEmpresa(String cnpj, Path caminhoCertificado, String senha) {
        return new Credencial(cnpj, caminhoCertificado, senha, TipoCertificado.EMPRESA);
    }

    public boolean possuiCertificado() {
        return caminhoCertificado != null && senhaCertificado != null;
    }

    @Override
    public String toString() {
        return "Credencial[transmissor=" + identificadorTransmissor + ", tipo=" + tipo + ", certificado=" + (caminhoCertificado != null ? caminhoCertificado.getFileName() : "nenhum") + ", senha=***]";
    }
}

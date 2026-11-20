package com.makerpixel.notasync.core.modelo;

import java.util.Objects;

/**
 * Representa uma chave de acesso padrão SPED/DF-e de 44 dígitos com validação de DV pelo Módulo 11.
 */
public record ChaveAcesso(
        String chaveCompleta,
        String cUf,
        String anoMes,
        String cnpjEmitente,
        ModeloDocumento modelo,
        int serie,
        long numero,
        String tpEmis,
        String codigoNumerico,
        int cDv
) {

    public ChaveAcesso {
        Objects.requireNonNull(chaveCompleta, "Chave de acesso não pode ser nula");
        if (!isValida(chaveCompleta)) {
            throw new IllegalArgumentException("Chave de acesso inválida ou com dígito verificador incorreto: " + chaveCompleta);
        }
    }

    /**
     * Valida os 44 dígitos e o DV calculado pelo Módulo 11 (pesos 2 a 9).
     */
    public static boolean isValida(String chave) {
        if (chave == null) return false;
        String limpa = chave.replaceAll("\\D", "");
        if (limpa.length() != 44) return false;

        String corpo43 = limpa.substring(0, 43);
        int dvInformado = Character.digit(limpa.charAt(43), 10);
        int dvCalculado = calcularDv(corpo43);

        return dvInformado == dvCalculado;
    }

    /**
     * Calcula o dígito verificador Módulo 11 para uma raiz de 43 dígitos.
     */
    public static int calcularDv(String chave43) {
        if (chave43 == null) return 0;
        String limpa = chave43.replaceAll("\\D", "");
        if (limpa.length() != 43) return 0;

        int soma = 0;
        int peso = 2;
        for (int i = limpa.length() - 1; i >= 0; i--) {
            int digito = Character.digit(limpa.charAt(i), 10);
            soma += digito * peso;
            peso = (peso == 9) ? 2 : peso + 1;
        }

        int resto = soma % 11;
        return (resto == 0 || resto == 1) ? 0 : 11 - resto;
    }

    /**
     * Decompõe uma string de 44 dígitos válidos na instância do record ChaveAcesso.
     */
    public static ChaveAcesso parse(String chave) {
        if (chave == null) {
            throw new IllegalArgumentException("Chave de acesso não pode ser nula");
        }
        String limpa = chave.replaceAll("\\D", "");
        if (!isValida(limpa)) {
            throw new IllegalArgumentException("Chave de acesso com tamanho ou DV inválido: " + chave);
        }

        String cUf = limpa.substring(0, 2);
        String anoMes = limpa.substring(2, 6);
        String cnpjEmitente = limpa.substring(6, 20);
        String modStr = limpa.substring(20, 22);
        ModeloDocumento modelo = ModeloDocumento.fromCodigo(modStr);
        int serie = Integer.parseInt(limpa.substring(22, 25));
        long numero = Long.parseLong(limpa.substring(25, 34));
        String tpEmis = limpa.substring(34, 35);
        String codigoNumerico = limpa.substring(35, 43);
        int cDv = Character.digit(limpa.charAt(43), 10);

        return new ChaveAcesso(limpa, cUf, anoMes, cnpjEmitente, modelo, serie, numero, tpEmis, codigoNumerico, cDv);
    }

    /**
     * Formata a chave em grupos legíveis de 4 dígitos (ex.: "4226 1111 ...").
     */
    public String formatada() {
        if (chaveCompleta == null || chaveCompleta.length() != 44) {
            return chaveCompleta;
        }
        return chaveCompleta.replaceAll("(\\d{4})(?=\\d)", "$1 ");
    }
}

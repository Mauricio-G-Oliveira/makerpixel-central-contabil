package com.makerpixel.notasync.core.fonte;

import com.makerpixel.notasync.core.modelo.Credencial;
import com.makerpixel.notasync.core.modelo.EstadoConsulta;
import com.makerpixel.notasync.core.modelo.EstadoEmpresa;
import com.makerpixel.notasync.core.modelo.ModeloDocumento;
import com.makerpixel.notasync.core.modelo.ResultadoConsulta;
import com.makerpixel.notasync.core.modelo.TipoCertificado;

import java.util.Set;

/**
 * Interface extensível para arquitetura de fontes plugáveis de documentos fiscais.
 */
public interface FonteDeNotas {

    /**
     * Identificador único da fonte (ex.: "sef-sc-nfce", "sef-sc-nfe", "dfe-nacional", "nfse-nacional").
     */
    String id();

    /**
     * Modelos de documentos fiscais abrangidos por esta fonte.
     */
    Set<ModeloDocumento> modelos();

    /**
     * Tipo de certificado digital requerido pela autoridade fiscal.
     */
    TipoCertificado certificadoExigido();

    /**
     * Realiza a consulta e sincronização junto à fonte fiscal usando EstadoEmpresa.
     *
     * @param estado Estado de consumo e último NSU da empresa
     * @param cred Credenciais de transmissão e certificado digital
     * @return Resultado da consulta com lote de documentos e ação de espera
     * @throws FonteException em caso de falha de comunicação ou envelope
     */
    ResultadoConsulta consultar(EstadoEmpresa estado, Credencial cred) throws FonteException;

    /**
     * Realiza a consulta usando EstadoConsulta (Central Contábil v3).
     */
    default ResultadoConsulta consultar(EstadoConsulta estado, Credencial cred) throws FonteException {
        return consultar(estado != null ? estado.toEstadoEmpresa() : null, cred);
    }
}

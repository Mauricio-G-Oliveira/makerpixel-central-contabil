package com.makerpixel.notasync.app.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "execucao")
public class ExecucaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant dataHora = Instant.now();

    @Column(nullable = false, length = 14)
    private String cnpj;

    @Column(nullable = false, length = 50)
    private String fonteId;

    @Column(nullable = false)
    private int cStat;

    @Column(length = 500)
    private String xMotivo;

    @Column(nullable = false)
    private int qtdDocumentos;

    @Column(nullable = false)
    private long duracaoMs;

    @Column(nullable = false, length = 50)
    private String status;

    public ExecucaoEntity() {}

    public Long getId() {
        return id;
    }

    public Instant getDataHora() {
        return dataHora;
    }

    public void setDataHora(Instant dataHora) {
        this.dataHora = dataHora;
    }

    public String getCnpj() {
        return cnpj;
    }

    public void setCnpj(String cnpj) {
        this.cnpj = cnpj != null ? cnpj.replaceAll("\\D", "") : null;
    }

    public String getFonteId() {
        return fonteId;
    }

    public void setFonteId(String fonteId) {
        this.fonteId = fonteId;
    }

    public int getCStat() {
        return cStat;
    }

    public void setCStat(int cStat) {
        this.cStat = cStat;
    }

    public String getXMotivo() {
        return xMotivo;
    }

    public void setXMotivo(String xMotivo) {
        this.xMotivo = xMotivo;
    }

    public int getQtdDocumentos() {
        return qtdDocumentos;
    }

    public void setQtdDocumentos(int qtdDocumentos) {
        this.qtdDocumentos = qtdDocumentos;
    }

    public long getDuracaoMs() {
        return duracaoMs;
    }

    public void setDuracaoMs(long duracaoMs) {
        this.duracaoMs = duracaoMs;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}

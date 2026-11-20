package com.makerpixel.notasync.app.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "documento",
        indexes = {
                @Index(name = "idx_doc_cnpj", columnList = "cnpjEmitente"),
                @Index(name = "idx_doc_emissao", columnList = "dataEmissao"),
                @Index(name = "idx_doc_modelo", columnList = "modelo")
        }
)
public class DocumentoEntity {

    @Id
    @Column(length = 44, nullable = false, unique = true)
    private String chave;

    @Column(nullable = false, length = 10)
    private String modelo;

    @Column(nullable = false, length = 14)
    private String cnpjEmitente;

    @Column(nullable = false)
    private Instant dataEmissao;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valorTotal = BigDecimal.ZERO;

    @Column(nullable = false, length = 20)
    private String situacao; // AUTORIZADA, CANCELADA

    @Column(nullable = false)
    private long nsu;

    @Column(nullable = false, length = 50)
    private String fonte;

    private String caminhoXml;

    private String motivoCancelamento;

    @Column(nullable = false)
    private Instant dataGravacao = Instant.now();

    public DocumentoEntity() {}

    public String getChave() {
        return chave;
    }

    public void setChave(String chave) {
        this.chave = chave;
    }

    public String getModelo() {
        return modelo;
    }

    public void setModelo(String modelo) {
        this.modelo = modelo;
    }

    public String getCnpjEmitente() {
        return cnpjEmitente;
    }

    public void setCnpjEmitente(String cnpjEmitente) {
        this.cnpjEmitente = cnpjEmitente;
    }

    public Instant getDataEmissao() {
        return dataEmissao;
    }

    public void setDataEmissao(Instant dataEmissao) {
        this.dataEmissao = dataEmissao;
    }

    public BigDecimal getValorTotal() {
        return valorTotal;
    }

    public void setValorTotal(BigDecimal valorTotal) {
        this.valorTotal = valorTotal;
    }

    public String getSituacao() {
        return situacao;
    }

    public void setSituacao(String situacao) {
        this.situacao = situacao;
    }

    public long getNsu() {
        return nsu;
    }

    public void setNsu(long nsu) {
        this.nsu = nsu;
    }

    public String getFonte() {
        return fonte;
    }

    public void setFonte(String fonte) {
        this.fonte = fonte;
    }

    public String getCaminhoXml() {
        return caminhoXml;
    }

    public void setCaminhoXml(String caminhoXml) {
        this.caminhoXml = caminhoXml;
    }

    public String getMotivoCancelamento() {
        return motivoCancelamento;
    }

    public void setMotivoCancelamento(String motivoCancelamento) {
        this.motivoCancelamento = motivoCancelamento;
    }

    public Instant getDataGravacao() {
        return dataGravacao;
    }

    public void setDataGravacao(Instant dataGravacao) {
        this.dataGravacao = dataGravacao;
    }
}

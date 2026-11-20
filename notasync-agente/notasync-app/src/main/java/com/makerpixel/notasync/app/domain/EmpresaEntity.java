package com.makerpixel.notasync.app.domain;

import jakarta.persistence.*;
import java.util.Objects;

@Entity
@Table(name = "empresa")
public class EmpresaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 14)
    private String cnpj;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(nullable = false)
    private String fontesHabilitadas = "sef-sc-nfce";

    private String caminhoCertificado;
    private String senhaCertificado;

    public EmpresaEntity() {}

    public EmpresaEntity(String cnpj, String nome) {
        this.cnpj = cnpj != null ? cnpj.replaceAll("\\D", "") : null;
        this.nome = nome;
        this.ativo = true;
        this.fontesHabilitadas = "sef-sc-nfce";
    }

    public Long getId() {
        return id;
    }

    public String getCnpj() {
        return cnpj;
    }

    public void setCnpj(String cnpj) {
        this.cnpj = cnpj != null ? cnpj.replaceAll("\\D", "") : null;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void setAtivo(boolean ativo) {
        this.ativo = ativo;
    }

    public String getFontesHabilitadas() {
        return fontesHabilitadas;
    }

    public void setFontesHabilitadas(String fontesHabilitadas) {
        this.fontesHabilitadas = fontesHabilitadas;
    }

    public String getCaminhoCertificado() {
        return caminhoCertificado;
    }

    public void setCaminhoCertificado(String caminhoCertificado) {
        this.caminhoCertificado = caminhoCertificado;
    }

    public String getSenhaCertificado() {
        return senhaCertificado;
    }

    public void setSenhaCertificado(String senhaCertificado) {
        this.senhaCertificado = senhaCertificado;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof EmpresaEntity that)) return false;
        return Objects.equals(cnpj, that.cnpj);
    }

    @Override
    public int hashCode() {
        return Objects.hash(cnpj);
    }
}

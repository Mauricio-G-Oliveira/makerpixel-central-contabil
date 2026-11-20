package com.makerpixel.notasync.app.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
        name = "estado_fonte",
        uniqueConstraints = @UniqueConstraint(columnNames = {"empresaCnpj", "fonteId"})
)
public class EstadoFonteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 14)
    private String empresaCnpj;

    @Column(nullable = false, length = 50)
    private String fonteId;

    @Column(nullable = false)
    private long ultNsu = 0L;

    @Column(nullable = false)
    private Instant proximaConsulta = Instant.EPOCH;

    @Column(nullable = false)
    private int tentativasIguais = 0;

    @Column(nullable = false)
    private int ultimoCStat = 0;

    private String ultimoMotivo;

    public EstadoFonteEntity() {}

    public EstadoFonteEntity(String empresaCnpj, String fonteId) {
        this.empresaCnpj = empresaCnpj != null ? empresaCnpj.replaceAll("\\D", "") : null;
        this.fonteId = fonteId;
        this.ultNsu = 0L;
        this.proximaConsulta = Instant.EPOCH;
        this.tentativasIguais = 0;
        this.ultimoCStat = 0;
    }

    public Long getId() {
        return id;
    }

    public String getEmpresaCnpj() {
        return empresaCnpj;
    }

    public void setEmpresaCnpj(String empresaCnpj) {
        this.empresaCnpj = empresaCnpj != null ? empresaCnpj.replaceAll("\\D", "") : null;
    }

    public String getFonteId() {
        return fonteId;
    }

    public void setFonteId(String fonteId) {
        this.fonteId = fonteId;
    }

    public long getUltNsu() {
        return ultNsu;
    }

    public void setUltNsu(long ultNsu) {
        this.ultNsu = ultNsu;
    }

    public Instant getProximaConsulta() {
        return proximaConsulta;
    }

    public void setProximaConsulta(Instant proximaConsulta) {
        this.proximaConsulta = proximaConsulta;
    }

    public int getTentativasIguais() {
        return tentativasIguais;
    }

    public void setTentativasIguais(int tentativasIguais) {
        this.tentativasIguais = tentativasIguais;
    }

    public int getUltimoCStat() {
        return ultimoCStat;
    }

    public void setUltimoCStat(int ultimoCStat) {
        this.ultimoCStat = ultimoCStat;
    }

    public String getUltimoMotivo() {
        return ultimoMotivo;
    }

    public void setUltimoMotivo(String ultimoMotivo) {
        this.ultimoMotivo = ultimoMotivo;
    }
}

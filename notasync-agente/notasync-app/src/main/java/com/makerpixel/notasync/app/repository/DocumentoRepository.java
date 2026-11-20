package com.makerpixel.notasync.app.repository;

import com.makerpixel.notasync.app.domain.DocumentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface DocumentoRepository extends JpaRepository<DocumentoEntity, String> {

    List<DocumentoEntity> findByCnpjEmitenteOrderByDataEmissaoDesc(String cnpjEmitente);

    @Query("SELECT d FROM DocumentoEntity d WHERE "
            + "(:cnpj IS NULL OR d.cnpjEmitente = :cnpj) AND "
            + "(:modelo IS NULL OR d.modelo = :modelo) AND "
            + "(:inicio IS NULL OR d.dataEmissao >= :inicio) AND "
            + "(:fim IS NULL OR d.dataEmissao <= :fim) "
            + "ORDER BY d.dataEmissao DESC")
    List<DocumentoEntity> pesquisarDocumentos(
            @Param("cnpj") String cnpj,
            @Param("modelo") String modelo,
            @Param("inicio") Instant inicio,
            @Param("fim") Instant fim
    );

    long countByCnpjEmitente(String cnpjEmitente);
    long countBySituacao(String situacao);
}

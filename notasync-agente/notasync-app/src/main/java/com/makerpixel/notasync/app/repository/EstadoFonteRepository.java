package com.makerpixel.notasync.app.repository;

import com.makerpixel.notasync.app.domain.EstadoFonteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EstadoFonteRepository extends JpaRepository<EstadoFonteEntity, Long> {
    Optional<EstadoFonteEntity> findByEmpresaCnpjAndFonteId(String empresaCnpj, String fonteId);
    List<EstadoFonteEntity> findByEmpresaCnpj(String empresaCnpj);
}

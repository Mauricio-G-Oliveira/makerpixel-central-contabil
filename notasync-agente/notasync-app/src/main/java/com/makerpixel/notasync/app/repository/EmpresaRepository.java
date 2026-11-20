package com.makerpixel.notasync.app.repository;

import com.makerpixel.notasync.app.domain.EmpresaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmpresaRepository extends JpaRepository<EmpresaEntity, Long> {
    Optional<EmpresaEntity> findByCnpj(String cnpj);
    List<EmpresaEntity> findByAtivoTrue();
}

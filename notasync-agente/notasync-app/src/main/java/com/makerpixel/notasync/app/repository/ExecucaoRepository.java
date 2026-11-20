package com.makerpixel.notasync.app.repository;

import com.makerpixel.notasync.app.domain.ExecucaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExecucaoRepository extends JpaRepository<ExecucaoEntity, Long> {
    List<ExecucaoEntity> findTop50ByOrderByDataHoraDesc();
    List<ExecucaoEntity> findByCnpjOrderByDataHoraDesc(String cnpj);
}

package com.makerpixel.notasync.app.service;

import com.makerpixel.notasync.app.domain.EmpresaEntity;
import com.makerpixel.notasync.app.repository.EmpresaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Agendador cron que executa a rotina periódica de coleta automática para todas as empresas ativas.
 */
@Component
public class AgendadorColeta {

    private static final Logger log = LoggerFactory.getLogger(AgendadorColeta.class);

    private final EmpresaRepository empresaRepository;
    private final ColetorService coletorService;

    public AgendadorColeta(EmpresaRepository empresaRepository, ColetorService coletorService) {
        this.empresaRepository = empresaRepository;
        this.coletorService = coletorService;
    }

    @Scheduled(cron = "${notasync.agendamento.cron:0 0 2 * * *}")
    public void executarRotinaAgendada() {
        log.info("Iniciando rotina agendada de sincronização de documentos fiscais...");
        List<EmpresaEntity> ativas = empresaRepository.findByAtivoTrue();

        for (EmpresaEntity emp : ativas) {
            try {
                coletorService.sincronizarEmpresa(emp.getCnpj(), false);
            } catch (ColetorService.EsperaAtivaException e) {
                log.info("Empresa {} aguardando janela regulamentar até {}", emp.getCnpj(), e.getPermitidoAPartirDe());
            } catch (Exception e) {
                log.error("Falha ao coletar dados para a empresa {}: {}", emp.getCnpj(), e.getMessage());
            }
        }
        log.info("Rotina agendada finalizada para {} empresa(s).", ativas.size());
    }
}

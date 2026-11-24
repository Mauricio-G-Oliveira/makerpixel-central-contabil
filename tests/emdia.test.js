// Testes de unidade do novo módulo Em Dia (v4.0.0 reescrito do zero)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  gerarModelosPadraoDemo,
  gerarEmpresasEmDiaDemo,
  seModeloAplica,
  gerarMesIdempotente,
  gerarTarefasAutomaticas,
  calcularMetricasPainel,
  agruparMinhasTarefas
} from "../src/lib/emDia.mjs";

describe("Em Dia v4 — Regras de Negócio e Idempotência", () => {
  const modelos = gerarModelosPadraoDemo();
  const empresas = gerarEmpresasEmDiaDemo();

  test("seModeloAplica respeita regime tributário e exigência de funcionário", () => {
    const modFgts = modelos.find((m) => m.id === "mod-fgts"); // exigeFuncionario: true
    const empComFunc = empresas.find((e) => e.temFuncionario);
    const empSemFunc = empresas.find((e) => !e.temFuncionario);

    assert.equal(seModeloAplica(modFgts, empComFunc), true);
    assert.equal(seModeloAplica(modFgts, empSemFunc), false);

    const modPgdas = modelos.find((m) => m.id === "mod-pgdas"); // apenas simples
    const empPresumido = empresas.find((e) => e.regime === "LUCRO_PRESUMIDO");
    assert.equal(seModeloAplica(modPgdas, empPresumido), false);
  });

  test("gerarMesIdempotente: rodar duas vezes para a mesma competência não duplica tarefas", () => {
    const mes = "2026-11";

    // 1ª execução: gera as tarefas
    const prim = gerarMesIdempotente([], empresas, modelos, mes);
    assert.ok(prim.criadas > 0, "Deve criar tarefas na primeira execução");
    assert.equal(prim.existentes, 0);

    // 2ª execução com as tarefas já geradas
    const seg = gerarMesIdempotente(prim.tarefas, empresas, modelos, mes);
    assert.equal(seg.criadas, 0, "Não deve criar nenhuma tarefa na segunda execução");
    assert.equal(seg.existentes, prim.criadas, "Todas devem ser identificadas como existentes");
    assert.equal(seg.tarefas.length, prim.tarefas.length);
  });

  test("gerarTarefasAutomaticas: deduplica eventos abertos sem duplicar", () => {
    const eventos = [
      {
        origem: "NOTASYNC_8002",
        chaveDeduplicacao: "SAT_8002_11222333000181",
        nome: "Vincular contador no SAT – empresa Mercado Modelo",
        empresaId: "emp-1"
      },
      {
        origem: "CERTIFICADO_VENCENDO",
        chaveDeduplicacao: "CERT_VENCENDO_cert-123",
        nome: "Renovar Certificado Digital A1",
        empresaId: "emp-1"
      }
    ];

    // 1ª execução
    const r1 = gerarTarefasAutomaticas([], eventos);
    assert.equal(r1.criadas, 2);
    assert.equal(r1.tarefas.length, 2);

    // 2ª execução com as mesmas tarefas abertas
    const r2 = gerarTarefasAutomaticas(r1.tarefas, eventos);
    assert.equal(r2.criadas, 0, "Não deve criar duplicata enquanto a tarefa estiver aberta");
    assert.equal(r2.tarefas.length, 2);
  });

  test("calcularMetricasPainel: calcula totais por status, setor e responsável", () => {
    const tarefas = [
      { id: "1", status: "CONCLUIDA", setor: "FISCAL", responsavel: "Marcos" },
      { id: "2", status: "A_FAZER", prazo: "2025-01-01", setor: "FISCAL", responsavel: "Marcos" }, // atrasada
      { id: "3", status: "AGUARDANDO_CLIENTE", prazo: "2099-01-01", setor: "DP", responsavel: "Carla" },
      { id: "4", status: "A_FAZER", prazo: "2099-01-01", setor: "CONTABIL", responsavel: "Ana" } // em dia
    ];

    const kpis = calcularMetricasPainel(tarefas);
    assert.equal(kpis.totalTarefas, 4);
    assert.equal(kpis.concluidas, 1);
    assert.equal(kpis.atrasadas, 1);
    assert.equal(kpis.aguardandoCliente, 1);
    assert.equal(kpis.emDia, 1);
    assert.equal(kpis.porSetor.FISCAL, 2);
    assert.equal(kpis.porSetor.DP, 1);
    assert.equal(kpis.porResponsavel["Marcos"], 2);
  });

  test("agruparMinhasTarefas classifica prazos corretamente", () => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const ontemStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const amanhaStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const tarefas = [
      { id: "1", prazo: ontemStr, status: "A_FAZER" },
      { id: "2", prazo: hojeStr, status: "A_FAZER" },
      { id: "3", prazo: amanhaStr, status: "A_FAZER" }
    ];

    const ag = agruparMinhasTarefas(tarefas, "user@teste.com");
    assert.equal(ag.atrasadas.length, 1);
    assert.equal(ag.hoje.length, 1);
    assert.equal(ag.destaSemana.length, 1);
  });
});

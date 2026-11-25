import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG_SEMAFORO,
  calcularSemaforo,
  gerarPainelContinuaDemo
} from "../src/lib/ibsCbs.mjs";

test("Central Contábil v4.1 — Auditoria Contínua & Semáforo", async (t) => {
  await t.test("CONFIG_SEMAFORO: objeto único centraliza limites", () => {
    assert.equal(CONFIG_SEMAFORO.limiteVerdeDivergencias, 0);
    assert.equal(CONFIG_SEMAFORO.limiteAmareloDivergencias, 5);
    assert.equal(CONFIG_SEMAFORO.bloqueiaSemGrupoIbsCbs, true);
    assert.equal(CONFIG_SEMAFORO.bloqueiaErrosCalculo, true);
  });

  await t.test("calcularSemaforo: empresa sem movimentação nem pendência fica CINZA", () => {
    const emp = { totalNotas: 0, totalPendentes: 0, totalDivergencias: 0 };
    assert.equal(calcularSemaforo(emp), "CINZA");
  });

  await t.test("calcularSemaforo: empresa auditada sem divergências fica VERDE", () => {
    const emp = { totalNotas: 120, totalItens: 300, totalOk: 300, totalDivergencias: 0, totalSemGrupo: 0, totalErros: 0 };
    assert.equal(calcularSemaforo(emp), "VERDE");
  });

  await t.test("calcularSemaforo: empresa com 1 a 5 divergências leves fica AMARELO", () => {
    const emp1 = { totalNotas: 50, totalDivergencias: 1, totalSemGrupo: 0, totalErros: 0 };
    const emp5 = { totalNotas: 50, totalDivergencias: 5, totalSemGrupo: 0, totalErros: 0 };
    assert.equal(calcularSemaforo(emp1), "AMARELO");
    assert.equal(calcularSemaforo(emp5), "AMARELO");
  });

  await t.test("calcularSemaforo: empresa com mais de 5 divergências fica VERMELHO", () => {
    const emp6 = { totalNotas: 50, totalDivergencias: 6, totalSemGrupo: 0, totalErros: 0 };
    assert.equal(calcularSemaforo(emp6), "VERMELHO");
  });

  await t.test("calcularSemaforo: qualquer nota sem grupo IBS/CBS ativa VERMELHO imediatamente", () => {
    const emp = { totalNotas: 100, totalDivergencias: 0, totalSemGrupo: 1, totalErros: 0 };
    assert.equal(calcularSemaforo(emp), "VERMELHO");
  });

  await t.test("calcularSemaforo: erro de cálculo do motor RTC ativa VERMELHO", () => {
    const emp = { totalNotas: 10, totalDivergencias: 0, totalSemGrupo: 0, totalErros: 1 };
    assert.equal(calcularSemaforo(emp), "VERMELHO");
  });

  await t.test("gerarPainelContinuaDemo: sementes completas para operação e testes offline", () => {
    const painel = gerarPainelContinuaDemo("2026-02");
    assert.equal(painel.anoMes, "2026-02");
    assert.ok(painel.empresas.length >= 3);
    assert.ok(painel.desdeOntem.notasConferidas >= 0);
    assert.ok(painel.statusFontes.sef);
    assert.ok(painel.statusFontes.sieg);
    assert.equal(painel.statusFontes.sieg.ultimosQuatro, "9876");
    assert.ok(painel.versaoCalculadora.versaoMotor);
    assert.ok(painel.limitePlano.limiteMensal > 0);
  });
});

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("licencas.test.js — Modelo de Licenças e Módulos Central Contábil", async () => {
  const {
    criarAcessoTeste,
    prorrogarTeste,
    ativarContrato,
    renovarContrato,
    alterarModulos,
    suspenderEscritorio,
    reativarEscritorio,
    encerrarEscritorio,
    statusAcesso,
    podeUsarModulo,
    gerarTokenAgente,
    revogarTokenAgente,
    calcularAcessoAte,
    definirDataFinalAcesso,
    listarEscritorios,
    listarPlanos,
    obterPlano,
    trocarPlano,
    checarLimite,
    obterConsumoPlano
  } = await import("../src/lib/multiEscritorio.mjs");

  test("cria acesso de teste com dias livres (1, 7, 45 dias) e padrão notasync", () => {
    // 1 dia
    const t1 = criarAcessoTeste({ nome: "Escritório 1 Dia", email: "e1@exemplo.com", dias: 1 });
    assert.equal(t1.escritorio.situacao, "TESTE");
    assert.deepEqual(t1.escritorio.modulos, ["notasync"]);
    const st1 = statusAcesso(t1.escritorio);
    assert.equal(st1.situacaoEfetiva, "TESTE");
    assert.ok(st1.diasRestantes >= 1 && st1.diasRestantes <= 2);
    assert.equal(st1.vencido, false);
    assert.equal(t1.escritorio.historico[0].tipo, "TESTE_CRIADO");

    // 7 dias
    const t7 = criarAcessoTeste({ nome: "Escritório 7 Dias", email: "e7@exemplo.com", dias: 7 });
    const st7 = statusAcesso(t7.escritorio);
    assert.ok(st7.diasRestantes >= 6 && st7.diasRestantes <= 8);

    // 45 dias (sem teto artificial de 30 dias)
    const t45 = criarAcessoTeste({ nome: "Escritório 45 Dias", email: "e45@exemplo.com", dias: 45 });
    const st45 = statusAcesso(t45.escritorio);
    assert.ok(st45.diasRestantes >= 44 && st45.diasRestantes <= 46);
  });

  test("prorroga teste antes e depois de vencer", () => {
    // Prorrogar teste ainda válido (soma à data atual de término)
    const t = criarAcessoTeste({ nome: "Escritório Prorroga", email: "prorroga@exemplo.com", dias: 3 });
    const inicialMs = new Date(t.escritorio.acessoAte).getTime();

    const prorrogado = prorrogarTeste(t.escritorio.id, 5);
    const novoMs = new Date(prorrogado.acessoAte).getTime();
    const diffDias = Math.round((novoMs - inicialMs) / (24 * 3600 * 1000));
    assert.equal(diffDias, 5);

    const histProrroga = prorrogado.historico.find((h) => h.tipo === "TESTE_PRORROGADO");
    assert.ok(histProrroga);
    assert.equal(histProrroga.dias, 5);

    // Prorrogar teste já vencido (soma a partir de hoje)
    const vencido = criarAcessoTeste({ nome: "Escritório Já Vencido", email: "vencido@exemplo.com", dias: 1 });
    const escNoBanco = listarEscritorios().find((e) => e.id === vencido.escritorio.id);
    if (escNoBanco) {
      escNoBanco.acessoAte = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
      escNoBanco.testeExpiraEm = escNoBanco.acessoAte;
    }
    const recuperado = prorrogarTeste(vencido.escritorio.id, 4);
    const stRec = statusAcesso(recuperado);
    assert.equal(stRec.situacaoEfetiva, "TESTE");
    assert.ok(stRec.diasRestantes >= 4 && stRec.diasRestantes <= 5);
  });

  test("ativa contrato com dias e com data final pré-determinada", () => {
    const esc = criarAcessoTeste({ nome: "Escritório Contrato", email: "contrato@exemplo.com", dias: 3 });

    // Ativação por dias (ex: 90 dias com NotaSync e Conciliação)
    const ativo90 = ativarContrato(esc.escritorio.id, {
      dias: 90,
      modulos: ["notasync", "conciliacao"],
      observacao: "Plano Trimestral NotaSync + Conciliação"
    });

    assert.equal(ativo90.situacao, "ATIVO");
    assert.deepEqual(ativo90.modulos, ["notasync", "conciliacao"]);
    const st90 = statusAcesso(ativo90);
    assert.equal(st90.situacaoEfetiva, "ATIVO");
    assert.ok(st90.diasRestantes >= 89 && st90.diasRestantes <= 91);
    assert.equal(ativo90.historico[ativo90.historico.length - 1].tipo, "CONTRATO_ATIVADO");

    // Ativação por data final (ex: final do ano)
    const ativoData = ativarContrato(esc.escritorio.id, {
      ate: "2027-12-31",
      modulos: ["notasync"],
      observacao: "Contrato Anual até 31/12/2027"
    });
    assert.match(ativoData.acessoAte, /^2027-12-31T23:59:59/);
    assert.equal(statusAcesso(ativoData).situacaoEfetiva, "ATIVO");
  });

  test("renova contrato somando a partir da data de término atual", () => {
    const esc = criarAcessoTeste({ nome: "Renovação", email: "renova@exemplo.com", dias: 3 });
    ativarContrato(esc.escritorio.id, { dias: 30 });
    const fimInicialMs = new Date(esc.escritorio.acessoAte).getTime();

    // Renova por mais 60 dias
    const renovado = renovarContrato(esc.escritorio.id, { dias: 60, observacao: "Renovação antecipada Pix" });
    const fimNovoMs = new Date(renovado.acessoAte).getTime();
    const diffDias = Math.round((fimNovoMs - fimInicialMs) / (24 * 3600 * 1000));
    assert.equal(diffDias, 60);

    const histRenova = renovado.historico.find((h) => h.tipo === "CONTRATO_RENOVADO");
    assert.ok(histRenova);
  });

  test("statusAcesso vira VENCIDO quando a data de acesso passa, mesmo gravado ATIVO ou TESTE", () => {
    const escAtivoExpirado = {
      situacao: "ATIVO",
      modulos: ["notasync"],
      acessoAte: new Date(Date.now() - 3600000).toISOString()
    };
    const st = statusAcesso(escAtivoExpirado);
    assert.equal(st.situacaoEfetiva, "VENCIDO");
    assert.equal(st.vencido, true);
    assert.equal(st.diasRestantes, 0);
    assert.equal(st.podeAcessar, false);

    // Teste expirado também vira VENCIDO
    const escTesteExpirado = {
      situacao: "TESTE",
      modulos: ["notasync"],
      acessoAte: new Date(Date.now() - 7200000).toISOString()
    };
    const st2 = statusAcesso(escTesteExpirado);
    assert.equal(st2.situacaoEfetiva, "VENCIDO");
    assert.equal(st2.podeAcessar, false);
  });

  test("podeUsarModulo só libera quando situação efetiva é TESTE ou ATIVO e o módulo está na lista", () => {
    const esc = {
      situacao: "ATIVO",
      acessoAte: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      modulos: ["notasync"]
    };

    // Módulo contratado
    assert.equal(podeUsarModulo(esc, "notasync"), true);
    assert.equal(podeUsarModulo(esc, "mod-notasync"), true);

    // Módulos não contratados
    assert.equal(podeUsarModulo(esc, "conciliacao"), false);
    assert.equal(podeUsarModulo(esc, "fiscal"), false);
    assert.equal(podeUsarModulo(esc, "horas"), false);

    // Áreas do sistema sempre liberadas
    assert.equal(podeUsarModulo(esc, "inicio"), true);
    assert.equal(podeUsarModulo(esc, "usuarios"), true);
    assert.equal(podeUsarModulo(esc, "suporte"), true);

    // Se o contrato vencer, bloqueia até o módulo contratado
    esc.acessoAte = new Date(Date.now() - 1000).toISOString();
    assert.equal(podeUsarModulo(esc, "notasync"), false);
  });

  test("geração e revogação de token do agente NotaSync com registro em histórico", () => {
    const esc = criarAcessoTeste({ nome: "Escritório Agente", email: "agente@exemplo.com", dias: 5 });

    const { rawToken, prefixo } = gerarTokenAgente(esc.escritorio.id, "Admin MakerPixel");
    assert.ok(rawToken.startsWith("mp_live_"));
    assert.ok(prefixo.startsWith("mp_live_"));
    assert.ok(esc.escritorio.agenteToken);
    assert.ok(esc.escritorio.agenteToken.tokenHash.startsWith("sha256_"));
    assert.equal(esc.escritorio.agenteToken.revogadoEm, null);

    const histToken = esc.escritorio.historico.find((h) => h.tipo === "TOKEN_GERADO");
    assert.ok(histToken);

    // Revogação
    revogarTokenAgente(esc.escritorio.id, "Admin MakerPixel");
    assert.ok(esc.escritorio.agenteToken.revogadoEm);
    const histRevoga = esc.escritorio.historico.find((h) => h.tipo === "TOKEN_REVOGADO");
    assert.ok(histRevoga);
  });

  test("suspensão, reativação e encerramento de escritório", () => {
    const esc = criarAcessoTeste({ nome: "Escritório Ciclo", email: "ciclo@exemplo.com", dias: 10 });

    suspenderEscritorio(esc.escritorio.id, "Falta de pagamento");
    assert.equal(statusAcesso(esc.escritorio).situacaoEfetiva, "SUSPENSO");
    assert.equal(podeUsarModulo(esc.escritorio, "notasync"), false);

    reativarEscritorio(esc.escritorio.id);
    assert.equal(statusAcesso(esc.escritorio).situacaoEfetiva, "ATIVO");
    assert.equal(podeUsarModulo(esc.escritorio, "notasync"), true);

    encerrarEscritorio(esc.escritorio.id, "Solicitação do cliente");
    assert.equal(statusAcesso(esc.escritorio).situacaoEfetiva, "ENCERRADO");
    assert.equal(podeUsarModulo(esc.escritorio, "notasync"), false);
  });

  test("planos cadastrados e troca de plano com registro de PLANO_ALTERADO", () => {
    const planos = listarPlanos();
    assert.ok(planos.length >= 3);
    const essencial = planos.find((p) => p.id === "plano-essencial");
    const escritorio = planos.find((p) => p.id === "plano-escritorio");
    const plus = planos.find((p) => p.id === "plano-escritorio-plus");

    assert.ok(essencial && escritorio && plus);
    assert.equal(essencial.limiteUsuarios, 2);
    assert.equal(essencial.limiteEmpresas, 20);
    assert.equal(essencial.limiteArmazenamentoGb, 5);

    // Cria escritório no plano essencial
    const esc = criarAcessoTeste({
      nome: "Escritório Plano Teste",
      email: "plano@exemplo.com",
      planoId: "plano-essencial",
      dias: 7
    });

    assert.equal(esc.escritorio.planoId, "plano-essencial");
    assert.equal(esc.escritorio.limiteUsuarios, 2);
    assert.equal(esc.escritorio.limiteEmpresas, 20);
    assert.equal(esc.escritorio.limiteArmazenamentoGb, 5);

    // Troca de plano para Escritório+
    const atualizado = trocarPlano(esc.escritorio.id, "plano-escritorio-plus", "Admin MakerPixel");
    assert.equal(atualizado.planoId, "plano-escritorio-plus");
    assert.equal(atualizado.limiteUsuarios, 15);
    assert.equal(atualizado.limiteEmpresas, 180);
    assert.equal(atualizado.limiteArmazenamentoGb, 100);

    const histPlano = atualizado.historico.find((h) => h.tipo === "PLANO_ALTERADO");
    assert.ok(histPlano);
    assert.equal(histPlano.planoNovo, "plano-escritorio-plus");
  });

  test("limites do plano (usuário, empresa e armazenamento) bloqueando com mensagem padrão", () => {
    const esc = {
      id: "esc-limites",
      planoId: "plano-essencial",
      limiteUsuarios: 2,
      limiteEmpresas: 20,
      limiteArmazenamentoGb: 5
    };

    // Usuários abaixo do limite
    const chkUserOk = checarLimite(esc, "usuarios", 1);
    assert.equal(chkUserOk.permitido, true);
    assert.equal(chkUserOk.restante, 1);

    // Usuários no limite -> bloqueio
    const chkUserBlock = checarLimite(esc, "usuarios", 2);
    assert.equal(chkUserBlock.permitido, false);
    assert.equal(chkUserBlock.mensagem, "limite do plano atingido; fale conosco para mudar de plano");

    // Empresas acima do limite -> bloqueio
    const chkEmpBlock = checarLimite(esc, "empresas", 20);
    assert.equal(chkEmpBlock.permitido, false);
    assert.equal(chkEmpBlock.mensagem, "limite do plano atingido; fale conosco para mudar de plano");

    // Armazenamento excedido -> bloqueio
    const chkStorageBlock = checarLimite(esc, "armazenamento", 5.2);
    assert.equal(chkStorageBlock.permitido, false);
    assert.equal(chkStorageBlock.mensagem, "limite do plano atingido; fale conosco para mudar de plano");
  });

  test("módulos v3 da Central Contábil: reforma (auditor IBS/CBS) e danfse (WASM)", () => {
    const esc = {
      situacao: "ATIVO",
      acessoAte: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      modulos: ["notasync", "reforma", "danfse"]
    };

    assert.equal(podeUsarModulo(esc, "reforma"), true);
    assert.equal(podeUsarModulo(esc, "mod-ibs-cbs"), true); // alias
    assert.equal(podeUsarModulo(esc, "ibs-cbs"), true);     // alias
    assert.equal(podeUsarModulo(esc, "danfse"), true);
    assert.equal(podeUsarModulo(esc, "conciliacao"), false);
  });

  test("isolamento estrito entre escritórios", () => {
    const escA = criarAcessoTeste({ nome: "Escritório A", email: "a@exemplo.com", dias: 5 });
    const escB = criarAcessoTeste({ nome: "Escritório B", email: "b@exemplo.com", dias: 5 });

    // Suspender escritório A não pode afetar escritório B
    suspenderEscritorio(escA.escritorio.id, "Teste");
    assert.equal(statusAcesso(escA.escritorio).situacaoEfetiva, "SUSPENSO");
    assert.equal(statusAcesso(escB.escritorio).situacaoEfetiva, "TESTE");

    // Trocar plano de B não afeta limites de A
    trocarPlano(escB.escritorio.id, "plano-escritorio-plus");
    const lista = listarEscritorios();
    const buscaA = lista.find((e) => e.id === escA.escritorio.id);
    const buscaB = lista.find((e) => e.id === escB.escritorio.id);

    assert.notEqual(buscaA.limiteUsuarios, buscaB.limiteUsuarios);
    assert.equal(buscaB.limiteUsuarios, 15);
  });
});

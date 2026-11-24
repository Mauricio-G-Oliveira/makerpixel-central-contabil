/*
 * emDia.mjs — Lógica de negócios do módulo Em Dia (v4.0.0, reescrito do zero).
 * Gestão diária de obrigações contábeis, checklists mensais e diário do cliente.
 */

export const SETORES = [
  { id: "FISCAL", label: "Fiscal", cor: "brand" },
  { id: "CONTABIL", label: "Contábil", cor: "indigo" },
  { id: "DP", label: "Departamento Pessoal", cor: "emerald" },
  { id: "GERAL", label: "Geral / Societário", cor: "muted" }
];

export const STATUS_TAREFA = [
  { id: "A_FAZER", label: "A Fazer", selo: "pendente" },
  { id: "EM_ANDAMENTO", label: "Em Andamento", selo: "info" },
  { id: "AGUARDANDO_CLIENTE", label: "Aguardando Cliente", selo: "aviso" },
  { id: "CONCLUIDA", label: "Concluída", selo: "ok" },
  { id: "NAO_SE_APLICA", label: "Não se Aplica", selo: "muted" }
];

export function gerarModelosPadraoDemo() {
  return [
    {
      id: "mod-das",
      nome: "DAS - Documento de Arrecadação do Simples",
      setor: "FISCAL",
      diaVencimento: 20,
      aplicaSimples: true,
      aplicaLucroPresumido: false,
      aplicaLucroReal: false,
      aplicaMei: true,
      exigeFuncionario: false,
      tipoEmpresa: "TODOS",
      ativo: true
    },
    {
      id: "mod-pgdas",
      nome: "PGDAS-D - Transmissão Mensal",
      setor: "FISCAL",
      diaVencimento: 20,
      aplicaSimples: true,
      aplicaLucroPresumido: false,
      aplicaLucroReal: false,
      aplicaMei: false,
      exigeFuncionario: false,
      tipoEmpresa: "TODOS",
      ativo: true
    },
    {
      id: "mod-dctf",
      nome: "DCTFWeb - Declaração de Débitos e Créditos",
      setor: "FISCAL",
      diaVencimento: 15,
      aplicaSimples: true,
      aplicaLucroPresumido: true,
      aplicaLucroReal: true,
      aplicaMei: false,
      exigeFuncionario: true,
      tipoEmpresa: "TODOS",
      ativo: true
    },
    {
      id: "mod-fgts",
      nome: "FGTS Digital - Guia de Recolhimento",
      setor: "DP",
      diaVencimento: 20,
      aplicaSimples: true,
      aplicaLucroPresumido: true,
      aplicaLucroReal: true,
      aplicaMei: false,
      exigeFuncionario: true,
      tipoEmpresa: "TODOS",
      ativo: true
    },
    {
      id: "mod-folha",
      nome: "Folha de Pagamento & Pró-labore",
      setor: "DP",
      diaVencimento: 5,
      aplicaSimples: true,
      aplicaLucroPresumido: true,
      aplicaLucroReal: true,
      aplicaMei: true,
      exigeFuncionario: false,
      tipoEmpresa: "TODOS",
      ativo: true
    },
    {
      id: "mod-fechamento",
      nome: "Fechamento e Conciliação Mensal",
      setor: "CONTABIL",
      diaVencimento: 25,
      aplicaSimples: true,
      aplicaLucroPresumido: true,
      aplicaLucroReal: true,
      aplicaMei: true,
      exigeFuncionario: false,
      tipoEmpresa: "TODOS",
      ativo: true
    }
  ];
}

export function gerarEmpresasEmDiaDemo() {
  return [
    {
      id: "emp-1",
      cnpj: "11222333000181",
      razaoSocial: "Mercado Modelo Ltda",
      regime: "SIMPLES_NACIONAL",
      tipo: "LTDA",
      temFuncionario: true,
      responsavelSetorFiscal: "Marcos Fiscal",
      responsavelSetorContabil: "Ana Contábil",
      responsavelSetorDp: "Carla DP"
    },
    {
      id: "emp-2",
      cnpj: "22333444000192",
      razaoSocial: "Móveis & Decorações Sul Ltda",
      regime: "LUCRO_PRESUMIDO",
      tipo: "LTDA",
      temFuncionario: true,
      responsavelSetorFiscal: "Marcos Fiscal",
      responsavelSetorContabil: "Ana Contábil",
      responsavelSetorDp: "Carla DP"
    },
    {
      id: "emp-3",
      cnpj: "33444555000103",
      razaoSocial: "Consultoria Ágil Ltda",
      regime: "SIMPLES_NACIONAL",
      tipo: "ME",
      temFuncionario: false,
      responsavelSetorFiscal: "Marcos Fiscal",
      responsavelSetorContabil: "Ana Contábil",
      responsavelSetorDp: "Carla DP"
    }
  ];
}

export function seModeloAplica(modelo, empresa) {
  if (!modelo.ativo) return false;
  if (modelo.tipoEmpresa && modelo.tipoEmpresa !== "TODOS" && modelo.tipoEmpresa !== empresa.tipo) {
    return false;
  }
  if (modelo.exigeFuncionario && !empresa.temFuncionario) {
    return false;
  }
  const reg = empresa.regime;
  if (reg === "SIMPLES_NACIONAL" && !modelo.aplicaSimples) return false;
  if (reg === "LUCRO_PRESUMIDO" && !modelo.aplicaLucroPresumido) return false;
  if (reg === "LUCRO_REAL" && !modelo.aplicaLucroReal) return false;
  if (reg === "MEI" && !modelo.aplicaMei) return false;
  return true;
}

export function gerarMesIdempotente(tarefasAtuais, empresas, modelos, mesCompetencia) {
  const mapaExistentes = new Set(
    tarefasAtuais.map((t) => `${t.empresaId}_${t.modeloId}_${t.mesCompetencia}`)
  );

  const [ano, mesStr] = mesCompetencia.split("-");
  const anoNum = parseInt(ano, 10);
  const mesNum = parseInt(mesStr, 10);
  const diasNoMes = new Date(anoNum, mesNum, 0).getDate();

  const novasTarefas = [...tarefasAtuais];
  let criadas = 0;
  let existentes = 0;

  for (const emp of empresas) {
    for (const mod of modelos) {
      if (!seModeloAplica(mod, emp)) continue;

      const chave = `${emp.id}_${mod.id}_${mesCompetencia}`;
      if (mapaExistentes.has(chave)) {
        existentes++;
        continue;
      }

      const dia = Math.min(mod.diaVencimento, diasNoMes);
      const diaFormatado = String(dia).padStart(2, "0");
      const prazo = `${mesCompetencia}-${diaFormatado}`;

      const resp =
        mod.setor === "FISCAL"
          ? emp.responsavelSetorFiscal
          : mod.setor === "DP"
          ? emp.responsavelSetorDp
          : emp.responsavelSetorContabil;

      novasTarefas.push({
        id: `tar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        empresaId: emp.id,
        empresaNome: emp.razaoSocial,
        empresaCnpj: emp.cnpj,
        modeloId: mod.id,
        nome: mod.nome,
        setor: mod.setor,
        mesCompetencia,
        prazo,
        status: "A_FAZER",
        responsavel: resp || "Equipe",
        atrasada: false,
        concluidaEm: null,
        concluidaPor: null,
        origemAutomatica: "MODELO"
      });

      mapaExistentes.add(chave);
      criadas++;
    }
  }

  return { tarefas: novasTarefas, criadas, existentes };
}

export function gerarTarefasAutomaticas(tarefasAtuais, eventos) {
  const tarefas = [...tarefasAtuais];
  let criadas = 0;

  for (const ev of eventos || []) {
    const chaveDedup = ev.chaveDeduplicacao;
    const jaExiste = tarefas.some(
      (t) => t.chaveDeduplicacao === chaveDedup && t.status !== "CONCLUIDA" && t.status !== "NAO_SE_APLICA"
    );

    if (!jaExiste) {
      tarefas.push({
        id: `tar-auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        empresaId: ev.empresaId,
        empresaNome: ev.empresaNome || "Empresa",
        empresaCnpj: ev.empresaCnpj || "",
        modeloId: null,
        nome: ev.nome,
        setor: ev.setor || "GERAL",
        mesCompetencia: ev.mesCompetencia || new Date().toISOString().slice(0, 7),
        prazo: ev.prazo || new Date().toISOString().slice(0, 10),
        status: "A_FAZER",
        responsavel: ev.responsavel || "Responsável Técnico",
        atrasada: false,
        concluidaEm: null,
        concluidaPor: null,
        origemAutomatica: ev.origem,
        chaveDeduplicacao: chaveDedup
      });
      criadas++;
    }
  }

  return { tarefas, criadas };
}

export function calcularMetricasPainel(tarefas) {
  const hoje = new Date().toISOString().slice(0, 10);
  let emDia = 0, atrasadas = 0, aguardandoCliente = 0, concluidas = 0, naoSeAplica = 0;
  const porSetor = { FISCAL: 0, CONTABIL: 0, DP: 0, GERAL: 0 };
  const porResponsavel = {};

  for (const t of tarefas) {
    if (t.status === "CONCLUIDA") {
      concluidas++;
    } else if (t.status === "NAO_SE_APLICA") {
      naoSeAplica++;
    } else if (t.status === "AGUARDANDO_CLIENTE") {
      aguardandoCliente++;
    } else if (t.prazo && t.prazo < hoje) {
      atrasadas++;
    } else {
      emDia++;
    }

    const s = t.setor || "GERAL";
    porSetor[s] = (porSetor[s] || 0) + 1;

    const r = t.responsavel || "Não atribuído";
    porResponsavel[r] = (porResponsavel[r] || 0) + 1;
  }

  return {
    totalTarefas: tarefas.length,
    emDia,
    atrasadas,
    aguardandoCliente,
    concluidas,
    naoSeAplica,
    porSetor,
    porResponsavel
  };
}

export function agruparMinhasTarefas(tarefas, usuarioNomeOuEmail) {
  const hoje = new Date().toISOString().slice(0, 10);
  const daqui7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const filtradas = tarefas.filter(
    (t) => t.status !== "CONCLUIDA" && t.status !== "NAO_SE_APLICA"
  );

  const res = {
    hoje: [],
    atrasadas: [],
    destaSemana: [],
    proximas: []
  };

  for (const t of filtradas) {
    const p = t.prazo;
    if (p < hoje) {
      res.atrasadas.push({ ...t, atrasada: true });
    } else if (p === hoje) {
      res.hoje.push({ ...t, atrasada: false });
    } else if (p <= daqui7Dias) {
      res.destaSemana.push({ ...t, atrasada: false });
    } else {
      res.proximas.push({ ...t, atrasada: false });
    }
  }

  return res;
}

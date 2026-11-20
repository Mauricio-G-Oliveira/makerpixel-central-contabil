/**
 * Gerenciamento Multi-Escritório (Multi-Tenant), Licenças e Acessos.
 *
 * Estrutura de três níveis:
 * 1. MakerPixel (ADMIN_PRODUTO)
 * 2. Escritório Contábil (ADMIN_ESCRITORIO, situação: TESTE, ATIVO, VENCIDO, SUSPENSO, ENCERRADO)
 * 3. Usuários e Empresas do escritório
 */

const STORAGE_KEY_ESCRITORIOS = "mp:escritorios";
const STORAGE_KEY_ATIVO = "mp:escritorio_ativo";
const STORAGE_KEY_SUPORTE = "mp:suporte_ativo_ate";
const STORAGE_KEY_PLANOS = "mp:planos";
const WHATSAPP_MAKERPIXEL = "5548999999999";

export const MODULOS_DISPONIVEIS = [
  { id: "notasync", nome: "NotaSync (SEF/SC & DF-e)", secao: "Fiscal", destaque: true },
  { id: "reforma", nome: "Reforma Tributária (Auditor IBS/CBS & RTC)", secao: "Fiscal", destaque: true },
  { id: "danfse", nome: "DANFSe (Gerador NFS-e WASM)", secao: "Fiscal" },
  { id: "conciliacao", nome: "Conciliação Bancária com IA", secao: "Contábil" },
  { id: "integracao", nome: "Integração Contábil", secao: "Contábil" },
  { id: "vencimentos", nome: "Departamento Cadastro (Alvarás & Certidões)", secao: "Cadastro" },
  { id: "em-dia", nome: "Em Dia (Fechamento Mensal)", secao: "Operacional" },
  { id: "fiscal", nome: "Fiscal (ICMS & ISS Municipal)", secao: "Fiscal" },
  { id: "horas", nome: "Controle de Horas (DP)", secao: "Pessoal" },
  { id: "lucros", nome: "Distribuição de Lucros & REINF", secao: "Contábil" },
];

export const PLANOS_PADRAO = [
  {
    id: "plano-essencial",
    nome: "Essencial",
    descricao: "Ideal para escritórios individuais e contadores autônomos",
    limiteUsuarios: 2,
    limiteEmpresas: 20,
    limiteArmazenamentoGb: 5,
    modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
    destaque: false
  },
  {
    id: "plano-escritorio",
    nome: "Escritório",
    descricao: "Para escritórios de pequeno e médio porte com equipe contábil",
    limiteUsuarios: 5,
    limiteEmpresas: 60,
    limiteArmazenamentoGb: 20,
    modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
    destaque: true
  },
  {
    id: "plano-escritorio-plus",
    nome: "Escritório+",
    descricao: "Para escritórios em expansão com grande volume de clientes e documentos",
    limiteUsuarios: 15,
    limiteEmpresas: 180,
    limiteArmazenamentoGb: 100,
    modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
    destaque: false
  }
];

const ESCRITORIOS_PADRAO = [
  {
    id: "esc-modelo",
    cnpj: "12.345.678/0001-90",
    razaoSocial: "Escritório Contábil Modelo",
    nomeFantasia: "Contabilidade Modelo",
    contato: "Carlos Eduardo Silveira",
    email: "carlos@contabilidademodelo.com.br",
    telefone: "(48) 3622-1000",
    cidade: "Cidade Modelo",
    uf: "SC",
    situacao: "ATIVO", // ATIVO | TESTE | VENCIDO | SUSPENSO | ENCERRADO
    planoId: "plano-escritorio-plus",
    modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
    limiteUsuarios: 15,
    limiteEmpresas: 180,
    limiteArmazenamentoGb: 100,
    observacao: "Contrato padrão MakerPixel",
    acessoAte: "2027-12-31T23:59:59.999-03:00",
    historico: [
      {
        data: "2026-01-10T08:00:00Z",
        tipo: "CONTRATO_ATIVADO",
        detalhe: "Contrato corporativo 24 meses ativado",
        modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
        autor: "MakerPixel"
      }
    ],
    agenteToken: null,
    criadoEm: "2026-01-10T08:00:00Z"
  },
  {
    id: "esc-teste-3d",
    cnpj: "98.765.432/0001-10",
    razaoSocial: "Delta Gestão Contábil Eireli",
    nomeFantasia: "Delta Contabilidade",
    contato: "Fernanda Machado",
    email: "fernanda@deltacontabil.com.br",
    telefone: "(48) 99123-4567",
    cidade: "Cidade Modelo",
    uf: "SC",
    situacao: "TESTE",
    planoId: "plano-escritorio",
    modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
    limiteUsuarios: 5,
    limiteEmpresas: 60,
    limiteArmazenamentoGb: 20,
    observacao: "Teste de avaliação completo v3",
    acessoAte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    testeExpiraEm: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    historico: [
      {
        data: new Date().toISOString(),
        tipo: "TESTE_CRIADO",
        detalhe: "Acesso de teste de 3 dias criado",
        dias: 3,
        modulos: ["notasync", "reforma", "danfse", "conciliacao", "integracao", "vencimentos", "em-dia", "fiscal", "horas", "lucros"],
        autor: "MakerPixel"
      }
    ],
    agenteToken: null,
    criadoEm: new Date().toISOString()
  }
];

function lerStorage(key, padrao) {
  if (typeof localStorage === "undefined") return padrao;
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : padrao;
  } catch (e) {
    return padrao;
  }
}

function salvarStorage(key, valor) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch (e) {}
}

/**
 * Formata data ISO para string legível DD/MM/AAAA.
 */
function formatarDataIso(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch (e) {
    return "—";
  }
}

/**
 * Calcula a data de expiração (23:59:59.999 no fuso de Brasília UTC-3) somando N dias a uma data base.
 */
export function calcularAcessoAte(dias = 3, dataBase = null) {
  const ref = dataBase ? new Date(dataBase) : new Date();
  const d = new Date(ref.getTime());
  d.setDate(d.getDate() + Number(dias));

  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}T23:59:59.999-03:00`;
}

/**
 * Define data final fixa para acesso (às 23:59:59.999 no fuso America/Sao_Paulo).
 */
export function definirDataFinalAcesso(dataStr) {
  if (!dataStr) return null;
  const limpa = String(dataStr).slice(0, 10);
  return `${limpa}T23:59:59.999-03:00`;
}

/**
 * Gera senha provisória de fácil ditado no formato Xxxx-0000-xxxx.
 */
export function gerarSenhaProvisoria() {
  const consoantes = "bcdfghjklmnpqrstvwxyz";
  const vogais = "aeiou";
  const parte = (tam) => {
    let s = "";
    for (let i = 0; i < tam; i++) {
      s += i % 2 === 0 ? consoantes[Math.floor(Math.random() * consoantes.length)] : vogais[Math.floor(Math.random() * vogais.length)];
    }
    return s;
  };
  const p1 = parte(4);
  const capital = p1.charAt(0).toUpperCase() + p1.slice(1);
  const num = String(Math.floor(1000 + Math.random() * 9000));
  const p2 = parte(4);
  return `${capital}-${num}-${p2}`;
}

export function listarEscritorios() {
  const l = lerStorage(STORAGE_KEY_ESCRITORIOS, ESCRITORIOS_PADRAO);
  return Array.isArray(l) && l.length > 0 ? l : ESCRITORIOS_PADRAO;
}

export function obterEscritorio(id) {
  const lista = listarEscritorios();
  return lista.find((e) => e && e.id === id) || lista[0] || ESCRITORIOS_PADRAO[0];
}

export function escritorioAtivo() {
  const lista = listarEscritorios();
  const idPadrao = (lista[0] && lista[0].id) ? lista[0].id : "esc-modelo";
  const idAtivo = lerStorage(STORAGE_KEY_ATIVO, idPadrao);
  return lista.find((e) => e && e.id === idAtivo) || lista[0] || ESCRITORIOS_PADRAO[0];
}

export function definirEscritorioAtivo(id) {
  salvarStorage(STORAGE_KEY_ATIVO, id);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("makerpixel:escritorio_mudou", { detail: { id } }));
  }
}

/**
 * Avalia o status efetivo do acesso do escritório (situação real, expiração e dias restantes).
 */
export function statusAcesso(escritorio) {
  if (!escritorio || typeof escritorio !== "object") {
    return {
      situacaoEfetiva: "ENCERRADO",
      diasRestantes: 0,
      venceHoje: false,
      vencido: true,
      emTeste: false,
      emContrato: false,
      suspenso: false,
      encerrado: true,
      acessoAteFmt: "—",
      podeAcessar: false
    };
  }

  const situacaoGravada = (escritorio.situacao || "TESTE").toUpperCase();

  if (situacaoGravada === "ENCERRADO") {
    return {
      situacaoEfetiva: "ENCERRADO",
      diasRestantes: 0,
      venceHoje: false,
      vencido: true,
      emTeste: false,
      emContrato: false,
      suspenso: false,
      encerrado: true,
      acessoAteFmt: escritorio.acessoAte ? formatarDataIso(escritorio.acessoAte) : "—",
      podeAcessar: false
    };
  }

  if (situacaoGravada === "SUSPENSO") {
    return {
      situacaoEfetiva: "SUSPENSO",
      diasRestantes: 0,
      venceHoje: false,
      vencido: false,
      emTeste: false,
      emContrato: false,
      suspenso: true,
      encerrado: false,
      acessoAteFmt: escritorio.acessoAte ? formatarDataIso(escritorio.acessoAte) : "—",
      podeAcessar: false
    };
  }

  const dataFimStr = escritorio.acessoAte || escritorio.testeExpiraEm;
  if (!dataFimStr) {
    // Contrato sem data de expiração (apenas por confirmação explícita)
    return {
      situacaoEfetiva: "ATIVO",
      diasRestantes: 9999,
      venceHoje: false,
      vencido: false,
      emTeste: false,
      emContrato: true,
      suspenso: false,
      encerrado: false,
      acessoAteFmt: "Sem expiração",
      podeAcessar: true
    };
  }

  const agora = Date.now();
  const fimMs = new Date(dataFimStr).getTime();
  const diffMs = fimMs - agora;
  const vencido = diffMs <= 0;
  const diasRestantes = vencido ? 0 : Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const venceHoje = diasRestantes <= 1 && !vencido;

  let situacaoEfetiva = situacaoGravada;
  if (vencido) {
    situacaoEfetiva = "VENCIDO";
  }

  return {
    situacaoEfetiva,
    diasRestantes,
    venceHoje,
    vencido,
    emTeste: situacaoEfetiva === "TESTE",
    emContrato: situacaoEfetiva === "ATIVO",
    suspenso: situacaoEfetiva === "SUSPENSO",
    encerrado: situacaoEfetiva === "ENCERRADO",
    acessoAteFmt: formatarDataIso(dataFimStr),
    podeAcessar: situacaoEfetiva === "TESTE" || situacaoEfetiva === "ATIVO"
  };
}

/**
 * Determina se o escritório tem direito de acessar determinado módulo.
 * Só é true quando a situação efetiva é TESTE ou ATIVO e o módulo consta na lista.
 */
export function podeUsarModulo(escritorio, modulo) {
  if (!modulo) return false;
  const idNormalizado = String(modulo).replace(/^mod-/, "").toLowerCase();

  // Áreas essenciais do sistema sempre liberadas
  if (["inicio", "usuarios", "suporte", "dep-empresas", "empresas"].includes(idNormalizado)) {
    return true;
  }

  const status = statusAcesso(escritorio);
  if (status.situacaoEfetiva !== "TESTE" && status.situacaoEfetiva !== "ATIVO") {
    return false;
  }

  const mapaAlias = {
    "ibs-cbs": "reforma",
    "auditor-ibs-cbs": "reforma",
    "danfse": "danfse"
  };
  const aliasResolvido = mapaAlias[idNormalizado] || idNormalizado;

  const modulos = Array.isArray(escritorio?.modulos) ? escritorio.modulos : [];
  return modulos.some((m) => {
    const limpo = String(m).replace(/^mod-/, "").toLowerCase();
    return limpo === idNormalizado || limpo === aliasResolvido;
  });
}

/**
 * Lista todos os planos cadastrados (armazenamento persistente ou sementes padrão).
 */
export function listarPlanos() {
  const planos = lerStorage(STORAGE_KEY_PLANOS, null);
  if (!Array.isArray(planos) || planos.length === 0) {
    salvarStorage(STORAGE_KEY_PLANOS, PLANOS_PADRAO);
    return PLANOS_PADRAO;
  }
  return planos;
}

/**
 * Obtém um plano pelo identificador.
 */
export function obterPlano(planoId) {
  const lista = listarPlanos();
  return lista.find((p) => p.id === planoId) || lista.find((p) => p.destaque) || lista[0];
}

/**
 * Salva ou atualiza um plano no catálogo do admin.
 */
export function salvarPlano(plano) {
  if (!plano || !plano.id) throw new Error("Dados do plano inválidos.");
  const lista = listarPlanos();
  const idx = lista.findIndex((p) => p.id === plano.id);
  if (idx >= 0) {
    lista[idx] = { ...lista[idx], ...plano };
  } else {
    lista.push(plano);
  }
  salvarStorage(STORAGE_KEY_PLANOS, lista);
  return plano;
}

/**
 * Troca o plano de um escritório, aplicando seus novos limites e registrando PLANO_ALTERADO no histórico.
 */
export function trocarPlano(id, planoId, autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  const plano = obterPlano(planoId);
  if (!plano) throw new Error("Plano não encontrado: " + planoId);

  const planoAnterior = esc.planoId || "plano-essencial";
  esc.planoId = plano.id;
  esc.limiteUsuarios = plano.limiteUsuarios;
  esc.limiteEmpresas = plano.limiteEmpresas;
  esc.limiteArmazenamentoGb = plano.limiteArmazenamentoGb;

  if (Array.isArray(plano.modulos) && plano.modulos.length > 0) {
    esc.modulos = [...plano.modulos];
  }

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "PLANO_ALTERADO",
    detalhe: `Plano alterado para ${plano.nome} (limite ${plano.limiteUsuarios} usuários, ${plano.limiteEmpresas} empresas, ${plano.limiteArmazenamentoGb} GB)`,
    planoAnterior,
    planoNovo: plano.id,
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Validação de limites do plano. Retorna objeto { permitido: boolean, mensagem: string }.
 * Mensagem padrão quando excedido: "limite do plano atingido; fale conosco para mudar de plano".
 */
export function checarLimite(escritorio, tipo, quantidadeAtual = 0) {
  if (!escritorio) {
    return { permitido: false, mensagem: "Escritório não identificado." };
  }

  const qtd = Number(quantidadeAtual) || 0;
  let limite = 0;

  if (tipo === "usuarios" || tipo === "usuario") {
    limite = Number(escritorio.limiteUsuarios) || 5;
  } else if (tipo === "empresas" || tipo === "empresa") {
    limite = Number(escritorio.limiteEmpresas) || 60;
  } else if (tipo === "armazenamento" || tipo === "upload") {
    limite = Number(escritorio.limiteArmazenamentoGb) || 20;
  } else {
    return { permitido: true };
  }

  if (qtd >= limite) {
    return {
      permitido: false,
      mensagem: "limite do plano atingido; fale conosco para mudar de plano",
      tipo,
      limite,
      atual: qtd,
      restante: 0
    };
  }

  return {
    permitido: true,
    mensagem: "OK",
    tipo,
    limite,
    atual: qtd,
    restante: Math.max(0, limite - qtd)
  };
}

/**
 * Retorna o consumo atual de recursos do plano para exibição no painel Início e no admin.
 */
export function obterConsumoPlano(escritorioId = null) {
  const esc = escritorioId ? obterEscritorio(escritorioId) : escritorioAtivo();
  if (!esc) return null;

  const plano = obterPlano(esc.planoId || "plano-escritorio");
  const limUsuarios = Number(esc.limiteUsuarios) || plano?.limiteUsuarios || 5;
  const limEmpresas = Number(esc.limiteEmpresas) || plano?.limiteEmpresas || 60;
  const limArmazenamento = Number(esc.limiteArmazenamentoGb) || plano?.limiteArmazenamentoGb || 20;

  let totalUsuarios = 1;
  let totalEmpresas = 4;
  let totalArmazenamentoGb = 0.45; // Simulação de dados

  if (typeof localStorage !== "undefined") {
    try {
      const rawUsers = localStorage.getItem("mp:usuarios");
      if (rawUsers) {
        const u = JSON.parse(rawUsers);
        if (Array.isArray(u)) totalUsuarios = u.length;
      }
    } catch (e) {}

    try {
      const rawEmp = localStorage.getItem("depCadastro:empresas");
      if (rawEmp) {
        const emps = JSON.parse(rawEmp);
        if (Array.isArray(emps)) totalEmpresas = emps.length;
      }
    } catch (e) {}
  }

  return {
    plano: plano || { id: "custom", nome: "Personalizado" },
    usuarios: {
      atual: totalUsuarios,
      limite: limUsuarios,
      percentual: Math.min(100, Math.round((totalUsuarios / limUsuarios) * 100)),
      atingido: totalUsuarios >= limUsuarios
    },
    empresas: {
      atual: totalEmpresas,
      limite: limEmpresas,
      percentual: Math.min(100, Math.round((totalEmpresas / limEmpresas) * 100)),
      atingido: totalEmpresas >= limEmpresas
    },
    armazenamento: {
      atualGb: totalArmazenamentoGb,
      limiteGb: limArmazenamento,
      percentual: Math.min(100, Math.round((totalArmazenamentoGb / limArmazenamento) * 100)),
      atingido: totalArmazenamentoGb >= limArmazenamento
    }
  };
}

/**
 * Cria um novo acesso de teste para escritório com qualquer quantidade de dias livres (>= 1).
 */
export function criarAcessoTeste({
  nome,
  cnpj,
  contato,
  email,
  telefone = "",
  cidade = "",
  uf = "SC",
  dias = 3,
  planoId = null,
  modulos = ["notasync"],
  carregarDemo = true,
  limiteUsuarios = null,
  limiteEmpresas = null,
  limiteArmazenamentoGb = null,
  observacao = "",
  autor = "MakerPixel"
}) {
  const lista = listarEscritorios();
  const id = "esc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const diasValidos = Math.max(1, Number(dias) || 3);
  const acessoAte = calcularAcessoAte(diasValidos);
  const plano = planoId ? obterPlano(planoId) : null;

  const limUsuarios = limiteUsuarios != null ? Number(limiteUsuarios) : (plano ? plano.limiteUsuarios : 3);
  const limEmpresas = limiteEmpresas != null ? Number(limiteEmpresas) : (plano ? plano.limiteEmpresas : 20);
  const limArmazenamento = limiteArmazenamentoGb != null ? Number(limiteArmazenamentoGb) : (plano ? plano.limiteArmazenamentoGb : 20);

  const novo = {
    id,
    cnpj: cnpj || "00.000.000/0001-00",
    razaoSocial: nome,
    nomeFantasia: nome,
    contato,
    email,
    telefone,
    cidade,
    uf,
    situacao: "TESTE",
    planoId: plano?.id || "plano-escritorio",
    acessoAte,
    testeExpiraEm: acessoAte,
    modulos: Array.isArray(modulos) && modulos.length > 0 ? modulos : (plano?.modulos || ["notasync"]),
    limiteUsuarios: limUsuarios,
    limiteEmpresas: limEmpresas,
    limiteArmazenamentoGb: limArmazenamento,
    observacao,
    carregarDemo,
    agenteToken: null,
    historico: [
      {
        data: new Date().toISOString(),
        tipo: "TESTE_CRIADO",
        detalhe: `Acesso de teste criado com ${diasValidos} dia(s) no plano ${plano?.nome || "Escritório"}. Expira em ${formatarDataIso(acessoAte)}.`,
        dias: diasValidos,
        plano: plano?.id,
        modulos: [...(Array.isArray(modulos) && modulos.length > 0 ? modulos : (plano?.modulos || ["notasync"]))],
        autor
      }
    ],
    criadoEm: new Date().toISOString()
  };

  const senhaProvisoria = gerarSenhaProvisoria();
  lista.push(novo);
  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  definirEscritorioAtivo(id);

  return { escritorio: novo, senhaProvisoria };
}

/**
 * Prorroga o período de teste por N dias.
 * Se o teste ainda for válido, soma a partir da data de término atual; senão, a partir de hoje.
 */
export function prorrogarTeste(id, dias = 3, autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  const diasValidos = Math.max(1, Number(dias) || 1);
  const dataAtualFim = esc.acessoAte || esc.testeExpiraEm;
  const dataBase = dataAtualFim && new Date(dataAtualFim) > new Date() ? new Date(dataAtualFim) : new Date();

  const novoAcessoAte = calcularAcessoAte(diasValidos, dataBase);
  const anterior = esc.acessoAte || esc.testeExpiraEm;

  esc.acessoAte = novoAcessoAte;
  esc.testeExpiraEm = novoAcessoAte;
  esc.situacao = "TESTE";

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "TESTE_PRORROGADO",
    detalhe: `Teste prorrogado por ${diasValidos} dia(s). Nova validade: ${formatarDataIso(novoAcessoAte)}.`,
    dias: diasValidos,
    anterior,
    novo: novoAcessoAte,
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Ativa contrato de cliente pago por dias ou data final com vinculação de plano.
 */
export function ativarContrato(id, {
  dias,
  ate,
  planoId,
  modulos,
  limiteUsuarios,
  limiteEmpresas,
  limiteArmazenamentoGb,
  observacao = "",
  semData = false,
  autor = "MakerPixel"
} = {}) {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  if (planoId) {
    const plano = obterPlano(planoId);
    if (plano) {
      esc.planoId = plano.id;
      if (!limiteUsuarios) esc.limiteUsuarios = plano.limiteUsuarios;
      if (!limiteEmpresas) esc.limiteEmpresas = plano.limiteEmpresas;
      if (!limiteArmazenamentoGb) esc.limiteArmazenamentoGb = plano.limiteArmazenamentoGb;
      if (!modulos && Array.isArray(plano.modulos)) esc.modulos = [...plano.modulos];
    }
  }

  let novoAcessoAte = null;
  if (!semData) {
    if (ate) {
      novoAcessoAte = definirDataFinalAcesso(ate);
    } else if (dias) {
      novoAcessoAte = calcularAcessoAte(dias);
    } else {
      novoAcessoAte = calcularAcessoAte(30);
    }
  }

  esc.situacao = "ATIVO";
  esc.acessoAte = novoAcessoAte;
  delete esc.testeExpiraEm;

  if (Array.isArray(modulos) && modulos.length > 0) {
    esc.modulos = modulos;
  }
  if (limiteUsuarios) esc.limiteUsuarios = Number(limiteUsuarios);
  if (limiteEmpresas) esc.limiteEmpresas = Number(limiteEmpresas);
  if (observacao) esc.observacao = observacao;

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "CONTRATO_ATIVADO",
    detalhe: observacao || `Contrato ativado até ${formatarDataIso(novoAcessoAte)}.`,
    modulos: esc.modulos,
    novo: novoAcessoAte,
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Retrocompatibilidade com conversão antiga (ativa com padrão vitalício ou 365 dias).
 */
export function converterEmCliente(id) {
  return ativarContrato(id, { semData: true, observacao: "Convertido em cliente permanente" });
}

/**
 * Renova o contrato adicionando dias ou definindo nova data final.
 */
export function renovarContrato(id, { dias, ate, observacao = "", autor = "MakerPixel" } = {}) {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  let novoAcessoAte;
  const anterior = esc.acessoAte;

  if (ate) {
    novoAcessoAte = definirDataFinalAcesso(ate);
  } else {
    const diasValidos = Math.max(1, Number(dias) || 30);
    const dataBase = esc.acessoAte && new Date(esc.acessoAte) > new Date() ? new Date(esc.acessoAte) : new Date();
    novoAcessoAte = calcularAcessoAte(diasValidos, dataBase);
  }

  esc.situacao = "ATIVO";
  esc.acessoAte = novoAcessoAte;

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "CONTRATO_RENOVADO",
    detalhe: observacao || `Contrato renovado até ${formatarDataIso(novoAcessoAte)}.`,
    anterior,
    novo: novoAcessoAte,
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Altera a lista de módulos contratados pelo escritório.
 */
export function alterarModulos(id, modulos, autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  const anterior = esc.modulos ? [...esc.modulos] : [];
  esc.modulos = Array.isArray(modulos) ? modulos : [];

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "MODULOS_ALTERADOS",
    detalhe: `Módulos alterados para: ${esc.modulos.join(", ")}`,
    anterior,
    novo: esc.modulos,
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Suspende o acesso do escritório.
 */
export function suspenderEscritorio(id, motivo = "", autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  esc.situacao = "SUSPENSO";
  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "SUSPENSO",
    detalhe: motivo || "Acesso suspenso administrativamente.",
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Reativa escritório suspenso.
 */
export function reativarEscritorio(id, autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  esc.situacao = "ATIVO";
  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "REATIVADO",
    detalhe: "Acesso reativado.",
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Encerra o contrato do escritório.
 */
export function encerrarEscritorio(id, motivo = "", autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  esc.situacao = "ENCERRADO";
  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "ENCERRADO",
    detalhe: motivo || "Contrato encerrado.",
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Hash determinístico e seguro para tokens de agente (executa no navegador e no Node.js).
 */
function calcularTokenHash(token) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < token.length; i++) {
    const ch = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "sha256_" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}

/**
 * Gera token do agente NotaSync para o escritório.
 * Retorna o rawToken (apenas visível no momento da geração) e salva o hash no escritório.
 */
export function gerarTokenAgente(id, autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  const randomPart = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  const rawToken = `mp_live_${esc.id.replace("esc-", "")}_${randomPart}`;
  const prefixo = rawToken.slice(0, 14) + "...";
  const tokenHash = calcularTokenHash(rawToken);

  esc.agenteToken = {
    tokenHash,
    prefixo,
    criadoEm: new Date().toISOString(),
    revogadoEm: null
  };

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "TOKEN_GERADO",
    detalhe: `Token do agente gerado (${prefixo}).`,
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return { rawToken, prefixo };
}

/**
 * Revoga o token do agente NotaSync do escritório.
 */
export function revogarTokenAgente(id, autor = "MakerPixel") {
  const lista = listarEscritorios();
  const esc = lista.find((e) => e.id === id);
  if (!esc) throw new Error("Escritório não encontrado.");

  if (esc.agenteToken) {
    esc.agenteToken.revogadoEm = new Date().toISOString();
  }

  if (!Array.isArray(esc.historico)) esc.historico = [];
  esc.historico.push({
    data: new Date().toISOString(),
    tipo: "TOKEN_REVOGADO",
    detalhe: "Token do agente revogado.",
    autor
  });

  salvarStorage(STORAGE_KEY_ESCRITORIOS, lista);
  return esc;
}

/**
 * Avalia o status do teste gratuito (retrocompatibilidade).
 */
export function statusTeste(escritorio) {
  const st = statusAcesso(escritorio);
  return {
    emTeste: st.emTeste || (escritorio && escritorio.situacao === "TESTE"),
    expirado: st.vencido,
    diasRestantes: st.diasRestantes,
    terminaHoje: st.venceHoje,
    expiraEmData: st.acessoAteFmt
  };
}

/**
 * Gera mensagem de convite pronta para WhatsApp ou e-mail.
 */
export function gerarMensagemConvite(escritorio, senha) {
  const url = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://mauricio-g-oliveira.github.io/makerpixel-central-contabil/";
  const st = statusAcesso(escritorio);
  const expiraStr = st.acessoAteFmt !== "—" ? st.acessoAteFmt : "";

  return `Olá ${escritorio.contato || escritorio.razaoSocial}!\n\n` +
    `Seu acesso ao Central Contábil está liberado:\n` +
    `🔗 Link: ${url}\n` +
    `👤 E-mail: ${escritorio.email}\n` +
    `🔑 Senha provisória: ${senha}\n\n` +
    (expiraStr ? `Seu acesso vai até ${expiraStr}.\n\n` : "") +
    `No primeiro acesso você poderá cadastrar a sua senha definitiva.\n` +
    `Equipe MakerPixel`;
}

/**
 * Suporte com autorização por 24h.
 */
export function liberarSuporte24h() {
  const ate = Date.now() + 24 * 60 * 60 * 1000;
  salvarStorage(STORAGE_KEY_SUPORTE, ate);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("makerpixel:suporte_mudou"));
  }
}

export function isSuporteAtivo() {
  const ate = lerStorage(STORAGE_KEY_SUPORTE, 0);
  return Date.now() < ate;
}

export function revogarSuporte() {
  salvarStorage(STORAGE_KEY_SUPORTE, 0);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("makerpixel:suporte_mudou"));
  }
}

/**
 * Link para contratação via WhatsApp com mensagem pré-definida.
 */
export function linkContratarWhatsApp(escritorio, moduloNome = "") {
  const modTxt = moduloNome ? ` para o módulo ${moduloNome}` : "";
  const escTxt = escritorio ? ` para o escritório ${escritorio.razaoSocial || escritorio.nomeFantasia}` : "";
  const texto = encodeURIComponent(`Olá! Gostaria de contratar o Central Contábil${modTxt}${escTxt}.`);
  return `https://wa.me/${WHATSAPP_MAKERPIXEL}?text=${texto}`;
}

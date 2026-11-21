/**
 * notasync.mjs — Lógica de negócio do módulo NotaSync (NFC-e SEF/SC).
 * Baseado no Boletim Técnico SEF/SC 2026/003, v1.00-1 (Distribuição de NFC-e para Contadores).
 * 
 * Regras:
 * - Validação e extração de chaves de acesso NFC-e (modelo 65);
 * - Parser e simulação de loteDistComp (gzip + base64 + XML);
 * - Máquina de estados das regras de consumo SEF (118/117/110/657);
 * - Dicionário de erros traduzidos da SEF com ação sugerida (incluindo o erro 8002);
 * - Deduplicação e marcação de cancelamento por chave de acesso;
 * - Exportação de relatórios.
 */


/**
 * Valida o dígito verificador da chave de acesso de 44 dígitos pela regra do Módulo 11.
 * Pesos de 2 a 9 da direita para a esquerda.
 */
export function validarChaveAcesso(chave) {
  if (typeof chave !== "string") return false;
  const limpa = chave.replace(/\D/g, "");
  if (limpa.length !== 44) return false;

  const corpo = limpa.slice(0, 43);
  const dvInformado = Number.parseInt(limpa[43], 10);

  let soma = 0;
  let peso = 2;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += Number.parseInt(corpo[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  const dvCalculado = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return dvInformado === dvCalculado;
}

/**
 * Calcula o DV de uma chave de 43 dígitos.
 */
export function calcularDvChave(chave43) {
  const limpa = String(chave43 || "").replace(/\D/g, "").slice(0, 43);
  if (limpa.length !== 43) return 0;
  let soma = 0;
  let peso = 2;
  for (let i = limpa.length - 1; i >= 0; i--) {
    soma += Number.parseInt(limpa[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/**
 * Formata a chave de acesso em blocos legíveis de 4 dígitos.
 */
export function formatarChaveAcesso(chave) {
  if (!chave) return "";
  const limpa = String(chave).replace(/\D/g, "");
  if (limpa.length !== 44) return chave;
  return limpa.replace(/(\d{4})/g, "$1 ").trim();
}

/**
 * Extrai os metadados contidos nos 44 dígitos da chave de acesso.
 */
export function extrairDadosChave(chave) {
  const limpa = String(chave || "").replace(/\D/g, "");
  if (limpa.length !== 44) return null;
  return {
    cUF: limpa.slice(0, 2),
    anoMes: limpa.slice(2, 6),
    cnpjEmitente: limpa.slice(6, 20),
    modelo: limpa.slice(20, 22), // 65 = NFC-e, 55 = NF-e
    serie: Number.parseInt(limpa.slice(22, 25), 10),
    numero: Number.parseInt(limpa.slice(25, 34), 10),
    tpEmis: limpa.slice(34, 35),
    codigoNumerico: limpa.slice(35, 43),
    cDV: Number.parseInt(limpa.slice(43, 44), 10),
  };
}

/**
 * Catálogo oficial de cStat traduzidos da SEF/SC com a ação prática recomendada.
 */
export const ERROS_SEF = {
  108: {
    motivo: "SEF/SC temporariamente fora do ar ou em manutenção.",
    acao: "Aguardar alguns minutos e o agente tentará automaticamente.",
    severidade: "aviso",
  },
  109: {
    motivo: "Serviço da SEF/SC paralisado momentaneamente.",
    acao: "O agente tentará novamente na próxima janela programada.",
    severidade: "aviso",
  },
  110: {
    motivo: "Uso indevido do web service (consultas repetidas sem intervalo).",
    acao: "Aguardar 1 hora obrigatória antes de realizar nova requisição para este CNPJ.",
    severidade: "atencao",
  },
  117: {
    motivo: "Fim do lote de notas para este CNPJ (nenhum documento novo).",
    acao: "Empresa sincronizada. Próxima busca agendada para daqui a 12 horas.",
    severidade: "ok",
  },
  118: {
    motivo: "Lote de documentos localizado com sucesso na SEF/SC.",
    acao: "Processando os documentos fiscais recebidos.",
    severidade: "ok",
  },
  252: {
    motivo: "Ambiente informado não homologado (tpAmb diferente de 1).",
    acao: "Verificar a configuração do agente (o web service da SEF/SC opera somente em produção).",
    severidade: "erro",
  },
  280: {
    motivo: "Certificado Digital do transmissor inválido.",
    acao: "Conferir se o arquivo .pfx do contador é um e-CPF ou e-CNPJ ICP-Brasil válido.",
    severidade: "erro",
  },
  281: {
    motivo: "Certificado Digital do transmissor vencido.",
    acao: "Renovar o certificado digital A1 do escritório de contabilidade.",
    severidade: "erro",
  },
  284: {
    motivo: "Certificado Digital revogado pelo emissor.",
    acao: "Emitir um novo certificado digital válido junto à autoridade certificadora.",
    severidade: "erro",
  },
  486: {
    motivo: "CNPJ do emitente consultado inválido.",
    acao: "Conferir o número de inscrição no Cadastro de Empresas.",
    severidade: "erro",
  },
  589: {
    motivo: "Período consultado fora do limite permitido (apenas mês atual e 2 anteriores).",
    acao: "Ajustar o filtro de busca para o período regulamentar da SEF/SC.",
    severidade: "aviso",
  },
  657: {
    motivo: "Bloqueio temporário por excesso de requisições na SEF/SC.",
    acao: "Pausar as buscas desta empresa e aguardar liberação da SEF (não repetir mais de 3 vezes).",
    severidade: "bloqueio",
  },
  8001: {
    motivo: "Chave de acesso não pertence ao contabilista transmissor.",
    acao: "Verificar se a chave de acesso consultada pertence aos clientes da carteira.",
    severidade: "atencao",
  },
  8002: {
    motivo: "Contador transmissor não consta como Contabilista Vinculado no SAT da SEF/SC.",
    acao: "Acesse o portal SAT da SEF/SC e vincule o CPF/CNPJ do escritório a esta empresa.",
    severidade: "atencao",
    destaque: true,
  },
  8004: {
    motivo: "NSU solicitado não pertence à faixa do contabilista.",
    acao: "O agente reiniciará a busca a partir do último NSU confirmado.",
    severidade: "aviso",
  },
  9999: {
    motivo: "Erro não catalogado nos servidores da SEF/SC.",
    acao: "Aguardar retorno da estabilidade do web service da Fazenda.",
    severidade: "erro",
  },
};

/**
 * Traduz o código de status retornado pela SEF/SC em linguagem clara para o usuário contábil.
 */
export function traduzirErroSef(cStat, xMotivoOriginal = "") {
  const cod = Number(cStat);
  const def = ERROS_SEF[cod];
  if (def) {
    return {
      cStat: cod,
      motivo: def.motivo,
      acao: def.acao,
      severidade: def.severidade,
      destaque: !!def.destaque,
      detalheOriginal: xMotivoOriginal,
    };
  }

  // Faixas agrupadas
  if (cod >= 214 && cod <= 250) {
    return {
      cStat: cod,
      motivo: `Erro de schema no envelope XML da requisição (${cod}).`,
      acao: "Atualizar o agente NotaSync para a versão compatível com a SEF/SC.",
      severidade: "erro",
      detalheOriginal: xMotivoOriginal,
    };
  }
  if (cod >= 282 && cod <= 286) {
    return {
      cStat: cod,
      motivo: `Cadeia de certificação inválida ou certificado não reconhecido (${cod}).`,
      acao: "Instalar a cadeia V5/V10 da ICP-Brasil no computador do agente.",
      severidade: "erro",
      detalheOriginal: xMotivoOriginal,
    };
  }

  return {
    cStat: cod,
    motivo: xMotivoOriginal || `Status SEF/SC ${cod}`,
    acao: "Consultar o log de execução do agente ou o suporte da SEF/SC.",
    severidade: cod < 200 ? "ok" : "atencao",
    detalheOriginal: xMotivoOriginal,
  };
}

/**
 * Regras de consumo da SEF/SC (Máquina de estados):
 * - cStat 118 com 50 docs: buscar próximo lote imediatamente;
 * - cStat 118 com <50 docs ou 117: sincronizado, aguardar 12h;
 * - cStat 110: uso indevido, aguardar 1h;
 * - cStat 657: bloqueio por excesso, parar tentativas (máx 3);
 * - Atualiza o ultNuNSU da empresa.
 */
export function processarRetornoSef(resposta, estadoEmpresa = {}) {
  const cStat = Number(resposta.cStat || 0);
  const qtDfe = Number(resposta.qtDfeRet || 0);
  const ultNuNSURet = Number(resposta.ultNuNSURet || estadoEmpresa.ultNuNSU || 0);
  const tentativas = (estadoEmpresa.tentativas || 0) + 1;

  const resultado = {
    empresaId: estadoEmpresa.id,
    cnpj: estadoEmpresa.cnpj,
    cStat,
    xMotivo: resposta.xMotivo,
    traducao: traduzirErroSef(cStat, resposta.xMotivo),
    ultNuNSU: Math.max(estadoEmpresa.ultNuNSU || 0, ultNuNSURet),
    qtdDocumentos: qtDfe,
    bloqueado: false,
    acaoRecomendada: "",
    proximaConsultaMs: 0,
    tentativas,
  };

  // 1. Sucesso com lote cheio (50 docs): busca contínua imediata
  if (cStat === 118 && qtDfe >= 50) {
    resultado.acaoRecomendada = "BUSCAR_PROXIMO_LOTE";
    resultado.proximaConsultaMs = 0; // Imediato
    resultado.tentativas = 0;
    return resultado;
  }

  // 2. Sucesso com fim da fila (<50 docs) ou 117 (sem novas notas)
  if ((cStat === 118 && qtDfe < 50) || cStat === 117) {
    resultado.acaoRecomendada = "SINCRONIZADO_AGUARDAR_12H";
    resultado.proximaConsultaMs = 12 * 60 * 60 * 1000; // 12 horas
    resultado.tentativas = 0;
    return resultado;
  }

  // 3. Uso indevido (110): espera 1 hora
  if (cStat === 110) {
    resultado.acaoRecomendada = "AGUARDAR_1H";
    resultado.proximaConsultaMs = 60 * 60 * 1000; // 1 hora
    return resultado;
  }

  // 4. Bloqueio por excesso (657): paralisação e backoff
  if (cStat === 657) {
    resultado.bloqueado = true;
    resultado.acaoRecomendada = "BLOQUEIO_EXCESSO_PARAR";
    resultado.proximaConsultaMs = 24 * 60 * 60 * 1000; // Aguardar 24 horas
    return resultado;
  }

  // 5. Erro 8002 (sem vínculo SAT): aguarda ação humana
  if (cStat === 8002) {
    resultado.acaoRecomendada = "VINCULAR_SAT_SEF";
    resultado.proximaConsultaMs = 6 * 60 * 60 * 1000;
    return resultado;
  }

  // 6. Demais erros temporários: tentar no máximo 3 vezes com backoff exponencial
  if (tentativas >= 3) {
    resultado.bloqueado = true;
    resultado.acaoRecomendada = "LIMITE_TENTATIVAS_EXCEDIDO";
    resultado.proximaConsultaMs = 12 * 60 * 60 * 1000;
  } else {
    resultado.acaoRecomendada = "RETRY_TEMPORARIO";
    resultado.proximaConsultaMs = tentativas * 15 * 60 * 1000; // 15m, 30m
  }

  return resultado;
}

/**
 * Deduplica documentos pela chave de acesso.
 * Se uma nota já autorizada receber um evento de cancelamento (110111/110112),
 * sua situação é atualizada para CANCELADA sem duplicar o registro.
 */
export function deduplicarDocumentos(atuais = [], novos = []) {
  const mapa = new Map();

  for (const doc of atuais) {
    mapa.set(doc.chave, { ...doc });
  }

  for (const doc of novos) {
    const existente = mapa.get(doc.chave);
    if (!existente) {
      mapa.set(doc.chave, { ...doc });
    } else {
      // Se a nova entrada for cancelamento, prevalece
      if (doc.situacao === "CANCELADA" || doc.tpEvento === "110111" || doc.tpEvento === "110112") {
        existente.situacao = "CANCELADA";
        existente.motivoCancelamento = doc.motivoCancelamento || "Cancelada na SEF/SC";
        existente.dataCancelamento = doc.dataCancelamento || doc.dataEmissao;
      }
      // Mantém o maior NSU
      if (doc.nsu && (!existente.nsu || doc.nsu > existente.nsu)) {
        existente.nsu = doc.nsu;
      }
    }
  }

  return Array.from(mapa.values()).sort((a, b) => {
    // Ordem decrescente de data
    return new Date(b.dataEmissao || 0).getTime() - new Date(a.dataEmissao || 0).getTime();
  });
}

/**
 * Gera o envelope SOAP oficial do pedido de download de NFC-e conforme
 * Boletim Técnico SEF/SC 2026/003, v1.00-1.
 * Sem espaços entre tags, UTF-8.
 */
export function gerarEnvelopeDistNFCe({ cnpjContador, ultNuNSU = 0, indAtor = 1, indXML = 1, chaveAcesso = null }) {
  const cnpjLimpo = String(cnpjContador || "").replace(/\D/g, "").padStart(14, "0");

  let solucaoXml = "";
  if (chaveAcesso) {
    const chLimpa = String(chaveAcesso).replace(/\D/g, "");
    solucaoXml = `<solDFe><chAcesso>${chLimpa}</chAcesso></solDFe>`;
  } else {
    solucaoXml = `<solRel><indXML>${indXML}</indXML><indAtor>${indAtor}</indAtor><ultNuNSU>${ultNuNSU}</ultNuNSU></solRel>`;
  }

  const corpoXml = `<distNFCeSC versao="1.00" xmlns="http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1"><tpAmb>1</tpAmb><verAplic>notasync 1.0</verAplic><cUF>42</cUF><CNPJ>${cnpjLimpo}</CNPJ>${solucaoXml}</distNFCeSC>`;

  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfceDownloadContab xmlns="http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1"><nfceDadosMsg>${corpoXml}</nfceDadosMsg></nfceDownloadContab></soap12:Body></soap12:Envelope>`;
}

/**
 * Empacota uma lista de documentos em base64 de um gzip contendo <loteDistNFCeSC>,
 * no formato padrão do web service da SEF/SC.
 */
export async function empacotarLoteSef(documentos = []) {
  let xmlItens = "";
  for (const doc of documentos) {
    xmlItens += `<distNFCeSC NSU="${doc.nsu}" chAcesso="${doc.chave}"><nfeProc versao="4.00"><NFe><infNFe><ide><nNF>${doc.numero || 1}</nNF><serie>${doc.serie || 1}</serie><dhEmi>${doc.dataEmissao || "2026-11-01T10:00:00-03:00"}</dhEmi></ide><emit><CNPJ>${doc.cnpjEmitente}</CNPJ></emit><total><ICMSTot><vNF>${(doc.valorTotal || 0).toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe></nfeProc></distNFCeSC>`;
  }
  const xmlLote = `<loteDistNFCeSC xmlns="http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1">${xmlItens}</loteDistNFCeSC>`;

  if (typeof CompressionStream !== "undefined") {
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(xmlLote));
    writer.close();
    const reader = cs.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(merged).toString("base64");
    }
    let binary = "";
    for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
    return btoa(binary);
  }
  return "";
}

/**
 * Desempacota e decodifica o loteDistComp retornado pela SEF/SC.
 */
export async function desempacotarLoteSef(loteDistCompBase64) {
  if (!loteDistCompBase64) return [];
  let xmlDescompactado = "";

  if (typeof DecompressionStream !== "undefined") {
    let bytes;
    if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(loteDistCompBase64, "base64");
    } else {
      const binary = atob(loteDistCompBase64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    }
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    xmlDescompactado = new TextDecoder("utf-8").decode(merged);
  }

  const documentos = [];
  const regexItem = /<distNFCeSC\s+NSU="(\d+)"\s+chAcesso="(\d{44})">([\s\S]*?)<\/distNFCeSC>/g;
  let match;

  while ((match = regexItem.exec(xmlDescompactado)) !== null) {
    const [, nsu, chAcesso, conteudo] = match;
    const ehCancelamento = conteudo.includes("<procEventoNFe") || conteudo.includes("110111") || conteudo.includes("110112");

    let vNF = 0;
    const vMatch = /<vNF>([\d.]+)<\/vNF>/.exec(conteudo);
    if (vMatch) vNF = Number.parseFloat(vMatch[1]);

    let dhEmi = new Date().toISOString();
    const dMatch = /<dhEmi>([^<]+)<\/dhEmi>/.exec(conteudo);
    if (dMatch) dhEmi = dMatch[1];

    let nNF = 0;
    const nMatch = /<nNF>(\d+)<\/nNF>/.exec(conteudo);
    if (nMatch) nNF = Number.parseInt(nMatch[1], 10);

    let serie = 1;
    const sMatch = /<serie>(\d+)<\/serie>/.exec(conteudo);
    if (sMatch) serie = Number.parseInt(sMatch[1], 10);

    const dadosChave = extrairDadosChave(chAcesso);

    documentos.push({
      chave: chAcesso,
      nsu: Number.parseInt(nsu, 10),
      cnpjEmitente: (dadosChave && dadosChave.cnpjEmitente) || "",
      numero: nNF || (dadosChave && dadosChave.numero) || 0,
      serie: serie || (dadosChave && dadosChave.serie) || 1,
      dataEmissao: dhEmi,
      valorTotal: vNF,
      situacao: ehCancelamento ? "CANCELADA" : "AUTORIZADA",
    });
  }

  return documentos;
}

/**
 * Gera sementes de demonstração (NFC-e fictícias válidas) para 4 empresas da carteira.
 */
export function gerarSementesNfceDemo() {
  const empresas = [
    { id: "emp-1", nome: "Mercado Modelo Ltda", cnpj: "11222333000181" },
    { id: "emp-2", nome: "Padaria & Confeitaria Central Ltda", cnpj: "44555666000177" },
    { id: "emp-3", nome: "Farmácia Exemplo Ltda", cnpj: "77888999000155" },
    { id: "emp-4", nome: "Posto Exemplo Ltda", cnpj: "12345678000195" },
  ];

  const documentos = [];
  let nsuAtual = 1001;

  for (const emp of empresas) {
    const qtdNotas = 35; // notas do mês
    for (let i = 1; i <= qtdNotas; i++) {
      const dia = (i % 28) + 1;
      const diaFmt = String(dia).padStart(2, "0");
      const valor = Number((15 + (i * 7.35) % 380).toFixed(2));
      const cancelada = i === 7 || i === 22; // algumas canceladas para conferência

      // Chave de 44 dígitos com DV válido
      const uf = "42"; // SC
      const aamm = "2611"; // Nov/2026
      const cnpj = emp.cnpj;
      const mod = "65"; // NFC-e
      const serie = "001";
      const nNF = String(i).padStart(9, "0");
      const tpEmis = "1"; // normal
      const cNF = String(10000000 + i).slice(-8);

      const raizChave = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
      const dv = calcularDvChave(raizChave);
      const chaveCompleta = `${raizChave}${dv}`;

      documentos.push({
        chave: chaveCompleta,
        empresaId: emp.id,
        empresaNome: emp.nome,
        cnpjEmitente: emp.cnpj,
        numero: i,
        serie: 1,
        dataEmissao: `2026-11-${diaFmt}T14:${String(i % 59).padStart(2, "0")}:00-03:00`,
        valorTotal: valor,
        situacao: cancelada ? "CANCELADA" : "AUTORIZADA",
        motivoCancelamento: cancelada ? "Cancelamento homologado pelo emitente" : null,
        nsu: nsuAtual++,
        origem: "SEF_SC_WS",
      });
    }
  }

  const execucoes = [
    {
      id: "exec-1",
      empresaId: "emp-1",
      empresaNome: "Mercado Modelo Ltda",
      dataHora: "2026-11-17T11:30:00-03:00",
      cStat: 117,
      xMotivo: "Fim do lote de notas",
      qtd: 35,
      duracaoMs: 1420,
      status: "SINCRONIZADO",
    },
    {
      id: "exec-2",
      empresaId: "emp-2",
      empresaNome: "Padaria & Confeitaria Central Ltda",
      dataHora: "2026-11-17T11:31:15-03:00",
      cStat: 117,
      xMotivo: "Fim do lote de notas",
      qtd: 35,
      duracaoMs: 1180,
      status: "SINCRONIZADO",
    },
    {
      id: "exec-3",
      empresaId: "emp-3",
      empresaNome: "Farmácia Exemplo Ltda",
      dataHora: "2026-11-17T11:32:40-03:00",
      cStat: 117,
      xMotivo: "Fim do lote de notas",
      qtd: 35,
      duracaoMs: 1650,
      status: "SINCRONIZADO",
    },
    {
      id: "exec-4",
      empresaId: "emp-4",
      empresaNome: "Posto Exemplo Ltda",
      dataHora: "2026-11-17T11:33:05-03:00",
      cStat: 8002,
      xMotivo: "Contador transmissor não é contabilista deste CNPJ no SAT",
      qtd: 0,
      duracaoMs: 820,
      status: "PENDENTE_VINCULO_SAT",
    },
  ];

  return { documentos, execucoes, empresas };
}

/**
 * Exporta uma lista de notas para formato CSV contábil compatível com Excel.
 */
export function exportarNfceParaCsv(documentos = []) {
  const cabecalho = "Chave de Acesso;Número;Série;Data Emissão;CNPJ Emitente;Empresa;Valor (R$);Situação;NSU";
  const linhas = documentos.map((d) => {
    const valorFmt = (d.valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return `${d.chave};${d.numero};${d.serie};${d.dataEmissao};${d.cnpjEmitente};${d.empresaNome || ""};${valorFmt};${d.situacao};${d.nsu || ""}`;
  });
  return [cabecalho, ...linhas].join("\r\n");
}

/**
 * Valida se uma data de emissão está dentro da janela regulamentar da SEF/SC (mês atual e 2 anteriores, tolerância 1 dia).
 * Em conformidade com o Boletim Técnico 2026/003 (Central Contábil v3 Fase 2).
 */
export function validarPeriodoDisponivelSef(dataEmissao, agora = new Date()) {
  const d = dataEmissao instanceof Date ? dataEmissao : new Date(dataEmissao);
  const ref = agora instanceof Date ? agora : new Date(agora);

  if (Number.isNaN(d.getTime())) {
    return { disponivel: false, motivo: "Data de emissão inválida" };
  }

  // Tolerância máxima de 1 dia para emissões ligeiramente futuras (relógio desajustado)
  const limiteFuturo = new Date(ref.getTime() + 24 * 60 * 60 * 1000);
  if (d > limiteFuturo) {
    return { disponivel: false, motivo: "Data futura além da tolerância permitida de 1 dia" };
  }

  // Início dos 2 meses anteriores (ex.: Nov/2026 -> 01/09/2026 00:00:00)
  const anoAtual = ref.getFullYear();
  const mesAtual = ref.getMonth();
  const limitePassado = new Date(anoAtual, mesAtual - 2, 1, 0, 0, 0, 0);

  if (d < limitePassado) {
    return {
      disponivel: false,
      motivo: "Período expirado na SEF/SC (disponíveis apenas o mês atual e os 2 meses anteriores)"
    };
  }

  return { disponivel: true, motivo: "Dentro da janela regulamentar SEF/SC" };
}

/**
 * Valida os pré-requisitos para envio de certificado A1 ao cofre seguro (Fase 3).
 */
export function validarUploadCertificadoA1({ tamanhoBytes, senha, aceitouTermo }) {
  if (!aceitouTermo) {
    return { valido: false, erro: "É obrigatório aceitar o termo de custódia e uso seguro do certificado digital." };
  }
  if (!senha || senha.trim().length === 0) {
    return { valido: false, erro: "A senha do certificado digital é obrigatória." };
  }
  if (tamanhoBytes > 50 * 1024) {
    return { valido: false, erro: "Certificado excede o limite máximo permitido de 50 KB." };
  }
  return { valido: true };
}

/**
 * Aplica máscara de privacidade para titular do certificado (CPF ou CNPJ).
 */
export function mascararTitularCertificado(titular, documento, tipo = "E_CNPJ") {
  const docLimpo = String(documento || "").replace(/\D/g, "");
  let docMascarado = "";

  if (docLimpo.length === 14) {
    // 12.***.***/0001-90
    docMascarado = `${docLimpo.slice(0, 2)}.***.***/${docLimpo.slice(8, 12)}-${docLimpo.slice(12, 14)}`;
  } else if (docLimpo.length === 11) {
    // ***.456.789-**
    docMascarado = `***.${docLimpo.slice(3, 6)}.${docLimpo.slice(6, 9)}-**`;
  }

  let nome = String(titular || "").trim();
  if (nome.includes(":")) {
    nome = nome.substring(0, nome.indexOf(":")).trim();
  }

  if (docMascarado) {
    return `${nome} (${docMascarado})`;
  }
  return nome;
}

/**
 * Calcula status e alertas de vencimento do certificado (avisos em 30, 15 e 7 dias).
 */
export function calcularStatusVencimentoCertificado(dataValidade, agora = new Date()) {
  if (!dataValidade) {
    return { diasRestantes: 0, status: "DESCONHECIDO", alerta: null };
  }
  const val = dataValidade instanceof Date ? dataValidade : new Date(dataValidade);
  const ref = agora instanceof Date ? agora : new Date(agora);

  const diffMs = val.getTime() - ref.getTime();
  const diasRestantes = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diasRestantes < 0) {
    return { diasRestantes, status: "EXPIRADO", alerta: "Certificado digital expirado!" };
  }
  if (diasRestantes <= 7) {
    return { diasRestantes, status: "CRITICO_7_DIAS", alerta: `Atenção crítica: certificado vence em ${diasRestantes} dias!` };
  }
  if (diasRestantes <= 15) {
    return { diasRestantes, status: "ALERTA_15_DIAS", alerta: `Alerta: certificado vence em ${diasRestantes} dias.` };
  }
  if (diasRestantes <= 30) {
    return { diasRestantes, status: "AVISO_30_DIAS", alerta: `Aviso: certificado vence em ${diasRestantes} dias.` };
  }
  return { diasRestantes, status: "OK", alerta: null };
}

/**
 * Valida o dígito verificador de um CNPJ (Módulo 11).
 */
export function validarCnpjModulo11(cnpj) {
  if (!cnpj) return false;
  const limpo = String(cnpj).replace(/\D/g, "");
  if (limpo.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(limpo)) return false;

  const peso1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += Number.parseInt(limpo[i], 10) * peso1[i];
  }
  let r = soma % 11;
  const dv1 = r < 2 ? 0 : 11 - r;
  if (Number.parseInt(limpo[12], 10) !== dv1) return false;

  const peso2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += Number.parseInt(limpo[i], 10) * peso2[i];
  }
  r = soma % 11;
  const dv2 = r < 2 ? 0 : 11 - r;
  return Number.parseInt(limpo[13], 10) === dv2;
}

/**
 * Analisa e importa linhas de um arquivo CSV de empresas respeitando o limite do plano.
 */
export function parsearEmpresasCsv(conteudoCsv, limiteEmpresas = 20, jaCadastradasCnpjs = new Set()) {
  const linhas = String(conteudoCsv || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const empresasValidas = [];
  const erros = [];
  let jaCadastradasQtd = 0;
  let limiteAtingido = false;

  const setCnpjs = new Set(jaCadastradasCnpjs);

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (i === 0 && linha.toLowerCase().includes("cnpj")) continue; // Pula cabeçalho

    const partes = linha.includes(";") ? linha.split(";") : linha.split(",");
    const rawCnpj = partes[0] ? partes[0].trim() : "";
    const rawRazao = partes[1] ? partes[1].trim() : `Empresa ${rawCnpj}`;
    const cnpjLimpo = rawCnpj.replace(/\D/g, "");

    if (!validarCnpjModulo11(cnpjLimpo)) {
      erros.push({ linha: i + 1, cnpj: rawCnpj, motivo: "Dígito verificador do CNPJ inválido" });
      continue;
    }

    if (setCnpjs.has(cnpjLimpo)) {
      jaCadastradasQtd++;
      continue;
    }

    if (setCnpjs.size >= limiteEmpresas) {
      limiteAtingido = true;
      erros.push({ linha: i + 1, cnpj: rawCnpj, motivo: `Limite de empresas do plano atingido (${limiteEmpresas})` });
      continue;
    }

    setCnpjs.add(cnpjLimpo);
    empresasValidas.push({
      cnpj: cnpjLimpo,
      razaoSocial: rawRazao,
      ativo: true
    });
  }

  return {
    totalLinhas: linhas.length,
    empresasValidas,
    erros,
    jaCadastradasQtd,
    limiteAtingido
  };
}

/**
 * Verifica se a empresa está no período de espera regulamentar da SEF/SC (HTTP 429).
 */
export function verificarEsperaBuscaAgora(proximaConsulta, agora = new Date()) {
  if (!proximaConsulta) return { podeConsultar: true, segundosRestantes: 0 };
  const prox = proximaConsulta instanceof Date ? proximaConsulta : new Date(proximaConsulta);
  const ref = agora instanceof Date ? agora : new Date(agora);

  const diffMs = prox.getTime() - ref.getTime();
  if (diffMs > 0) {
    const segundosRestantes = Math.ceil(diffMs / 1000);
    return {
      podeConsultar: false,
      segundosRestantes,
      permitidoAPartirDe: prox.toISOString(),
      erro: "Aguarde o intervalo regulamentar da SEF/SC antes de uma nova busca."
    };
  }
  return { podeConsultar: true, segundosRestantes: 0 };
}



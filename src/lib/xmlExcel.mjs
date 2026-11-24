/**
 * xmlExcel.mjs — Conversor universal de XML (NF-e, NFC-e, NFS-e) e notas do NotaSync para Excel (XLSX).
 * Gera planilhas completas com abas separadas para "Notas Fiscais" e "Itens dos Produtos e Serviços".
 */
import { arvore } from "./xmlParser.mjs";
import { carregarXlsx } from "./leitores.js";

function busca(el, nome) {
  if (!el) return null;
  for (const f of el.filhos || []) {
    if (f.nome === nome) return f;
    const x = busca(f, nome);
    if (x) return x;
  }
  return null;
}

function texto(el, nome) {
  const n = busca(el, nome);
  return n ? (n.texto || "").trim() : "";
}

function todos(el, nome, out = []) {
  for (const f of el.filhos || []) {
    if (f.nome === nome) out.push(f);
    todos(f, nome, out);
  }
  return out;
}

function num(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Converte um XML avulso de NF-e, NFC-e ou NFS-e em estrutura unificada de nota e itens.
 */
export function converterXml(xmlTexto, nomeArquivo = "documento.xml") {
  let raiz;
  try {
    raiz = arvore(xmlTexto);
  } catch (e) {
    return { ok: false, erro: "XML malformado: " + e.message, nota: null, itens: [] };
  }

  const doc = { nome: "#doc", filhos: [raiz], texto: "", attrs: {} };

  // Verifica se é NFS-e
  const isNfse = busca(doc, "nfse") || busca(doc, "dps") || busca(doc, "infnfse");
  if (isNfse) {
    const numNfse = texto(doc, "nnfse") || texto(doc, "ndps") || texto(doc, "numero") || "1";
    const dataEmi = texto(doc, "dhemi") || texto(doc, "dataemissao") || "";
    const prestador = texto(doc, "xnome") || texto(doc, "razaosocial") || "Prestador";
    const cnpjPrest = texto(doc, "cnpj") || "";
    const toma = busca(doc, "tomador") || busca(doc, "toma") || doc;
    const tomador = texto(toma, "xnome") || texto(toma, "razaosocial") || "Tomador";
    const cnpjToma = texto(toma, "cnpj") || texto(toma, "cpf") || "";
    const vServ = num(texto(doc, "vserv") || texto(doc, "valorservicos"));
    const vIss = num(texto(doc, "viss") || texto(doc, "valoriss"));
    const desc = texto(doc, "xdescserv") || texto(doc, "discriminacao") || "Serviço Prestado";

    const nota = {
      arquivo: nomeArquivo,
      chave: texto(doc, "chavenfse") || texto(doc, "id") || "",
      modelo: "NFS-e",
      numero: numNfse,
      serie: texto(doc, "serie") || "1",
      dataEmissao: dataEmi,
      emitenteCnpj: cnpjPrest,
      emitenteNome: prestador,
      destinatarioCnpj: cnpjToma,
      destinatarioNome: tomador,
      valorProdutos: vServ,
      valorTotal: vServ,
      baseIcms: 0,
      valorIcms: 0,
      baseIss: vServ,
      valorIss: vIss,
      valorPis: num(texto(doc, "vpis")),
      valorCofins: num(texto(doc, "vcofins")),
      valorCbs: num(texto(doc, "vcbs")),
      valorIbs: num(texto(doc, "vibs"))
    };

    const item = {
      arquivo: nomeArquivo,
      numeroNota: numNfse,
      nItem: 1,
      codigo: texto(doc, "cserv") || "01",
      descricao: desc,
      ncm: "",
      cfop: "",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: vServ,
      valorTotal: vServ,
      cst: texto(doc, "cst") || "000",
      cClassTrib: texto(doc, "cclasstrib") || "",
      valorIcms: 0,
      valorIss: vIss,
      valorCbs: nota.valorCbs,
      valorIbs: nota.valorIbs
    };

    return { ok: true, nota, itens: [item] };
  }

  // Tratamento de NF-e (55) ou NFC-e (65)
  const infNFe = busca(doc, "infnfe");
  const ide = busca(infNFe || doc, "ide");
  const emit = busca(infNFe || doc, "emit");
  const dest = busca(infNFe || doc, "dest");
  const total = busca(infNFe || doc, "total");
  const icmsTot = busca(total || doc, "icmstot");

  let chave = "";
  if (infNFe && infNFe.attrs && infNFe.attrs.id) {
    chave = infNFe.attrs.id.replace(/\D/g, "");
  } else {
    chave = texto(doc, "chfe") || texto(doc, "chavenfe") || "";
  }

  const modelo = texto(ide, "mod") || (chave.length === 44 ? chave.slice(20, 22) : "55");
  const numero = texto(ide, "nnf") || (chave.length === 44 ? String(parseInt(chave.slice(25, 34), 10)) : "1");
  const serie = texto(ide, "serie") || "1";
  const dataEmissao = texto(ide, "dhemi") || texto(ide, "demi") || "";

  const emitCnpj = texto(emit, "cnpj") || texto(emit, "cpf") || "";
  const emitNome = texto(emit, "xnome") || "";
  const destCnpj = texto(dest, "cnpj") || texto(dest, "cpf") || "";
  const destNome = texto(dest, "xnome") || "Consumidor Final";

  const vProd = num(texto(icmsTot, "vprod"));
  const vNF = num(texto(icmsTot, "vnf")) || vProd;
  const vBC = num(texto(icmsTot, "vbc"));
  const vICMS = num(texto(icmsTot, "vicms"));
  const vPIS = num(texto(icmsTot, "vpis"));
  const vCOFINS = num(texto(icmsTot, "vcofins"));
  const ibsCbsTot = busca(total || doc, "ibscbstot");
  let vCBS = num(texto(ibsCbsTot, "vcbs"));
  let vIBS = num(texto(ibsCbsTot, "vibs"));

  const dets = todos(infNFe || doc, "det");
  const itens = dets.map((det, i) => {
    const prod = busca(det, "prod");
    const imposto = busca(det, "imposto");
    const icmsGrp = busca(imposto, "icms");
    const ibsCbsGrp = busca(imposto, "ibscbs");

    const nItem = det.attrs?.nitem || (i + 1);
    const cProd = texto(prod, "cprod") || String(nItem);
    const xProd = texto(prod, "xprod") || `Item ${nItem}`;
    const ncm = texto(prod, "ncm") || "";
    const cfop = texto(prod, "cfop") || "";
    const uCom = texto(prod, "ucom") || "UN";
    const qCom = num(texto(prod, "qcom")) || 1;
    const vUnCom = num(texto(prod, "vuncom")) || 0;
    const vItemProd = num(texto(prod, "vprod")) || (qCom * vUnCom);

    // CST ICMS
    let cstIcms = "";
    if (icmsGrp && icmsGrp.filhos && icmsGrp.filhos[0]) {
      const g = icmsGrp.filhos[0];
      cstIcms = texto(g, "cst") || texto(g, "csosn") || "";
    }

    const cstIbs = texto(ibsCbsGrp, "cst") || "";
    const cClass = texto(ibsCbsGrp, "cclasstrib") || "";
    const vItemCbs = num(texto(ibsCbsGrp, "vcbs"));
    const vItemIbs = num(texto(ibsCbsGrp, "vibs"));

    return {
      arquivo: nomeArquivo,
      numeroNota: numero,
      nItem,
      codigo: cProd,
      descricao: xProd,
      ncm,
      cfop,
      unidade: uCom,
      quantidade: qCom,
      valorUnitario: vUnCom,
      valorTotal: vItemProd,
      cst: cstIbs || cstIcms || "000",
      cClassTrib: cClass,
      valorIcms: num(texto(icmsGrp, "vicms")),
      valorIss: 0,
      valorCbs: vItemCbs,
      valorIbs: vItemIbs
    };
  });

  // Se cabeçalho não continha totais, agrega a partir dos itens
  const somaItens = itens.reduce((acc, it) => acc + (it.valorTotal || 0), 0);
  const somaCbsItens = itens.reduce((acc, it) => acc + (it.valorCbs || 0), 0);
  const somaIbsItens = itens.reduce((acc, it) => acc + (it.valorIbs || 0), 0);
  const somaIcmsItens = itens.reduce((acc, it) => acc + (it.valorIcms || 0), 0);

  const valorTotalFinal = vNF > 0 ? vNF : somaItens;
  const valorProdutosFinal = vProd > 0 ? vProd : somaItens;
  if (!vCBS && somaCbsItens > 0) vCBS = Math.round(somaCbsItens * 100) / 100;
  if (!vIBS && somaIbsItens > 0) vIBS = Math.round(somaIbsItens * 100) / 100;
  const valorIcmsFinal = vICMS > 0 ? vICMS : somaIcmsItens;

  const nota = {
    arquivo: nomeArquivo,
    chave,
    modelo: modelo === "65" ? "NFC-e (65)" : "NF-e (55)",
    numero,
    serie,
    dataEmissao,
    emitenteCnpj: emitCnpj,
    emitenteNome: emitNome,
    destinatarioCnpj: destCnpj,
    destinatarioNome: destNome,
    valorProdutos: valorProdutosFinal,
    valorTotal: valorTotalFinal,
    baseIcms: vBC || (valorIcmsFinal > 0 ? valorProdutosFinal : 0),
    valorIcms: valorIcmsFinal,
    baseIss: 0,
    valorIss: 0,
    valorPis: vPIS,
    valorCofins: vCOFINS,
    valorCbs: vCBS,
    valorIbs: vIBS
  };

  return { ok: true, nota, itens };
}

/**
 * Processa uma lista de arquivos ou textos XML e agrega notas e itens.
 */
export function processarLoteXml(listaXmls = []) {
  const notas = [];
  const itens = [];
  const erros = [];

  for (const arq of listaXmls) {
    const res = converterXml(arq.texto || arq.xml, arq.nome || "nota.xml");
    if (res.ok) {
      if (res.nota) notas.push(res.nota);
      if (res.itens) itens.push(...res.itens);
    } else {
      erros.push({ nome: arq.nome, erro: res.erro });
    }
  }

  // Totais consolidados
  const totais = {
    totalNotas: notas.length,
    totalItens: itens.length,
    faturamentoTotal: Math.round(notas.reduce((acc, n) => acc + (n.valorTotal || 0), 0) * 100) / 100,
    totalIcms: Math.round(notas.reduce((acc, n) => acc + (n.valorIcms || 0), 0) * 100) / 100,
    totalIss: Math.round(notas.reduce((acc, n) => acc + (n.valorIss || 0), 0) * 100) / 100,
    totalCbs: Math.round(notas.reduce((acc, n) => acc + (n.valorCbs || 0), 0) * 100) / 100,
    totalIbs: Math.round(notas.reduce((acc, n) => acc + (n.valorIbs || 0), 0) * 100) / 100
  };

  return { notas, itens, totais, erros };
}

/**
 * Gera e dispara o download da planilha Excel XLSX com as abas Notas e Itens.
 */
export async function exportarLoteParaXlsx(notas, itens, nomeArquivo = "exportacao_notas_fiscais.xlsx") {
  const XLSX = await carregarXlsx();

  // Cabeçalhos e linhas da aba Notas Fiscais
  const cabNotas = [
    "Arquivo",
    "Chave de Acesso",
    "Modelo",
    "Número",
    "Série",
    "Data de Emissão",
    "CNPJ Emitente",
    "Razão Social Emitente",
    "CNPJ/CPF Destinatário",
    "Nome Destinatário",
    "Valor dos Produtos (R$)",
    "Valor Total da Nota (R$)",
    "Base ICMS (R$)",
    "Valor ICMS (R$)",
    "Base ISS (R$)",
    "Valor ISS (R$)",
    "PIS (R$)",
    "COFINS (R$)",
    "CBS Reforma (R$)",
    "IBS Reforma (R$)"
  ];

  const linhasNotas = [cabNotas];
  for (const n of notas) {
    linhasNotas.push([
      n.arquivo,
      n.chave,
      n.modelo,
      n.numero,
      n.serie,
      n.dataEmissao,
      n.emitenteCnpj,
      n.emitenteNome,
      n.destinatarioCnpj,
      n.destinatarioNome,
      n.valorProdutos,
      n.valorTotal,
      n.baseIcms,
      n.valorIcms,
      n.baseIss,
      n.valorIss,
      n.valorPis,
      n.valorCofins,
      n.valorCbs,
      n.valorIbs
    ]);
  }

  // Cabeçalhos e linhas da aba Itens das Notas
  const cabItens = [
    "Arquivo",
    "Número da Nota",
    "Item",
    "Código do Produto",
    "Descrição da Mercadoria / Serviço",
    "NCM",
    "CFOP",
    "Unidade",
    "Quantidade",
    "Valor Unitário (R$)",
    "Valor Total do Item (R$)",
    "CST",
    "cClassTrib",
    "Valor ICMS (R$)",
    "Valor ISS (R$)",
    "Valor CBS (R$)",
    "Valor IBS (R$)"
  ];

  const linhasItens = [cabItens];
  for (const it of itens) {
    linhasItens.push([
      it.arquivo,
      it.numeroNota,
      it.nItem,
      it.codigo,
      it.descricao,
      it.ncm,
      it.cfop,
      it.unidade,
      it.quantidade,
      it.valorUnitario,
      it.valorTotal,
      it.cst,
      it.cClassTrib,
      it.valorIcms,
      it.valorIss,
      it.valorCbs,
      it.valorIbs
    ]);
  }

  const wb = XLSX.utils.book_new();
  const wsNotas = XLSX.utils.aoa_to_sheet(linhasNotas);
  const wsItens = XLSX.utils.aoa_to_sheet(linhasItens);

  // Ajuste de largura das colunas
  wsNotas["!cols"] = [
    { wch: 20 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
    { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }
  ];

  wsItens["!cols"] = [
    { wch: 20 }, { wch: 12 }, { wch: 6 }, { wch: 16 }, { wch: 40 }, { wch: 12 },
    { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 8 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, wsNotas, "Notas Fiscais");
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens dos Produtos");

  XLSX.writeFile(wb, nomeArquivo);
}

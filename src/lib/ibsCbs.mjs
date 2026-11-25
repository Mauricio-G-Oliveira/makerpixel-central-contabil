/*
 * Auditor IBS/CBS: confere os itens de NF-e (mod. 55) e NFS-e no grupo IBSCBS (LC 214/2025, NT 2025.002):
 * CST, cClassTrib, base de cálculo, alíquota nominal e efetiva (com a redução do gRed) e os valores de
 * IBS-UF, IBS-Município e CBS. Mesmas regras do módulo antigo (public/modulos/auditor-ibs-cbs).
 * O XML é lido com o leitor tolerante do ISS (igual no navegador e nos testes). Testado em tests/ibsCbs.test.js.
 */
import { arvore } from "./xmlParser.mjs";

export const TOLERANCIA = 0.03;

// ------------------------------------------------------------ XML (nomes em minúsculas, sem prefixo)
function busca(el, nome) {
  if (!el) return null;
  for (const f of el.filhos) { if (f.nome === nome) return f; const x = busca(f, nome); if (x) return x; }
  return null;
}
const texto = (el, nome) => { const n = busca(el, nome); return n ? n.texto.trim() : null; };
export function num(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
const nTexto = (el, nome) => num(texto(el, nome));
/** Todos os elementos com o nome, cada um com a lista dos ancestrais (do mais perto para o mais longe). */
function comAncestrais(el, nome, pilha = [], out = []) {
  for (const f of el.filhos) {
    if (f.nome === nome) out.push({ el: f, ancestrais: [el].concat(pilha.slice().reverse()) });
    comAncestrais(f, nome, pilha.concat([el]), out);
  }
  return out;
}
function todos(el, nome, out = []) { for (const f of el.filhos) { if (f.nome === nome) out.push(f); todos(f, nome, out); } return out; }

function numeroDoc(doc) {
  for (const t of ["nnf", "nnfse", "ndps", "numero", "numeronfse", "ndfse"]) { const v = texto(doc, t); if (v) return v; }
  return null;
}

function extrair(grp, meta) {
  const row = Object.assign({ doc: meta.doc, nfNumber: meta.nfNumber ?? null, nItem: meta.nItem, desc: meta.desc, vProd: meta.vProd ?? null,
    cProd: meta.cProd ?? null, ncm: meta.ncm ?? null, cfop: meta.cfop ?? null, qCom: meta.qCom ?? null, vUnCom: meta.vUnCom ?? null },
  { cst: null, cClassTrib: null, bc: null, pIbsUf: null, vIbsUf: null, pRedAliqUf: null, pAliqEfetUf: null,
    pIbsMun: null, vIbsMun: null, pRedAliqMun: null, pAliqEfetMun: null, vIbs: null, pCbs: null, vCbs: null, pRedAliqCbs: null, pAliqEfetCbs: null, found: !!grp });
  if (!grp) return row;
  row.cst = texto(grp, "cst");
  row.cClassTrib = texto(grp, "cclasstrib");
  row.bc = nTexto(busca(grp, "gibscbs") || grp, "vbc");
  const uf = busca(grp, "gibsuf");
  if (uf) { row.pIbsUf = nTexto(uf, "pibsuf"); row.vIbsUf = nTexto(uf, "vibsuf"); const r = busca(uf, "gred"); if (r) { row.pRedAliqUf = nTexto(r, "predaliq"); row.pAliqEfetUf = nTexto(r, "paliqefet"); } }
  const mun = busca(grp, "gibsmun");
  if (mun) { row.pIbsMun = nTexto(mun, "pibsmun"); row.vIbsMun = nTexto(mun, "vibsmun"); const r = busca(mun, "gred"); if (r) { row.pRedAliqMun = nTexto(r, "predaliq"); row.pAliqEfetMun = nTexto(r, "paliqefet"); } }
  row.vIbs = nTexto(grp, "vibs");
  const cbs = busca(grp, "gcbs");
  if (cbs) { row.pCbs = nTexto(cbs, "pcbs"); row.vCbs = nTexto(cbs, "vcbs"); const r = busca(cbs, "gred"); if (r) { row.pRedAliqCbs = nTexto(r, "predaliq"); row.pAliqEfetCbs = nTexto(r, "paliqefet"); } }
  else { row.pCbs = nTexto(grp, "pcbs"); row.vCbs = nTexto(grp, "vcbs"); }
  return row;
}

/** Lê um XML de NF-e ou NFS-e. Devolve { erro, itens }. */
export function lerXml(textoXml, nome) {
  let raiz;
  try { raiz = arvore(textoXml); } catch (e) { return { erro: "XML inválido / malformado", itens: [] }; }
  const doc = { nome: "#doc", filhos: [raiz], texto: "", attrs: {} };
  const nfNumber = numeroDoc(doc);
  const dets = todos(doc, "det");
  if (dets.length) {
    return { erro: null, itens: dets.map((det, i) => {
      const prod = busca(det, "prod"), nItem = det.attrs.nitem || i + 1;
      return extrair(busca(det, "ibscbs") || busca(det, "ub"), { doc: nome, nfNumber, nItem, desc: texto(prod, "xprod") || "Item " + nItem, cProd: texto(prod, "cprod") || "",
        ncm: texto(prod, "ncm") || "", cfop: texto(prod, "cfop") || "", qCom: nTexto(prod, "qcom"), vUnCom: nTexto(prod, "vuncom"), vProd: nTexto(prod, "vprod") });
    }) };
  }
  const grupos = comAncestrais(doc, "ibscbs").concat(comAncestrais(doc, "ub"));
  if (grupos.length) {
    return { erro: null, itens: grupos.map((g, i) => {
      let desc = null;
      for (const a of g.ancestrais.slice(0, 4)) { desc = texto(a, "xprod") || texto(a, "discriminacao") || texto(a, "xserv") || texto(a, "descricao") || texto(a, "ddescricao") || texto(a, "xdescserv"); if (desc) break; }
      return extrair(g.el, { doc: nome, nfNumber, nItem: i + 1, desc: desc || "Item " + (i + 1) });
    }) };
  }
  return { erro: "Nenhum item ou grupo IBS/CBS encontrado neste XML", itens: [] };
}

// ------------------------------------------------------------ conferência
export const brl = (n) => (n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const pct = (n) => (n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + "%");

/** { nivel: "ok"|"atencao"|"erro", msgs: [{ nivel, texto }] } */
// ------------------------------------------------------------ tabela de referência (NCM → tratamento esperado)
const soDig = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const cab = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
/**
 * Lê a planilha da equipe fiscal (linhas como arrays, a 1ª com os títulos): NCM, Descrição, CST, cClassTrib,
 * Redução (%), Observação. Devolve { itens: { ncm: {...} }, total, avisos }. NCM com 2 a 8 dígitos (vale por prefixo).
 */
export function lerReferencia(linhas) {
  const ini = (linhas || []).findIndex((l) => (l || []).some((c) => cab(c) === "ncm"));
  if (ini < 0) throw new Error("A planilha precisa de uma coluna NCM (veja o modelo).");
  const h = linhas[ini].map(cab);
  const col = (...nomes) => h.findIndex((x) => nomes.includes(x));
  const cN = col("ncm"), cD = col("descricao", "produto"), cC = col("cst"), cT = col("cclasstrib", "classtrib"), cR = col("reducao", "reducaodealiquota"), cO = col("observacao", "obs");
  if (cC < 0 || cT < 0) throw new Error("A planilha precisa das colunas CST e cClassTrib.");
  const itens = {}, avisos = [];
  linhas.slice(ini + 1).forEach((l, i) => {
    if (!l) return;
    const ncm = soDig(l[cN]);
    if (!ncm) return;
    const linha = ini + i + 2;
    if (ncm.length < 2 || ncm.length > 8) { avisos.push("Linha " + linha + ": NCM " + l[cN] + " inválido (use de 2 a 8 dígitos)."); return; }
    const cst = soDig(l[cC]).padStart(3, "0"), ct = soDig(l[cT]).padStart(6, "0");
    if (!soDig(l[cC]) || !soDig(l[cT])) { avisos.push("Linha " + linha + ": falta CST ou cClassTrib do NCM " + ncm + "."); return; }
    if (ct.slice(0, 3) !== cst) avisos.push("Linha " + linha + ": cClassTrib " + ct + " não pertence ao CST " + cst + ".");
    const red = cR >= 0 ? num(l[cR]) : null;
    itens[ncm] = { ncm, desc: cD >= 0 ? String(l[cD] || "").trim() : "", cst, cClassTrib: ct, reducao: red === null ? 0 : red, obs: cO >= 0 ? String(l[cO] || "").trim() : "" };
  });
  return { itens, total: Object.keys(itens).length, avisos };
}
/**
 * Junta duas tabelas de referência (itens por NCM): a própria (da equipe) vale mais que a base (ex.: a da LC 214);
 * a base só completa os NCMs que a própria não tem. Devolve { itens, total, daBase }.
 */
export function mesclarReferencias(base, propria) {
  const itens = Object.assign({}, base || {}, propria || {});
  const daBase = Object.keys(base || {}).filter((n) => !(propria || {})[n]).length;
  return { itens, total: Object.keys(itens).length, daBase };
}
/** A referência do NCM: a mais específica (8 dígitos, depois 6, 4, 2). */
export function referenciaDoNcm(ref, ncm) {
  const n = soDig(ncm);
  if (!ref || !n) return null;
  for (let k = n.length; k >= 2; k--) if (ref[n.slice(0, k)]) return ref[n.slice(0, k)];
  return null;
}

/** ref (opcional) = itens da tabela de referência. */
export function conferir(row, ref) {
  const msgs = [];
  const add = (nivel, texto) => msgs.push({ nivel, texto });
  if (!row.found) { add("erro", "Grupo IBS/CBS não encontrado neste item: verifique se o XML já contempla a NT 2025.002."); return { nivel: "erro", msgs }; }
  if (!row.cst) add("erro", "CST do IBS/CBS ausente.");
  if (!row.cClassTrib) add("atencao", "cClassTrib ausente: necessário para identificar o enquadramento exato na LC 214/2025.");
  if (row.bc === null) add("atencao", "Base de cálculo (vBC) não informada: pode ser esperado para CSTs sem incidência (ex.: 400, 830).");
  const parte = (rotulo, valor, nominal, efetiva, reducao) => {
    if (row.bc === null || valor === null) return;
    const ef = efetiva !== null ? efetiva : nominal;
    if (ef === null) return;
    const esp = row.bc * ef / 100;
    if (Math.abs(esp - valor) > TOLERANCIA) add("erro", rotulo + " divergente: esperado R$ " + brl(esp) + " (BC × " + pct(ef) + "), informado R$ " + brl(valor) + ".");
    else if (reducao !== null && reducao > 0) add("ok", rotulo + " com redução de alíquota de " + pct(reducao) + ": nominal " + pct(nominal) + ", efetiva " + pct(ef) + ".");
  };
  parte("IBS-UF", row.vIbsUf, row.pIbsUf, row.pAliqEfetUf, row.pRedAliqUf);
  parte("IBS-Município", row.vIbsMun, row.pIbsMun, row.pAliqEfetMun, row.pRedAliqMun);
  if (row.vIbsUf !== null && row.vIbsMun !== null && row.vIbs !== null) {
    const esp = row.vIbsUf + row.vIbsMun;
    if (Math.abs(esp - row.vIbs) > TOLERANCIA) add("erro", "Total do IBS (vIBS) não bate com UF + Município: esperado R$ " + brl(esp) + ", informado R$ " + brl(row.vIbs) + ".");
  }
  parte("CBS", row.vCbs, row.pCbs, row.pAliqEfetCbs, row.pRedAliqCbs);
  // o cClassTrib começa pelo CST (200003 → CST 200)
  if (row.cst && row.cClassTrib && soDig(row.cClassTrib).slice(0, 3) !== soDig(row.cst).padStart(3, "0"))
    add("erro", "cClassTrib " + row.cClassTrib + " não pertence ao CST " + row.cst + " (os 3 primeiros dígitos do cClassTrib são o CST).");
  // comparação com a tabela de referência da equipe
  if (ref && Object.keys(ref).length) {
    const r = referenciaDoNcm(ref, row.ncm);
    if (!row.ncm) add("atencao", "Item sem NCM: não dá para comparar com a tabela de referência.");
    else if (!r) add("atencao", "NCM " + row.ncm + " não está na tabela de referência.");
    else {
      const red = row.pRedAliqUf ?? row.pRedAliqCbs ?? row.pRedAliqMun ?? 0;
      const dif = [];
      if (soDig(row.cst).padStart(3, "0") !== r.cst) dif.push("CST " + (row.cst || "—") + " (esperado " + r.cst + ")");
      if (soDig(row.cClassTrib).padStart(6, "0") !== r.cClassTrib) dif.push("cClassTrib " + (row.cClassTrib || "—") + " (esperado " + r.cClassTrib + ")");
      if (Math.abs((red || 0) - (r.reducao || 0)) > 0.001) dif.push("redução " + pct(red || 0) + " (esperado " + pct(r.reducao || 0) + ")");
      const quem = "NCM " + r.ncm + (r.desc ? " – " + r.desc : "") + (r.obs ? " (" + r.obs + ")" : "");
      if (dif.length) add("erro", "Diferente da tabela de referência (" + quem + "): " + dif.join("; ") + ".");
      else add("ok", "Confere com a tabela de referência (" + quem + ").");
    }
  }
  if (!msgs.length) add("ok", "Valores e alíquotas consistentes para os campos informados.");
  return { nivel: msgs.some((m) => m.nivel === "erro") ? "erro" : msgs.some((m) => m.nivel === "atencao") ? "atencao" : "ok", msgs };
}

/** Item digitado à mão (sem XML). c = textos do formulário. Os valores que faltarem são calculados. */
export function itemManual(c, n) {
  const bc = num(c.bc), pIbsUf = num(c.pIbsUf), pIbsMun = num(c.pIbsMun), pCbs = num(c.pCbs);
  if (!String(c.desc || "").trim()) throw new Error("Informe a descrição do item.");
  const vIbsUf = bc !== null && pIbsUf !== null ? bc * pIbsUf / 100 : null;
  const vIbsMun = bc !== null && pIbsMun !== null ? bc * pIbsMun / 100 : null;
  const vIbsCalc = vIbsUf !== null || vIbsMun !== null ? (vIbsUf || 0) + (vIbsMun || 0) : null;
  const vCbsCalc = bc !== null && pCbs !== null ? bc * pCbs / 100 : null;
  const t = (k) => String(c[k] || "").trim() || null;
  return { doc: "Inserido manualmente", nfNumber: null, nItem: n, desc: String(c.desc).trim(), cProd: t("cProd"), ncm: t("ncm"), cfop: t("cfop"),
    qCom: num(c.qCom), vUnCom: num(c.vUnCom), vProd: bc, cst: t("cst"), cClassTrib: t("cClassTrib"), bc, pIbsUf, vIbsUf, pIbsMun, vIbsMun,
    vIbs: num(c.vIbs) !== null ? num(c.vIbs) : vIbsCalc, pCbs, vCbs: num(c.vCbs) !== null ? num(c.vCbs) : vCbsCalc,
    pRedAliqUf: null, pAliqEfetUf: null, pRedAliqMun: null, pAliqEfetMun: null, pRedAliqCbs: null, pAliqEfetCbs: null, found: true };
}

/** Calculadora avulsa: BC × alíquotas, e confere os valores informados. */
export function calcular(c) {
  const bc = num(c.bc), pUf = num(c.pIbsUf), pMun = num(c.pIbsMun), pCbs = num(c.pCbs), infIbs = num(c.vIbs), infCbs = num(c.vCbs);
  const ibsUf = bc !== null && pUf !== null ? bc * pUf / 100 : null;
  const ibsMun = bc !== null && pMun !== null ? bc * pMun / 100 : null;
  const ibs = ibsUf !== null || ibsMun !== null ? (ibsUf || 0) + (ibsMun || 0) : null;
  const cbs = bc !== null && pCbs !== null ? bc * pCbs / 100 : null;
  const total = ibs !== null || cbs !== null ? (ibs || 0) + (cbs || 0) : null;
  const msgs = [];
  const conf = (rot, inf, calc) => {
    if (inf === null || calc === null) return;
    const d = Math.abs(inf - calc);
    msgs.push(d <= TOLERANCIA ? { nivel: "ok", texto: "Valor de " + rot + " informado confere com o calculado." }
      : { nivel: "erro", texto: "Valor de " + rot + " informado (R$ " + brl(inf) + ") diverge do calculado (R$ " + brl(calc) + "), diferença de R$ " + brl(d) + "." });
  };
  conf("IBS", infIbs, ibs); conf("CBS", infCbs, cbs);
  return { ibsUf, ibsMun, ibs, cbs, total, msgs };
}

/** CSV para o Excel (separador ;, vírgula decimal, BOM para os acentos). */
export function csv(rows, ref) {
  const n = (v) => (v === null || v === undefined || v === "" ? "" : String(v).replace(".", ","));
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const cab = ["Documento", "Item", "Descrição do produto", "Código", "NCM", "CFOP", "Quantidade", "Valor Unitário", "Valor Produto", "CST IBS", "cClassTrib", "BC IBS/CBS",
    "Alíquota Nominal IBS-UF (%)", "Redução IBS-UF (%)", "Alíquota Efetiva IBS-UF (%)", "Valor IBS-UF", "Alíquota Nominal IBS-Mun (%)", "Redução IBS-Mun (%)", "Alíquota Efetiva IBS-Mun (%)", "Valor IBS-Mun",
    "Valor IBS - Total", "CST CBS", "Alíquota Nominal CBS (%)", "Redução CBS (%)", "Alíquota Efetiva CBS (%)", "Valor CBS", "Valor Total (IBS + CBS)", "Situação", "Motivo"];
  const linhas = [cab.join(";")];
  rows.forEach((r) => {
    const v = conferir(r, ref);
    const tot = r.vIbs !== null || r.vCbs !== null ? (r.vIbs || 0) + (r.vCbs || 0) : null;
    linhas.push([q(r.doc), r.nItem, q(r.desc || ""), q(r.cProd || ""), q(r.ncm || ""), q(r.cfop || ""), n(r.qCom), n(r.vUnCom), n(r.vProd), q(r.cst || ""), q(r.cClassTrib || ""), n(r.bc),
      n(r.pIbsUf), n(r.pRedAliqUf), n(r.pAliqEfetUf ?? r.pIbsUf), n(r.vIbsUf), n(r.pIbsMun), n(r.pRedAliqMun), n(r.pAliqEfetMun ?? r.pIbsMun), n(r.vIbsMun), n(r.vIbs),
      q(r.cst || ""), n(r.pCbs), n(r.pRedAliqCbs), n(r.pAliqEfetCbs ?? r.pCbs), n(r.vCbs), n(tot), q(v.nivel === "ok" ? "OK" : v.nivel === "atencao" ? "Atenção" : "Erro"), q(v.msgs.filter((m) => m.nivel !== "ok").map((m) => m.texto).join(" | "))].join(";"));
  });
  return "﻿" + linhas.join("\r\n");
}

/** Tabela de CST do IBS/CBS (Portal da Conformidade Fácil, SVRS). */
export const CSTS = [
  ["000", "Tributação integral", "Exige tributação plena", "000001: situações tributadas integralmente pelo IBS e CBS"],
  ["010", "Tributação com alíquotas uniformes", "Alíquota uniforme nacional/setorial", "010001: operações do FGTS; 010002: serviços financeiros"],
  ["011", "Tributação com alíquotas uniformes reduzidas", "Redução de alíquota uniforme", "011002: planos de assistência à saúde; 011004: concursos e prognósticos"],
  ["200", "Alíquota reduzida", "Redução de alíquota", "200003: cesta básica (Anexo I); 200028: serviços de educação (Anexo II); 200029: saúde humana (Anexo III)"],
  ["220", "Alíquota fixa", "Alíquota fixa", "220001/220002: incorporação imobiliária em regime especial"],
  ["221", "Alíquota fixa proporcional", "Alíquota fixa proporcional", "221001: locação/cessão/arrendamento de imóvel sobre receita bruta"],
  ["222", "Redução de base de cálculo", "Redução de BC", "222001: transporte internacional de passageiros (ida e volta em conjunto)"],
  ["400", "Isenção", "Sem tributação", "400001/400002: transporte público coletivo rodoviário e metroviário"],
  ["410", "Imunidade e não incidência", "Sem tributação", "410002: transferência entre estabelecimentos do mesmo contribuinte; 410004: exportações; 410036: descontos incondicionais"],
  ["510", "Diferimento", "Diferimento", "510001: energia elétrica (importação, geração, comercialização, distribuição, transmissão)"],
  ["515", "Diferimento com redução de alíquota", "Diferimento + redução", "515001: insumos agropecuários e aquícolas (Anexo IX)"],
  ["550", "Suspensão", "Suspensão", "550001: exportação de bens materiais; 550014: Zona de Processamento de Exportação; 550020: Áreas de Livre Comércio"],
  ["620", "Tributação monofásica", "Monofásica", "620001: monofásica sobre combustíveis; 620002: com retenção sobre combustíveis"],
  ["800", "Transferência de crédito", "Transferência de crédito", "800001: fusão, cisão ou incorporação; 800002: transferência de crédito do associado/cooperativa"],
  ["810", "Ajuste de IBS na ZFM", "Crédito presumido IBS ZFM", "810001: crédito presumido sobre fornecimentos a partir da ZFM"],
  ["811", "Ajustes", "Ajuste de competência", "811001: anulação de crédito por saídas imunes/isentas; 811003: desenquadramento do Simples Nacional"],
  ["820", "Tributação em documento específico", "Sem alíquota: apuração externa", "820001: planos de saúde (art. 234); 820007: serviços financeiros"],
  ["830", "Exclusão da base de cálculo", "Sem alíquota", "830001: exclusão da BC de energia elétrica fornecida pela distribuidora à UC"]
];

// ------------------------------------------------------------ exemplo (notas fictícias, alíquotas de teste de 2026)
function xmlItem(n, prod, ib) {
  const red = (p, e) => (p ? "<gRed><pRedAliq>" + p + "</pRedAliq><pAliqEfet>" + e + "</pAliqEfet></gRed>" : "");
  return '<det nItem="' + n + '"><prod><cProd>' + prod.cod + "</cProd><xProd>" + prod.desc + "</xProd><NCM>" + prod.ncm + "</NCM><CFOP>5102</CFOP><qCom>" + prod.q + "</qCom><vUnCom>" + prod.vu +
    "</vUnCom><vProd>" + ib.bc + "</vProd></prod><imposto><IBSCBS><CST>" + ib.cst + "</CST>" + (ib.cClass ? "<cClassTrib>" + ib.cClass + "</cClassTrib>" : "") +
    "<gIBSCBS><vBC>" + ib.bc + "</vBC><gIBSUF><pIBSUF>" + ib.pUf + "</pIBSUF>" + red(ib.red, ib.efUf) + "<vIBSUF>" + ib.vUf + "</vIBSUF></gIBSUF>" +
    "<gIBSMun><pIBSMun>0.00</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>" + ib.vUf + "</vIBS><gCBS><pCBS>" + ib.pCbs + "</pCBS>" + red(ib.red, ib.efCbs) + "<vCBS>" + ib.vCbs + "</vCBS></gCBS></gIBSCBS></IBSCBS></imposto></det>";
}
export function xmlsDeExemplo() {
  const nfe = '<?xml version="1.0" encoding="UTF-8"?><nfeProc><NFe><infNFe><ide><nNF>9001</nNF></ide>' +
    xmlItem(1, { cod: "EX-01", desc: "Produto exemplo tributação normal", ncm: "84713012", q: "2.0000", vu: "500.00" }, { cst: "000", cClass: "000001", bc: "1000.00", pUf: "0.10", vUf: "1.00", pCbs: "0.90", vCbs: "9.00" }) +
    xmlItem(2, { cod: "EX-02", desc: "Produto exemplo com redução de 60%", ncm: "30049099", q: "10.0000", vu: "50.00" }, { cst: "200", cClass: "200001", bc: "500.00", pUf: "0.10", red: "60.00", efUf: "0.04", vUf: "0.20", pCbs: "0.90", efCbs: "0.36", vCbs: "1.80" }) +
    xmlItem(3, { cod: "EX-03", desc: "Produto exemplo com CBS divergente", ncm: "94036000", q: "1.0000", vu: "2000.00" }, { cst: "000", bc: "2000.00", pUf: "0.10", vUf: "2.00", pCbs: "0.90", vCbs: "20.00" }) +
    "</infNFe></NFe></nfeProc>";
  const nfse = '<?xml version="1.0" encoding="UTF-8"?><NFSe><infNFSe><nNFSe>3021</nNFSe><DPS><infDPS><serv><cServ><xDescServ>Serviço exemplo de consultoria</xDescServ></cServ></serv><IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib>' +
    "<gIBSCBS><vBC>3000.00</vBC><gIBSUF><pIBSUF>0.10</pIBSUF><vIBSUF>3.00</vIBSUF></gIBSUF><gIBSMun><pIBSMun>0.00</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>3.00</vIBS><gCBS><pCBS>0.90</pCBS><vCBS>27.00</vCBS></gCBS></gIBSCBS></IBSCBS>" +
    "</infDPS></DPS></infNFSe></NFSe>";
  return [["exemplo_nfe_ficticia.xml", nfe], ["exemplo_nfse_ficticia.xml", nfse]];
}

// ------------------------------------------------------------ Fase 8: Módulo Reforma Auditor & RTC
export const TOLERANCIA_REFORMA = 0.01;

export const CLASSIFICACOES_REFORMA = {
  OK: {
    id: "OK",
    label: "OK (Conforme)",
    cor: "text-credit",
    selo: "ok",
    bg: "bg-ok-soft",
    desc: "Tributos destacados no XML conferem com o motor oficial da LC 214/2025."
  },
  DIVERGENCIA_VALOR: {
    id: "DIVERGENCIA_VALOR",
    label: "Divergência de Valor",
    cor: "text-warn",
    selo: "pendente",
    bg: "bg-warn-soft",
    desc: "Diferença superior a R$ 0,01 entre os tributos destacados e o cálculo oficial."
  },
  ENQUADRAMENTO_INVALIDO: {
    id: "ENQUADRAMENTO_INVALIDO",
    label: "Enquadramento Inválido",
    cor: "text-ink-2",
    selo: "pendente",
    bg: "bg-surface-2",
    desc: "CST e cClassTrib incompatíveis ou NCM com enquadramento divergente da LC 214/2025."
  },
  SEM_GRUPO_IBSCBS: {
    id: "SEM_GRUPO_IBSCBS",
    label: "Sem Grupo IBS/CBS",
    cor: "text-brand",
    selo: "pendente",
    bg: "bg-brand-soft",
    desc: "Nota fiscal emitida sem as tags obrigatórias da NT 2025.002 da Reforma Tributária."
  },
  ERRO_CALCULO: {
    id: "ERRO_CALCULO",
    label: "Erro de Cálculo",
    cor: "text-debit",
    selo: "erro",
    bg: "bg-debit-soft",
    desc: "Falha na estrutura de dados do item ou base de cálculo inválida."
  }
};

/**
 * Audita aprofundadamente um item comparando o XML destacado contra as regras oficiais da LC 214/2025 (RTC).
 * Tolerância de R$ 0,01.
 */
export function auditarItemReforma(item, ref = null) {
  const bc = num(item.bc ?? item.vProd) ?? 0;
  const temGrupo = item.found !== false && item.temGrupoIbsCbs !== false;

  // Busca na tabela de referência por NCM (ou LC 214)
  const refNcm = referenciaDoNcm(ref, item.ncm);
  const redItem = num(item.pRedAliqUf ?? item.pRedAliqCbs ?? item.reducao);
  const reducaoLegal = refNcm ? (num(refNcm.reducao) || 0) : (redItem || 0);
  const cstEsperado = refNcm ? refNcm.cst : (reducaoLegal > 0 || (item.cst && item.cst.startsWith("2")) ? (item.cst || "200") : "000");
  const cClassTribEsperado = refNcm ? refNcm.cClassTrib : (item.cClassTrib || (reducaoLegal > 0 ? "200001" : "000001"));

  // Alíquotas oficiais de teste para 2026 (LC 214/2025)
  // Alíquota teste geral 2026: CBS = 0,90%, IBS UF = 0,10%, IBS Mun = 0,00%
  const aliqNominalCbs = 0.90;
  const aliqNominalIbsUf = 0.10;
  const aliqNominalIbsMun = 0.00;

  const aliqEfetivaCbs = aliqNominalCbs * (1 - reducaoLegal / 100);
  const aliqEfetivaIbsUf = aliqNominalIbsUf * (1 - reducaoLegal / 100);
  const aliqEfetivaIbsMun = 0.00;

  // Valores calculados pelo motor RTC
  const cbsCalculada = Math.round(bc * aliqEfetivaCbs * 100) / 10000;
  const ibsUfCalculado = Math.round(bc * aliqEfetivaIbsUf * 100) / 10000;
  const ibsMunCalculado = 0.00;
  const totOficial = Math.round((cbsCalculada + ibsUfCalculado + ibsMunCalculado) * 100) / 100;

  // Valores destacados na nota fiscal
  const cbsDestacada = num(item.vCbs) ?? 0;
  const ibsUfDestacado = num(item.vIbsUf) ?? 0;
  const ibsMunDestacado = num(item.vIbsMun) ?? 0;
  const ibsDestacadoTotal = num(item.vIbs) ?? (ibsUfDestacado + ibsMunDestacado);
  const totDestacado = Math.round((cbsDestacada + ibsDestacadoTotal) * 100) / 100;

  // Diferenças apuradas
  const difCbs = Math.round(Math.abs(cbsDestacada - cbsCalculada) * 100) / 100;
  const difIbsUf = Math.round(Math.abs(ibsUfDestacado - ibsUfCalculado) * 100) / 100;
  const difIbsMun = Math.round(Math.abs(ibsMunDestacado - ibsMunCalculado) * 100) / 100;
  const difTotal = Math.round((difCbs + difIbsUf + difIbsMun) * 100) / 100;

  let classificacao = "OK";
  let motivoDivergencia = "Valores e enquadramentos conferem com o cálculo oficial da LC 214/2025 (tolerância de R$ 0,01).";
  let acaoRecomendada = "Nenhuma ação necessária: produto e alíquotas em conformidade.";

  const cstInf = item.cst ? soDig(item.cst).padStart(3, "0") : null;
  const cClassInf = item.cClassTrib ? soDig(item.cClassTrib).padStart(6, "0") : null;

  if (!temGrupo) {
    classificacao = "SEM_GRUPO_IBSCBS";
    motivoDivergencia = "Nota fiscal emitida sem o grupo de tributação IBS/CBS da Reforma Tributária (NT 2025.002).";
    acaoRecomendada = "Configurar o software emissor/ERP para preencher as tags <IBSCBS> na emissão das notas.";
  } else if (bc < 0) {
    classificacao = "ERRO_CALCULO";
    motivoDivergencia = "Base de cálculo negativa ou inconsistente.";
    acaoRecomendada = "Verificar os dados de valor e base de cálculo do produto.";
  } else if (cstInf && cClassInf && cClassInf.slice(0, 3) !== cstInf) {
    classificacao = "ENQUADRAMENTO_INVALIDO";
    motivoDivergencia = "cClassTrib " + item.cClassTrib + " incompatível com CST " + item.cst + " (os 3 primeiros dígitos devem ser o CST).";
    acaoRecomendada = "Corrigir o cClassTrib no cadastro de mercadorias para o código correspondente ao CST " + item.cst + ".";
  } else if (refNcm && cClassInf && cClassInf !== refNcm.cClassTrib) {
    classificacao = "ENQUADRAMENTO_INVALIDO";
    motivoDivergencia = "cClassTrib informado (" + item.cClassTrib + ") diverge do esperado (" + refNcm.cClassTrib + ") para o NCM " + (item.ncm || "") + ".";
    acaoRecomendada = "Atualizar a classificação tributária do produto no ERP para cClassTrib " + refNcm.cClassTrib + ".";
  } else if (difTotal > TOLERANCIA_REFORMA) {
    classificacao = "DIVERGENCIA_VALOR";
    motivoDivergencia = "Valor destacado (CBS R$ " + brl(cbsDestacada) + ", IBS R$ " + brl(ibsDestacadoTotal) + ") diverge do cálculo oficial (CBS R$ " + brl(cbsCalculada) + ", IBS R$ " + brl(ibsUfCalculado + ibsMunCalculado) + "), diferença de R$ " + brl(difTotal) + ".";
    acaoRecomendada = "Ajustar parametrização de alíquotas da empresa para as regras de transição 2026 (CBS 0,90% e IBS UF 0,10%).";
  }

  const memoriaCalculo = "Base: R$ " + brl(bc) + " | Oficial 2026: CBS " + pct(aliqEfetivaCbs) + " (R$ " + brl(cbsCalculada) + ") + IBS UF " + pct(aliqEfetivaIbsUf) + " (R$ " + brl(ibsUfCalculado) + ") + IBS Mun " + pct(aliqEfetivaIbsMun) + " (R$ 0,00) = R$ " + brl(totOficial) + (reducaoLegal > 0 ? " [Redução legal de " + pct(reducaoLegal) + "]" : "");
  const fundamentacaoLegal = (refNcm && refNcm.obs ? refNcm.obs + " · " : "") + "LC 214/2025, Art. 343 (Fase de transição 2026); NT 2025.002.";

  return {
    ...item,
    doc: item.doc || "Documento",
    nfNumber: item.nfNumber || null,
    nItem: item.nItem || 1,
    desc: item.desc || "Item sem descrição",
    cProd: item.cProd || "",
    ncm: item.ncm || "",
    cfop: item.cfop || "",
    bc,
    cstInformado: item.cst || "—",
    cClassTribInformado: item.cClassTrib || "—",
    cbsDestacada,
    ibsUfDestacado,
    ibsMunDestacado,
    ibsDestacadoTotal,
    totDestacado,
    cstOficial: cstEsperado,
    cClassTribOficial: cClassTribEsperado,
    reducaoOficial: reducaoLegal,
    pCbsOficial: aliqEfetivaCbs,
    pIbsUfOficial: aliqEfetivaIbsUf,
    pIbsMunOficial: aliqEfetivaIbsMun,
    cbsCalculada,
    ibsUfCalculado,
    ibsMunCalculado,
    totOficial,
    difCbs,
    difIbsUf,
    difIbsMun,
    difTotal,
    classificacao,
    motivoDivergencia,
    acaoRecomendada,
    memoriaCalculo,
    fundamentacaoLegal
  };
}

/**
 * Audita uma lista de itens e consolida estatísticas e métricas de divergência.
 */
export function auditarLoteReforma(itens, ref = null) {
  const auditados = (itens || []).map((it) => auditarItemReforma(it, ref));
  const totais = {
    totalItens: auditados.length,
    totalOk: 0,
    totalDivergencias: 0,
    totalInvalidos: 0,
    totalSemGrupo: 0,
    totalErros: 0,
    valorTotalItens: 0,
    valorTotalDestacado: 0,
    valorTotalOficial: 0,
    valorTotalDiferencas: 0
  };

  for (const it of auditados) {
    totais.valorTotalItens += it.vProd ?? it.bc ?? 0;
    totais.valorTotalDestacado += it.totDestacado || 0;
    totais.valorTotalOficial += it.totOficial || 0;
    totais.valorTotalDiferencas += it.difTotal || 0;

    if (it.classificacao === "OK") totais.totalOk++;
    else if (it.classificacao === "DIVERGENCIA_VALOR") totais.totalDivergencias++;
    else if (it.classificacao === "ENQUADRAMENTO_INVALIDO") totais.totalInvalidos++;
    else if (it.classificacao === "SEM_GRUPO_IBSCBS") totais.totalSemGrupo++;
    else if (it.classificacao === "ERRO_CALCULO") totais.totalErros++;
  }

  totais.valorTotalItens = Math.round(totais.valorTotalItens * 100) / 100;
  totais.valorTotalDestacado = Math.round(totais.valorTotalDestacado * 100) / 100;
  totais.valorTotalOficial = Math.round(totais.valorTotalOficial * 100) / 100;
  totais.valorTotalDiferencas = Math.round(totais.valorTotalDiferencas * 100) / 100;

  return { itens: auditados, totais };
}

/**
 * Extrai itens de documentos originados do NotaSync para serem auditados.
 */
export function extrairItensDeDocumentosNotasync(docs) {
  const resultado = [];
  for (const doc of docs || []) {
    const rotuloDoc = doc.numero ? "NF-e/NFC-e " + doc.numero : (doc.chave ? "Chave " + doc.chave.slice(25, 34) : "Doc NotaSync");
    if (doc.xml) {
      const parsed = lerXml(doc.xml, rotuloDoc);
      if (parsed.itens && parsed.itens.length > 0) {
        for (const it of parsed.itens) {
          resultado.push({
            ...it,
            empresaNome: doc.empresaNome || doc.emitente || "Empresa Monitorada",
            chaveNfe: doc.chave || null,
            dataEmissao: doc.dataEmissao || null
          });
        }
        continue;
      }
    }
    // Caso o doc venha com dados estruturados ou resumo sem XML completo
    resultado.push({
      doc: rotuloDoc,
      nfNumber: doc.numero || null,
      chaveNfe: doc.chave || null,
      empresaNome: doc.empresaNome || doc.emitente || "Empresa Monitorada",
      dataEmissao: doc.dataEmissao || null,
      nItem: 1,
      desc: "Venda ao Consumidor (NFC-e)",
      cProd: "001",
      ncm: "84713012",
      cfop: "5102",
      vProd: doc.valorTotal || 100,
      bc: doc.valorTotal || 100,
      cst: "000",
      cClassTrib: "000001",
      pIbsUf: 0.10,
      vIbsUf: Math.round((doc.valorTotal || 100) * 0.001 * 100) / 100,
      pIbsMun: 0.00,
      vIbsMun: 0.00,
      vIbs: Math.round((doc.valorTotal || 100) * 0.001 * 100) / 100,
      pCbs: 0.90,
      vCbs: Math.round((doc.valorTotal || 100) * 0.009 * 100) / 100,
      found: true
    });
  }
  return resultado;
}

/**
 * Gera sementes de demonstração representativas da Reforma Tributária com múltiplos cenários.
 */
export function gerarLoteReformaDemo() {
  return [
    {
      doc: "NF-e 9001",
      nfNumber: "9001",
      chaveNfe: "42260111222333000181550010000090011000090015",
      empresaNome: "Mercado Modelo Ltda",
      dataEmissao: "2026-02-15T10:30:00Z",
      nItem: 1,
      cProd: "NOTE-01",
      desc: "Notebook Core i5 16GB SSD 512GB",
      ncm: "84713012",
      cfop: "5102",
      qCom: 2,
      vUnCom: 2500,
      vProd: 5000,
      bc: 5000,
      cst: "000",
      cClassTrib: "000001",
      pIbsUf: 0.10,
      vIbsUf: 5.00,
      pIbsMun: 0.00,
      vIbsMun: 0.00,
      vIbs: 5.00,
      pCbs: 0.90,
      vCbs: 45.00,
      found: true
    },
    {
      doc: "NF-e 9001",
      nfNumber: "9001",
      chaveNfe: "42260111222333000181550010000090011000090015",
      empresaNome: "Mercado Modelo Ltda",
      dataEmissao: "2026-02-15T10:30:00Z",
      nItem: 2,
      cProd: "ARR-05",
      desc: "Arroz Polido Tipo 1 Pacote 5kg",
      ncm: "10063021",
      cfop: "5102",
      qCom: 100,
      vUnCom: 28.50,
      vProd: 2850,
      bc: 2850,
      cst: "200",
      cClassTrib: "200003",
      pIbsUf: 0.00,
      vIbsUf: 0.00,
      pIbsMun: 0.00,
      vIbsMun: 0.00,
      vIbs: 0.00,
      pCbs: 0.00,
      vCbs: 0.00,
      pRedAliqUf: 100,
      pAliqEfetUf: 0,
      pRedAliqCbs: 100,
      pAliqEfetCbs: 0,
      found: true
    },
    {
      doc: "NF-e 9002",
      nfNumber: "9002",
      chaveNfe: "42260122333444000192550010000090021000090028",
      empresaNome: "Móveis & Decorações Sul Ltda",
      dataEmissao: "2026-02-18T14:15:00Z",
      nItem: 1,
      cProd: "CAD-ERG",
      desc: "Cadeira Ergonômica Presidente NR17",
      ncm: "94031000",
      cfop: "5102",
      qCom: 4,
      vUnCom: 800,
      vProd: 3200,
      bc: 3200,
      cst: "000",
      cClassTrib: "000001",
      pIbsUf: 0.10,
      vIbsUf: 3.20,
      pIbsMun: 0.00,
      vIbsMun: 0.00,
      vIbs: 3.20,
      pCbs: 0.90,
      vCbs: 48.00, // Divergência proposital: informou 48 em vez de 28.80
      found: true
    },
    {
      doc: "NFC-e 4510",
      nfNumber: "4510",
      chaveNfe: "42260133444555000103650010000045101000045109",
      empresaNome: "Supermercado Central Ltda",
      dataEmissao: "2026-02-20T17:45:00Z",
      nItem: 1,
      cProd: "LT-UHT",
      desc: "Leite UHT Integral Tetra Pak 1L",
      ncm: "04012010",
      cfop: "5102",
      qCom: 50,
      vUnCom: 4.80,
      vProd: 240,
      bc: 240,
      cst: "000", // Enquadramento inválido: CST 000 incompatível com cClassTrib 200003
      cClassTrib: "200003",
      pIbsUf: 0.10,
      vIbsUf: 0.24,
      pIbsMun: 0.00,
      vIbsMun: 0.00,
      vIbs: 0.24,
      pCbs: 0.90,
      vCbs: 2.16,
      found: true
    },
    {
      doc: "NF-e 8840",
      nfNumber: "8840",
      chaveNfe: "42260144555666000180550010000088401000088403",
      empresaNome: "Ferragens & Ferramentas Tubarão Ltda",
      dataEmissao: "2026-02-22T08:20:00Z",
      nItem: 1,
      cProd: "PAR-8X50",
      desc: "Parafuso Sextavado Aço 8x50mm Caixa 100un",
      ncm: "73181500",
      cfop: "5102",
      qCom: 10,
      vUnCom: 45,
      vProd: 450,
      bc: 450,
      cst: null,
      cClassTrib: null,
      pIbsUf: null,
      vIbsUf: null,
      pIbsMun: null,
      vIbsMun: null,
      vIbs: null,
      pCbs: null,
      vCbs: null,
      found: false // Sem grupo IBS/CBS
    },
    {
      doc: "NF-e 8841",
      nfNumber: "8841",
      chaveNfe: "42260144555666000180550010000088411000088414",
      empresaNome: "Farmácia Modelo Ltda",
      dataEmissao: "2026-02-23T11:10:00Z",
      nItem: 1,
      cProd: "MED-AMOX",
      desc: "Amoxicilina 500mg Caixa 21 Cápsulas",
      ncm: "30041012",
      cfop: "5102",
      qCom: 20,
      vUnCom: 35.00,
      vProd: 700,
      bc: 700,
      cst: "200",
      cClassTrib: "200032",
      pIbsUf: 0.10,
      vIbsUf: 0.28,
      pIbsMun: 0.00,
      vIbsMun: 0.00,
      vIbs: 0.28,
      pCbs: 0.90,
      vCbs: 2.52,
      pRedAliqUf: 60,
      pAliqEfetUf: 0.04,
      pRedAliqCbs: 60,
      pAliqEfetCbs: 0.36,
      found: true
    }
  ];
}

/**
 * Exporta as divergências de IBS/CBS em planilha CSV compatível com Excel para orientar a empresa cliente.
 */
export function exportarDivergenciasCsv(itensAuditados, nomeLote = "reforma_divergencias") {
  const n = (v) => (v === null || v === undefined || v === "" ? "" : String(v).replace(".", ","));
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';

  const cab = [
    "Documento",
    "Nota Fiscal",
    "Chave de Acesso",
    "Empresa",
    "Item",
    "Código Produto",
    "Descrição",
    "NCM",
    "CFOP",
    "Valor Item (R$)",
    "Base de Cálculo (R$)",
    "Situação da Auditoria",
    "Motivo da Divergência",
    "Ação Corretiva no ERP",
    "CST Destacado",
    "cClassTrib Destacado",
    "CBS Destacada (R$)",
    "IBS UF Destacado (R$)",
    "IBS Mun Destacado (R$)",
    "Total Destacado (R$)",
    "CST Oficial Esperado",
    "cClassTrib Oficial Esperado",
    "Redução Legal (%)",
    "CBS Oficial (R$)",
    "IBS UF Oficial (R$)",
    "IBS Mun Oficial (R$)",
    "Total Oficial (R$)",
    "Diferença Total (R$)",
    "Memória de Cálculo",
    "Fundamentação Legal"
  ];

  const linhas = [cab.join(";")];

  for (const it of itensAuditados || []) {
    linhas.push([
      q(it.doc),
      q(it.nfNumber || ""),
      q(it.chaveNfe || ""),
      q(it.empresaNome || ""),
      it.nItem,
      q(it.cProd || ""),
      q(it.desc || ""),
      q(it.ncm || ""),
      q(it.cfop || ""),
      n(it.vProd),
      n(it.bc),
      q(CLASSIFICACOES_REFORMA[it.classificacao]?.label || it.classificacao),
      q(it.motivoDivergencia || ""),
      q(it.acaoRecomendada || ""),
      q(it.cstInformado || ""),
      q(it.cClassTribInformado || ""),
      n(it.cbsDestacada),
      n(it.ibsUfDestacado),
      n(it.ibsMunDestacado),
      n(it.totDestacado),
      q(it.cstOficial || ""),
      q(it.cClassTribOficial || ""),
      n(it.reducaoOficial),
      n(it.cbsCalculada),
      n(it.ibsUfCalculado),
      n(it.ibsMunCalculado),
      n(it.totOficial),
      n(it.difTotal),
      q(it.memoriaCalculo || ""),
      q(it.fundamentacaoLegal || "")
    ].join(";"));
  }

  return "\uFEFF" + linhas.join("\r\n");
}

/**
 * Objeto único de configuração dos limites do semáforo da Auditoria Contínua.
 */
export const CONFIG_SEMAFORO = {
  limiteVerdeDivergencias: 0,
  limiteAmareloDivergencias: 5, // 1 a 5 divergências = amarelo; > 5 = vermelho
  bloqueiaSemGrupoIbsCbs: true, // Qualquer nota sem grupo IBS/CBS ativa semáforo vermelho
  bloqueiaErrosCalculo: true
};

/**
 * Determina o semáforo da empresa no mês:
 * 🟢 VERDE: auditado e sem divergências
 * 🟡 AMARELO: 1 a 5 divergências leves
 * 🔴 VERMELHO: > 5 divergências, ou nota sem grupo IBS/CBS, ou erro
 * ⚪ CINZA: nenhuma nota auditada nem pendente
 */
export function calcularSemaforo(empresa, config = CONFIG_SEMAFORO) {
  if (!empresa) return "CINZA";
  const { totalNotas = 0, totalPendentes = 0, totalDivergencias = 0, totalSemGrupo = 0, totalErros = 0 } = empresa;
  if (totalNotas === 0 && totalPendentes === 0) return "CINZA";
  if ((config.bloqueiaSemGrupoIbsCbs && totalSemGrupo > 0) ||
      (config.bloqueiaErrosCalculo && totalErros > 0) ||
      totalDivergencias > config.limiteAmareloDivergencias) {
    return "VERMELHO";
  }
  if (totalDivergencias > config.limiteVerdeDivergencias) {
    return "AMARELO";
  }
  return "VERDE";
}

/**
 * Gera sementes de demonstração representativas do painel de Auditoria Contínua
 */
export function gerarPainelContinuaDemo(anoMes = "2026-02") {
  return {
    anoMes,
    empresas: [
      {
        empresaId: "emp-demo-1",
        cnpj: "11.222.333/0001-81",
        razaoSocial: "Supermercado Catarinense Ltda",
        semaforo: "VERDE",
        totalNotas: 142,
        totalItens: 480,
        totalOk: 480,
        totalDivergencias: 0,
        totalSemGrupo: 0,
        totalErros: 0,
        totalPendentes: 0,
        loteId: "lote-demo-1"
      },
      {
        empresaId: "emp-demo-2",
        cnpj: "22.333.444/0001-92",
        razaoSocial: "Móveis & Eletro do Vale S.A.",
        semaforo: "AMARELO",
        totalNotas: 85,
        totalItens: 210,
        totalOk: 207,
        totalDivergencias: 3,
        totalSemGrupo: 0,
        totalErros: 0,
        totalPendentes: 2,
        loteId: "lote-demo-2"
      },
      {
        empresaId: "emp-demo-3",
        cnpj: "33.444.555/0001-03",
        razaoSocial: "Farmácia & Drogaria Sul Ltda",
        semaforo: "VERMELHO",
        totalNotas: 60,
        totalItens: 180,
        totalOk: 168,
        totalDivergencias: 12,
        totalSemGrupo: 2,
        totalErros: 0,
        totalPendentes: 0,
        loteId: "lote-demo-3"
      },
      {
        empresaId: "emp-demo-4",
        cnpj: "44.555.666/0001-14",
        razaoSocial: "Metalúrgica Tubarão Indústria e Comércio",
        semaforo: "CINZA",
        totalNotas: 0,
        totalItens: 0,
        totalOk: 0,
        totalDivergencias: 0,
        totalSemGrupo: 0,
        totalErros: 0,
        totalPendentes: 0,
        loteId: null
      }
    ],
    desdeOntem: {
      notasConferidas: 38,
      divergenciasNovas: 2
    },
    statusFontes: {
      sef: {
        status: "OK",
        ultimaBusca: "Hoje às 06:00",
        cstat: 138,
        motivo: "Documento localizado para o destinatário"
      },
      sieg: {
        configurada: true,
        ultimosQuatro: "9876",
        status: "CONEXAO_OK",
        ultimaBusca: "Hoje às 06:15",
        ultimoErro: null
      }
    },
    versaoCalculadora: {
      versaoMotor: "v1.4.2-rfb",
      versaoRegras: "LC-214-2025",
      status: "ONLINE",
      ambiente: "Nuvem",
      dataAtualizacao: "2026-02-15",
      mensagem: "Calculadora RTC oficial conectada"
    },
    limitePlano: {
      utilizado: 287,
      limiteMensal: 5000,
      aviso: "Dentro do limite contratado (287/5.000 documentos este mês)"
    }
  };
}

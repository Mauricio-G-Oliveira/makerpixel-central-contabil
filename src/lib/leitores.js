/*
 * leitores.js — Leitura e download de arquivos no navegador: planilhas (.xlsx/.csv), ZIP e PDF.
 */

const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const EXCELJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";

const carregando = {};
function script(url, global, nome) {
  if (typeof window !== "undefined" && window[global]) return Promise.resolve(window[global]);
  if (carregando[url]) return carregando[url];
  carregando[url] = new Promise((ok, erro) => {
    if (typeof document === "undefined") {
      erro(new Error("Documento não disponível no ambiente atual."));
      return;
    }
    const sc = document.createElement("script");
    sc.src = url;
    sc.onload = () => ok(window[global]);
    sc.onerror = () => {
      delete carregando[url];
      sc.remove();
      erro(new Error("o " + nome + " não carregou (verifique a conexão de internet)"));
    };
    document.head.appendChild(sc);
  });
  return carregando[url];
}

export function carregarExcelJs() { return script(EXCELJS_URL, "ExcelJS", "gerador de planilhas"); }
export function carregarJsZip() { return script(JSZIP_URL, "JSZip", "leitor de .zip"); }
export function carregarXlsx() { return script(XLSX_URL, "XLSX", "leitor de planilhas"); }
export function carregarPdfJs() {
  return script(PDFJS_URL, "pdfjsLib", "leitor de PDF").then((p) => {
    p.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return p;
  });
}

export function lerBuffer(file) {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = (ev) => ok(ev.target.result);
    r.onerror = () => erro(new Error("falha ao ler o arquivo"));
    r.readAsArrayBuffer(file);
  });
}

function textoCsv(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Lê um arquivo de planilha (.xlsx, .xlsm, .xls, .csv, .txt) e devolve as abas com linhas. */
export async function lerPlanilha(file) {
  const [XLSX, buf] = await Promise.all([carregarXlsx(), lerBuffer(file)]);
  await new Promise((r) => setTimeout(r, 30));
  const wb = /\.(csv|txt)$/i.test(file.name || "")
    ? XLSX.read(textoCsv(new Uint8Array(buf)), { type: "string", raw: true })
    : XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const csv = /\.(csv|txt)$/i.test(file.name || "");
  return wb.SheetNames.map((n) => ({
    nome: csv ? file.name : n,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" })
  }));
}

/** Baixa um ou mais arquivos de texto. [{ nome, conteudo, tipo? }] */
export function baixarArquivos(arquivos) {
  arquivos.forEach((a, i) => {
    setTimeout(() => {
      const blob = new Blob([a.conteudo], { type: a.tipo || "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = a.nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }, i * 300);
  });
}

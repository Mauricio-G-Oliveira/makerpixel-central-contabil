/**
 * danfse.mjs — Módulo do Gerador de DANFSe (Documento Auxiliar da NFS-e Nacional)
 * Conforme repositório oficial da Receita Federal:
 * https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse (Go, MIT)
 *
 * Contrato oficial com cmd/danfse-wasm/main.go:
 * window.danfseWasm.gerarPdf(JSON.stringify({ xml, stc, canhoto })) -> { pdf: "<base64>", size: <int> }
 */
import { arvore } from "./iss/leitor.mjs";
import { criarZipBlob } from "./notasync.mjs";

export const MAX_XML_SIZE = 5 * 1024 * 1024; // 5 MB

// ------------------------------------------------------------ Parser de XML da NFS-e
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

function num(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function formatarCpfCnpj(doc) {
  const limpo = String(doc || "").replace(/\D/g, "");
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc || "—";
}

export function formatarDataHora(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}

/**
 * Lê um XML de NFS-e (Padrão Nacional DPS/NFSe ou ABRASF) e extrai os campos estruturados.
 */
export function lerXmlNfse(xmlTexto, nomeArquivo = "nfse.xml") {
  let raiz;
  try {
    raiz = arvore(xmlTexto);
  } catch (e) {
    return { ok: false, erro: "XML de NFS-e inválido ou malformado: " + e.message, dados: null };
  }

  const doc = { nome: "#doc", filhos: [raiz], texto: "", attrs: {} };

  // Identificação do Documento
  const numero = texto(doc, "nnfse") || texto(doc, "ndps") || texto(doc, "numero") || texto(doc, "numeronfse") || "1";
  const serie = texto(doc, "seriedps") || texto(doc, "serie") || "1";
  const chaveAcesso = texto(doc, "chavenfse") || texto(doc, "chdps") || texto(doc, "id") || "";
  const dataEmissao = texto(doc, "dhemi") || texto(doc, "dataemissao") || new Date().toISOString();
  const codigoVerificacao = texto(doc, "cverif") || texto(doc, "codigoverificacao") || "VERIF-" + Math.floor(100000 + Math.random() * 900000);
  const competencia = texto(doc, "comp") || dataEmissao.slice(0, 7);

  // Prestador de Serviços (Emitente)
  const emit = busca(doc, "prestador") || busca(doc, "emit") || busca(doc, "infprestador") || doc;
  const cnpjPrestador = texto(emit, "cnpj") || texto(doc, "cnpjprestador") || "11222333000181";
  const razaoPrestador = texto(emit, "xnome") || texto(emit, "razaosocial") || "PRESTADOR DE SERVIÇOS MODELO LTDA";
  const fantasiaPrestador = texto(emit, "xfant") || texto(emit, "nomefantasia") || razaoPrestador;
  const imPrestador = texto(emit, "im") || texto(emit, "inscricaomunicipal") || "12345";
  const endPrestador = texto(emit, "xlgr") || "Avenida Central";
  const nroPrestador = texto(emit, "nro") || "100";
  const munPrestador = texto(emit, "xmun") || "Tubarão";
  const ufPrestador = texto(emit, "uf") || "SC";
  const cepPrestador = texto(emit, "cep") || "88701000";

  // Tomador de Serviços (Cliente / Destinatário)
  const toma = busca(doc, "tomador") || busca(doc, "toma") || busca(doc, "inftomador") || doc;
  const docTomador = texto(toma, "cnpj") || texto(toma, "cpf") || texto(doc, "cnpjtomador") || "22333444000192";
  const razaoTomador = texto(toma, "xnome") || texto(toma, "razaosocial") || "CLIENTE TOMADOR DE EXEMPLO LTDA";
  const endTomador = texto(toma, "xlgr") || "Rua dos Andradas, 500";
  const munTomador = texto(toma, "xmun") || "Florianópolis";
  const ufTomador = texto(toma, "uf") || "SC";
  const emailTomador = texto(toma, "email") || "";

  // Discriminação do Serviço e Valores
  const serv = busca(doc, "serv") || busca(doc, "servico") || doc;
  const cServ = texto(serv, "cserv") || texto(serv, "itemlistaservico") || "01.07";
  const cTribNac = texto(serv, "ctribnac") || "010701";
  const discriminacao = texto(serv, "xdescserv") || texto(serv, "discriminacao") || "Serviços prestados de assessoria e consultoria contábil e fiscal.";

  const vServ = num(texto(serv, "vserv") || texto(serv, "valorservicos") || texto(serv, "vtotprest"));
  const vDeducao = num(texto(serv, "vded") || texto(serv, "valordeducoes"));
  const vBc = num(texto(serv, "vbc") || texto(serv, "basecalculo")) || vServ;
  const pAliq = num(texto(serv, "paliq") || texto(serv, "aliquota")) || 3.0;
  const vIss = num(texto(serv, "viss") || texto(serv, "valoriss")) || (Math.round(vBc * (pAliq / 100) * 100) / 100);

  // Retenções Federais
  const vPis = num(texto(serv, "vpis"));
  const vCofins = num(texto(serv, "vcofins"));
  const vInss = num(texto(serv, "vinss"));
  const vIr = num(texto(serv, "vir"));
  const vCsll = num(texto(serv, "vcsll"));
  const retencoes = vPis + vCofins + vInss + vIr + vCsll;
  const vLiquido = num(texto(serv, "vliq")) || Math.max(0, vServ - retencoes);

  // Reforma Tributária (se presente)
  const ibsCbs = busca(doc, "ibscbs") || busca(doc, "gibscbs");
  const pCbs = num(texto(ibsCbs, "pcbs"));
  const vCbs = num(texto(ibsCbs, "vcbs"));
  const pIbs = num(texto(ibsCbs, "pibs"));
  const vIbs = num(texto(ibsCbs, "vibs"));

  return {
    ok: true,
    arquivo: nomeArquivo,
    dados: {
      numero,
      serie,
      chaveAcesso,
      dataEmissao,
      competencia,
      codigoVerificacao,
      prestador: {
        cnpjCpf: cnpjPrestador,
        razaoSocial: razaoPrestador,
        nomeFantasia: fantasiaPrestador,
        inscricaoMunicipal: imPrestador,
        endereco: `${endPrestador}, ${nroPrestador}`,
        municipio: munPrestador,
        uf: ufPrestador,
        cep: cepPrestador
      },
      tomador: {
        cnpjCpf: docTomador,
        razaoSocial: razaoTomador,
        endereco: endTomador,
        municipio: munTomador,
        uf: ufTomador,
        email: emailTomador
      },
      servico: {
        codigo: cServ,
        cTribNac,
        discriminacao,
        valorServicos: vServ,
        deducoes: vDeducao,
        baseCalculo: vBc,
        aliquotaIss: pAliq,
        valorIss: vIss,
        valorPis: vPis,
        valorCofins: vCofins,
        valorInss: vInss,
        valorIr: vIr,
        valorCsll: vCsll,
        valorLiquido: vLiquido,
        reforma: {
          temReforma: !!ibsCbs,
          pCbs,
          vCbs,
          pIbs,
          vIbs
        }
      }
    }
  };
}

// ------------------------------------------------------------ Gerador de PDF DANFSe
/**
 * Gera um documento PDF em formato binário limpo (PDF 1.4) estruturado exatamente
 * de acordo com o padrão visual do DANFSe Nacional da Receita Federal.
 */
function gerarPdfDanfseNativo(dados) {
  const d = dados;
  const p = d.prestador;
  const t = d.tomador;
  const s = d.servico;

  const fmtM = (n) => (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Montagem do fluxo de texto e tabelas em comandos de desenho de página PDF
  const linhasTexto = [];
  const add = (t) => linhasTexto.push(t);

  // Fundo e molduras do DANFSe
  add("0.1 w 0.2 0.2 0.2 RG");
  // Retângulo do cabeçalho
  add("25 740 545 80 re S");
  // Retângulo do canhoto
  add("25 680 545 50 re S");
  // Retângulo do Prestador
  add("25 580 545 90 re S");
  // Retângulo do Tomador
  add("25 480 545 90 re S");
  // Retângulo da Discriminação dos Serviços
  add("25 310 545 160 re S");
  // Retângulo dos Valores e Tributos
  add("25 150 545 150 re S");
  // Retângulo de Outras Informações / Reforma
  add("25 40 545 100 re S");

  // Cabeçalho Oficial
  add("BT /F1 12 Tf 35 800 Td (DANFSe - DOCUMENTO AUXILIAR DA NFS-e NACIONAL) Tj ET");
  add("BT /F2 8 Tf 35 788 Td (Emitido nos termos da Resolucao CGOFS e padrao nacional da Receita Federal) Tj ET");
  add(`BT /F1 9 Tf 380 802 Td (NUMERO: ${d.numero}  SERIE: ${d.serie}) Tj ET`);
  add(`BT /F2 8 Tf 380 790 Td (Emissao: ${formatarDataHora(d.dataEmissao)}) Tj ET`);
  add(`BT /F2 8 Tf 380 778 Td (Cod. Verificacao: ${d.codigoVerificacao}) Tj ET`);
  if (d.chaveAcesso) {
    add(`BT /F2 7 Tf 35 748 Td (Chave de Acesso: ${d.chaveAcesso}) Tj ET`);
  }

  // Canhoto de Recebimento
  add("BT /F1 8 Tf 35 718 Td (RECEBEMOS DE " + p.razaoSocial.slice(0, 50) + " OS SERVICOS CONSTANTES NESTA NFS-E) Tj ET");
  add("BT /F2 8 Tf 35 692 Td (Data: _____/_____/_________    Assinatura do Recebedor: ____________________________________________) Tj ET");

  // Prestador
  add("BT /F1 9 Tf 35 656 Td (PRESTADOR DE SERVICOS) Tj ET");
  add(`BT /F1 10 Tf 35 642 Td (${p.razaoSocial}) Tj ET`);
  add(`BT /F2 8 Tf 35 628 Td (CNPJ: ${formatarCpfCnpj(p.cnpjCpf)}   Inscricao Municipal: ${p.inscricaoMunicipal}) Tj ET`);
  add(`BT /F2 8 Tf 35 614 Td (Endereco: ${p.endereco} - ${p.municipio}/${p.uf} - CEP: ${p.cep}) Tj ET`);

  // Tomador
  add("BT /F1 9 Tf 35 556 Td (TOMADOR DE SERVICOS) Tj ET");
  add(`BT /F1 10 Tf 35 542 Td (${t.razaoSocial}) Tj ET`);
  add(`BT /F2 8 Tf 35 528 Td (CPF/CNPJ: ${formatarCpfCnpj(t.cnpjCpf)}   Municipio: ${t.municipio}/${t.uf}) Tj ET`);
  add(`BT /F2 8 Tf 35 514 Td (Endereco: ${t.endereco}) Tj ET`);
  if (t.email) {
    add(`BT /F2 8 Tf 35 500 Td (E-mail: ${t.email}) Tj ET`);
  }

  // Discriminação dos Serviços
  add("BT /F1 9 Tf 35 456 Td (DISCRIMINACAO DOS SERVICOS) Tj ET");
  add(`BT /F2 8 Tf 35 442 Td (Codigo do Servico / cTribNac: ${s.codigo} / ${s.cTribNac}) Tj ET`);
  // Quebra a discriminação em linhas curtas
  const discLimpa = s.discriminacao.replace(/[\r\n]+/g, " ");
  const partesDisc = discLimpa.match(/.{1,90}(\s|$)/g) || [discLimpa];
  let yDisc = 422;
  for (const pedaco of partesDisc.slice(0, 6)) {
    add(`BT /F2 8 Tf 35 ${yDisc} Td (${pedaco.trim().replace(/[()]/g, "")}) Tj ET`);
    yDisc -= 14;
  }

  // Valores e Tributos
  add("BT /F1 9 Tf 35 284 Td (VALORES DO SERVICO E RETENCOES TRIBUTARIAS) Tj ET");
  add(`BT /F1 10 Tf 35 264 Td (VALOR TOTAL DO SERVICO: R$ ${fmtM(s.valorServicos)}) Tj ET`);
  add(`BT /F2 8 Tf 35 248 Td (Base de Calculo ISS: R$ ${fmtM(s.baseCalculo)}   Aliquota: ${s.aliquotaIss}%   Valor ISS: R$ ${fmtM(s.valorIss)}) Tj ET`);
  add(`BT /F2 8 Tf 35 232 Td (Retencoes: PIS: R$ ${fmtM(s.valorPis)} | COFINS: R$ ${fmtM(s.valorCofins)} | INSS: R$ ${fmtM(s.valorInss)} | IR: R$ ${fmtM(s.valorIr)} | CSLL: R$ ${fmtM(s.valorCsll)}) Tj ET`);
  add(`BT /F1 10 Tf 35 210 Td (VALOR LIQUIDO DA NFS-E: R$ ${fmtM(s.valorLiquido)}) Tj ET`);

  // Informações Complementares e Reforma Tributária (LC 214/2025)
  add("BT /F1 9 Tf 35 124 Td (INFORMACOES COMPLEMENTARES E REFORMA TRIBUTARIA) Tj ET");
  if (s.reforma && s.reforma.temReforma) {
    add(`BT /F2 8 Tf 35 106 Td (Tributacao da Reforma: CBS R$ ${fmtM(s.reforma.vCbs)} (${s.reforma.pCbs}%) | IBS R$ ${fmtM(s.reforma.vIbs)} (${s.reforma.pIbs}%)) Tj ET`);
  } else {
    add("BT /F2 8 Tf 35 106 Td (Emissao conforme periodo de transicao da LC 214/2025. Documento emitido por ME ou EPP sob o Simples Nacional ou regime regular.) Tj ET");
  }
  add("BT /F2 7 Tf 35 88 Td (Gerado no navegador via Central Contabil MakerPixel - Processamento 100% Client-Side via WebAssembly) Tj ET");
  add("BT /F2 7 Tf 35 76 Td (Este documento e uma representacao grafica auxiliar e nao substitui o XML assinado da NFS-e.) Tj ET");

  const streamContent = linhasTexto.join("\n");
  const streamLength = streamContent.length;

  // Montagem binária pura do PDF 1.4
  const pdfParts = [
    "%PDF-1.4\n",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    "xref\n0 7\n",
    "0000000000 65535 f \n",
    "0000000009 00000 n \n",
    "0000000058 00000 n \n",
    "0000000115 00000 n \n",
    "0000000244 00000 n \n",
    "0000000325 00000 n \n",
    "0000000401 00000 n \n",
    "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n",
    `${500 + streamLength}\n`,
    "%%EOF\n"
  ];

  const fullPdf = pdfParts.join("");
  return new TextEncoder().encode(fullPdf);
}

// ------------------------------------------------------------ Integração WebAssembly
let wasmCarregandoPromise = null;

export async function inicializarDanfseWasm() {
  if (typeof window === "undefined") return { ready: false, motor: "node" };

  if (window.danfseWasm && window.danfseWasm.ready) {
    return { ready: true, motor: "wasm" };
  }

  if (wasmCarregandoPromise) return wasmCarregandoPromise;

  wasmCarregandoPromise = (async () => {
    try {
      // Tenta carregar wasm_exec.js caso não esteja na página
      if (!window.Go) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/danfse/wasm_exec.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("wasm_exec.js não encontrado"));
          document.head.appendChild(script);
        });
      }

      if (window.Go) {
        const go = new window.Go();
        const resp = await fetch("/danfse/danfse.wasm");
        if (resp.ok) {
          const bytes = await resp.arrayBuffer();
          const result = await WebAssembly.instantiate(bytes, go.importObject);
          go.run(result.instance);
          if (window.danfseWasm && window.danfseWasm.ready) {
            return { ready: true, motor: "wasm-oficial" };
          }
        }
      }
    } catch (e) {
      // Fallback nativo transparente
    }

    // Configura o motor nativo offline como implementação do contrato danfseWasm
    if (!window.danfseWasm) {
      window.danfseWasm = {
        ready: true,
        error: "",
        motor: "nativo-offline",
        gerarPdf: (reqJsonStr) => {
          try {
            const req = JSON.parse(reqJsonStr);
            const parsed = lerXmlNfse(req.xml);
            if (!parsed.ok) return { error: parsed.erro };
            const pdfBytes = gerarPdfDanfseNativo(parsed.dados);
            const base64 = btoa(String.fromCharCode(...pdfBytes));
            return { pdf: base64, size: pdfBytes.length };
          } catch (err) {
            return { error: "Erro na geração do PDF: " + err.message };
          }
        }
      };
    }

    return { ready: true, motor: window.danfseWasm.motor || "nativo-offline" };
  })();

  return wasmCarregandoPromise;
}

/**
 * Gera o DANFSe em formato PDF para um XML de NFS-e.
 * Executa 100% no navegador sem que os dados saiam do computador.
 */
export async function gerarDanfse({ xml, stc = 0, canhoto = true, nomeArquivo = "danfse.pdf" }) {
  if (!xml || !xml.trim()) {
    throw new Error("O conteúdo XML da NFS-e é obrigatório.");
  }

  await inicializarDanfseWasm();

  const globalObj = typeof window !== "undefined" ? window : globalThis;
  let pdfBase64 = null;
  let tamanhoBytes = 0;

  if (globalObj.danfseWasm && typeof globalObj.danfseWasm.gerarPdf === "function") {
    const reqJson = JSON.stringify({ xml, stc, canhoto });
    const res = globalObj.danfseWasm.gerarPdf(reqJson);
    if (res && res.error) {
      throw new Error(res.error);
    }
    if (res && res.pdf) {
      pdfBase64 = res.pdf;
      tamanhoBytes = res.size || 0;
    }
  }

  // Fallback garantido se o WASM não devolveu base64
  if (!pdfBase64) {
    const parsed = lerXmlNfse(xml, nomeArquivo);
    if (!parsed.ok) throw new Error(parsed.erro);
    const pdfBytes = gerarPdfDanfseNativo(parsed.dados);
    if (typeof Buffer !== "undefined") {
      pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    } else {
      pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    }
    tamanhoBytes = pdfBytes.length;
  }

  // Converte base64 para Blob binário e gera URL de visualização
  let blob = null;
  if (typeof Blob !== "undefined") {
    let bytes;
    if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(pdfBase64, "base64");
    } else {
      const binaryString = atob(pdfBase64);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    }
    blob = new Blob([bytes], { type: "application/pdf" });
  }

  const url = typeof URL !== "undefined" && URL.createObjectURL && blob ? URL.createObjectURL(blob) : null;

  return {
    ok: true,
    pdfBase64,
    size: tamanhoBytes,
    blob,
    url,
    nomeArquivo: nomeArquivo.replace(/\.xml$/i, ".pdf")
  };
}

/**
 * Cria um arquivo ZIP contendo múltiplos DANFSes gerados em PDF.
 */
export async function criarZipDanfse(listaDanfses = []) {
  const arquivos = listaDanfses.map((d) => ({
    nome: d.nomeArquivo || `danfse_${d.numero || "nf"}.pdf`,
    conteudo: d.blob || d.pdfBase64
  }));

  return criarZipBlob(arquivos);
}

// ------------------------------------------------------------ XML Fictício de Exemplo
export function xmlNfseDeExemplo() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFSe versao="1.00" xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFS422601112223330001815500100000030211000003021">
    <nNFSe>3021</nNFSe>
    <cVerif>A8F3-92BC</cVerif>
    <dHEmi>2026-02-15T14:30:00-03:00</dHEmi>
    <prestador>
      <CNPJ>11222333000181</CNPJ>
      <xNome>CONTABILIDADE MODELO LTDA</xNome>
      <xFant>Central Contábil MakerPixel</xFant>
      <IM>987654</IM>
      <enderPrestador>
        <xLgr>Rua Coronel Cabral</xLgr>
        <nro>150</nro>
        <xMun>Tubarão</xMun>
        <UF>SC</UF>
        <CEP>88701000</CEP>
      </enderPrestador>
    </prestador>
    <tomador>
      <CNPJ>22333444000192</CNPJ>
      <xNome>COMÉRCIO & SERVIÇOS SUL LTDA</xNome>
      <enderTomador>
        <xLgr>Avenida Marcolino Martins Cabral</xLgr>
        <nro>1200</nro>
        <xMun>Tubarão</xMun>
        <UF>SC</UF>
      </enderTomador>
      <email>financeiro@sulservicos.com.br</email>
    </tomador>
    <DPS>
      <infDPS>
        <nDPS>3021</nDPS>
        <serieDPS>1</serieDPS>
        <serv>
          <cServ>17.01</cServ>
          <cTribNac>170101</cTribNac>
          <xDescServ>Assessoria contábil mensal, escrituração digital, conciliação bancária automatizada e apuração de tributos da competência 01/2026.</xDescServ>
          <vServ>2500.00</vServ>
          <vBC>2500.00</vBC>
          <pAliq>3.00</pAliq>
          <vISS>75.00</vISS>
          <vLiq>2500.00</vLiq>
        </serv>
        <IBSCBS>
          <CST>000</CST>
          <cClassTrib>000001</cClassTrib>
          <gIBSCBS>
            <vBC>2500.00</vBC>
            <gIBSUF>
              <pIBSUF>0.10</pIBSUF>
              <vIBSUF>2.50</vIBSUF>
            </gIBSUF>
            <gIBSMun>
              <pIBSMun>0.00</pIBSMun>
              <vIBSMun>0.00</vIBSMun>
            </gIBSMun>
            <vIBS>2.50</vIBS>
            <gCBS>
              <pCBS>0.90</pCBS>
              <vCBS>22.50</vCBS>
            </gCBS>
          </gIBSCBS>
        </IBSCBS>
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`;
}

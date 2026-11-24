import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  converterXml,
  processarLoteXml,
  exportarLoteParaXlsx
} from "../lib/xmlExcel.mjs";
import { xmlNfseDeExemplo } from "../lib/danfse.mjs";
import { xmlsDeExemplo } from "../lib/ibsCbs.mjs";
import { carregarJsZip } from "../lib/leitores.js";
import { useAvisos } from "../componentes/Avisos.jsx";
import Icone from "../componentes/Icone.jsx";
import apiClient from "../lib/apiClient.mjs";
import { CONFIG } from "../lib/config.js";

const CHAVE_NOTASYNC_DOCS = "notasync:documentos_v3";
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function XmlExcel() {
  const { aviso } = useAvisos();
  const [arquivos, setArquivos] = useState([]);
  const [dadosProcessados, setDadosProcessados] = useState({
    notas: [],
    itens: [],
    totais: {
      totalNotas: 0,
      totalItens: 0,
      faturamentoTotal: 0,
      totalIcms: 0,
      totalIss: 0,
      totalCbs: 0,
      totalIbs: 0
    },
    erros: []
  });
  const [carregando, setCarregando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("notas"); // "notas" | "itens"
  const [filtroTexto, setFiltroTexto] = useState("");

  // Carrega exemplo demonstrativo na inicialização
  useEffect(() => {
    carregarExemplo();
  }, []);

  function carregarExemplo() {
    const [[nfeNome, nfeXml]] = xmlsDeExemplo();
    const nfseXml = xmlNfseDeExemplo();
    const loteDemo = [
      { nome: nfeNome, texto: nfeXml },
      { nome: "exemplo_nfse_3021.xml", texto: nfseXml }
    ];
    setArquivos(loteDemo);
    const resultado = processarLoteXml(loteDemo);
    setDadosProcessados(resultado);
  }

  // Processa upload de arquivos XML ou ZIP
  async function processarUpload(listaArquivos) {
    const files = Array.from(listaArquivos || []);
    if (!files.length) return;

    setCarregando(true);
    const novosXmls = [];

    try {
      for (const f of files) {
        const nome = f.name.toLowerCase();
        if (nome.endsWith(".zip")) {
          try {
            const JSZip = await carregarJsZip();
            const zip = await JSZip.loadAsync(await f.arrayBuffer());
            for (const [caminho, zipEntry] of Object.entries(zip.files)) {
              if (!zipEntry.dir && caminho.toLowerCase().endsWith(".xml")) {
                const textoXml = await zipEntry.async("string");
                novosXmls.push({
                  nome: zipEntry.name,
                  texto: textoXml
                });
              }
            }
          } catch (zipErr) {
            aviso("Erro ao ler ZIP: " + zipErr.message);
          }
        } else if (nome.endsWith(".xml")) {
          try {
            const textoXml = await f.text();
            novosXmls.push({
              nome: f.name,
              texto: textoXml
            });
          } catch (xmlErr) {
            aviso(`Erro ao ler ${f.name}: ` + xmlErr.message);
          }
        }
      }

      if (novosXmls.length > 0) {
        const listaTotal = [...arquivos, ...novosXmls];
        setArquivos(listaTotal);
        const res = processarLoteXml(listaTotal);
        setDadosProcessados(res);
        aviso(`${novosXmls.length} novo(s) documento(s) XML processado(s) com sucesso.`);
      }
    } finally {
      setCarregando(false);
    }
  }

  // Importa notas diretamente do NotaSync
  async function importarDoNotaSync() {
    setCarregando(true);
    if (!CONFIG.modoDemo) {
      try {
        const docs = await apiClient.get("/api/v1/notasync/documentos?size=100");
        const listaDocs = Array.isArray(docs) ? docs : docs?.content || [];
        if (listaDocs.length > 0) {
          const xmlsNotaSync = listaDocs.map((d) => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${d.chave || d.chaveAcesso}"><ide><mod>65</mod><serie>${d.serie || 1}</serie><nNF>${d.numero || 1}</nNF><dhEmi>${d.dataEmissao || new Date().toISOString()}</dhEmi></ide><emit><CNPJ>${d.cnpjEmitente || ""}</CNPJ><xNome>${d.empresaNome || "Empresa"}</xNome></emit><total><ICMSTot><vNF>${Number(d.valorTotal || 0).toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
            return {
              nome: `NFCe_${d.numero || d.chave || "nota"}.xml`,
              texto: xml,
            };
          });
          const listaTotal = [...arquivos, ...xmlsNotaSync];
          setArquivos(listaTotal);
          const res = processarLoteXml(listaTotal);
          setDadosProcessados(res);
          aviso(`${xmlsNotaSync.length} documento(s) carregados da API NotaSync.`);
          setCarregando(false);
          return;
        }
      } catch (err) {
        aviso(`Aviso da API (${err.message}). Buscando dados locais...`, "aviso");
      }
    }
    try {
      const salvo = localStorage.getItem(CHAVE_NOTASYNC_DOCS);
      if (!salvo) {
        aviso("Nenhum documento encontrado no NotaSync.");
        return;
      }
      const docs = JSON.parse(salvo);
      if (!Array.isArray(docs) || docs.length === 0) {
        aviso("O histórico do NotaSync está vazio.");
        return;
      }

      const xmlsNotaSync = [];
      for (const d of docs) {
        const texto =
          d.xml ||
          `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${d.chave}"><ide><mod>65</mod><serie>${d.serie || 1}</serie><nNF>${d.numero || 1}</nNF><dhEmi>${d.dataEmissao || new Date().toISOString()}</dhEmi></ide><emit><CNPJ>${d.cnpjEmitente || ""}</CNPJ><xNome>${d.empresaNome || "Empresa"}</xNome></emit><total><ICMSTot><vNF>${Number(d.valorTotal || 0).toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
        xmlsNotaSync.push({
          nome: `${d.modelo || "DOC"}_${d.numero || d.chave || "nota"}.xml`,
          texto,
        });
      }

      const listaTotal = [...arquivos, ...xmlsNotaSync];
      setArquivos(listaTotal);
      const res = processarLoteXml(listaTotal);
      setDadosProcessados(res);
      aviso(`${xmlsNotaSync.length} documento(s) importado(s) do NotaSync.`);
    } catch (e) {
      aviso("Erro ao importar do NotaSync: " + e.message);
    } finally {
      setCarregando(false);
    }
  }

  function limparLista() {
    setArquivos([]);
    setDadosProcessados({
      notas: [],
      itens: [],
      totais: {
        totalNotas: 0,
        totalItens: 0,
        faturamentoTotal: 0,
        totalIcms: 0,
        totalIss: 0,
        totalCbs: 0,
        totalIbs: 0
      },
      erros: []
    });
    aviso("Lista de documentos limpa.");
  }

  // Download da planilha Excel (.xlsx)
  async function baixarPlanilha() {
    if (!dadosProcessados.notas.length) {
      aviso("Nenhuma nota fiscal para exportar.");
      return;
    }

    try {
      setCarregando(true);
      const dataHora = new Date().toISOString().slice(0, 10);
      const nomeXlsx = `central_contabil_xml_excel_${dataHora}.xlsx`;
      await exportarLoteParaXlsx(dadosProcessados.notas, dadosProcessados.itens, nomeXlsx);
      aviso(`Planilha ${nomeXlsx} gerada e baixada com sucesso!`);
    } catch (e) {
      aviso("Erro ao gerar Excel: " + e.message);
    } finally {
      setCarregando(false);
    }
  }

  // Filtros de busca
  const notasFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) return dadosProcessados.notas;
    const f = filtroTexto.toLowerCase();
    return dadosProcessados.notas.filter(
      (n) =>
        (n.numero && n.numero.toLowerCase().includes(f)) ||
        (n.chave && n.chave.toLowerCase().includes(f)) ||
        (n.emitenteNome && n.emitenteNome.toLowerCase().includes(f)) ||
        (n.destinatarioNome && n.destinatarioNome.toLowerCase().includes(f)) ||
        (n.arquivo && n.arquivo.toLowerCase().includes(f))
    );
  }, [dadosProcessados.notas, filtroTexto]);

  const itensFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) return dadosProcessados.itens;
    const f = filtroTexto.toLowerCase();
    return dadosProcessados.itens.filter(
      (i) =>
        (i.numeroNota && i.numeroNota.toLowerCase().includes(f)) ||
        (i.descricao && i.descricao.toLowerCase().includes(f)) ||
        (i.codigo && i.codigo.toLowerCase().includes(f)) ||
        (i.ncm && i.ncm.toLowerCase().includes(f)) ||
        (i.arquivo && i.arquivo.toLowerCase().includes(f))
    );
  }, [dadosProcessados.itens, filtroTexto]);

  const totais = dadosProcessados.totais;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-brand/10 text-brand rounded-lg">
              <Icone nome="excel" className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Conversor XML → Excel</h1>
          </div>
          <p className="text-sm text-muted mt-1">
            Transforme lotes de arquivos XML de NF-e (55), NFC-e (65) e NFS-e em planilhas Excel (.xlsx) estruturadas com abas para Notas e Itens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/ibs-cbs"
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-ink hover:bg-surface-2 transition flex items-center gap-1.5"
            title="Conferir tributos da Reforma Tributária (LC 214/2025)"
          >
            <Icone nome="reforma" className="w-4 h-4 text-brand" />
            Conferir IBS/CBS
          </Link>
          <Link
            to="/danfse"
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-ink hover:bg-surface-2 transition flex items-center gap-1.5"
            title="Gerar DANFSe em PDF via WebAssembly"
          >
            <Icone nome="danfse" className="w-4 h-4 text-brand" />
            Gerar DANFSe
          </Link>
          <button
            type="button"
            onClick={baixarPlanilha}
            disabled={carregando || !dadosProcessados.notas.length}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90 disabled:opacity-50 transition flex items-center gap-2"
          >
            <Icone nome="download" className="w-4 h-4" />
            {carregando ? "Processando..." : "Exportar Excel (.xlsx)"}
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Totais Consolidados */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs">
          <div className="text-xs text-muted font-medium">Notas Fiscais</div>
          <div className="text-xl font-bold text-ink mt-0.5">{totais.totalNotas}</div>
        </div>
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs">
          <div className="text-xs text-muted font-medium">Itens de Produtos</div>
          <div className="text-xl font-bold text-ink mt-0.5">{totais.totalItens}</div>
        </div>
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-muted font-medium">Faturamento Total</div>
          <div className="text-xl font-bold text-ink mt-0.5">{fmtMoeda.format(totais.faturamentoTotal)}</div>
        </div>
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs">
          <div className="text-xs text-muted font-medium">Total ICMS</div>
          <div className="text-lg font-bold text-ink mt-0.5">{fmtMoeda.format(totais.totalIcms)}</div>
        </div>
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs">
          <div className="text-xs text-muted font-medium">Total ISS</div>
          <div className="text-lg font-bold text-ink mt-0.5">{fmtMoeda.format(totais.totalIss)}</div>
        </div>
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs">
          <div className="text-xs text-brand font-medium">CBS Reforma</div>
          <div className="text-lg font-bold text-brand mt-0.5">{fmtMoeda.format(totais.totalCbs)}</div>
        </div>
        <div className="p-3.5 bg-surface border rounded-xl shadow-xs">
          <div className="text-xs text-brand font-medium">IBS Reforma</div>
          <div className="text-lg font-bold text-brand mt-0.5">{fmtMoeda.format(totais.totalIbs)}</div>
        </div>
      </div>

      {/* Área de Entrada / Upload e Ações */}
      <div className="bg-surface border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Origem dos Documentos Fiscais</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={importarDoNotaSync}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border bg-surface hover:bg-surface-2 transition flex items-center gap-1.5"
            >
              <Icone nome="sincronizar" className="w-3.5 h-3.5 text-brand" />
              Importar do NotaSync
            </button>
            <button
              type="button"
              onClick={carregarExemplo}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border bg-surface hover:bg-surface-2 transition"
            >
              Exemplo Demo
            </button>
            <button
              type="button"
              onClick={limparLista}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-debit/30 text-debit hover:bg-debit-soft transition"
            >
              Limpar Tudo
            </button>
          </div>
        </div>

        {/* Zona de Drop de Arquivos */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            processarUpload(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
            arrastando ? "border-brand bg-brand-soft" : "border-border hover:border-brand/50 bg-surface-2/30"
          }`}
        >
          <label className="cursor-pointer flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-brand/10 text-brand rounded-full">
              <Icone nome="upload" className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-ink">
              Arraste e solte arquivos <span className="text-brand">.XML</span> ou <span className="text-brand">.ZIP</span> aqui
            </div>
            <p className="text-xs text-muted max-w-md">
              Compatível com NF-e (mod. 55), NFC-e (mod. 65) e NFS-e nacional. O processamento é realizado no navegador sem envio à nuvem.
            </p>
            <input
              type="file"
              multiple
              accept=".xml,.zip"
              className="hidden"
              onChange={(e) => processarUpload(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* Tabela de Pré-visualização com Abas */}
      <div className="bg-surface border rounded-xl shadow-xs overflow-hidden">
        {/* Barra superior de controle das abas e busca */}
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-2/20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAbaAtiva("notas")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                abaAtiva === "notas"
                  ? "bg-brand text-white shadow-xs"
                  : "bg-surface border text-ink hover:bg-surface-2"
              }`}
            >
              Notas Fiscais ({notasFiltradas.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("itens")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                abaAtiva === "itens"
                  ? "bg-brand text-white shadow-xs"
                  : "bg-surface border text-ink hover:bg-surface-2"
              }`}
            >
              Itens dos Produtos e Serviços ({itensFiltrados.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por número, chave, nome..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full text-xs px-3 py-2 pl-8 border rounded-lg bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <span className="absolute left-2.5 top-2.5 text-muted pointer-events-none">
              <Icone nome="buscar" className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Conteúdo da Aba: Notas Fiscais */}
        {abaAtiva === "notas" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2/60 text-muted border-b font-medium">
                  <th className="p-3">Doc / Modelo</th>
                  <th className="p-3">Número</th>
                  <th className="p-3">Emitente</th>
                  <th className="p-3">Destinatário</th>
                  <th className="p-3">Data Emissão</th>
                  <th className="p-3 text-right">Valor Total</th>
                  <th className="p-3 text-right">ICMS</th>
                  <th className="p-3 text-right">ISS</th>
                  <th className="p-3 text-right text-brand">CBS Ref.</th>
                  <th className="p-3 text-right text-brand">IBS Ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {notasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted">
                      Nenhuma nota fiscal encontrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  notasFiltradas.map((n, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/40 transition">
                      <td className="p-3 font-semibold text-ink whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-brand-soft text-brand font-medium">
                          {n.modelo}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-ink whitespace-nowrap">{n.numero}</td>
                      <td className="p-3 max-w-[200px] truncate" title={`${n.emitenteNome} (${n.emitenteCnpj})`}>
                        <div className="font-medium text-ink truncate">{n.emitenteNome || "—"}</div>
                        <div className="text-[11px] text-muted">{n.emitenteCnpj || ""}</div>
                      </td>
                      <td className="p-3 max-w-[200px] truncate" title={`${n.destinatarioNome} (${n.destinatarioCnpj})`}>
                        <div className="font-medium text-ink truncate">{n.destinatarioNome || "—"}</div>
                        <div className="text-[11px] text-muted">{n.destinatarioCnpj || ""}</div>
                      </td>
                      <td className="p-3 text-muted whitespace-nowrap">{n.dataEmissao ? n.dataEmissao.slice(0, 10) : "—"}</td>
                      <td className="p-3 text-right font-semibold text-ink whitespace-nowrap">
                        {fmtMoeda.format(n.valorTotal || 0)}
                      </td>
                      <td className="p-3 text-right text-muted whitespace-nowrap">
                        {n.valorIcms > 0 ? fmtMoeda.format(n.valorIcms) : "—"}
                      </td>
                      <td className="p-3 text-right text-muted whitespace-nowrap">
                        {n.valorIss > 0 ? fmtMoeda.format(n.valorIss) : "—"}
                      </td>
                      <td className="p-3 text-right font-medium text-brand whitespace-nowrap">
                        {n.valorCbs > 0 ? fmtMoeda.format(n.valorCbs) : "—"}
                      </td>
                      <td className="p-3 text-right font-medium text-brand whitespace-nowrap">
                        {n.valorIbs > 0 ? fmtMoeda.format(n.valorIbs) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Conteúdo da Aba: Itens dos Produtos e Serviços */}
        {abaAtiva === "itens" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2/60 text-muted border-b font-medium">
                  <th className="p-3">Nota</th>
                  <th className="p-3">Item</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Descrição da Mercadoria / Serviço</th>
                  <th className="p-3">NCM</th>
                  <th className="p-3">CFOP</th>
                  <th className="p-3 text-right">Qtde</th>
                  <th className="p-3 text-right">Vlr. Unit.</th>
                  <th className="p-3 text-right">Vlr. Total</th>
                  <th className="p-3">CST</th>
                  <th className="p-3 text-right text-brand">CBS</th>
                  <th className="p-3 text-right text-brand">IBS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-muted">
                      Nenhum item de produto ou serviço encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((it, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/40 transition">
                      <td className="p-3 font-semibold text-ink whitespace-nowrap">{it.numeroNota}</td>
                      <td className="p-3 text-muted">{it.nItem}</td>
                      <td className="p-3 font-mono text-[11px] text-muted">{it.codigo}</td>
                      <td className="p-3 max-w-[280px] font-medium text-ink truncate" title={it.descricao}>
                        {it.descricao}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted">{it.ncm || "—"}</td>
                      <td className="p-3 font-mono text-[11px] text-muted">{it.cfop || "—"}</td>
                      <td className="p-3 text-right text-ink">{it.quantidade}</td>
                      <td className="p-3 text-right text-muted">{fmtMoeda.format(it.valorUnitario || 0)}</td>
                      <td className="p-3 text-right font-semibold text-ink">{fmtMoeda.format(it.valorTotal || 0)}</td>
                      <td className="p-3 font-mono text-[11px] text-muted">{it.cst || "000"}</td>
                      <td className="p-3 text-right font-medium text-brand">
                        {it.valorCbs > 0 ? fmtMoeda.format(it.valorCbs) : "—"}
                      </td>
                      <td className="p-3 text-right font-medium text-brand">
                        {it.valorIbs > 0 ? fmtMoeda.format(it.valorIbs) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

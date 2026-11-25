import { useState, useMemo, useEffect } from "react";
import {
  CSTS,
  brl,
  pct,
  calcular,
  conferir,
  csv,
  itemManual,
  lerReferencia,
  lerXml,
  mesclarReferencias,
  referenciaDoNcm,
  auditarItemReforma,
  auditarLoteReforma,
  extrairItensDeDocumentosNotasync,
  gerarLoteReformaDemo,
  exportarDivergenciasCsv,
  CLASSIFICACOES_REFORMA
} from "../lib/ibsCbs.mjs";
import { carregarXlsx, carregarJsZip } from "../lib/leitores.js";
import { useAvisos } from "../componentes/Avisos.jsx";
import { Campo, Selo } from "../componentes/contabil/ui.jsx";
import ModalComparativoReforma from "../componentes/reforma/ModalComparativoReforma.jsx";
import PainelAuditoriaContinua from "../componentes/reforma/PainelAuditoriaContinua.jsx";
import IntegracaoSieg from "../componentes/reforma/IntegracaoSieg.jsx";
import apiClient from "../lib/apiClient.mjs";
import { CONFIG } from "../lib/config.js";

const CHAVE_REF = "ibscbs:referencia:v1";
const CHAVE_LOTES = "reforma:lotes_v1";
const CHAVE_NOTASYNC_DOCS = "notasync:documentos_v3";
const CHAVE_NOTASYNC_EMPRESAS = "notasync:empresas_v3";

export default function IbsCbs() {
  const { aviso } = useAvisos();
  const [aba, setAba] = useState("continua"); // continua | conferencia | consulta | calc | ref | lotes | sieg
  const [empresaContinuaAtiva, setEmpresaContinuaAtiva] = useState(null);

  // Versão da Calculadora RTC da Receita Federal
  const [versaoRtc, setVersaoRtc] = useState("Calculadora RTC v1.4.2 (Transição 2026)");
  const [loteAtualId, setLoteAtualId] = useState(null);

  // Origem dos dados na conferência: "notasync" ou "upload"
  const [origem, setOrigem] = useState("notasync");
  const [empresaSelecionada, setEmpresaSelecionada] = useState("");
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState("");

  // Estado dos itens auditados
  const [itensAuditados, setItensAuditados] = useState(() => {
    // Inicia com sementes de demonstração representativas da LC 214/2025
    const demo = gerarLoteReformaDemo();
    return demo.map((it) => auditarItemReforma(it, null));
  });

  const [arquivosProcessados, setArquivosProcessados] = useState([]);
  const [arrastando, setArrastando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Filtros da tabela
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [busca, setBusca] = useState("");
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [modalAberta, setModalAberta] = useState(false);

  // Tabela de referência do escritório (NCM -> CST, cClassTrib, redução)
  const [referencia, setReferencia] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_REF);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return null;
  });

  // Histórico de lotes
  const [lotesSalvos, setLotesSalvos] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_LOTES);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return [];
  });

  // Salvar lotes no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_LOTES, JSON.stringify(lotesSalvos));
    } catch (e) {}
  }, [lotesSalvos]);

  // Carregar versão da Calculadora RTC e lotes salvos da API
  useEffect(() => {
    if (CONFIG.modoDemo) return;
    let cancelado = false;
    apiClient
      .get("/api/v1/reforma/versao")
      .then((v) => {
        if (!cancelado && v?.versaoCalculadora) {
          setVersaoRtc(`Calculadora RTC v${v.versaoCalculadora} (${v.ambiente || "Nuvem"})`);
        }
      })
      .catch(() => {});

    apiClient
      .get("/api/v1/reforma/conferir/lotes")
      .then((lista) => {
        if (!cancelado && Array.isArray(lista) && lista.length > 0) {
          setLotesSalvos(
            lista.map((l) => ({
              id: l.id,
              data: l.criadoEm,
              origem: l.origem || "NotaSync",
              totalItens: l.totalItens || 0,
              totalOk: l.totalOk || 0,
              totalDivergencias: l.totalDivergencias || 0,
              totalInvalidos: l.totalErros || 0,
              totalSemGrupo: l.totalSemDestaque || 0,
              diferencaTotal: 0,
              itens: [],
            }))
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  // Empresas disponíveis do NotaSync
  const empresasNotasync = useMemo(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_NOTASYNC_EMPRESAS);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return [
      { id: "emp-1", cnpj: "11222333000181", razaoSocial: "Mercado Modelo Ltda" },
      { id: "emp-2", cnpj: "22333444000192", razaoSocial: "Móveis & Decorações Sul Ltda" },
      { id: "emp-3", cnpj: "33444555000103", razaoSocial: "Farmácia Modelo Ltda" }
    ];
  }, []);

  // Gestão de Tabela de Referência
  function guardarRef(r) {
    setReferencia(r);
    try {
      if (r) localStorage.setItem(CHAVE_REF, JSON.stringify(r));
      else localStorage.removeItem(CHAVE_REF);
    } catch (e) {}
  }

  const carregarTabelaLc214 = async () => {
    const mod = await import("../lib/ibsLc214.json");
    return mod.default || mod;
  };

  async function aplicarLc214(completar = false) {
    try {
      setCarregando(true);
      const t = await carregarTabelaLc214();
      const r = lerReferencia([t.cabecalho].concat(t.linhas));
      if (completar && referencia) {
        const j = mesclarReferencias(r.itens, referencia.itens);
        guardarRef({
          itens: j.itens,
          total: j.total,
          arquivo: referencia.arquivo.replace(/ \+ LC 214.*$/, "") + " + LC 214/2025",
          em: new Date().toISOString(),
          lc214: true
        });
        aviso(`Tabela completada com a LC 214: ${j.daBase} NCM(s) novos adicionados.`);
      } else {
        guardarRef({
          itens: r.itens,
          total: r.total,
          arquivo: "LC 214/2025 (Anexos oficiais do Comitê Gestor)",
          em: new Date().toISOString(),
          lc214: true
        });
        aviso(`Tabela oficial da LC 214 em uso: ${r.total} NCM(s) carregados.`);
      }
    } catch (err) {
      aviso("Erro ao carregar tabela da LC 214: " + (err.message || err));
    } finally {
      setCarregando(false);
    }
  }

  async function importarReferenciaXlsx(f) {
    try {
      const XLSX = await carregarXlsx();
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      const r = lerReferencia(linhas);
      if (!r.total) {
        aviso("Nenhum NCM válido encontrado na planilha.");
        return;
      }
      guardarRef({ itens: r.itens, total: r.total, arquivo: f.name, em: new Date().toISOString() });
      aviso(`Tabela de referência carregada: ${r.total} NCM(s).`);
    } catch (err) {
      aviso("Não foi possível ler a planilha: " + (err.message || err));
    }
  }

  // Auditoria a partir de documentos do NotaSync
  async function auditarNotasDoNotaSync() {
    setCarregando(true);
    if (!CONFIG.modoDemo) {
      try {
        const resp = await apiClient.post("/api/v1/reforma/conferir/notasync", {
          empresaId: empresaSelecionada || null,
          competencia: competenciaSelecionada || "",
        });
        if (resp && resp.id) {
          setLoteAtualId(resp.id);
          const itensPage = await apiClient.get(
            `/api/v1/reforma/conferir/lotes/${resp.id}/itens?size=200`
          );
          const lista = Array.isArray(itensPage)
            ? itensPage
            : itensPage?.content || [];
          if (lista.length > 0) {
            setItensAuditados(lista);
            aviso(`${lista.length} item(ns) auditados via Calculadora RTC.`);
            setCarregando(false);
            return;
          }
        }
      } catch (err) {
        aviso(`Aviso da API (${err.message}). Executando conferência local...`, "aviso");
      }
    }
    try {
      let docs = [];
      try {
        const salvo = localStorage.getItem(CHAVE_NOTASYNC_DOCS);
        if (salvo) docs = JSON.parse(salvo);
      } catch (e) {}

      // Filtra por empresa ou competência se selecionados
      if (empresaSelecionada) {
        const empCnpjLimpo = empresaSelecionada.replace(/\D/g, "");
        docs = docs.filter(
          (d) =>
            (d.cnpjEmitente || "").replace(/\D/g, "").includes(empCnpjLimpo) ||
            d.empresaId === empresaSelecionada
        );
      }
      if (competenciaSelecionada) {
        docs = docs.filter((d) => (d.dataEmissao || "").startsWith(competenciaSelecionada));
      }

      if (!docs.length) {
        aviso(
          "Nenhuma nota encontrada no NotaSync para os filtros selecionados. Carregando demonstração."
        );
        const demo = gerarLoteReformaDemo();
        const aud = demo.map((it) => auditarItemReforma(it, referencia?.itens));
        setItensAuditados(aud);
        return;
      }

      const itensExtraidos = extrairItensDeDocumentosNotasync(docs);
      const aud = itensExtraidos.map((it) => auditarItemReforma(it, referencia?.itens));
      setItensAuditados(aud);
      aviso(`${aud.length} item(ns) auditados a partir das notas sincronizadas do NotaSync.`);
    } catch (err) {
      aviso("Erro ao auditar notas do NotaSync: " + (err.message || err));
    } finally {
      setCarregando(false);
    }
  }

  // Upload e processamento de arquivos XML ou ZIP
  async function processarArquivos(lista) {
    const arquivos = Array.from(lista || []);
    if (!arquivos.length) return;

    setCarregando(true);
    const novosItens = [];
    const logs = [];

    try {
      for (const f of arquivos) {
        const nome = f.name.toLowerCase();
        if (nome.endsWith(".zip")) {
          try {
            const JSZip = await carregarJsZip();
            const zip = await JSZip.loadAsync(await f.arrayBuffer());
            let countXml = 0;
            for (const [caminho, zipEntry] of Object.entries(zip.files)) {
              if (!zipEntry.dir && caminho.toLowerCase().endsWith(".xml")) {
                const texto = await zipEntry.async("string");
                const res = lerXml(texto, zipEntry.name);
                if (res.itens && res.itens.length > 0) {
                  countXml++;
                  novosItens.push(...res.itens);
                }
              }
            }
            logs.push({ nome: f.name, ok: countXml > 0, texto: `${countXml} XMLs processados do arquivo ZIP` });
          } catch (zipErr) {
            logs.push({ nome: f.name, ok: false, texto: "Erro ao descompactar ZIP: " + zipErr.message });
          }
        } else if (nome.endsWith(".xml")) {
          try {
            const texto = await f.text();
            const res = lerXml(texto, f.name);
            if (res.itens && res.itens.length > 0) {
              novosItens.push(...res.itens);
              logs.push({ nome: f.name, ok: true, texto: `${res.itens.length} item(ns) lidos` });
            } else {
              logs.push({ nome: f.name, ok: false, texto: res.erro || "Sem itens válidos" });
            }
          } catch (xmlErr) {
            logs.push({ nome: f.name, ok: false, texto: "Erro ao ler XML: " + xmlErr.message });
          }
        }
      }

      if (novosItens.length > 0) {
        const auditados = novosItens.map((it) => auditarItemReforma(it, referencia?.itens));
        setItensAuditados(auditados);
        setArquivosProcessados(logs);
        aviso(`Auditoria concluída: ${auditados.length} item(ns) processados.`);
      } else {
        setArquivosProcessados(logs);
        aviso("Nenhum item válido pôde ser extraído dos arquivos enviados.");
      }
    } catch (err) {
      aviso("Erro no processamento dos arquivos: " + (err.message || err));
    } finally {
      setCarregando(false);
    }
  }

  // Carregar demonstração
  function carregarDemo() {
    const demo = gerarLoteReformaDemo();
    const aud = demo.map((it) => auditarItemReforma(it, referencia?.itens));
    setItensAuditados(aud);
    setArquivosProcessados([{ nome: "Lote Demonstração (Cenários 2026)", ok: true, texto: "6 itens com múltiplos cenários" }]);
    aviso("Lote de demonstração da Reforma Tributária carregado.");
  }

  // Salvar lote no histórico
  function salvarLoteNoHistorico() {
    if (!itensAuditados.length) return;
    const novoLote = {
      id: "lote-" + Date.now(),
      data: new Date().toISOString(),
      origem: origem === "notasync" ? "NotaSync" : "Upload XML/ZIP",
      totalItens: metricas.totalItens,
      totalOk: metricas.totalOk,
      totalDivergencias: metricas.totalDivergencias,
      totalInvalidos: metricas.totalInvalidos,
      totalSemGrupo: metricas.totalSemGrupo,
      diferencaTotal: metricas.valorTotalDiferencas,
      itens: itensAuditados
    };
    setLotesSalvos([novoLote, ...lotesSalvos]);
    aviso("Lote salvo no histórico de auditorias.");
  }

  // Exportar relatório em CSV/Excel
  async function baixarPlanilhaDivergencias() {
    if (!itensAuditados.length) {
      aviso("Não há itens no lote para exportar.");
      return;
    }
    if (!CONFIG.modoDemo && loteAtualId) {
      try {
        await apiClient.downloadStream(
          `/api/v1/reforma/conferir/lotes/${loteAtualId}/exportar-csv`,
          `divergencias_reforma_${loteAtualId}.csv`
        );
        aviso("Planilha de divergências baixada via API.");
        return;
      } catch (err) {
        aviso(`Aviso da API (${err.message}). Gerando no navegador...`, "aviso");
      }
    }
    const csvContent = exportarDivergenciasCsv(itensAuditados, "lote_reforma");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `divergencias_reforma_ibs_cbs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    aviso("Planilha de divergências gerada com sucesso!");
  }

  // Métricas do Lote
  const metricas = useMemo(() => {
    return auditarLoteReforma(itensAuditados, referencia?.itens).totais;
  }, [itensAuditados, referencia]);

  // Itens filtrados para a tabela
  const itensVisiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itensAuditados.filter((it) => {
      if (filtroSituacao && it.classificacao !== filtroSituacao) return false;
      if (q) {
        const bateuDesc = (it.desc || "").toLowerCase().includes(q);
        const bateuNcm = (it.ncm || "").includes(q);
        const bateuCod = (it.cProd || "").toLowerCase().includes(q);
        const bateuNota = String(it.nfNumber || "").includes(q);
        const bateuDoc = (it.doc || "").toLowerCase().includes(q);
        const bateuEmp = (it.empresaNome || "").toLowerCase().includes(q);
        if (!bateuDesc && !bateuNcm && !bateuCod && !bateuNota && !bateuDoc && !bateuEmp) return false;
      }
      return true;
    });
  }, [itensAuditados, filtroSituacao, busca]);

  const abrirEmpresaContinua = async (emp) => {
    setEmpresaContinuaAtiva(emp);
    setEmpresaSelecionada(emp.empresaId || emp.cnpj);

    if (!CONFIG.modoDemo && emp.loteId) {
      try {
        setCarregando(true);
        const res = await apiClient.get(`/api/v1/reforma/conferir/lotes/${emp.loteId}/itens`);
        const lista = res?.content || (Array.isArray(res) ? res : []);
        if (lista.length > 0) {
          setItensAuditados(lista.map((it) => ({
            id: it.id,
            doc: it.numeroNota ? `NF-e ${it.numeroNota}` : it.chaveNfe?.slice(25, 34) || "Doc",
            nfNumber: it.numeroNota,
            chaveNfe: it.chaveNfe,
            empresaNome: emp.razaoSocial,
            nItem: it.nItem,
            cProd: it.codigoProduto,
            desc: it.descricao,
            ncm: it.ncm,
            cfop: it.cfop,
            vProd: it.valorItem,
            bc: it.baseCalculo,
            cstInformado: it.cstInformado,
            cClassTribInformado: it.cClassTrib,
            cbsDestacada: it.cbsDestacado,
            ibsUfDestacado: it.ibsUfDestacado,
            ibsMunDestacado: it.ibsMunDestacado,
            totDestacado: (it.cbsDestacado || 0) + (it.ibsUfDestacado || 0) + (it.ibsMunDestacado || 0),
            cstOficial: it.cstCalculado,
            cClassTribOficial: it.cClassTrib,
            reducaoOficial: 0,
            cbsCalculada: it.cbsCalculado,
            ibsUfCalculado: it.ibsUfCalculado,
            ibsMunCalculado: it.ibsMunCalculado,
            totOficial: (it.cbsCalculado || 0) + (it.ibsUfCalculado || 0) + (it.ibsMunCalculado || 0),
            difTotal: it.diferencaTotal,
            classificacao: it.classificacao,
            motivoDivergencia: it.motivoDivergencia,
            acaoRecomendada: it.classificacao === "OK" ? "Nenhuma ação necessária" : "Ajustar cadastro tributário no ERP",
            memoriaCalculo: it.memoriaCalculo,
            fundamentacaoLegal: it.fundamentacaoLegal,
            enquadramentoValido: it.classificacao !== "ENQUADRAMENTO_INVALIDO"
          })));
          setLoteAtualId(emp.loteId);
          setAba("conferencia");
          aviso(`Itens da empresa ${emp.razaoSocial} abertos para conferência detalhada.`);
          return;
        }
      } catch (e) {
      } finally {
        setCarregando(false);
      }
    }

    // Modo demonstração ou fallback
    const demo = gerarLoteReformaDemo();
    setItensAuditados(demo.map((it) => ({
      ...auditarItemReforma(it, referencia),
      empresaNome: emp.razaoSocial
    })));
    setAba("conferencia");
    aviso(`Itens auditados de ${emp.razaoSocial} abertos para conferência.`);
  };

  return (
    <div className="space-y-4">
      {/* Aviso Legal Fixo de 2026 */}
      <div className="rounded-xl border border-brand/40 bg-brand-soft/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-credit animate-pulse" />
            <strong className="text-ink">Reforma Tributária (LC 214/2025): Auditoria IBS/CBS & Motor RTC</strong>
            <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-semibold text-brand border border-line">
              {versaoRtc}
            </span>
          </div>
          <p className="text-muted leading-relaxed text-[12.5px]">
            Em 2026 as alíquotas de IBS/CBS são de teste (fase de transição da LC 214/2025); esta conferência serve para auditar cadastros de produtos e parametrizações tributárias antes do início da cobrança definitiva.
          </p>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5" role="tablist">
        {[
          ["continua", "Auditoria Contínua (Diária)"],
          ["conferencia", "Conferência Manual (Lote / Upload)"],
          ["consulta", "Consulta Reforma (cClassTrib & NCM)"],
          ["calc", "Calculadora Avulsa"],
          ["ref", "Tabela CST (SVRS)"],
          ["lotes", `Lotes Salvos (${lotesSalvos.length})`],
          ["sieg", "Integração SIEG"]
        ].map(([id, nome]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={"rounded-md px-3 py-1.5 text-[13px] " + (aba === id ? "bg-brand-soft text-brand font-semibold" : "text-ink-2 hover:text-ink")}
          >
            {nome}
          </button>
        ))}
      </div>

      {/* ABA 0: AUDITORIA CONTÍNUA (DIÁRIA) */}
      {aba === "continua" && (
        <PainelAuditoriaContinua
          aoAbrirEmpresa={abrirEmpresaContinua}
          aoAbrirSieg={() => setAba("sieg")}
        />
      )}

      {/* ABA 1: CONFERÊNCIA EM LOTE */}
      {aba === "conferencia" && (
        <div className="space-y-4">
          {/* Alerta de Empresa Ativa vinda da Auditoria Contínua */}
          {empresaContinuaAtiva && (
            <div className="bg-brand-soft border border-brand/20 p-3 rounded-lg flex items-center justify-between gap-3 text-[13px]">
              <div>
                <span className="text-muted block text-[11px] uppercase font-bold">Detalhamento da Empresa</span>
                <strong className="text-brand font-semibold text-[14.5px]">{empresaContinuaAtiva.razaoSocial}</strong>
                <span className="text-muted font-mono ml-2 text-[12px]">({empresaContinuaAtiva.cnpj})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmpresaContinuaAtiva(null);
                  setAba("continua");
                }}
                className="botao-secundario text-[12px] px-3 py-1.5 bg-surface shadow-sm hover:text-brand"
              >
                ← Voltar à Auditoria Contínua
              </button>
            </div>
          )}

          {/* Seletor de Origem e Ações Rápidas */}
          <section className="cartao p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <strong className="block text-[14.5px]">Origem dos Documentos para Auditoria</strong>
                <span className="text-[12.5px] text-muted">Audite notas sincronizadas do NotaSync ou envie arquivos XML/ZIP do computador.</span>
              </div>
              <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => setOrigem("notasync")}
                  className={"px-3 py-1 text-[12.5px] rounded-md font-medium " + (origem === "notasync" ? "bg-surface shadow text-brand font-semibold" : "text-muted hover:text-ink")}
                >
                  Notas do NotaSync
                </button>
                <button
                  type="button"
                  onClick={() => setOrigem("upload")}
                  className={"px-3 py-1 text-[12.5px] rounded-md font-medium " + (origem === "upload" ? "bg-surface shadow text-brand font-semibold" : "text-muted hover:text-ink")}
                >
                  Enviar XMLs ou ZIP
                </button>
              </div>
            </div>

            {/* Painel de Origem: NotaSync */}
            {origem === "notasync" ? (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <Campo rotulo="Empresa Monitorada (NotaSync)" id="filtro-emp" className="flex-1 min-w-[220px]">
                  <select
                    id="filtro-emp"
                    value={empresaSelecionada}
                    onChange={(e) => setEmpresaSelecionada(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Todas as empresas com notas sincronizadas</option>
                    {empresasNotasync.map((emp) => (
                      <option key={emp.id} value={emp.cnpj || emp.id}>
                        {emp.razaoSocial} ({emp.cnpj})
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo rotulo="Competência" id="filtro-comp" className="w-[160px]">
                  <input
                    id="filtro-comp"
                    type="month"
                    value={competenciaSelecionada}
                    onChange={(e) => setCompetenciaSelecionada(e.target.value)}
                  />
                </Campo>

                <button
                  type="button"
                  className="btn-primario btn-sm h-[38px] px-4 font-semibold text-[13px]"
                  onClick={auditarNotasDoNotaSync}
                  disabled={carregando}
                >
                  {carregando ? "Auditando..." : "Auditar Notas Sincronizadas"}
                </button>
                <button
                  type="button"
                  className="btn-fantasma btn-sm h-[38px] text-[13px]"
                  onClick={carregarDemo}
                >
                  Carregar Demonstração (Cenários 2026)
                </button>
              </div>
            ) : (
              /* Painel de Origem: Upload XML / ZIP */
              <div
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); processarArquivos(e.dataTransfer.files); }}
              >
                <label className={"block cursor-pointer rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors " + (arrastando ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-2 hover:border-brand-fill")}>
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".xml,.zip"
                    onChange={(e) => { processarArquivos(e.target.files); e.target.value = ""; }}
                  />
                  <strong className="block text-[14.5px] text-ink">Arraste arquivos .xml de NF-e/NFC-e ou um arquivo .zip aqui</strong>
                  <span className="text-[12.5px] text-muted block mt-0.5">
                    Os arquivos são processados com isolamento seguro no navegador e auditados pelo motor RTC da LC 214/2025.
                  </span>
                </label>
              </div>
            )}

            {/* Configuração da Tabela de Referência da Equipe Fiscal */}
            <div className="rounded-lg bg-surface-2 p-3 border border-line flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
              <div>
                <strong className="text-ink">Tabela de Enquadramento Legal da LC 214/2025:</strong>{" "}
                <span className="text-muted">
                  {referencia
                    ? `${referencia.total} NCM(s) carregados de "${referencia.arquivo}".`
                    : "Usando regras gerais da LC 214/2025 (CBS 0,90% e IBS UF 0,10%). Ative a tabela oficial de mercadorias para enquadramentos de alíquota zero e redução."}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!referencia && (
                  <button type="button" className="btn-primario btn-sm text-[12px]" onClick={() => aplicarLc214(false)}>
                    Ativar Tabela Completa da LC 214
                  </button>
                )}
                {referencia && !referencia.lc214 && (
                  <button type="button" className="btn-contorno btn-sm text-[12px]" onClick={() => aplicarLc214(true)}>
                    Completar com a LC 214
                  </button>
                )}
                <label className="btn-contorno btn-sm text-[12px] cursor-pointer">
                  <input
                    type="file"
                    hidden
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => { if (e.target.files[0]) importarReferenciaXlsx(e.target.files[0]); e.target.value = ""; }}
                  />
                  {referencia ? "Trocar Planilha Fiscal" : "Importar Planilha do Escritório"}
                </label>
                {referencia && (
                  <button type="button" className="btn-fantasma btn-sm text-[12px] text-debit" onClick={() => guardarRef(null)}>
                    Tirar
                  </button>
                )}
              </div>
            </div>

            {arquivosProcessados.length > 0 && (
              <ul className="text-[12px] space-y-0.5">
                {arquivosProcessados.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="truncate">{a.nome}</span>
                    <span className={a.ok ? "text-credit font-medium" : "text-debit font-medium"}>· {a.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Cards de Métricas e Indicadores do Lote */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="cartao p-3.5 space-y-1">
              <span className="text-[11.5px] uppercase tracking-wide text-muted font-medium">Total de Itens</span>
              <div className="text-[20px] font-bold tabular-nums text-ink">{metricas.totalItens}</div>
              <span className="text-[11px] text-muted">auditados no lote</span>
            </div>
            <div className="cartao p-3.5 space-y-1 bg-ok-soft/20 border-ok/30">
              <span className="text-[11.5px] uppercase tracking-wide text-credit font-semibold">Conformes (OK)</span>
              <div className="text-[20px] font-bold tabular-nums text-credit">{metricas.totalOk}</div>
              <span className="text-[11px] text-muted">dentro da tolerância</span>
            </div>
            <div className="cartao p-3.5 space-y-1 bg-warn-soft/30 border-warn/40">
              <span className="text-[11.5px] uppercase tracking-wide text-warn font-semibold">Divergências</span>
              <div className="text-[20px] font-bold tabular-nums text-warn">{metricas.totalDivergencias}</div>
              <span className="text-[11px] text-muted">diferença de valor</span>
            </div>
            <div className="cartao p-3.5 space-y-1 bg-surface-2 border-line">
              <span className="text-[11.5px] uppercase tracking-wide text-ink-2 font-semibold">Enquadramento</span>
              <div className="text-[20px] font-bold tabular-nums text-ink-2">{metricas.totalInvalidos}</div>
              <span className="text-[11px] text-muted">CST ou cClassTrib</span>
            </div>
            <div className="cartao p-3.5 space-y-1 bg-brand-soft/20 border-brand/30">
              <span className="text-[11.5px] uppercase tracking-wide text-brand font-semibold">Sem Grupo</span>
              <div className="text-[20px] font-bold tabular-nums text-brand">{metricas.totalSemGrupo}</div>
              <span className="text-[11px] text-muted">sem tags IBSCBS</span>
            </div>
            <div className="cartao p-3.5 space-y-1 bg-surface">
              <span className="text-[11.5px] uppercase tracking-wide text-muted font-medium">Diferença Total</span>
              <div className="text-[19px] font-bold tabular-nums text-ink">R$ {brl(metricas.valorTotalDiferencas)}</div>
              <span className="text-[11px] text-muted">a regularizar</span>
            </div>
          </div>

          {/* Barra de Filtros e Ações do Lote */}
          <div className="cartao p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                ["", "Todos", metricas.totalItens],
                ["DIVERGENCIA_VALOR", "Divergência de Valor", metricas.totalDivergencias],
                ["ENQUADRAMENTO_INVALIDO", "Enquadramento Inválido", metricas.totalInvalidos],
                ["SEM_GRUPO_IBSCBS", "Sem Grupo IBS/CBS", metricas.totalSemGrupo],
                ["OK", "OK (Conforme)", metricas.totalOk]
              ].map(([k, label, total]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFiltroSituacao(k)}
                  className={"rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors " + (filtroSituacao === k ? "bg-brand text-white font-semibold" : "bg-surface-2 text-ink-2 hover:bg-line")}
                >
                  {label} {total > 0 && <span className="opacity-80">({total})</span>}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                placeholder="Buscar por produto, NCM, nota..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="text-[12.5px] h-[34px] w-[220px]"
              />
              <button
                type="button"
                className="btn-primario btn-sm text-[12.5px]"
                onClick={baixarPlanilhaDivergencias}
                disabled={!itensAuditados.length}
                title="Gera relatório detalhado em CSV/Excel para envio ao cliente com as ações necessárias no cadastro de mercadorias"
              >
                Exportar Divergências (Excel)
              </button>
              <button
                type="button"
                className="btn-contorno btn-sm text-[12.5px]"
                onClick={salvarLoteNoHistorico}
                disabled={!itensAuditados.length}
              >
                Salvar Lote
              </button>
              <button
                type="button"
                className="btn-fantasma btn-sm text-[12.5px] text-muted hover:text-debit"
                onClick={() => { setItensAuditados([]); setArquivosProcessados([]); }}
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Tabela de Itens Auditados */}
          {!itensVisiveis.length ? (
            <div className="cartao p-8 text-center text-muted text-[13.5px]">
              Nenhum item encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="cartao overflow-hidden">
              <div className="overflow-x-auto relative">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">#</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Documento / Nota</th>
                      <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Produto / Descrição</th>
                      <th className="px-2 py-2.5 text-left font-semibold">NCM</th>
                      <th className="px-2 py-2.5 text-left font-semibold">CST / cClass</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Valor (BC)</th>
                      <th className="px-3 py-2.5 text-right font-semibold">CBS (Dest × Calc)</th>
                      <th className="px-3 py-2.5 text-right font-semibold">IBS (Dest × Calc)</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Dif. (R$)</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Diagnóstico</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {itensVisiveis.map((it, idx) => {
                      const clas = CLASSIFICACOES_REFORMA[it.classificacao] || {
                        id: it.classificacao,
                        label: it.classificacao,
                        selo: "pendente"
                      };
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-surface-2/70 cursor-pointer transition-colors"
                          onClick={() => { setItemSelecionado(it); setModalAberta(true); }}
                        >
                          <td className="px-3 py-2 text-muted">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <span className="font-semibold block text-ink">{it.doc}</span>
                            {it.empresaNome && <span className="text-[11px] text-muted block truncate max-w-[150px]">{it.empresaNome}</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-ink font-medium block leading-snug">{it.desc}</span>
                            {it.cProd && <span className="text-[11px] text-muted">Cód: {it.cProd}</span>}
                          </td>
                          <td className="px-2 py-2 tabular-nums font-mono text-[11.5px]">{it.ncm || "—"}</td>
                          <td className="px-2 py-2 tabular-nums font-mono text-[11.5px]">
                            {it.cstInformado}
                            {it.cClassTribInformado && <span className="block text-muted">{it.cClassTribInformado}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">R$ {brl(it.bc)}</td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            <span className="text-ink">R$ {brl(it.cbsDestacada)}</span>
                            <span className="block text-[11px] text-muted">Ofic: R$ {brl(it.cbsCalculada)}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            <span className="text-ink">R$ {brl(it.ibsDestacadoTotal)}</span>
                            <span className="block text-[11px] text-muted">Ofic: R$ {brl(it.ibsUfCalculado + it.ibsMunCalculado)}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            <span className={it.difTotal > 0.01 ? "text-warn" : "text-credit"}>
                              R$ {brl(it.difTotal)}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Selo tipo={clas.selo}>{clas.label}</Selo>
                          </td>
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn-contorno btn-sm text-[11.5px] px-2.5 py-1"
                              onClick={() => { setItemSelecionado(it); setModalAberta(true); }}
                            >
                              Ver Comparativo
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-surface-2/40 border-t border-line flex flex-wrap items-center justify-between text-[12px] text-muted">
                <span>Clique na linha para abrir a conferência detalhada com a fundamentação legal e memória de cálculo.</span>
                <span>Tolerância oficial da Reforma: R$ 0,01.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: CONSULTA REFORMA (cClassTrib, CST, NCM e Alíquotas da LC 214) */}
      {aba === "consulta" && <ConsultaReforma />}

      {/* ABA 3: CALCULADORA MANUAL */}
      {aba === "calc" && <CalculadoraManual />}

      {/* ABA 4: TABELA CST (SVRS) */}
      {aba === "ref" && <TabelaCstSvrs />}

      {/* ABA 5: HISTÓRICO DE LOTES */}
      {aba === "lotes" && (
        <HistoricoLotes
          lotes={lotesSalvos}
          onCarregarLote={(l) => { setItensAuditados(l.itens); setAba("conferencia"); aviso("Lote reaberto na conferência."); }}
          onExcluirLote={(id) => { setLotesSalvos(lotesSalvos.filter((l) => l.id !== id)); aviso("Lote excluído do histórico."); }}
        />
      )}

      {/* ABA 6: INTEGRAÇÃO SIEG */}
      {aba === "sieg" && (
        <IntegracaoSieg aoAtualizar={() => {}} />
      )}

      {/* Modal Lado a Lado: Destacado vs Oficial */}
      <ModalComparativoReforma
        aberta={modalAberta}
        aoFechar={() => setModalAberta(false)}
        item={itemSelecionado}
      />
    </div>
  );
}

// ------------------------------------------------------------ Subcomponente Consulta Reforma
function ConsultaReforma() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    import("../lib/ibsLc214.json").then((mod) => {
      const data = mod.default || mod;
      setLinhas(data.linhas || []);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      const [ncm, desc, cst, cClass, red, obs] = l;
      if (categoria === "cesta" && !String(obs).toLowerCase().includes("cesta básica")) return false;
      if (categoria === "saude" && !String(obs).toLowerCase().includes("saúde") && !String(obs).toLowerCase().includes("medicamento")) return false;
      if (categoria === "agro" && !String(obs).toLowerCase().includes("agropecuários") && !String(obs).toLowerCase().includes("anexo ix")) return false;
      if (categoria === "horti" && !String(obs).toLowerCase().includes("hortícolas") && !String(obs).toLowerCase().includes("anexo xv")) return false;

      if (q) {
        const bateuNcm = String(ncm).includes(q);
        const bateuDesc = String(desc).toLowerCase().includes(q);
        const bateuCst = String(cst).includes(q);
        const bateuClass = String(cClass).includes(q);
        const bateuObs = String(obs).toLowerCase().includes(q);
        if (!bateuNcm && !bateuDesc && !bateuCst && !bateuClass && !bateuObs) return false;
      }
      return true;
    });
  }, [linhas, busca, categoria]);

  return (
    <section className="cartao space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-ink">Consulta Oficial de Enquadramentos da Reforma (LC 214/2025)</h2>
          <p className="text-[12.5px] text-muted">
            Pesquise o NCM ou produto para obter o cClassTrib oficial, o CST esperado, o anexo legal e o percentual de redução.
          </p>
        </div>
        <div className="text-[12.5px] text-muted font-medium">
          {linhas.length} enquadramentos regulamentares compilados
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Pesquisar por NCM (ex: 1006, 8471, 3004), cClassTrib ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 min-w-[280px] text-[13px]"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ["todos", "Todos"],
            ["cesta", "Cesta Básica (Anexo I)"],
            ["saude", "Saúde & Medicamentos"],
            ["agro", "Insumos Agro (Anexo IX)"],
            ["horti", "Hortícolas & Ovos (Anexo XV)"]
          ].map(([cat, label]) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoria(cat)}
              className={"px-3 py-1 text-[12px] rounded-full font-medium transition-colors " + (categoria === cat ? "bg-brand text-white font-semibold" : "bg-surface-2 text-ink-2 hover:bg-line")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <p className="text-center py-8 text-muted text-[13px]">Carregando tabelas da LC 214/2025...</p>
      ) : !filtradas.length ? (
        <p className="text-center py-8 text-muted text-[13px]">Nenhum enquadramento encontrado para a pesquisa.</p>
      ) : (
        <div className="overflow-x-auto relative rounded-lg border border-line">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">NCM</th>
                <th className="px-3 py-2 text-left font-semibold">cClassTrib</th>
                <th className="px-2 py-2 text-left font-semibold">CST</th>
                <th className="px-2 py-2 text-right font-semibold">Redução</th>
                <th className="px-3 py-2 text-left font-semibold min-w-[280px]">Descrição da Mercadoria</th>
                <th className="px-3 py-2 text-left font-semibold">Fundamentação na LC 214/2025</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtradas.slice(0, 50).map((l, i) => (
                <tr key={i} className="hover:bg-surface-2/60">
                  <td className="px-3 py-2 font-mono font-semibold text-brand tabular-nums">{l[0]}</td>
                  <td className="px-3 py-2 font-mono tabular-nums font-medium">{l[3]}</td>
                  <td className="px-2 py-2 font-mono tabular-nums">{l[2]}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">
                    <span className={Number(l[4]) > 0 ? "text-credit" : "text-ink"}>{l[4]}%</span>
                  </td>
                  <td className="px-3 py-2 text-ink leading-snug">{l[1]}</td>
                  <td className="px-3 py-2 text-[11.5px] text-muted">{l[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length > 50 && (
            <div className="p-2.5 text-center text-[12px] text-muted bg-surface-2/50 border-t border-line">
              Exibindo 50 de {filtradas.length} resultados. Refine o termo de busca para localizar produtos específicos.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------ Subcomponente Calculadora Manual
function CalculadoraManual() {
  const [c, setC] = useState({
    bc: "1000",
    pIbsUf: "0.10",
    pIbsMun: "0.00",
    pCbs: "0.90",
    vIbs: "1.00",
    vCbs: "9.00"
  });

  const r = calcular(c);
  const campo = (k, rot) => (
    <Campo rotulo={rot} id={"c-" + k}>
      <input
        id={"c-" + k}
        value={c[k]}
        onChange={(e) => setC({ ...c, [k]: e.target.value })}
        inputMode="decimal"
        className="text-right tabular-nums"
      />
    </Campo>
  );

  return (
    <section className="cartao p-5 space-y-4 max-w-[860px]">
      <div>
        <h2 className="text-[16px] font-semibold text-ink">Calculadora Avulsa (Transição LC 214/2025)</h2>
        <p className="text-[12.5px] text-muted">
          Base de cálculo × alíquotas oficiais de teste (CBS 0,90% e IBS UF 0,10%), permitindo testar itens isolados e comparar com a nota.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {campo("bc", "Base de Cálculo (R$)")}
        {campo("pIbsUf", "Alíquota IBS-UF (%)")}
        {campo("pIbsMun", "Alíquota IBS-Mun (%)")}
        {campo("pCbs", "Alíquota CBS (%)")}
        {campo("vIbs", "Valor IBS Informado na Nota (R$)")}
        {campo("vCbs", "Valor CBS Informado na Nota (R$)")}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {[
          ["IBS-UF (0,10%)", r.ibsUf],
          ["IBS-Mun (0,00%)", r.ibsMun],
          ["IBS Total", r.ibs],
          ["CBS (0,90%)", r.cbs],
          ["IBS + CBS", r.total]
        ].map(([n, v], i) => (
          <div
            key={n}
            className={"rounded-lg border px-3 py-2 " + (i === 4 ? "border-brand-fill bg-brand-soft" : "border-line bg-surface-2")}
          >
            <div className="text-[11.5px] text-muted">{n}</div>
            <div className="text-[15px] font-semibold tabular-nums text-ink">R$ {brl(v)}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-1">
        {r.msgs.map((m, i) => (
          <p
            key={i}
            className={"rounded-lg px-3 py-2 text-[12.5px] " + (m.nivel === "ok" ? "bg-ok-soft text-credit" : "bg-debit-soft text-debit")}
          >
            {m.nivel === "ok" ? "✓ " : "✕ "}
            {m.texto}
          </p>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ Subcomponente Tabela CST SVRS
function TabelaCstSvrs() {
  return (
    <section className="cartao overflow-hidden">
      <div className="p-4 border-b border-line">
        <h2 className="text-[16px] font-semibold text-ink">CST do IBS e CBS (SVRS / Receita Federal)</h2>
        <p className="text-[12.5px] text-muted">
          Tabela oficial de Códigos de Situação Tributária da Reforma Tributária. Cada CST se desdobra em Códigos de Classificação Tributária (cClassTrib de 6 dígitos) que definem o enquadramento na LC 214/2025.
        </p>
      </div>
      <div className="overflow-x-auto relative">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">CST</th>
              <th className="px-2 py-2 text-left font-semibold">Descrição</th>
              <th className="px-2 py-2 text-left font-semibold">Indicador de Tributação</th>
              <th className="px-4 py-2 text-left font-semibold">Exemplos Práticos de cClassTrib</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CSTS.map(([c, d, ind, ex]) => (
              <tr key={c} className="hover:bg-surface-2/60">
                <td className="px-4 py-2 font-mono font-semibold text-brand tabular-nums">{c}</td>
                <td className="px-2 py-2 text-ink font-medium">{d}</td>
                <td className="px-2 py-2 text-ink-2 text-[12.5px]">{ind}</td>
                <td className="px-4 py-2 text-[12px] text-muted leading-relaxed">{ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ Subcomponente Histórico de Lotes
function HistoricoLotes({ lotes, onCarregarLote, onExcluirLote }) {
  if (!lotes.length) {
    return (
      <div className="cartao p-8 text-center text-muted text-[13.5px]">
        Nenhum lote salvo no histórico. Após realizar uma conferência de notas, clique em &quot;Salvar Lote&quot; para registrar o fechamento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Histórico de Conferências Auditadas</h2>
        <span className="text-[12.5px] text-muted">{lotes.length} lote(s) registrado(s)</span>
      </div>

      <div className="space-y-2.5">
        {lotes.map((l) => (
          <div key={l.id} className="cartao p-4 flex flex-wrap items-center justify-between gap-3 hover:border-brand/50 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <strong className="text-[14px] text-ink">{l.origem}</strong>
                <span className="text-[11.5px] text-muted">
                  · {new Date(l.data).toLocaleDateString("pt-BR")} às {new Date(l.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                <span>{l.totalItens} item(ns)</span>
                <span className="text-credit font-medium">{l.totalOk} OK</span>
                {l.totalDivergencias > 0 && <span className="text-warn font-medium">{l.totalDivergencias} divergência(s)</span>}
                {l.totalInvalidos > 0 && <span className="text-ink-2 font-medium">{l.totalInvalidos} enquadramento(s)</span>}
                {l.diferencaTotal > 0 && <span className="text-debit font-medium">Dif: R$ {brl(l.diferencaTotal)}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-contorno btn-sm text-[12.5px]"
                onClick={() => onCarregarLote(l)}
              >
                Reabrir Lote
              </button>
              <button
                type="button"
                className="btn-primario btn-sm text-[12.5px]"
                onClick={() => {
                  const csvData = exportarDivergenciasCsv(l.itens, l.id);
                  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `divergencias_${l.id}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                }}
              >
                Baixar CSV
              </button>
              <button
                type="button"
                className="btn-fantasma btn-sm text-[12px] text-muted hover:text-debit"
                onClick={() => onExcluirLote(l.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

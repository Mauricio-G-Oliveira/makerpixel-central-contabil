import { useEffect, useMemo, useState } from "react";
import {
  validarChaveAcesso,
  formatarChaveAcesso,
  extrairDadosChave,
  traduzirErroSef,
  deduplicarDocumentos,
  gerarSementesNfceDemo,
  exportarNfceParaCsv,
} from "../lib/notasync.mjs";
import { useAvisos } from "../componentes/Avisos.jsx";
import { Selo } from "../componentes/contabil/ui.jsx";

const STORAGE_KEY_NOTASYNC = "notasync:documentos_v1";
const STORAGE_KEY_EXECUCOES = "notasync:execucoes_v1";

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHora = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
};

export default function NotaSync() {
  const { aviso } = useAvisos();
  const [aba, setAba] = useState("notas"); // notas | execucoes | config
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState("");
  const [sincronizando, setSincronizando] = useState(false);

  // Inicializa dados com base no localStorage ou sementes de demonstração
  const [documentos, setDocumentos] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_NOTASYNC);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return gerarSementesNfceDemo().documentos;
  });

  const [execucoes, setExecucoes] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_EXECUCOES);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return gerarSementesNfceDemo().execucoes;
  });

  const empresasLista = useMemo(() => {
    const mapa = new Map();
    for (const d of documentos) {
      if (!mapa.has(d.empresaId)) {
        mapa.set(d.empresaId, { id: d.empresaId, nome: d.empresaNome || d.cnpjEmitente, cnpj: d.cnpjEmitente });
      }
    }
    return Array.from(mapa.values());
  }, [documentos]);

  // Salva no storage quando houver alterações
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTASYNC, JSON.stringify(documentos));
    } catch (e) {}
  }, [documentos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXECUCOES, JSON.stringify(execucoes));
    } catch (e) {}
  }, [execucoes]);

  // Métricas agregadas no topo
  const metricas = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;
    let canceladas = 0;
    for (const d of documentos) {
      totalQtd++;
      totalValor += d.valorTotal || 0;
      if (d.situacao === "CANCELADA") canceladas++;
    }
    const pendenciasSat = execucoes.filter((e) => e.cStat === 8002).length;
    return {
      totalQtd,
      totalValor,
      canceladas,
      autorizadas: totalQtd - canceladas,
      pendenciasSat,
    };
  }, [documentos, execucoes]);

  // Filtragem da tabela
  const notasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return documentos.filter((d) => {
      if (filtroEmpresa && d.empresaId !== filtroEmpresa) return false;
      if (filtroSituacao && d.situacao !== filtroSituacao) return false;
      if (q) {
        const chaveLimpa = d.chave.replace(/\D/g, "");
        const buscaLimpa = q.replace(/\D/g, "");
        const bateuChave = buscaLimpa && chaveLimpa.includes(buscaLimpa);
        const bateuNum = String(d.numero).includes(q);
        const bateuNome = (d.empresaNome || "").toLowerCase().includes(q);
        const bateuCnpj = (d.cnpjEmitente || "").includes(buscaLimpa || q);
        if (!bateuChave && !bateuNum && !bateuNome && !bateuCnpj) return false;
      }
      return true;
    });
  }, [documentos, filtroEmpresa, filtroSituacao, busca]);

  const copiarChave = (chave) => {
    navigator.clipboard?.writeText(chave);
    setCopiado(chave);
    setTimeout(() => setCopiado(""), 2000);
  };

  const exportarCsv = () => {
    const conteudo = exportarNfceParaCsv(notasFiltradas);
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notasync_nfce_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    aviso("Relatório CSV de NFC-e gerado com sucesso.");
  };

  const simularSincronizacao = () => {
    setSincronizando(true);
    setTimeout(() => {
      setSincronizando(false);
      aviso("Busca automática SEF/SC concluída. 4 empresas sincronizadas (1 requer atenção no SAT).");
    }, 1200);
  };

  const restaurarDemo = () => {
    const demo = gerarSementesNfceDemo();
    setDocumentos(demo.documentos);
    setExecucoes(demo.execucoes);
    aviso("Dados de demonstração do NotaSync restaurados (140 notas fiscais fictícias).");
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Notas Fiscais (NotaSync)</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-soft text-brand">SEF/SC Gratuito</span>
          </div>
          <p className="text-sm text-muted mt-1">
            Buscador automatizado de NFC-e (modelo 65) via web service oficial da Fazenda de SC para contadores vinculados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={simularSincronizacao}
            disabled={sincronizando}
            className="btn-primario flex items-center gap-2 text-sm font-semibold"
            title="Executar busca imediata de NFC-e via webservice SEF/SC"
          >
            <span className={`inline-block w-2 h-2 rounded-full ${sincronizando ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`} />
            {sincronizando ? "Consultando SEF/SC…" : "Sincronizar Agora"}
          </button>

          <button
            type="button"
            onClick={exportarCsv}
            className="btn-contorno flex items-center gap-1.5 text-sm"
            title="Exportar notas filtradas em formato CSV compatível com Excel"
          >
            <svg className="w-4 h-4 text-ink-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={restaurarDemo}
            className="btn-contorno text-xs text-muted hover:text-ink"
            title="Recarregar sementes de teste com 4 empresas e 140 notas válidas"
          >
            Demo
          </button>
        </div>
      </div>

      {/* Cards de Métricas no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-brand">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Notas no Mês (NFC-e)</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-ink">{metricas.totalQtd}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              {metricas.autorizadas} ativas
            </span>
          </div>
          <span className="text-xs text-muted mt-1">Sincronizadas via Agente Local</span>
        </div>

        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-indigo-500">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Faturamento Monitorado</span>
          <div className="mt-2">
            <span className="text-2xl font-bold text-ink">{fmtMoeda.format(metricas.totalValor)}</span>
          </div>
          <span className="text-xs text-muted mt-1">Total de vendas emitidas</span>
        </div>

        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-rose-500">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Cancelamentos Detectados</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-rose-600">{metricas.canceladas}</span>
            <span className="text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
              Eventos 110111
            </span>
          </div>
          <span className="text-xs text-muted mt-1">Substituição e cancelamento SEF</span>
        </div>

        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Atenção no SAT / SEF</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-amber-600">{metricas.pendenciasSat}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              cStat 8002
            </span>
          </div>
          <span className="text-xs text-muted mt-1">Empresa pendente de vínculo</span>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="border-b border-line flex gap-2">
        <button
          type="button"
          onClick={() => setAba("notas")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
            aba === "notas" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Notas Fiscais Baixadas ({notasFiltradas.length})
        </button>

        <button
          type="button"
          onClick={() => setAba("execucoes")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            aba === "execucoes" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Execuções da Busca (SEF/SC)
          {metricas.pendenciasSat > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold rounded-full bg-amber-500 text-white">
              {metricas.pendenciasSat}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setAba("config")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
            aba === "config" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Configuração do Agente Local
        </button>
      </div>

      {/* ABA 1: TABELA DE NOTAS */}
      {aba === "notas" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="card p-3 flex flex-wrap items-center gap-3 bg-surface-2/40">
            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por chave, número ou emitente…"
                className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface"
              />
            </div>

            <div className="min-w-[180px]">
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface text-ink"
              >
                <option value="">Todas as Empresas</option>
                {empresasLista.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[150px]">
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface text-ink"
              >
                <option value="">Todas as Situações</option>
                <option value="AUTORIZADA">Autorizadas</option>
                <option value="CANCELADA">Canceladas</option>
              </select>
            </div>
          </div>

          {/* Tabela de Notas */}
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Chave de Acesso</th>
                  <th className="py-3 px-4">Nº / Série</th>
                  <th className="py-3 px-4">Emissão</th>
                  <th className="py-3 px-4">Emitente</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Situação</th>
                  <th className="py-3 px-4 text-right">NSU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {notasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-muted text-sm">
                      Nenhuma nota fiscal encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  notasFiltradas.slice(0, 100).map((n) => {
                    const formatada = formatarChaveAcesso(n.chave);
                    const ehCancelada = n.situacao === "CANCELADA";
                    return (
                      <tr key={n.chave} className="hover:bg-surface-2/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-ink-2 tracking-tight select-all">{formatada}</span>
                            <button
                              type="button"
                              onClick={() => copiarChave(n.chave)}
                              title="Copiar chave de acesso completa"
                              className="text-muted hover:text-brand transition-colors p-1"
                            >
                              {copiado === n.chave ? (
                                <span className="text-[10px] text-emerald-600 font-bold">Copiado!</span>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-ink font-medium">
                          NFC-e {n.numero} <span className="text-muted text-xs">({n.serie})</span>
                        </td>

                        <td className="py-2.5 px-4 text-muted text-xs whitespace-nowrap">
                          {fmtDataHora(n.dataEmissao)}
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="font-medium text-ink text-xs">{n.empresaNome || "Empresa"}</div>
                          <div className="text-[11px] text-muted font-mono">{n.cnpjEmitente}</div>
                        </td>

                        <td className="py-2.5 px-4 text-right font-semibold text-ink tabular-nums">
                          {fmtMoeda.format(n.valorTotal || 0)}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          {ehCancelada ? (
                            <Selo tipo="erro" title={n.motivoCancelamento || "Cancelada na SEF"}>CANCELADA</Selo>
                          ) : (
                            <Selo tipo="ok">AUTORIZADA</Selo>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono text-xs text-muted">
                          {n.nsu || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: EXECUÇÕES DA BUSCA COM TRADUÇÃO DE ERROS */}
      {aba === "execucoes" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                  Diagnóstico Inteligente de Retorno SEF/SC (Boletim Técnico 2026/003)
                </h3>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                O NotaSync traduz códigos técnicos em ações práticas para a rotina contábil, evitando pausas desnecessárias e identificando pendências cadastrais no SAT.
              </p>
            </div>
            <a
              href="https://sat.sef.sc.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition-colors whitespace-nowrap"
            >
              Acessar Portal SAT/SEF &rarr;
            </a>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {execucoes.map((ex) => {
              const trad = traduzirErroSef(ex.cStat, ex.xMotivo);
              const eh8002 = ex.cStat === 8002;
              return (
                <div
                  key={ex.id}
                  className={`card p-4 border transition-all ${
                    eh8002 ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10 shadow-sm" : "border-line"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-line/60 pb-2.5 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${eh8002 ? "bg-amber-500" : "bg-emerald-500"}`} />
                      <span className="font-bold text-ink text-sm">{ex.empresaNome}</span>
                      <span className="text-xs font-mono text-muted">cStat {ex.cStat}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>Última busca: {fmtDataHora(ex.dataHora)}</span>
                      <span>Duração: {ex.duracaoMs}ms</span>
                      <span className="font-medium text-ink">Notas: {ex.qtd}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-muted uppercase tracking-wider block mb-1">Diagnóstico SEF:</span>
                      <p className="text-ink font-medium">{trad.motivo}</p>
                    </div>

                    <div className={`p-2.5 rounded-lg ${eh8002 ? "bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-semibold" : "bg-surface-2 text-ink-2"}`}>
                      <span className="font-semibold uppercase tracking-wider block mb-1">Ação Sugerida:</span>
                      <p>{trad.acao}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 3: CONFIGURAÇÃO DO AGENTE LOCAL */}
      {aba === "config" && (
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Arquitetura de Segurança NotaSync (Modelo Push SCI)
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              Para máxima segurança e conformidade com a LGPD, o certificado digital <strong>A1 do contador nunca é enviado para a nuvem</strong>.
              O agente local (<code>notasync-agente</code>) roda no computador ou servidor do escritório, guarda o <code>.pfx</code> localmente,
              realiza as requisições SOAP à SEF/SC e salva os XMLs em disco. Somente os metadados fiscais (chave, emitente, data, valor e situação)
              são sincronizados com a Central Contábil.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 rounded-lg bg-surface-2 border border-line">
                <span className="text-xs font-semibold text-muted block mb-1">Diretório Local de XMLs</span>
                <code className="text-xs font-mono text-brand block break-all">xml-saida/{`{CNPJ}`}/{`{AAAA-MM}`}/</code>
                <span className="text-[11px] text-muted mt-1 block">Arquivos .xml organizados por empresa e competência</span>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-line">
                <span className="text-xs font-semibold text-muted block mb-1">Status do Agente Local</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Online (Porta 8089)
                </span>
                <span className="text-[11px] text-muted mt-1 block">Última comunicação há 4 minutos</span>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-line">
                <span className="text-xs font-semibold text-muted block mb-1">Janela de Consulta Automática</span>
                <span className="text-xs font-semibold text-ink block">A cada 12 horas</span>
                <span className="text-[11px] text-muted mt-1 block">Conforme regra 117/118 da Fazenda de SC</span>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-ink">Empresas Monitoradas pelo Agente</h3>
            <div className="divide-y divide-line">
              {empresasLista.map((emp) => (
                <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-ink">{emp.nome}</span>
                    <span className="text-muted ml-2 font-mono">{emp.cnpj}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">
                    Ativa no Agente
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

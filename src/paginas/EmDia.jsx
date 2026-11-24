import { useState, useEffect, useMemo, useCallback } from "react";
import Icone from "../componentes/Icone.jsx";
import { Selo } from "../componentes/contabil/ui.jsx";
import Janela from "../componentes/Janela.jsx";
import { useAvisos } from "../componentes/Avisos.jsx";
import apiClient from "../lib/apiClient.mjs";
import { CONFIG } from "../lib/config.js";
import {
  SETORES,
  STATUS_TAREFA,
  gerarModelosPadraoDemo,
  gerarEmpresasEmDiaDemo,
  gerarMesIdempotente,
  gerarTarefasAutomaticas,
  calcularMetricasPainel,
  agruparMinhasTarefas
} from "../lib/emDia.mjs";

const MES_ATUAL = new Date().toISOString().slice(0, 7);

export default function EmDia() {
  const { aviso } = useAvisos();
  const [abaAtiva, setAbaAtiva] = useState("minhas-tarefas");
  const [mesCompetencia, setMesCompetencia] = useState(MES_ATUAL);
  const [carregando, setCarregando] = useState(false);

  // Estados locais
  const [modelos, setModelos] = useState(() => gerarModelosPadraoDemo());
  const [empresas, setEmpresas] = useState(() => gerarEmpresasEmDiaDemo());
  const [tarefas, setTarefas] = useState(() => {
    const demo = gerarMesIdempotente([], gerarEmpresasEmDiaDemo(), gerarModelosPadraoDemo(), MES_ATUAL);
    return demo.tarefas;
  });

  // Diário da empresa
  const [empresaDiarioId, setEmpresaDiarioId] = useState("emp-1");
  const [anotacoes, setAnotacoes] = useState([
    {
      id: "anot-1",
      empresaId: "emp-1",
      autor: "Marcos Fiscal",
      texto: "Cliente enviou notas de entrada em atraso. Lançamento concluído.",
      criadoEm: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "anot-2",
      empresaId: "emp-1",
      autor: "Ana Contábil",
      texto: "Extrato bancário OFX conferido para conciliação.",
      criadoEm: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]);
  const [novaAnotacao, setNovaAnotacao] = useState("");

  // Modal Novo/Editar Modelo
  const [modalModeloAberta, setModalModeloAberta] = useState(false);
  const [modeloEdicao, setModeloEdicao] = useState(null);
  const [formModelo, setFormModelo] = useState({
    nome: "",
    setor: "FISCAL",
    diaVencimento: 15,
    aplicaSimples: true,
    aplicaLucroPresumido: true,
    aplicaLucroReal: true,
    aplicaMei: true,
    exigeFuncionario: false,
    tipoEmpresa: "TODOS",
    ativo: true
  });

  // Carregar dados da API em modo produção
  const carregarDadosApi = useCallback(async () => {
    if (CONFIG.modoDemo) return;
    setCarregando(true);
    try {
      const [modRes, checkRes, painelRes, minRes] = await Promise.allSettled([
        apiClient.get("/api/v1/emdia/modelos"),
        apiClient.get(`/api/v1/emdia/checklist/${mesCompetencia}`),
        apiClient.get(`/api/v1/emdia/painel/${mesCompetencia}`),
        apiClient.get("/api/v1/emdia/minhas-tarefas")
      ]);

      if (modRes.status === "fulfilled" && Array.isArray(modRes.value)) {
        setModelos(modRes.value);
      }

      if (checkRes.status === "fulfilled" && Array.isArray(checkRes.value)) {
        const todasTarefas = [];
        const empList = [];
        for (const item of checkRes.value) {
          empList.push({
            id: item.empresaId,
            razaoSocial: item.empresaNome,
            cnpj: item.empresaCnpj,
            regime: item.regime
          });
          if (Array.isArray(item.tarefas)) {
            todasTarefas.push(...item.tarefas);
          }
        }
        if (empList.length > 0) setEmpresas(empList);
        if (todasTarefas.length > 0) setTarefas(todasTarefas);
      }
    } catch (err) {
      aviso("Não foi possível carregar dados da API: " + (err.message || err), "aviso");
    } finally {
      setCarregando(false);
    }
  }, [mesCompetencia, aviso]);

  useEffect(() => {
    carregarDadosApi();
  }, [carregarDadosApi]);

  // Carregar anotações quando muda de empresa
  useEffect(() => {
    if (CONFIG.modoDemo || !empresaDiarioId) return;
    apiClient
      .get(`/api/v1/emdia/empresas/${empresaDiarioId}/anotacoes`)
      .then((lista) => {
        if (Array.isArray(lista)) setAnotacoes(lista);
      })
      .catch(() => {});
  }, [empresaDiarioId]);

  // Disparar geração idempotente do mês
  const dispararGerarMes = async () => {
    setCarregando(true);
    if (!CONFIG.modoDemo) {
      try {
        const resp = await apiClient.post("/api/v1/emdia/gerar-mes", {
          mesCompetencia
        });
        aviso(resp.mensagem || "Geração de tarefas concluída com sucesso!");
        await carregarDadosApi();
        return;
      } catch (err) {
        aviso("Erro ao gerar mês: " + (err.message || err), "erro");
      } finally {
        setCarregando(false);
      }
    }

    // Modo demonstração
    const res = gerarMesIdempotente(tarefas, empresas, modelos, mesCompetencia);
    setTarefas(res.tarefas);
    setCarregando(false);
    aviso(
      `Geração do mês ${mesCompetencia}: ${res.criadas} novas tarefas criadas (${res.existentes} já existiam).`
    );
  };

  // Alterar status de tarefa
  const alterarStatusTarefa = async (tarefaId, novoStatus) => {
    if (!CONFIG.modoDemo) {
      try {
        await apiClient.patch(`/api/v1/emdia/tarefas/${tarefaId}/status`, {
          status: novoStatus
        });
        setTarefas((prev) =>
          prev.map((t) =>
            t.id === tarefaId
              ? {
                  ...t,
                  status: novoStatus,
                  concluidaEm: novoStatus === "CONCLUIDA" ? new Date().toISOString() : null
                }
              : t
          )
        );
        aviso("Status atualizado!");
        return;
      } catch (err) {
        aviso("Erro ao atualizar status: " + (err.message || err), "erro");
        return;
      }
    }

    setTarefas((prev) =>
      prev.map((t) =>
        t.id === tarefaId
          ? {
              ...t,
              status: novoStatus,
              concluidaEm: novoStatus === "CONCLUIDA" ? new Date().toISOString() : null
            }
          : t
      )
    );
    aviso("Status da tarefa atualizado.");
  };

  // Salvar anotação
  const submeterAnotacao = async (e) => {
    e.preventDefault();
    if (!novaAnotacao.trim()) return;

    if (!CONFIG.modoDemo) {
      try {
        const resp = await apiClient.post("/api/v1/emdia/anotacoes", {
          empresaId: empresaDiarioId,
          texto: novaAnotacao
        });
        setAnotacoes([resp, ...anotacoes]);
        setNovaAnotacao("");
        aviso("Anotação registrada com sucesso no diário!");
        return;
      } catch (err) {
        aviso("Erro ao salvar anotação: " + (err.message || err), "erro");
        return;
      }
    }

    const nova = {
      id: `anot-${Date.now()}`,
      empresaId: empresaDiarioId,
      autor: "Você",
      texto: novaAnotacao,
      criadoEm: new Date().toISOString()
    };
    setAnotacoes([nova, ...anotacoes]);
    setNovaAnotacao("");
    aviso("Anotação adicionada ao diário.");
  };

  // Salvar modelo de tarefa
  const submeterModelo = async (e) => {
    e.preventDefault();
    if (!formModelo.nome.trim()) {
      aviso("Informe o nome da obrigação.", "erro");
      return;
    }

    if (!CONFIG.modoDemo) {
      try {
        if (modeloEdicao?.id) {
          const resp = await apiClient.put(`/api/v1/emdia/modelos/${modeloEdicao.id}`, formModelo);
          setModelos(modelos.map((m) => (m.id === modeloEdicao.id ? resp : m)));
        } else {
          const resp = await apiClient.post("/api/v1/emdia/modelos", formModelo);
          setModelos([...modelos, resp]);
        }
        setModalModeloAberta(false);
        aviso("Modelo de tarefa salvo com sucesso!");
        return;
      } catch (err) {
        aviso("Erro ao salvar modelo: " + (err.message || err), "erro");
        return;
      }
    }

    if (modeloEdicao?.id) {
      setModelos(modelos.map((m) => (m.id === modeloEdicao.id ? { ...formModelo, id: m.id } : m)));
    } else {
      setModelos([
        ...modelos,
        { ...formModelo, id: `mod-${Date.now()}` }
      ]);
    }
    setModalModeloAberta(false);
    aviso("Modelo de tarefa salvo.");
  };

  // Agrupamentos calculados
  const tarefasMes = useMemo(() => {
    return tarefas.filter((t) => (t.mesCompetencia || "").startsWith(mesCompetencia));
  }, [tarefas, mesCompetencia]);

  const metricas = useMemo(() => {
    return calcularMetricasPainel(tarefasMes);
  }, [tarefasMes]);

  const minhasTarefasAgrupadas = useMemo(() => {
    return agruparMinhasTarefas(tarefasMes);
  }, [tarefasMes]);

  return (
    <div className="space-y-6">
      {/* Banner Modo Demonstração */}
      {CONFIG.modoDemo && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <span>Demonstração: dados simulados em memória para o módulo Em Dia.</span>
          </div>
          <span className="text-[11px] uppercase tracking-wider font-bold bg-amber-200 dark:bg-amber-900 px-2 py-0.5 rounded">
            Demonstração
          </span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Em Dia</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-soft text-brand">
              v4.0 Produção
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Gestão diária de obrigações: o que cada empresa precisa este mês, quem cuida e o que já foi feito.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span>Competência:</span>
            <input
              type="month"
              value={mesCompetencia}
              onChange={(e) => setMesCompetencia(e.target.value)}
              className="text-xs font-bold py-1 px-2.5 rounded-lg border border-line bg-surface text-ink"
            />
          </div>

          <button
            type="button"
            onClick={dispararGerarMes}
            disabled={carregando}
            className="btn-primario text-xs font-semibold py-1.5 px-3 flex items-center gap-1.5"
            title="Gerar tarefas do mês de forma idempotente para todas as empresas"
          >
            <span>⚡</span>
            {carregando ? "Gerando..." : "Gerar Mês"}
          </button>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex gap-2 border-b border-line overflow-x-auto pb-px">
        {[
          { id: "minhas-tarefas", label: "Minhas Tarefas", count: minhasTarefasAgrupadas.hoje.length + minhasTarefasAgrupadas.atrasadas.length },
          { id: "mes-empresa", label: "Mês por Empresa", count: empresas.length },
          { id: "painel-mes", label: "Painel do Mês" },
          { id: "diario-empresa", label: "Diário da Empresa" },
          { id: "modelos", label: "Modelos de Tarefa", count: modelos.length }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAbaAtiva(tab.id)}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              abaAtiva === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                abaAtiva === tab.id ? "bg-brand/15 text-brand" : "bg-surface-2 text-muted"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ABA 1: MINHAS TAREFAS */}
      {abaAtiva === "minhas-tarefas" && (
        <div className="space-y-6">
          {/* Seção 1: Atrasadas */}
          {minhasTarefasAgrupadas.atrasadas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Tarefas Atrasadas ({minhasTarefasAgrupadas.atrasadas.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {minhasTarefasAgrupadas.atrasadas.map((t) => (
                  <div key={t.id} className="cartao p-3.5 border-l-4 border-l-rose-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">{t.nome}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                          Venceu em {new Date(t.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        <span>{t.empresaNome}</span> &bull; <span className="font-mono">{t.empresaCnpj}</span> &bull; Setor: <strong>{t.setor}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={t.status}
                        onChange={(e) => alterarStatusTarefa(t.id, e.target.value)}
                        className="text-xs h-8 px-2 rounded border border-line bg-surface text-ink font-semibold"
                      >
                        {STATUS_TAREFA.map((st) => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seção 2: Hoje */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-wider">
              <span>Para Hoje ({minhasTarefasAgrupadas.hoje.length})</span>
            </div>
            {minhasTarefasAgrupadas.hoje.length === 0 ? (
              <div className="cartao p-4 text-center text-xs text-muted">
                Nenhuma tarefa com vencimento para hoje.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {minhasTarefasAgrupadas.hoje.map((t) => (
                  <div key={t.id} className="cartao p-3.5 border-l-4 border-l-brand flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">{t.nome}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          Vence Hoje
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        <span>{t.empresaNome}</span> &bull; <span className="font-mono">{t.empresaCnpj}</span> &bull; Setor: <strong>{t.setor}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={t.status}
                        onChange={(e) => alterarStatusTarefa(t.id, e.target.value)}
                        className="text-xs h-8 px-2 rounded border border-line bg-surface text-ink font-semibold"
                      >
                        {STATUS_TAREFA.map((st) => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 3: Desta Semana */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-ink-2 font-bold text-xs uppercase tracking-wider">
              <span>Esta Semana ({minhasTarefasAgrupadas.destaSemana.length})</span>
            </div>
            {minhasTarefasAgrupadas.destaSemana.length === 0 ? (
              <div className="cartao p-4 text-center text-xs text-muted">
                Nenhuma tarefa agendada para os próximos 7 dias.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {minhasTarefasAgrupadas.destaSemana.map((t) => (
                  <div key={t.id} className="cartao p-3.5 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm">{t.nome}</span>
                        <span className="text-xs text-muted">
                          Prazo: {new Date(t.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        <span>{t.empresaNome}</span> &bull; Responsável: <strong>{t.responsavel || "Equipe"}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={t.status}
                        onChange={(e) => alterarStatusTarefa(t.id, e.target.value)}
                        className="text-xs h-8 px-2 rounded border border-line bg-surface text-ink font-semibold"
                      >
                        {STATUS_TAREFA.map((st) => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: MÊS POR EMPRESA */}
      {abaAtiva === "mes-empresa" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {empresas.map((emp) => {
              const empTarefas = tarefasMes.filter((t) => t.empresaId === emp.id);
              const concluidas = empTarefas.filter((t) => t.status === "CONCLUIDA").length;
              const total = empTarefas.length;
              const pctConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;

              return (
                <div key={emp.id} className="cartao p-4 space-y-3 border border-line">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-ink text-sm sm:text-base">{emp.razaoSocial}</h3>
                        <span className="text-[11px] font-mono text-muted">{emp.cnpj}</span>
                      </div>
                      <span className="text-xs text-muted">
                        Regime: <strong>{emp.regime}</strong> &bull; Responsáveis: Fiscal ({emp.responsavelSetorFiscal || "—"}), DP ({emp.responsavelSetorDp || "—"})
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold text-ink">{concluidas}/{total} concluídas</span>
                        <div className="w-24 bg-surface-2 rounded-full h-2 mt-1 overflow-hidden">
                          <div
                            className="bg-brand h-2 rounded-full transition-all"
                            style={{ width: `${pctConclusao}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {empTarefas.length === 0 ? (
                    <p className="text-xs text-muted py-2">
                      Nenhuma tarefa gerada para esta empresa no mês. Clique em "Gerar Mês" no topo.
                    </p>
                  ) : (
                    <div className="divide-y divide-line/60">
                      {empTarefas.map((t) => {
                        const ehConcluida = t.status === "CONCLUIDA";
                        return (
                          <div key={t.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={ehConcluida}
                                onChange={(e) =>
                                  alterarStatusTarefa(t.id, e.target.checked ? "CONCLUIDA" : "A_FAZER")
                                }
                                className="w-4 h-4 rounded text-brand border-line"
                              />
                              <span className={`text-xs font-semibold ${ehConcluida ? "line-through text-muted" : "text-ink"}`}>
                                {t.nome}
                              </span>
                              <span className="text-[11px] px-1.5 py-0.2 rounded font-semibold bg-surface-2 text-muted">
                                {t.setor}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted">
                                Prazo: {new Date(t.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                              </span>
                              <span className="text-muted font-medium">
                                Resp: {t.responsavel || "—"}
                              </span>
                              <select
                                value={t.status}
                                onChange={(e) => alterarStatusTarefa(t.id, e.target.value)}
                                className="text-xs h-7 px-2 rounded border border-line bg-surface text-ink font-semibold"
                              >
                                {STATUS_TAREFA.map((st) => (
                                  <option key={st.id} value={st.id}>{st.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 3: PAINEL DO MÊS */}
      {abaAtiva === "painel-mes" && (
        <div className="space-y-6">
          {/* Cards KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="cartao p-4 border-l-4 border-l-brand">
              <span className="text-xs font-semibold text-muted uppercase">Total Tarefas</span>
              <div className="text-2xl font-bold mt-1 text-ink">{metricas.totalTarefas}</div>
              <span className="text-[11px] text-muted">Competência {mesCompetencia}</span>
            </div>
            <div className="cartao p-4 border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold text-emerald-600 uppercase">Concluídas</span>
              <div className="text-2xl font-bold mt-1 text-emerald-600">{metricas.concluidas}</div>
              <span className="text-[11px] text-muted">Obrigações finalizadas</span>
            </div>
            <div className="cartao p-4 border-l-4 border-l-indigo-500">
              <span className="text-xs font-semibold text-indigo-600 uppercase">Em Dia</span>
              <div className="text-2xl font-bold mt-1 text-indigo-600">{metricas.emDia}</div>
              <span className="text-[11px] text-muted">No prazo regulamentar</span>
            </div>
            <div className="cartao p-4 border-l-4 border-l-rose-500">
              <span className="text-xs font-semibold text-rose-600 uppercase">Atrasadas</span>
              <div className="text-2xl font-bold mt-1 text-rose-600">{metricas.atrasadas}</div>
              <span className="text-[11px] text-muted">Requer ação urgente</span>
            </div>
            <div className="cartao p-4 border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold text-amber-600 uppercase">Aguardando Cliente</span>
              <div className="text-2xl font-bold mt-1 text-amber-600">{metricas.aguardandoCliente}</div>
              <span className="text-[11px] text-muted">Dependência externa</span>
            </div>
          </div>

          {/* Gráfico / Distribuição por Setor e Responsável */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="cartao p-4 space-y-3">
              <h3 className="font-bold text-sm text-ink border-b border-line pb-2">
                Distribuição por Setor
              </h3>
              <div className="space-y-2 text-xs">
                {Object.entries(metricas.porSetor).map(([setor, qtd]) => (
                  <div key={setor} className="flex items-center justify-between py-1 border-b border-line/40">
                    <span className="font-semibold text-ink">{setor}</span>
                    <span className="font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-full">{qtd} tarefas</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cartao p-4 space-y-3">
              <h3 className="font-bold text-sm text-ink border-b border-line pb-2">
                Distribuição por Responsável
              </h3>
              <div className="space-y-2 text-xs">
                {Object.entries(metricas.porResponsavel).map(([resp, qtd]) => (
                  <div key={resp} className="flex items-center justify-between py-1 border-b border-line/40">
                    <span className="font-semibold text-ink">{resp}</span>
                    <span className="font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">{qtd} tarefas</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: DIÁRIO DA EMPRESA */}
      {abaAtiva === "diario-empresa" && (
        <div className="space-y-4">
          <div className="cartao p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-sm text-ink">Linha do Tempo e Diário da Empresa</h3>
                <p className="text-xs text-muted">Histórico de anotações, atendimentos e interações com o cliente.</p>
              </div>

              <div className="min-w-[240px]">
                <select
                  value={empresaDiarioId}
                  onChange={(e) => setEmpresaDiarioId(e.target.value)}
                  className="w-full text-xs h-9 px-3 rounded-lg border border-line bg-surface text-ink font-semibold"
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Formulário Nova Anotação */}
            <form onSubmit={submeterAnotacao} className="space-y-2.5">
              <textarea
                rows={3}
                value={novaAnotacao}
                onChange={(e) => setNovaAnotacao(e.target.value)}
                placeholder="Escreva uma nova anotação no diário desta empresa…"
                className="w-full text-xs p-3 rounded-lg border border-line bg-surface text-ink"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn-primario text-xs font-semibold py-1.5 px-4"
                >
                  Adicionar Anotação
                </button>
              </div>
            </form>

            {/* Lista de Anotações */}
            <div className="space-y-3 pt-2">
              {anotacoes.length === 0 ? (
                <p className="text-xs text-muted text-center py-6">
                  Nenhuma anotação registrada ainda para esta empresa.
                </p>
              ) : (
                anotacoes.map((anot) => (
                  <div key={anot.id} className="p-3.5 rounded-lg border border-line bg-surface-2/40 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">{anot.autor}</span>
                      <span className="text-muted">
                        {new Date(anot.criadoEm).toLocaleDateString("pt-BR")}{" "}
                        {new Date(anot.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-ink-2 whitespace-pre-line leading-relaxed">
                      {anot.texto}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: MODELOS DE TAREFA */}
      {abaAtiva === "modelos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Configure as obrigações que devem ser geradas automaticamente para as empresas conforme o regime.
            </p>
            <button
              type="button"
              onClick={() => {
                setModeloEdicao(null);
                setFormModelo({
                  nome: "",
                  setor: "FISCAL",
                  diaVencimento: 15,
                  aplicaSimples: true,
                  aplicaLucroPresumido: true,
                  aplicaLucroReal: true,
                  aplicaMei: true,
                  exigeFuncionario: false,
                  tipoEmpresa: "TODOS",
                  ativo: true
                });
                setModalModeloAberta(true);
              }}
              className="btn-primario text-xs font-semibold py-1.5 px-3 flex items-center gap-1.5"
            >
              + Novo Modelo
            </button>
          </div>

          <div className="cartao overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-muted uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Obrigação</th>
                  <th className="py-3 px-4">Setor</th>
                  <th className="py-3 px-4 text-center">Dia Venc.</th>
                  <th className="py-3 px-4 text-center">Regimes Aplicáveis</th>
                  <th className="py-3 px-4 text-center">Exige Funcionário</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {modelos.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-ink">{m.nome}</td>
                    <td className="py-3 px-4 font-medium text-brand">{m.setor}</td>
                    <td className="py-3 px-4 text-center font-bold">Dia {m.diaVencimento}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {m.aplicaSimples && <span className="px-1.5 py-0.2 rounded bg-surface-2 text-ink-2 font-mono">Simples</span>}
                        {m.aplicaLucroPresumido && <span className="px-1.5 py-0.2 rounded bg-surface-2 text-ink-2 font-mono">Presumido</span>}
                        {m.aplicaLucroReal && <span className="px-1.5 py-0.2 rounded bg-surface-2 text-ink-2 font-mono">Real</span>}
                        {m.aplicaMei && <span className="px-1.5 py-0.2 rounded bg-surface-2 text-ink-2 font-mono">MEI</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      {m.exigeFuncionario ? (
                        <span className="text-amber-600 font-bold">Sim</span>
                      ) : (
                        <span className="text-muted">Não</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setModeloEdicao(m);
                          setFormModelo({ ...m });
                          setModalModeloAberta(true);
                        }}
                        className="btn-contorno text-xs py-1 px-2 text-brand font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar Modelo */}
      <Janela
        aberta={modalModeloAberta}
        aoFechar={() => setModalModeloAberta(false)}
        titulo={modeloEdicao ? "Editar Modelo de Obrigação" : "Novo Modelo de Obrigação"}
        largura="max-w-[540px]"
        rodape={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setModalModeloAberta(false)}
              className="btn-contorno text-xs py-1.5 px-3"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submeterModelo}
              className="btn-primario text-xs font-semibold py-1.5 px-4"
            >
              Salvar Modelo
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-muted uppercase tracking-wider block">Nome da Obrigação</label>
            <input
              type="text"
              value={formModelo.nome}
              onChange={(e) => setFormModelo({ ...formModelo, nome: e.target.value })}
              placeholder="Ex.: DAS Simples Nacional"
              className="w-full text-xs h-9 px-3 rounded-lg border border-line bg-surface text-ink font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-muted uppercase tracking-wider block">Setor Responsável</label>
              <select
                value={formModelo.setor}
                onChange={(e) => setFormModelo({ ...formModelo, setor: e.target.value })}
                className="w-full text-xs h-9 px-3 rounded-lg border border-line bg-surface text-ink font-semibold"
              >
                {SETORES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted uppercase tracking-wider block">Dia de Vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                value={formModelo.diaVencimento}
                onChange={(e) => setFormModelo({ ...formModelo, diaVencimento: parseInt(e.target.value) || 1 })}
                className="w-full text-xs h-9 px-3 rounded-lg border border-line bg-surface text-ink font-bold"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-line">
            <label className="font-semibold text-muted uppercase tracking-wider block">Regimes Aplicáveis</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formModelo.aplicaSimples}
                  onChange={(e) => setFormModelo({ ...formModelo, aplicaSimples: e.target.checked })}
                  className="rounded text-brand"
                />
                <span>Simples Nacional</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formModelo.aplicaLucroPresumido}
                  onChange={(e) => setFormModelo({ ...formModelo, aplicaLucroPresumido: e.target.checked })}
                  className="rounded text-brand"
                />
                <span>Lucro Presumido</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formModelo.aplicaLucroReal}
                  onChange={(e) => setFormModelo({ ...formModelo, aplicaLucroReal: e.target.checked })}
                  className="rounded text-brand"
                />
                <span>Lucro Real</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formModelo.aplicaMei}
                  onChange={(e) => setFormModelo({ ...formModelo, aplicaMei: e.target.checked })}
                  className="rounded text-brand"
                />
                <span>MEI</span>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-line">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formModelo.exigeFuncionario}
                onChange={(e) => setFormModelo({ ...formModelo, exigeFuncionario: e.target.checked })}
                className="rounded text-brand"
              />
              <span className="font-semibold">Exige que a empresa possua funcionários (ex.: FGTS)</span>
            </label>
          </div>
        </div>
      </Janela>
    </div>
  );
}

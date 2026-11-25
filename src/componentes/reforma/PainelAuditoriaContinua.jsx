import { useState, useEffect, useMemo } from "react";
import apiClient from "../../lib/apiClient.mjs";
import { CONFIG } from "../../lib/config.js";
import { useAvisos } from "../Avisos.jsx";
import Icone from "../Icone.jsx";
import {
  CONFIG_SEMAFORO,
  calcularSemaforo,
  gerarPainelContinuaDemo
} from "../../lib/ibsCbs.mjs";

export default function PainelAuditoriaContinua({ aoAbrirEmpresa, aoAbrirSieg }) {
  const { aviso } = useAvisos();
  const [anoMes, setAnoMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [dadosPainel, setDadosPainel] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [processandoPendentes, setProcessandoPendentes] = useState(false);
  const [reconferindoId, setReconferindoId] = useState(null);

  // Filtros
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [filtroSemaforo, setFiltroSemaforo] = useState("");

  const carregarPainel = async (mesAlvo = anoMes) => {
    try {
      setCarregando(true);
      if (CONFIG.modoDemo) {
        const demo = gerarPainelContinuaDemo(mesAlvo);
        setDadosPainel(demo);
        return;
      }

      const res = await apiClient.get(`/api/v1/reforma/continua/painel-mes?anoMes=${mesAlvo}`);
      setDadosPainel(res);
    } catch (err) {
      aviso("Não foi possível carregar o painel da auditoria contínua: " + (err.message || err));
      // Fallback para sementes demonstrativas em caso de erro de rede ou mock
      setDadosPainel(gerarPainelContinuaDemo(mesAlvo));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPainel(anoMes);
  }, [anoMes]);

  const conferirPendentesAgora = async () => {
    try {
      setProcessandoPendentes(true);
      if (CONFIG.modoDemo) {
        await new Promise((r) => setTimeout(r, 600));
        aviso("Auditoria contínua executada: 12 pendências processadas, 12 itens conferidos com a Calculadora RTC.");
        carregarPainel();
        return;
      }

      const res = await apiClient.post("/api/v1/reforma/continua/conferir-pendentes");
      aviso(
        `Auditoria executada: ${res.conferidosComSucesso || 0} documento(s) conferido(s), ` +
        `${res.jaAuditadosIgnorados || 0} já auditado(s) mantido(s) de forma idempotente.`
      );
      carregarPainel();
    } catch (err) {
      aviso("Erro ao processar pendências de auditoria: " + (err.message || err));
    } finally {
      setProcessandoPendentes(false);
    }
  };

  const reconferirMesEmpresa = async (empresa) => {
    const confirmou = window.confirm(
      `Deseja reconferir todos os documentos da empresa "${empresa.razaoSocial}" para o mês ${anoMes}?\n\n` +
      `Isso recalculará os itens contra a versão atual da Calculadora RTC da Receita Federal.`
    );
    if (!confirmou) return;

    try {
      setReconferindoId(empresa.empresaId);
      if (CONFIG.modoDemo) {
        await new Promise((r) => setTimeout(r, 700));
        aviso(`Reconferência da empresa ${empresa.razaoSocial} concluída com a versão ativa.`);
        carregarPainel();
        return;
      }

      const res = await apiClient.post(`/api/v1/reforma/continua/empresas/${empresa.empresaId}/mes/${anoMes}/reconferir`);
      aviso(res?.mensagem || "Reconferência concluída com sucesso.");
      carregarPainel();
    } catch (err) {
      aviso("Erro ao reconferir empresa: " + (err.message || err));
    } finally {
      setReconferindoId(null);
    }
  };

  // Filtragem das linhas da tabela
  const empresasFiltradas = useMemo(() => {
    if (!dadosPainel?.empresas) return [];
    return dadosPainel.empresas.filter((emp) => {
      const semaforoCalculado = emp.semaforo || calcularSemaforo(emp, CONFIG_SEMAFORO);
      if (filtroSemaforo && semaforoCalculado !== filtroSemaforo) {
        return false;
      }
      if (buscaEmpresa.trim()) {
        const termo = buscaEmpresa.toLowerCase().trim();
        const nome = (emp.razaoSocial || "").toLowerCase();
        const cnpj = (emp.cnpj || "").replace(/\D/g, "");
        const buscaLimpa = termo.replace(/\D/g, "");
        if (!nome.includes(termo) && (!buscaLimpa || !cnpj.includes(buscaLimpa))) {
          return false;
        }
      }
      return true;
    });
  }, [dadosPainel, buscaEmpresa, filtroSemaforo]);

  // Totais agregados
  const totais = useMemo(() => {
    if (!dadosPainel?.empresas) return { notas: 0, itens: 0, ok: 0, div: 0, semGrupo: 0, pendentes: 0 };
    return dadosPainel.empresas.reduce((acc, cur) => ({
      notas: acc.notas + (cur.totalNotas || 0),
      itens: acc.itens + (cur.totalItens || 0),
      ok: acc.ok + (cur.totalOk || 0),
      div: acc.div + (cur.totalDivergencias || 0),
      semGrupo: acc.semGrupo + (cur.totalSemGrupo || 0),
      pendentes: acc.pendentes + (cur.totalPendentes || 0)
    }), { notas: 0, itens: 0, ok: 0, div: 0, semGrupo: 0, pendentes: 0 });
  }, [dadosPainel]);

  return (
    <div className="space-y-4">
      {/* Barra de Controle Superior: Competência, Status e Ação */}
      <section className="cartao p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 className="text-[16px] font-bold text-ink flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Auditoria Contínua IBS/CBS
            </h2>
            <p className="text-[12.5px] text-muted">
              As notas fiscais entram automaticamente (NotaSync SEF/SC & SIEG) e o Auditor confere os itens sozinho.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-[13px]">
              <label htmlFor="mes-competencia" className="text-muted font-medium">Mês:</label>
              <input
                id="mes-competencia"
                type="month"
                value={anoMes}
                onChange={(e) => setAnoMes(e.target.value)}
                className="campo py-1 px-2.5 text-[13px] font-medium"
              />
            </div>

            <button
              type="button"
              onClick={conferirPendentesAgora}
              disabled={processandoPendentes}
              className="botao-primario text-[13px] inline-flex items-center gap-1.5 px-3 py-1.5 shadow-sm"
              title="Dispara imediatamente a fila de documentos pendentes contra a Calculadora RTC"
            >
              <Icone nome="raio" className="w-3.5 h-3.5" />
              {processandoPendentes ? "Conferindo..." : "Conferir Pendentes Agora"}
            </button>
          </div>
        </div>

        {/* Resumo em Cartões: Desde Ontem, Fontes e Limite do Plano */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
          {/* Card 1: Desde Ontem */}
          <div className="bg-surface-2 p-3 rounded-lg border border-line">
            <span className="text-muted text-[11px] uppercase font-bold tracking-wider block">Desde Ontem (24h)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[20px] font-bold text-ink">
                {dadosPainel?.desdeOntem?.notasConferidas ?? 0}
              </span>
              <span className="text-[12px] text-muted">notas conferidas</span>
            </div>
            <div className="mt-1 text-[11.5px]">
              {dadosPainel?.desdeOntem?.divergenciasNovas > 0 ? (
                <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                  ⚠️ {dadosPainel.desdeOntem.divergenciasNovas} divergência(s) nova(s)
                </span>
              ) : (
                <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                  ✓ Nenhuma divergência recente
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Fonte NotaSync (SEF/SC) */}
          <div className="bg-surface-2 p-3 rounded-lg border border-line">
            <div className="flex items-center justify-between">
              <span className="text-muted text-[11px] uppercase font-bold tracking-wider">SEF / SC (NFC-e)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="mt-1 font-semibold text-ink truncate">
              {dadosPainel?.statusFontes?.sef?.status || "Conectado"}
            </div>
            <p className="text-[11.5px] text-muted mt-0.5 truncate">
              {dadosPainel?.statusFontes?.sef?.ultimaBusca || "Sincronização diária ativa"}
            </p>
          </div>

          {/* Card 3: Fonte SIEG (NF-e & CT-e) */}
          <div className="bg-surface-2 p-3 rounded-lg border border-line">
            <div className="flex items-center justify-between">
              <span className="text-muted text-[11px] uppercase font-bold tracking-wider">SIEG (NF-e / CT-e)</span>
              {dadosPainel?.statusFontes?.sieg?.configurada ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <div className="mt-1 font-semibold text-ink flex items-center justify-between">
              <span>{dadosPainel?.statusFontes?.sieg?.configurada ? `Ativa (****${dadosPainel.statusFontes.sieg.ultimosQuatro})` : "Não configurada"}</span>
              {aoAbrirSieg && (
                <button
                  type="button"
                  onClick={aoAbrirSieg}
                  className="text-[11px] text-brand hover:underline"
                >
                  Configurar
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-muted mt-0.5 truncate">
              {dadosPainel?.statusFontes?.sieg?.ultimaBusca || "Chave no cofre seguro"}
            </p>
          </div>

          {/* Card 4: Calculadora RTC & Limite do Plano */}
          <div className="bg-surface-2 p-3 rounded-lg border border-line">
            <span className="text-muted text-[11px] uppercase font-bold tracking-wider block">Calculadora RTC & Plano</span>
            <div className="mt-1 font-semibold text-ink truncate text-[12.5px]">
              {dadosPainel?.versaoCalculadora?.versaoMotor || "v1.4.2"} ({dadosPainel?.versaoCalculadora?.versaoRegras || "LC 214/2025"})
            </div>
            <p className="text-[11.5px] text-muted mt-0.5 truncate" title={dadosPainel?.limitePlano?.aviso}>
              {dadosPainel?.limitePlano?.utilizado || 0} / {dadosPainel?.limitePlano?.limiteMensal || 5000} docs no mês
            </p>
          </div>
        </div>
      </section>

      {/* Tabela de Empresas com Semáforo */}
      <section className="cartao p-4 space-y-4">
        {/* Barra de Filtros e Busca */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-muted font-medium">Filtrar semáforo:</span>
            {[
              ["", "Todos"],
              ["VERDE", "🟢 Sem divergência"],
              ["AMARELO", "🟡 Atenção (1-5)"],
              ["VERMELHO", "🔴 Crítico / Sem Grupo"],
              ["CINZA", "⚪ Sem notas"]
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFiltroSemaforo(val)}
                className={
                  "px-2.5 py-1 text-[12px] rounded-md font-medium transition-colors " +
                  (filtroSemaforo === val
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink border border-line")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={buscaEmpresa}
              onChange={(e) => setBuscaEmpresa(e.target.value)}
              placeholder="Buscar por razão ou CNPJ..."
              className="campo w-full text-[12.5px] py-1 px-2.5"
            />
          </div>
        </div>

        {/* Tabela */}
        {carregando ? (
          <div className="py-12 text-center text-muted">
            <p className="animate-pulse">Atualizando painel de auditoria contínua...</p>
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="py-12 text-center text-muted border border-dashed border-line rounded-lg">
            <p>Nenhuma empresa encontrada com os filtros selecionados para o mês {anoMes}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="tabela-limpa w-full text-left text-[13px]">
              <thead className="bg-surface-2 border-b border-line text-[11.5px] uppercase font-bold text-muted tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Status</th>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3 text-center">Notas Conferidas</th>
                  <th className="py-2.5 px-3 text-center">Itens Auditados</th>
                  <th className="py-2.5 px-3 text-center">Itens OK</th>
                  <th className="py-2.5 px-3 text-center">Divergências</th>
                  <th className="py-2.5 px-3 text-center">Sem Grupo IBS</th>
                  <th className="py-2.5 px-3 text-center">Pendentes</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {empresasFiltradas.map((emp) => {
                  const sem = emp.semaforo || calcularSemaforo(emp, CONFIG_SEMAFORO);
                  return (
                    <tr
                      key={emp.empresaId}
                      className="hover:bg-surface-2 transition-colors cursor-pointer"
                      onClick={() => aoAbrirEmpresa && aoAbrirEmpresa(emp)}
                    >
                      <td className="py-2.5 px-3 text-center text-[18px]">
                        {sem === "VERDE" && <span title="🟢 Conforme: sem divergências">🟢</span>}
                        {sem === "AMARELO" && <span title="🟡 Atenção: poucas divergências">🟡</span>}
                        {sem === "VERMELHO" && <span title="🔴 Crítico: divergências elevadas ou notas sem grupo IBS/CBS">🔴</span>}
                        {sem === "CINZA" && <span title="⚪ Sem movimentação no mês">⚪</span>}
                      </td>

                      <td className="py-2.5 px-3">
                        <strong className="block text-ink text-[13.5px] hover:text-brand">
                          {emp.razaoSocial}
                        </strong>
                        <span className="text-[11.5px] text-muted font-mono">{emp.cnpj}</span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium">
                        {emp.totalNotas || 0}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {emp.totalItens || 0}
                      </td>

                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">
                        {emp.totalOk || 0}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {emp.totalDivergencias > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-bold bg-amber-500/10 text-amber-600">
                            {emp.totalDivergencias}
                          </span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {emp.totalSemGrupo > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-bold bg-red-500/10 text-red-600">
                            {emp.totalSemGrupo}
                          </span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {emp.totalPendentes > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-medium bg-blue-500/10 text-blue-600">
                            {emp.totalPendentes}
                          </span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => aoAbrirEmpresa && aoAbrirEmpresa(emp)}
                            className="botao-secundario text-[11.5px] px-2 py-1"
                            title="Abrir tela detalhada com memória de cálculo e exportação CSV"
                          >
                            Ver Itens
                          </button>

                          <button
                            type="button"
                            onClick={() => reconferirMesEmpresa(emp)}
                            disabled={reconferindoId === emp.empresaId}
                            className="botao-secundario text-[11.5px] px-2 py-1 text-muted hover:text-ink"
                            title="Reconferir todos os itens com a versão ativa da Calculadora RTC"
                          >
                            {reconferindoId === emp.empresaId ? "..." : "Reconferir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-surface-2 border-t border-line font-bold text-[12px] text-ink">
                <tr>
                  <td className="py-2.5 px-3 text-center">Total</td>
                  <td className="py-2.5 px-3">{empresasFiltradas.length} empresa(s)</td>
                  <td className="py-2.5 px-3 text-center">{totais.notas}</td>
                  <td className="py-2.5 px-3 text-center">{totais.itens}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-600">{totais.ok}</td>
                  <td className="py-2.5 px-3 text-center text-amber-600">{totais.div}</td>
                  <td className="py-2.5 px-3 text-center text-red-600">{totais.semGrupo}</td>
                  <td className="py-2.5 px-3 text-center text-blue-600">{totais.pendentes}</td>
                  <td className="py-2.5 px-3 text-right"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

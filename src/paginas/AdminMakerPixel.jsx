import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Icone from "../componentes/Icone.jsx";
import Janela from "../componentes/Janela.jsx";
import { Campo, Selo } from "../componentes/contabil/ui.jsx";
import { useAvisos } from "../componentes/Avisos.jsx";
import apiClient from "../lib/apiClient.mjs";
import { CONFIG } from "../lib/config.js";
import {
  listarEscritorios,
  escritorioAtivo,
  definirEscritorioAtivo,
  criarAcessoTeste,
  prorrogarTeste,
  ativarContrato,
  renovarContrato,
  alterarModulos,
  suspenderEscritorio,
  reativarEscritorio,
  encerrarEscritorio,
  statusAcesso,
  gerarTokenAgente,
  revogarTokenAgente,
  gerarMensagemConvite,
  linkContratarWhatsApp,
  MODULOS_DISPONIVEIS,
  listarPlanos,
  trocarPlano,
  PLANOS_PADRAO
} from "../lib/multiEscritorio.mjs";

export default function AdminMakerPixel() {
  const { aviso } = useAvisos();
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  const [escritoriosApi, setEscritoriosApi] = useState([]);
  const [carregandoApi, setCarregandoApi] = useState(!CONFIG.modoDemo);

  const carregarEscritorios = useCallback(async () => {
    if (CONFIG.modoDemo) return;
    setCarregandoApi(true);
    try {
      const lista = await apiClient.get("/api/admin/escritorios");
      if (Array.isArray(lista)) {
        setEscritoriosApi(
          lista.map((e) => ({
            id: e.id,
            cnpj: e.cnpj,
            razaoSocial: e.razaoSocial,
            nomeFantasia: e.razaoSocial,
            contato: e.contato,
            email: e.email,
            telefone: e.telefone,
            cidade: e.cidade,
            uf: e.uf,
            situacao: e.situacao,
            diasRestantes: e.diasRestantes,
            expirado: e.expirado,
            modulos: e.modulosAtivos || ["notasync", "reforma", "danfse", "xml-excel", "em-dia"],
            limiteUsuarios: e.maxUsuarios || 5,
            limiteEmpresas: e.maxEmpresas || 60,
            criadoEm: e.criadoEm,
          }))
        );
      }
    } catch (err) {
      aviso("Não foi possível carregar escritórios da API: " + (err.message || err), "aviso");
    } finally {
      setCarregandoApi(false);
    }
  }, [aviso]);

  useEffect(() => {
    carregarEscritorios();
  }, [carregarEscritorios, versao]);

  const escritorios = useMemo(() => {
    if (!CONFIG.modoDemo && escritoriosApi.length > 0) {
      return escritoriosApi;
    }
    return listarEscritorios();
  }, [escritoriosApi, versao]);

  const ativo = useMemo(() => escritorioAtivo(), [versao]);
  const planos = useMemo(() => listarPlanos(), [versao]);
  const [filtro, setFiltro] = useState("TODOS");
  const [apenasVencendo7d, setApenasVencendo7d] = useState(false);

  // Modais de ação
  const [modalNovoTeste, setModalNovoTeste] = useState(false);
  const [modalAtivarContrato, setModalAtivarContrato] = useState(null); // escritorio
  const [modalRenovarContrato, setModalRenovarContrato] = useState(null); // escritorio
  const [modalModulos, setModalModulos] = useState(null); // escritorio
  const [modalTrocarPlano, setModalTrocarPlano] = useState(null); // escritorio
  const [planoSelecionado, setPlanoSelecionado] = useState("plano-escritorio");
  const [modalHistorico, setModalHistorico] = useState(null); // escritorio
  const [modalToken, setModalToken] = useState(null); // { escritorio, rawToken, prefixo }
  const [modalConvite, setModalConvite] = useState(null); // { texto, whatsapp, email }

  // Formulário Novo Teste
  const [formTeste, setFormTeste] = useState({
    nome: "",
    cnpj: "",
    contato: "",
    email: "",
    telefone: "",
    cidade: "",
    dias: 3,
    planoId: "plano-essencial",
    modulos: ["notasync"],
    limiteUsuarios: 2,
    limiteEmpresas: 20,
    carregarDemo: true
  });

  // Formulário Ativar Contrato
  const [formContrato, setFormContrato] = useState({
    tipoDuracao: "dias", // "dias" | "data" | "permanente"
    dias: 30,
    dataFinal: "",
    planoId: "plano-escritorio",
    modulos: ["notasync"],
    limiteUsuarios: 5,
    limiteEmpresas: 60,
    observacao: "Contrato mensal padrão"
  });

  // Formulário Renovar Contrato
  const [formRenovar, setFormRenovar] = useState({
    tipoDuracao: "dias", // "dias" | "data"
    dias: 30,
    dataFinal: "",
    observacao: "Renovação de contrato"
  });

  // Filtragem
  const filtrados = useMemo(() => {
    return escritorios.filter((e) => {
      const st = statusAcesso(e);
      if (apenasVencendo7d) {
        if (st.vencido || st.diasRestantes > 7 || st.diasRestantes === 0) return false;
      }
      if (filtro === "TODOS") return true;
      if (filtro === "VENCIDO") return st.situacaoEfetiva === "VENCIDO";
      return st.situacaoEfetiva === filtro;
    });
  }, [escritorios, filtro, apenasVencendo7d]);

  const kpis = useMemo(() => {
    const total = escritorios.length;
    let ativos = 0, testes = 0, vencidos = 0, suspensos = 0;
    escritorios.forEach((e) => {
      const st = statusAcesso(e);
      if (st.situacaoEfetiva === "ATIVO") ativos++;
      else if (st.situacaoEfetiva === "TESTE") testes++;
      else if (st.situacaoEfetiva === "VENCIDO") vencidos++;
      else if (st.situacaoEfetiva === "SUSPENSO") suspensos++;
    });
    return { total, ativos, testes, vencidos, suspensos };
  }, [escritorios]);

  // Ações de formulário
  const submeterNovoTeste = async (e) => {
    e.preventDefault();
    if (!formTeste.nome.trim() || !formTeste.email.trim()) {
      aviso("Preencha o nome do escritório e o e-mail do responsável.", "erro");
      return;
    }
    if (formTeste.dias > 90) {
      if (!window.confirm(`Você definiu um período de teste longo (${formTeste.dias} dias). Deseja confirmar?`)) {
        return;
      }
    }
    if (!CONFIG.modoDemo) {
      try {
        const resp = await apiClient.post("/api/admin/escritorios/teste", {
          nome: formTeste.nome,
          cnpj: formTeste.cnpj,
          responsavel: formTeste.contato || formTeste.nome,
          email: formTeste.email,
          telefone: formTeste.telefone,
          cidade: formTeste.cidade,
          dias: Number(formTeste.dias) || 3,
          carregarExemplos: formTeste.carregarDemo ?? true,
        });
        setModalNovoTeste(false);
        setModalConvite({
          escritorio: { razaoSocial: formTeste.nome, telefone: formTeste.telefone },
          senha: resp.senhaProvisoria,
          texto: resp.mensagemFormatada,
          linkWhatsApp: resp.whatsappLink,
        });
        recarregar();
        aviso("Acesso de teste criado com sucesso na nuvem!");
        return;
      } catch (err) {
        aviso(err.message, "erro");
        return;
      }
    }
    try {
      const { escritorio, senhaProvisoria } = criarAcessoTeste(formTeste);
      const texto = gerarMensagemConvite(escritorio, senhaProvisoria);
      setModalNovoTeste(false);
      setModalConvite({
        escritorio,
        senha: senhaProvisoria,
        texto,
        linkWhatsApp: `https://wa.me/55${String(escritorio.telefone || "").replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`
      });
      recarregar();
      aviso("Acesso de teste criado com sucesso!");
    } catch (err) {
      aviso(err.message, "erro");
    }
  };

  const submeterAtivarContrato = (e) => {
    e.preventDefault();
    if (!modalAtivarContrato) return;
    try {
      ativarContrato(modalAtivarContrato.id, {
        dias: formContrato.tipoDuracao === "dias" ? formContrato.dias : null,
        ate: formContrato.tipoDuracao === "data" ? formContrato.dataFinal : null,
        semData: formContrato.tipoDuracao === "permanente",
        planoId: formContrato.planoId,
        modulos: formContrato.modulos,
        limiteUsuarios: formContrato.limiteUsuarios,
        limiteEmpresas: formContrato.limiteEmpresas,
        observacao: formContrato.observacao
      });
      setModalAtivarContrato(null);
      recarregar();
      aviso("Contrato ativado com sucesso!");
    } catch (err) {
      aviso(err.message, "erro");
    }
  };

  const submeterRenovarContrato = (e) => {
    e.preventDefault();
    if (!modalRenovarContrato) return;
    try {
      renovarContrato(modalRenovarContrato.id, {
        dias: formRenovar.tipoDuracao === "dias" ? formRenovar.dias : null,
        ate: formRenovar.tipoDuracao === "data" ? formRenovar.dataFinal : null,
        observacao: formRenovar.observacao
      });
      setModalRenovarContrato(null);
      recarregar();
      aviso("Contrato renovado com sucesso!");
    } catch (err) {
      aviso(err.message, "erro");
    }
  };

  const copiarTexto = (txt) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => aviso("Copiado para a área de transferência!"));
    }
  };

  return (
    <div className="space-y-6 max-w-[1180px]">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand px-2.5 py-0.5 rounded-full bg-brand-soft border border-brand/20">
              Gestão SaaS &amp; Licenças
            </span>
            <span className="text-xs text-muted">Central Contábil v3</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mt-1">
            Painel MakerPixel · Controle de Escritórios, Planos e Módulos
          </h1>
          <p className="text-[13.5px] text-muted">
            Gestão de planos (Essencial, Escritório, Escritório+), limites de usuários/empresas/storage, contratos e tokens NotaSync.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormTeste({
              nome: "",
              cnpj: "",
              contato: "",
              email: "",
              telefone: "",
              cidade: "",
              dias: 3,
              planoId: "plano-essencial",
              modulos: ["notasync"],
              limiteUsuarios: 2,
              limiteEmpresas: 20,
              carregarDemo: true
            });
            setModalNovoTeste(true);
          }}
          className="btn-primario flex items-center gap-2 whitespace-nowrap self-start sm:self-auto shadow-md"
        >
          <Icone nome="mais" className="w-4 h-4" />
          Novo Acesso de Teste (Dias Livres)
        </button>
      </div>

      {/* Cartões KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="cartao p-4 bg-surface border-line">
          <span className="text-xs font-semibold text-muted uppercase">Total Escritórios</span>
          <div className="text-2xl font-bold mt-1 text-ink">{kpis.total}</div>
          <span className="text-[11.5px] text-muted">Cadastrados no sistema</span>
        </div>
        <div className="cartao p-4 bg-surface border-line">
          <span className="text-xs font-semibold text-credit uppercase">Clientes Ativos</span>
          <div className="text-2xl font-bold mt-1 text-credit">{kpis.ativos}</div>
          <span className="text-[11.5px] text-muted">Contratos em operação</span>
        </div>
        <div className="cartao p-4 bg-surface border-line">
          <span className="text-xs font-semibold text-brand uppercase">Testes em Andamento</span>
          <div className="text-2xl font-bold mt-1 text-brand">{kpis.testes}</div>
          <span className="text-[11.5px] text-muted">Acessos em trial livre</span>
        </div>
        <div className="cartao p-4 bg-surface border-line">
          <span className="text-xs font-semibold text-debit uppercase">Vencidos</span>
          <div className="text-2xl font-bold mt-1 text-debit">{kpis.vencidos}</div>
          <span className="text-[11.5px] text-muted">Acesso expirado</span>
        </div>
        <div className="cartao p-4 bg-surface border-line">
          <span className="text-xs font-semibold text-warn uppercase">Suspensos</span>
          <div className="text-2xl font-bold mt-1 text-warn">{kpis.suspensos}</div>
          <span className="text-[11.5px] text-muted">Bloqueio administrativo</span>
        </div>
      </div>

      {/* Escritório Ativo Atual */}
      <div className="cartao p-4 bg-brand-soft/20 border-brand/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center font-bold text-base shrink-0">
            🏢
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted font-semibold">
              Escritório Operando no Navegador
            </div>
            <strong className="text-base text-ink">{ativo.razaoSocial}</strong>
            <span className="text-xs text-muted ml-2">CNPJ: {ativo.cnpj}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const st = statusAcesso(ativo);
            return (
              <span className={"text-xs font-bold px-2.5 py-1 rounded-full border " + (
                st.situacaoEfetiva === "ATIVO" ? "border-credit/30 bg-ok-soft text-credit" :
                st.situacaoEfetiva === "TESTE" ? "border-brand/30 bg-brand-soft text-brand" :
                st.situacaoEfetiva === "VENCIDO" ? "border-debit/30 bg-debit-soft text-debit" :
                "border-warn/30 bg-warn-soft text-warn"
              )}>
                {st.situacaoEfetiva} · Vence em: {st.acessoAteFmt}
              </span>
            );
          })()}
          <Link to="/" className="btn-contorno btn-sm">Abrir Módulos →</Link>
        </div>
      </div>

      {/* Lista de Escritórios */}
      <div className="cartao overflow-hidden border-line bg-surface">
        <div className="px-5 py-3.5 border-b border-line flex flex-wrap items-center justify-between gap-2 bg-surface-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Escritórios Cadastrados</span>
            <span className="text-xs text-muted">({filtrados.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-ink-2 hover:text-ink">
              <input
                type="checkbox"
                checked={apenasVencendo7d}
                onChange={(e) => setApenasVencendo7d(e.target.checked)}
                className="rounded text-brand"
              />
              <span>⚠️ Vencendo em 7 dias</span>
            </label>

            <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-border">
              {["TODOS", "ATIVO", "TESTE", "VENCIDO", "SUSPENSO"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={"text-xs font-semibold px-2 py-1 rounded-md transition-colors " + (
                    filtro === f ? "bg-brand text-black" : "text-muted hover:text-ink"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-line">
          {filtrados.map((esc) => {
            const st = statusAcesso(esc);
            const ehAtivo = esc.id === ativo.id;
            const ultimoEvento = Array.isArray(esc.historico) && esc.historico.length > 0 ? esc.historico[esc.historico.length - 1] : null;

            const planoAtual = planos.find((p) => p.id === esc.planoId) || planos[0];

            return (
              <div key={esc.id} className={"p-4 sm:px-5 hover:bg-surface-2/60 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-4 " + (ehAtivo ? "bg-surface-2/40" : "")}>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-[15px] font-semibold text-ink">{esc.razaoSocial}</strong>
                    {ehAtivo && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">OPERANDO</span>}
                    <span className={"text-[11px] font-bold px-2.5 py-0.5 rounded-full border " + (
                      st.situacaoEfetiva === "ATIVO" ? "border-credit/30 bg-ok-soft text-credit" :
                      st.situacaoEfetiva === "TESTE" ? "border-brand/30 bg-brand-soft text-brand" :
                      st.situacaoEfetiva === "VENCIDO" ? "border-debit/30 bg-debit-soft text-debit" :
                      "border-warn/30 bg-warn-soft text-warn"
                    )}>
                      {st.situacaoEfetiva}
                    </span>

                    {/* Badge do Plano */}
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-ink-2 border border-border" title={`Plano: ${planoAtual ? planoAtual.nome : esc.planoId}`}>
                      💎 {planoAtual ? planoAtual.nome.replace("Plano ", "") : "Essencial"} ({esc.limiteArmazenamentoGb || (planoAtual && planoAtual.limiteArmazenamentoGb) || 5} GB)
                    </span>

                    {st.diasRestantes <= 7 && !st.vencido && st.situacaoEfetiva !== "ENCERRADO" && (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-warn-soft text-warn border border-warn/30">
                        {st.venceHoje ? "Vence Hoje!" : `Resta(m) ${st.diasRestantes}d`}
                      </span>
                    )}

                    {esc.agenteToken && !esc.agenteToken.revogadoEm && (
                      <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-surface-3 text-muted border border-border" title="Token do agente NotaSync configurado">
                        🤖 {esc.agenteToken.prefixo}
                      </span>
                    )}
                  </div>

                  <p className="text-[12.5px] text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>CNPJ: {esc.cnpj}</span>
                    <span>Contato: {esc.contato} ({esc.email})</span>
                    <span>Acesso até: <strong className="text-fg">{st.acessoAteFmt}</strong></span>
                    <span>Limites: {esc.limiteUsuarios} users / {esc.limiteEmpresas} emp / {esc.limiteArmazenamentoGb || (planoAtual && planoAtual.limiteArmazenamentoGb) || 5} GB</span>
                  </p>

                  {/* Módulos contratados */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] text-muted font-medium">Módulos:</span>
                    {Array.isArray(esc.modulos) && esc.modulos.length > 0 ? (
                      esc.modulos.map((m) => {
                        const info = MODULOS_DISPONIVEIS.find((mod) => mod.id === m);
                        return (
                          <span key={m} className={"text-[10.5px] font-semibold px-2 py-0.5 rounded " + (m === "notasync" ? "bg-brand/15 text-brand border border-brand/30" : "bg-surface-2 text-ink-2 border border-border")}>
                            {info ? info.nome.split(" ")[0] : m}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-debit">Nenhum módulo ativo</span>
                    )}
                  </div>

                  {ultimoEvento && (
                    <div className="text-[11px] text-muted pt-0.5">
                      Último evento: <span className="font-mono">{ultimoEvento.tipo}</span> — {ultimoEvento.detalhe} ({new Date(ultimoEvento.data).toLocaleDateString("pt-BR")})
                    </div>
                  )}
                </div>

                {/* Ações Administrativas */}
                <div className="flex flex-wrap items-center gap-1.5 self-start xl:self-center shrink-0">
                  {!ehAtivo && (
                    <button
                      type="button"
                      onClick={() => { definirEscritorioAtivo(esc.id); recarregar(); aviso(`Operando como: ${esc.razaoSocial}`); }}
                      className="btn-contorno btn-sm text-brand border-brand-fill"
                    >
                      Alternar
                    </button>
                  )}

                  {/* Ativar Contrato */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormContrato({
                        tipoDuracao: "dias",
                        dias: 30,
                        dataFinal: "",
                        planoId: esc.planoId || "plano-escritorio",
                        modulos: Array.isArray(esc.modulos) ? [...esc.modulos] : ["notasync"],
                        limiteUsuarios: esc.limiteUsuarios || 5,
                        limiteEmpresas: esc.limiteEmpresas || 60,
                        observacao: "Contrato ativado via Painel MakerPixel"
                      });
                      setModalAtivarContrato(esc);
                    }}
                    className="btn-primario btn-sm text-xs"
                    title="Ativar contrato de cliente pago"
                  >
                    Ativar Contrato
                  </button>

                  {/* Renovar Contrato */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormRenovar({
                        tipoDuracao: "dias",
                        dias: 30,
                        dataFinal: "",
                        observacao: "Renovação de contrato mensal"
                      });
                      setModalRenovarContrato(esc);
                    }}
                    className="btn-contorno btn-sm text-xs"
                    title="Renovar contrato somando dias à data atual"
                  >
                    Renovar
                  </button>

                  {/* Prorrogar Teste */}
                  {st.emTeste && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!CONFIG.modoDemo) {
                          try {
                            await apiClient.post(`/api/admin/escritorios/${esc.id}/prorrogar`, { diasAdicionais: 7 });
                            recarregar();
                            aviso("Teste prorrogado por mais 7 dias na nuvem!");
                            return;
                          } catch (err) {
                            aviso(err.message, "erro");
                            return;
                          }
                        }
                        prorrogarTeste(esc.id, 7);
                        recarregar();
                        aviso("Teste prorrogado por mais 7 dias!");
                      }}
                      className="btn-fantasma btn-sm text-xs text-brand"
                      title="Prorrogar teste gratuito por 7 dias"
                    >
                      +7d Teste
                    </button>
                  )}

                  {/* Trocar Plano */}
                  <button
                    type="button"
                    onClick={() => {
                      setModalTrocarPlano(esc);
                      setPlanoSelecionado(esc.planoId || "plano-escritorio");
                    }}
                    className="btn-fantasma btn-sm text-xs text-brand font-semibold"
                    title="Trocar plano e limites (Armazenamento, Usuários, Empresas)"
                  >
                    Plano
                  </button>

                  {/* Alterar Módulos */}
                  <button
                    type="button"
                    onClick={() => setModalModulos(esc)}
                    className="btn-fantasma btn-sm text-xs"
                    title="Gerenciar módulos liberados"
                  >
                    Módulos
                  </button>

                  {/* Token do Agente NotaSync */}
                  <button
                    type="button"
                    onClick={() => {
                      if (esc.agenteToken && !esc.agenteToken.revogadoEm) {
                        if (window.confirm("Deseja revogar o token do agente deste escritório? O robô local perderá acesso até receber novo token.")) {
                          revogarTokenAgente(esc.id);
                          recarregar();
                          aviso("Token do agente revogado.");
                        }
                      } else {
                        const res = gerarTokenAgente(esc.id);
                        recarregar();
                        setModalToken({ escritorio: esc, ...res });
                      }
                    }}
                    className={"btn-fantasma btn-sm text-xs " + (esc.agenteToken && !esc.agenteToken.revogadoEm ? "text-debit" : "text-brand")}
                    title="Gerenciar credencial do robô NotaSync"
                  >
                    {esc.agenteToken && !esc.agenteToken.revogadoEm ? "Revogar Token" : "Gerar Token"}
                  </button>

                  {/* Histórico */}
                  <button
                    type="button"
                    onClick={() => setModalHistorico(esc)}
                    className="btn-fantasma btn-sm text-xs"
                    title="Ver histórico de alterações de licença"
                  >
                    Histórico
                  </button>

                  {/* Suspender / Reativar */}
                  {st.situacaoEfetiva === "SUSPENSO" ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!CONFIG.modoDemo) {
                          try {
                            await apiClient.post(`/api/admin/escritorios/${esc.id}/reativar`);
                            recarregar();
                            aviso("Escritório reativado na nuvem!");
                            return;
                          } catch (err) {
                            aviso(err.message, "erro");
                            return;
                          }
                        }
                        reativarEscritorio(esc.id);
                        recarregar();
                        aviso("Escritório reativado!");
                      }}
                      className="btn-fantasma btn-sm text-xs text-credit"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Deseja suspender o acesso do escritório ${esc.razaoSocial}?`)) {
                          if (!CONFIG.modoDemo) {
                            try {
                              await apiClient.post(`/api/admin/escritorios/${esc.id}/suspender`);
                              recarregar();
                              aviso("Escritório suspenso na nuvem.");
                              return;
                            } catch (err) {
                              aviso(err.message, "erro");
                              return;
                            }
                          }
                          suspenderEscritorio(esc.id, "Suspensão administrativa");
                          recarregar();
                          aviso("Escritório suspenso.");
                        }
                      }}
                      className="btn-fantasma btn-sm text-xs text-debit"
                    >
                      Suspender
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Criar Acesso de Teste (Dias Livres) */}
      {modalNovoTeste && (
        <Janela
          aberta
          titulo="Novo Acesso de Teste (Dias Livres)"
          aoFechar={() => setModalNovoTeste(false)}
          largura="max-w-[620px]"
          rodape={
            <>
              <button type="button" className="btn-fantasma" onClick={() => setModalNovoTeste(false)}>Cancelar</button>
              <button type="submit" form="form-novo-teste" className="btn-primario">Criar Acesso e Gerar Convite</button>
            </>
          }
        >
          <form id="form-novo-teste" onSubmit={submeterNovoTeste} className="space-y-4">
            <Campo rotulo="Razão Social / Nome do Escritório" id="t-nome">
              <input
                id="t-nome"
                required
                value={formTeste.nome}
                onChange={(e) => setFormTeste({ ...formTeste, nome: e.target.value })}
                placeholder="Ex: Delta Contabilidade Eireli"
              />
            </Campo>

            <div className="grid sm:grid-cols-2 gap-3">
              <Campo rotulo="CNPJ do Escritório" id="t-cnpj">
                <input
                  id="t-cnpj"
                  value={formTeste.cnpj}
                  onChange={(e) => setFormTeste({ ...formTeste, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </Campo>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">
                  Duração do Teste (Dias Livres)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    className="w-24 text-center font-bold"
                    value={formTeste.dias}
                    onChange={(e) => setFormTeste({ ...formTeste, dias: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />
                  <div className="flex items-center gap-1">
                    {[3, 7, 15, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFormTeste({ ...formTeste, dias: d })}
                        className={"text-xs px-2 py-1.5 rounded font-semibold border " + (
                          formTeste.dias === d ? "bg-brand text-black border-brand" : "bg-surface-2 text-muted hover:text-ink border-border"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Campo rotulo="Nome do Responsável" id="t-contato">
                <input
                  id="t-contato"
                  required
                  value={formTeste.contato}
                  onChange={(e) => setFormTeste({ ...formTeste, contato: e.target.value })}
                  placeholder="Ex: Fernanda Machado"
                />
              </Campo>
              <Campo rotulo="E-mail do Responsável" id="t-email">
                <input
                  id="t-email"
                  type="email"
                  required
                  value={formTeste.email}
                  onChange={(e) => setFormTeste({ ...formTeste, email: e.target.value })}
                  placeholder="fernanda@deltacontabil.com.br"
                />
              </Campo>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Campo rotulo="WhatsApp do Escritório" id="t-tel">
                <input
                  id="t-tel"
                  value={formTeste.telefone}
                  onChange={(e) => setFormTeste({ ...formTeste, telefone: e.target.value })}
                  placeholder="(48) 99123-4567"
                />
              </Campo>
              <Campo rotulo="Cidade (Opcional)" id="t-cidade">
                <input
                  id="t-cidade"
                  value={formTeste.cidade}
                  onChange={(e) => setFormTeste({ ...formTeste, cidade: e.target.value })}
                  placeholder="Ex: Cidade Exemplo"
                />
              </Campo>
            </div>

            {/* Escolha do Plano */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Plano Selecionado (Limites e Armazenamento)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {planos.map((p) => {
                  const sel = formTeste.planoId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFormTeste({
                          ...formTeste,
                          planoId: p.id,
                          limiteUsuarios: p.limiteUsuarios,
                          limiteEmpresas: p.limiteEmpresas
                        });
                      }}
                      className={"p-2.5 rounded-lg border text-left transition-all " + (
                        sel ? "bg-brand/15 border-brand ring-1 ring-brand" : "bg-surface-2 border-border hover:border-brand/40"
                      )}
                    >
                      <div className="font-bold text-xs text-ink">{p.nome.replace("Plano ", "")}</div>
                      <div className="text-[11px] text-muted">{p.limiteUsuarios} users · {p.limiteEmpresas} emp</div>
                      <div className="text-[10.5px] font-semibold text-brand">{p.limiteArmazenamentoGb} GB storage</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checkboxes de Módulos */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Módulos Liberados no Teste
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 bg-surface-2 p-3 rounded-lg border border-border">
                {MODULOS_DISPONIVEIS.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formTeste.modulos.includes(m.id)}
                      onChange={(e) => {
                        const novos = e.target.checked
                          ? [...formTeste.modulos, m.id]
                          : formTeste.modulos.filter((x) => x !== m.id);
                        setFormTeste({ ...formTeste, modulos: novos });
                      }}
                      className="rounded text-brand"
                    />
                    <span className={m.id === "notasync" ? "font-bold text-brand" : "text-fg"}>
                      {m.nome}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={formTeste.carregarDemo}
                onChange={(e) => setFormTeste({ ...formTeste, carregarDemo: e.target.checked })}
                className="rounded text-brand"
              />
              <span className="text-muted">Carregar dados fictícios de demonstração para apresentação comercial</span>
            </label>
          </form>
        </Janela>
      )}

      {/* Modal Ativar Contrato */}
      {modalAtivarContrato && (
        <Janela
          aberta
          titulo={`Ativar Contrato: ${modalAtivarContrato.razaoSocial}`}
          aoFechar={() => setModalAtivarContrato(null)}
          largura="max-w-[600px]"
          rodape={
            <>
              <button type="button" className="btn-fantasma" onClick={() => setModalAtivarContrato(null)}>Cancelar</button>
              <button type="submit" form="form-ativar-contrato" className="btn-primario">Confirmar Ativação de Contrato</button>
            </>
          }
        >
          <form id="form-ativar-contrato" onSubmit={submeterAtivarContrato} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Validade do Contrato
              </label>
              <div className="flex items-center gap-4 text-xs font-semibold mb-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoDuracao"
                    checked={formContrato.tipoDuracao === "dias"}
                    onChange={() => setFormContrato({ ...formContrato, tipoDuracao: "dias" })}
                  />
                  <span>Por Quantidade de Dias</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoDuracao"
                    checked={formContrato.tipoDuracao === "data"}
                    onChange={() => setFormContrato({ ...formContrato, tipoDuracao: "data" })}
                  />
                  <span>Data Final Específica</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoDuracao"
                    checked={formContrato.tipoDuracao === "permanente"}
                    onChange={() => setFormContrato({ ...formContrato, tipoDuracao: "permanente" })}
                  />
                  <span>Sem Data (Vitalício)</span>
                </label>
              </div>

              {formContrato.tipoDuracao === "dias" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-28 text-center font-bold"
                    value={formContrato.dias}
                    onChange={(e) => setFormContrato({ ...formContrato, dias: parseInt(e.target.value, 10) || 30 })}
                  />
                  <div className="flex items-center gap-1">
                    {[30, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFormContrato({ ...formContrato, dias: d })}
                        className={"text-xs px-2.5 py-1.5 rounded font-semibold border " + (
                          formContrato.dias === d ? "bg-brand text-black border-brand" : "bg-surface-2 text-muted border-border"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formContrato.tipoDuracao === "data" && (
                <input
                  type="date"
                  required
                  value={formContrato.dataFinal}
                  onChange={(e) => setFormContrato({ ...formContrato, dataFinal: e.target.value })}
                  className="w-full"
                />
              )}
            </div>

            {/* Escolha do Plano no Contrato */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Plano do Contrato (Limites e Armazenamento)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {planos.map((p) => {
                  const sel = formContrato.planoId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFormContrato({
                          ...formContrato,
                          planoId: p.id,
                          limiteUsuarios: p.limiteUsuarios,
                          limiteEmpresas: p.limiteEmpresas
                        });
                      }}
                      className={"p-2.5 rounded-lg border text-left transition-all " + (
                        sel ? "bg-brand/15 border-brand ring-1 ring-brand" : "bg-surface-2 border-border hover:border-brand/40"
                      )}
                    >
                      <div className="font-bold text-xs text-ink">{p.nome.replace("Plano ", "")}</div>
                      <div className="text-[11px] text-muted">{p.limiteUsuarios} users · {p.limiteEmpresas} emp</div>
                      <div className="text-[10.5px] font-semibold text-brand">{p.limiteArmazenamentoGb} GB storage</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Módulos do Contrato */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Módulos Contratados
              </label>
              <div className="grid grid-cols-2 gap-2 bg-surface-2 p-3 rounded-lg border border-border">
                {MODULOS_DISPONIVEIS.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formContrato.modulos.includes(m.id)}
                      onChange={(e) => {
                        const novos = e.target.checked
                          ? [...formContrato.modulos, m.id]
                          : formContrato.modulos.filter((x) => x !== m.id);
                        setFormContrato({ ...formContrato, modulos: novos });
                      }}
                      className="rounded text-brand"
                    />
                    <span className={m.id === "notasync" ? "font-bold text-brand" : "text-fg"}>
                      {m.nome}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Campo rotulo="Limite de Usuários" id="c-users">
                <input
                  id="c-users"
                  type="number"
                  min="1"
                  value={formContrato.limiteUsuarios}
                  onChange={(e) => setFormContrato({ ...formContrato, limiteUsuarios: parseInt(e.target.value, 10) || 15 })}
                />
              </Campo>
              <Campo rotulo="Limite de Empresas" id="c-emp">
                <input
                  id="c-emp"
                  type="number"
                  min="1"
                  value={formContrato.limiteEmpresas}
                  onChange={(e) => setFormContrato({ ...formContrato, limiteEmpresas: parseInt(e.target.value, 10) || 150 })}
                />
              </Campo>
            </div>

            <Campo rotulo="Observação do Contrato" id="c-obs">
              <input
                id="c-obs"
                value={formContrato.observacao}
                onChange={(e) => setFormContrato({ ...formContrato, observacao: e.target.value })}
                placeholder="Ex: Pix mensal, contrato 12 meses com NotaSync"
              />
            </Campo>
          </form>
        </Janela>
      )}

      {/* Modal Renovar Contrato */}
      {modalRenovarContrato && (
        <Janela
          aberta
          titulo={`Renovar Contrato: ${modalRenovarContrato.razaoSocial}`}
          aoFechar={() => setModalRenovarContrato(null)}
          largura="max-w-[500px]"
          rodape={
            <>
              <button type="button" className="btn-fantasma" onClick={() => setModalRenovarContrato(null)}>Cancelar</button>
              <button type="submit" form="form-renovar-contrato" className="btn-primario">Confirmar Renovação</button>
            </>
          }
        >
          <form id="form-renovar-contrato" onSubmit={submeterRenovarContrato} className="space-y-4">
            <p className="text-xs text-muted">
              Data de validade atual: <strong>{statusAcesso(modalRenovarContrato).acessoAteFmt}</strong>.
              A renovação somará os dias adicionais a partir da data de término atual.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                Adicionar Validade
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min="1"
                  className="w-28 text-center font-bold"
                  value={formRenovar.dias}
                  onChange={(e) => setFormRenovar({ ...formRenovar, dias: parseInt(e.target.value, 10) || 30 })}
                />
                <div className="flex items-center gap-1">
                  {[30, 60, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormRenovar({ ...formRenovar, dias: d })}
                      className={"text-xs px-2.5 py-1.5 rounded font-semibold border " + (
                        formRenovar.dias === d ? "bg-brand text-black border-brand" : "bg-surface-2 text-muted border-border"
                      )}
                    >
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Campo rotulo="Observação da Renovação" id="r-obs">
              <input
                id="r-obs"
                value={formRenovar.observacao}
                onChange={(e) => setFormRenovar({ ...formRenovar, observacao: e.target.value })}
                placeholder="Ex: Renovação mensalidade Pix"
              />
            </Campo>
          </form>
        </Janela>
      )}

      {/* Modal Gerenciar Módulos */}
      {modalModulos && (
        <Janela
          aberta
          titulo={`Módulos Liberados: ${modalModulos.razaoSocial}`}
          aoFechar={() => setModalModulos(null)}
          largura="max-w-[540px]"
          rodape={
            <>
              <button type="button" className="btn-fantasma" onClick={() => setModalModulos(null)}>Fechar</button>
              <button
                type="button"
                className="btn-primario"
                onClick={() => {
                  alterarModulos(modalModulos.id, modalModulos.modulos);
                  recarregar();
                  setModalModulos(null);
                  aviso("Módulos atualizados com sucesso!");
                }}
              >
                Salvar Módulos
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Selecione os módulos avulsos liberados para este escritório. Os menus e rotas se adaptarão automaticamente.
            </p>
            <div className="space-y-2 bg-surface-2 p-3.5 rounded-lg border border-border">
              {MODULOS_DISPONIVEIS.map((m) => {
                const ativoMod = Array.isArray(modalModulos.modulos) && modalModulos.modulos.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center justify-between p-2 rounded hover:bg-surface-3 cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={ativoMod}
                        onChange={(e) => {
                          const novos = e.target.checked
                            ? [...(modalModulos.modulos || []), m.id]
                            : (modalModulos.modulos || []).filter((x) => x !== m.id);
                          setModalModulos({ ...modalModulos, modulos: novos });
                        }}
                        className="rounded text-brand"
                      />
                      <div>
                        <strong className="text-xs block text-ink">{m.nome}</strong>
                        <span className="text-[11px] text-muted">Setor: {m.secao}</span>
                      </div>
                    </div>
                    {m.destaque && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand/20 text-brand">
                        DESTAQUE
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </Janela>
      )}

      {/* Modal Trocar Plano */}
      {modalTrocarPlano && (
        <Janela
          aberta
          titulo={`Alterar Plano: ${modalTrocarPlano.razaoSocial}`}
          aoFechar={() => setModalTrocarPlano(null)}
          largura="max-w-[540px]"
          rodape={
            <>
              <button type="button" className="btn-fantasma" onClick={() => setModalTrocarPlano(null)}>Cancelar</button>
              <button
                type="button"
                className="btn-primario"
                onClick={() => {
                  try {
                    trocarPlano(modalTrocarPlano.id, planoSelecionado, "Admin MakerPixel");
                    recarregar();
                    setModalTrocarPlano(null);
                    aviso("Plano atualizado com sucesso!");
                  } catch (err) {
                    aviso(err.message, "erro");
                  }
                }}
              >
                Confirmar Mudança de Plano
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Ao trocar de plano, os limites de usuários, empresas e armazenamento em GB serão ajustados automaticamente.
            </p>
            <div className="space-y-2.5">
              {planos.map((p) => {
                const selecionado = planoSelecionado === p.id;
                return (
                  <label
                    key={p.id}
                    onClick={() => setPlanoSelecionado(p.id)}
                    className={"flex items-center justify-between p-3.5 rounded-lg border cursor-pointer transition-all " + (
                      selecionado ? "bg-brand/15 border-brand ring-1 ring-brand" : "bg-surface-2 border-border hover:border-brand/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="plano-escolha-modal"
                        checked={selecionado}
                        onChange={() => setPlanoSelecionado(p.id)}
                        className="text-brand"
                      />
                      <div>
                        <div className="font-bold text-sm text-ink">{p.nome}</div>
                        <div className="text-xs text-muted">
                          Até {p.limiteUsuarios} usuários · {p.limiteEmpresas} empresas clientes · {p.limiteArmazenamentoGb} GB de armazenamento
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-brand px-2.5 py-1 rounded bg-brand/10 border border-brand/20">
                      {p.limiteArmazenamentoGb} GB
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </Janela>
      )}

      {/* Modal Histórico do Escritório */}
      {modalHistorico && (
        <Janela
          aberta
          titulo={`Histórico de Licenças: ${modalHistorico.razaoSocial}`}
          aoFechar={() => setModalHistorico(null)}
          largura="max-w-[620px]"
          rodape={<button type="button" className="btn-primario" onClick={() => setModalHistorico(null)}>Fechar</button>}
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {Array.isArray(modalHistorico.historico) && modalHistorico.historico.length > 0 ? (
              <div className="relative border-l-2 border-border ml-3 space-y-4 py-2">
                {modalHistorico.historico.map((h, idx) => (
                  <div key={idx} className="relative pl-6">
                    <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-brand ring-4 ring-surface" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand uppercase font-mono">{h.tipo}</span>
                      <span className="text-[11px] text-muted">{new Date(h.data).toLocaleString("pt-BR")}</span>
                      <span className="text-[11px] text-muted">por {h.autor || "MakerPixel"}</span>
                    </div>
                    <p className="text-xs text-ink mt-0.5">{h.detalhe}</p>
                    {Array.isArray(h.modulos) && (
                      <div className="text-[11px] text-muted mt-0.5">
                        Módulos: {h.modulos.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-4">Nenhum evento registrado ainda.</p>
            )}
          </div>
        </Janela>
      )}

      {/* Modal Token do Agente NotaSync Gerado */}
      {modalToken && (
        <Janela
          aberta
          titulo="Token do Agente NotaSync Gerado"
          aoFechar={() => setModalToken(null)}
          largura="max-w-[540px]"
          rodape={<button type="button" className="btn-primario" onClick={() => setModalToken(null)}>Concluir</button>}
        >
          <div className="space-y-4">
            <div className="p-3 bg-brand/10 border border-brand/30 rounded-lg text-xs text-brand leading-relaxed">
              ⚠️ <strong>Guarde este token com segurança.</strong> Por motivos de segurança, ele só será exibido uma única vez nesta tela.
            </div>

            <p className="text-xs text-muted">
              Configure esta credencial no arquivo <code className="font-mono text-fg">application.yml</code> do agente local ou variável de ambiente <code className="font-mono text-fg">NOTASYNC_CENTRAL_TOKEN</code>:
            </p>

            <div className="bg-surface-2 p-3 rounded-lg border border-border flex items-center justify-between gap-2 font-mono text-xs select-all text-brand font-semibold break-all">
              <span>{modalToken.rawToken}</span>
              <button
                type="button"
                onClick={() => copiarTexto(modalToken.rawToken)}
                className="btn-contorno btn-sm shrink-0"
              >
                Copiar
              </button>
            </div>
          </div>
        </Janela>
      )}

      {/* Modal Convite Gerado */}
      {modalConvite && (
        <Janela
          aberta
          titulo="Convite de Acesso Pronto"
          aoFechar={() => setModalConvite(null)}
          largura="max-w-[560px]"
          rodape={<button type="button" className="btn-primario" onClick={() => setModalConvite(null)}>Concluir</button>}
        >
          <div className="space-y-4">
            <p className="text-[13.5px] text-ink-2">
              O acesso de teste foi criado. Envie a mensagem pronta abaixo com as credenciais iniciais:
            </p>

            <div className="bg-surface-2 p-3.5 rounded-lg border border-line text-xs font-mono whitespace-pre-wrap leading-relaxed select-all">
              {modalConvite.texto}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copiarTexto(modalConvite.texto)}
                className="btn-primario btn-sm flex items-center gap-1.5"
              >
                <Icone nome="copiar" className="w-4 h-4" />
                Copiar Mensagem
              </button>
              <a
                href={modalConvite.linkWhatsApp}
                target="_blank"
                rel="noreferrer"
                className="btn-contorno btn-sm text-credit border-credit/40 flex items-center gap-1.5"
              >
                Enviar via WhatsApp
              </a>
              <a
                href={`mailto:${modalConvite.escritorio.email}?subject=Acesso ao Central Contabil&body=${encodeURIComponent(modalConvite.texto)}`}
                className="btn-contorno btn-sm flex items-center gap-1.5"
              >
                Enviar por E-mail
              </a>
            </div>
          </div>
        </Janela>
      )}
    </div>
  );
}

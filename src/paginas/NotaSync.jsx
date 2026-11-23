import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icone from "../componentes/Icone.jsx";
import {
  validarChaveAcesso,
  formatarChaveAcesso,
  extrairDadosChave,
  traduzirErroSef,
  deduplicarDocumentos,
  gerarSementesNfceDemo,
  exportarNfceParaCsv,
  verificarEsperaBuscaAgora,
  criarZipBlob,
} from "../lib/notasync.mjs";
import { useAvisos } from "../componentes/Avisos.jsx";
import { Selo } from "../componentes/contabil/ui.jsx";
import CardCertificado from "../componentes/notasync/CardCertificado.jsx";
import AssistentePrimeirosPassosModal from "../componentes/notasync/AssistentePrimeirosPassosModal.jsx";
import ModalUploadCertificado from "../componentes/notasync/ModalUploadCertificado.jsx";
import ModalImportarEmpresasCsv from "../componentes/notasync/ModalImportarEmpresasCsv.jsx";

const STORAGE_KEY_NOTASYNC = "notasync:documentos_v3";
const STORAGE_KEY_EXECUCOES = "notasync:execucoes_v3";
const STORAGE_KEY_EMPRESAS = "notasync:empresas_v3";
const STORAGE_KEY_CERTIFICADO = "notasync:certificado_v3";

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHora = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("pt-BR") +
      " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );
  } catch (e) {
    return iso;
  }
};

export default function NotaSync() {
  const { aviso } = useAvisos();
  const [aba, setAba] = useState("notas"); // notas | empresas | execucoes | cofre
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState("");
  const [sincronizandoGeral, setSincronizandoGeral] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState("");

  // Modais
  const [modalAssistenteAberta, setModalAssistenteAberta] = useState(false);
  const [modalUploadCertAberta, setModalUploadCertAberta] = useState(false);
  const [modalImportarCsvAberta, setModalImportarCsvAberta] = useState(false);

  // Estado do Certificado Digital A1 no Cofre
  const [certificado, setCertificado] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_CERTIFICADO);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return {
      titular: "CONTABILIDADE MODELO LTDA",
      documento: "11222333000181",
      tipo: "E_CNPJ",
      emissor: "AC Certisign Multipla G7",
      validoDe: "2026-01-10T00:00:00Z",
      validoAte: "2027-01-10T23:59:59Z",
      sha256Original: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      termoVersao: "1.0",
      versaoChaveMestra: 1,
    };
  });

  // Empresas monitoradas
  const [empresas, setEmpresas] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_EMPRESAS);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    const sementes = gerarSementesNfceDemo();
    return sementes.empresas.map((emp) => ({
      ...emp,
      ativo: true,
      ultNsu: 520,
      proximaBusca: null, // Disponível imediatamente
      status: emp.id === "emp-4" ? "PENDENTE_VINCULO_SAT" : "SINCRONIZADO",
    }));
  });

  // Documentos NFC-e
  const [documentos, setDocumentos] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_NOTASYNC);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return gerarSementesNfceDemo().documentos;
  });

  // Histórico de Execuções
  const [execucoes, setExecucoes] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_EXECUCOES);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {}
    return gerarSementesNfceDemo().execucoes;
  });

  // Persistência Local
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EMPRESAS, JSON.stringify(empresas));
    } catch (e) {}
  }, [empresas]);

  useEffect(() => {
    try {
      if (certificado) {
        localStorage.setItem(STORAGE_KEY_CERTIFICADO, JSON.stringify(certificado));
      } else {
        localStorage.removeItem(STORAGE_KEY_CERTIFICADO);
      }
    } catch (e) {}
  }, [certificado]);

  // Métricas para cards do topo
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

  // Contagem de notas por empresa no mês
  const notasPorEmpresa = useMemo(() => {
    const contagem = new Map();
    for (const d of documentos) {
      const chave = d.cnpjEmitente;
      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
    return contagem;
  }, [documentos]);

  // Filtragem da tabela de notas
  const notasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return documentos.filter((d) => {
      if (filtroEmpresa && d.empresaId !== filtroEmpresa && d.cnpjEmitente !== filtroEmpresa) return false;
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

  // Baixar arquivo ZIP com todos os XMLs do mês (Fase 4 & Fase 5)
  const baixarZipMes = (cnpjAlvo = null) => {
    const notasParaZip = notasFiltradas.filter((d) => !cnpjAlvo || d.cnpjEmitente === cnpjAlvo);
    if (notasParaZip.length === 0) {
      aviso("Nenhuma nota fiscal encontrada para gerar o arquivo ZIP.");
      return;
    }

    const arquivosXml = notasParaZip.map((n) => {
      const xmlNota =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">\n` +
        `  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">\n` +
        `    <infNFe Id="NFe${n.chave}" versao="4.00">\n` +
        `      <ide><cUF>42</cUF><mod>65</mod><serie>${n.serie}</serie><nNF>${n.numero}</nNF><dhEmi>${n.dataEmissao}</dhEmi></ide>\n` +
        `      <emit><CNPJ>${n.cnpjEmitente}</CNPJ><xNome>${n.empresaNome || "Empresa"}</xNome></emit>\n` +
        `      <total><ICMSTot><vNF>${(n.valorTotal || 0).toFixed(2)}</vNF></ICMSTot></total>\n` +
        `    </infNFe>\n` +
        `  </NFe>\n` +
        `</nfeProc>`;
      return { nome: `${n.chave}.xml`, conteudo: xmlNota };
    });

    const zipBlob = criarZipBlob(arquivosXml);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    const nomeEmpresa = cnpjAlvo ? cnpjAlvo : "lote_completo";
    a.download = `nfce_${nomeEmpresa}_2026-11.zip`;
    a.click();
    URL.revokeObjectURL(url);

    aviso(`Arquivo ZIP gerado com ${arquivosXml.length} notas fiscais em XML.`);
  };

  // Buscar Agora para empresa específica com controle de HTTP 429
  const buscarAgoraEmpresa = (empresa) => {
    const checagem = verificarEsperaBuscaAgora(empresa.proximaBusca);
    if (!checagem.podeConsultar) {
      const min = Math.ceil(checagem.segundosRestantes / 60);
      aviso(
        `[HTTP 429 - Aguarde] A SEF/SC exige intervalo regulamentar. Próxima busca permitida em ${min} minuto(s).`,
        "aviso"
      );
      return;
    }

    setBuscandoCnpj(empresa.cnpj);
    setTimeout(() => {
      setBuscandoCnpj("");

      // Se for a empresa com erro 8002 no SAT
      if (empresa.cnpj.includes("666") || empresa.id === "emp-4") {
        const novaProxima = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        setEmpresas((lista) =>
          lista.map((e) => (e.id === empresa.id ? { ...e, proximaBusca: novaProxima, status: "PENDENTE_VINCULO_SAT" } : e))
        );
        aviso(
          `SEF/SC Retorno 8002: O contador não está vinculado ao CNPJ ${empresa.cnpj} no SAT da SEF/SC. Aguardando 24h.`,
          "aviso"
        );
      } else {
        // Sucesso 118
        const novaProxima = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        setEmpresas((lista) =>
          lista.map((e) => (e.id === empresa.id ? { ...e, proximaBusca: novaProxima, status: "SINCRONIZADO" } : e))
        );
        aviso(`Busca concluída para ${empresa.razaoSocial || empresa.nome}. Fila sincronizada com sucesso!`);
      }
    }, 1200);
  };

  const toggleAtivoEmpresa = (id) => {
    setEmpresas((lista) =>
      lista.map((e) => (e.id === id ? { ...e, ativo: !e.ativo } : e))
    );
    aviso("Status da empresa atualizado.");
  };

  const simularSincronizacaoGeral = () => {
    setSincronizandoGeral(true);
    setTimeout(() => {
      setSincronizandoGeral(false);
      aviso("Busca automática SEF/SC concluída. 4 empresas sincronizadas (1 requer atenção no SAT).");
    }, 1200);
  };

  const restaurarDemo = () => {
    const demo = gerarSementesNfceDemo();
    setDocumentos(demo.documentos);
    setExecucoes(demo.execucoes);
    setEmpresas(
      demo.empresas.map((emp) => ({
        ...emp,
        ativo: true,
        ultNsu: 520,
        proximaBusca: null,
        status: emp.id === "emp-4" ? "PENDENTE_VINCULO_SAT" : "SINCRONIZADO",
      }))
    );
    aviso("Dados de demonstração do NotaSync restaurados com 4 empresas e 140 notas fiscais.");
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Notas Fiscais (NotaSync)</h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-soft text-brand">
              SEF/SC Direto
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Robô na nuvem de busca automatizada de NFC-e (modelo 65) via Secretaria da Fazenda de SC para contadores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalAssistenteAberta(true)}
            className="btn-contorno text-xs py-1.5 px-3 text-brand font-semibold flex items-center gap-1.5"
            title="Abrir o assistente passo a passo de configuração"
          >
            <span className="text-brand">✨</span>
            Assistente Primeiros Passos
          </button>

          <button
            type="button"
            onClick={simularSincronizacaoGeral}
            disabled={sincronizandoGeral}
            className="btn-primario flex items-center gap-2 text-xs font-semibold py-1.5 px-3"
            title="Executar ciclo de busca em lote de todas as empresas ativas"
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                sincronizandoGeral ? "bg-amber-400 animate-ping" : "bg-emerald-400"
              }`}
            />
            {sincronizandoGeral ? "Consultando SEF/SC…" : "Sincronizar Todas"}
          </button>

          <button
            type="button"
            onClick={() => baixarZipMes()}
            className="btn-contorno flex items-center gap-1 text-xs py-1.5 px-3 font-semibold"
            title="Baixar arquivo ZIP com todos os XMLs de notas do mês"
          >
            <svg className="w-4 h-4 text-ink-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Baixar ZIP do Mês
          </button>

          <Link
            to="/ibs-cbs"
            className="btn-contorno flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold text-brand hover:bg-brand-soft transition"
            title="Conferir tributos da Reforma Tributária (LC 214/2025)"
          >
            <Icone nome="reforma" className="w-3.5 h-3.5" />
            Conferir IBS/CBS
          </Link>

          <Link
            to="/xml-excel"
            className="btn-contorno flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold text-brand hover:bg-brand-soft transition"
            title="Exportar notas fiscais para planilha Excel (.xlsx) com abas de notas e itens"
          >
            <Icone nome="excel" className="w-3.5 h-3.5" />
            Exportar Excel
          </Link>

          <Link
            to="/danfse"
            className="btn-contorno flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold text-brand hover:bg-brand-soft transition"
            title="Gerar DANFSe de notas fiscais de serviço em PDF no navegador"
          >
            <Icone nome="danfse" className="w-3.5 h-3.5" />
            Gerar DANFSe
          </Link>

          <button
            type="button"
            onClick={restaurarDemo}
            className="btn-contorno text-xs text-muted hover:text-ink py-1.5 px-2.5"
            title="Restaurar sementes de teste do GitHub Pages"
          >
            Demo
          </button>
        </div>
      </div>

      {/* Card do Certificado Digital A1 no Cofre (Fase 3 & 5) */}
      <CardCertificado
        certificado={certificado}
        onTrocar={() => setModalUploadCertAberta(true)}
        onExcluir={() => {
          setCertificado(null);
          aviso("Certificado digital A1 excluído com sucesso do cofre.");
        }}
        onAbrirAssistente={() => setModalAssistenteAberta(true)}
      />

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
          <span className="text-xs text-muted mt-1">Armazenadas em Supabase Storage</span>
        </div>

        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-indigo-500">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Faturamento Monitorado</span>
          <div className="mt-2">
            <span className="text-2xl font-bold text-ink">{fmtMoeda.format(metricas.totalValor)}</span>
          </div>
          <span className="text-xs text-muted mt-1">Total de vendas transmitidas</span>
        </div>

        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-rose-500">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Cancelamentos Detectados</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-rose-600">{metricas.canceladas}</span>
            <span className="text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
              Eventos 110111
            </span>
          </div>
          <span className="text-xs text-muted mt-1">Deduplicação automática</span>
        </div>

        <div className="card p-4 flex flex-col justify-between border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Atenção no SAT / SEF</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-amber-600">{metricas.pendenciasSat}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              cStat 8002
            </span>
          </div>
          <span className="text-xs text-muted mt-1">Pendente de vínculo do contador</span>
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
          onClick={() => setAba("empresas")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            aba === "empresas" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Empresas Monitoradas ({empresas.length})
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
          onClick={() => setAba("cofre")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
            aba === "cofre" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Cofre Seguro & Auditoria
        </button>
      </div>

      {/* ABA 1: TABELA DE NOTAS COM FILTROS E ZIP */}
      {aba === "notas" && (
        <div className="space-y-4">
          <div className="card p-3 flex flex-wrap items-center justify-between gap-3 bg-surface-2/40">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="min-w-[220px] flex-1">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por chave de acesso, número ou emitente…"
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
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.cnpj}>
                      {emp.razaoSocial || emp.nome}
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

            <div className="flex items-center gap-2">
              {filtroEmpresa && (
                <button
                  type="button"
                  onClick={() => baixarZipMes(filtroEmpresa)}
                  className="btn-contorno text-xs py-1.5 px-3 text-brand font-semibold flex items-center gap-1.5"
                  title="Baixar ZIP desta empresa"
                >
                  ZIP desta Empresa
                </button>
              )}
              <Link
                to="/xml-excel"
                className="btn-contorno text-xs py-1.5 px-3 font-semibold text-brand flex items-center gap-1.5"
                title="Exportar notas para planilha Excel (.xlsx)"
              >
                <Icone nome="excel" className="w-3.5 h-3.5" />
                Excel
              </Link>
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
                            <Selo tipo="erro" title={n.motivoCancelamento || "Cancelada na SEF"}>
                              CANCELADA
                            </Selo>
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

      {/* ABA 2: EMPRESAS MONITORADAS (Fase 4 & 5) */}
      {aba === "empresas" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-2/40">
            <div>
              <h3 className="text-sm font-bold text-ink">Empresas Monitoradas pelo NotaSync</h3>
              <p className="text-xs text-muted">
                Controle de empresas ativas para busca automática periódica da SEF/SC. Limite do plano: <strong>20 empresas</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalImportarCsvAberta(true)}
                className="btn-primario text-xs font-semibold py-1.5 px-3 flex items-center gap-1.5"
              >
                + Adicionar / Importar CSV
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Razão Social / Nome</th>
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4 text-center">Notas no Mês</th>
                  <th className="py-3 px-4 text-center">Status / SAT</th>
                  <th className="py-3 px-4">Próxima Busca</th>
                  <th className="py-3 px-4 text-center">Ativo</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {empresas.map((emp) => {
                  const totalNotas = notasPorEmpresa.get(emp.cnpj) || 0;
                  const eh8002 = emp.status === "PENDENTE_VINCULO_SAT";
                  const checagem = verificarEsperaBuscaAgora(emp.proximaBusca);
                  const estaConsultando = buscandoCnpj === emp.cnpj;

                  return (
                    <tr key={emp.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-ink">
                        {emp.razaoSocial || emp.nome}
                      </td>

                      <td className="py-3 px-4 font-mono text-muted">
                        {emp.cnpj}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-ink">
                        {totalNotas}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {eh8002 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                            cStat 8002 (Sem Vínculo SAT)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">
                            Sincronizado
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-muted">
                        {checagem.podeConsultar ? (
                          <span className="text-emerald-600 font-medium">Disponível agora</span>
                        ) : (
                          <span className="text-amber-600">
                            Aguardar {Math.ceil(checagem.segundosRestantes / 60)} min
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleAtivoEmpresa(emp.id)}
                          className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                            emp.ativo ? "bg-brand" : "bg-line"
                          }`}
                        >
                          <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                              emp.ativo ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => buscarAgoraEmpresa(emp)}
                          disabled={estaConsultando || !emp.ativo}
                          className="btn-contorno text-xs py-1 px-2.5 font-semibold text-brand disabled:opacity-40"
                          title="Buscar imediatamente na SEF/SC para esta empresa"
                        >
                          {estaConsultando ? "Buscando…" : "Buscar Agora"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: EXECUÇÕES DA BUSCA */}
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
                O NotaSync traduz códigos técnicos em ações práticas para a rotina contábil, evitando bloqueios e identificando pendências no SAT.
              </p>
            </div>
            <a
              href="https://sat.sef.sc.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition-colors whitespace-nowrap"
            >
              Portal SAT/SEF &rarr;
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
                      <span className="font-semibold text-muted uppercase tracking-wider block mb-1">
                        Diagnóstico SEF:
                      </span>
                      <p className="text-ink font-medium">{trad.motivo}</p>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg ${
                        eh8002
                          ? "bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 font-semibold"
                          : "bg-surface-2 text-ink-2"
                      }`}
                    >
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

      {/* ABA 4: COFRE SEGURO & AUDITORIA (Fase 3 & 4) */}
      {aba === "cofre" && (
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Arquitetura Criptográfica do Cofre (Envelope AES-256-GCM)
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              O cofre do NotaSync utiliza criptografia em envelope no padrão militar: cada certificado e senha são cifrados com uma chave aleatória DEK de 256 bits, e a DEK é cifrada pela chave mestra (KEK) com rotação periódica. A decifração ocorre <strong>estritamente na memória volátil</strong> durante a consulta mTLS da SEF/SC.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 rounded-lg bg-surface-2 border border-line">
                <span className="text-xs font-semibold text-muted block mb-1">Algoritmo Criptográfico</span>
                <span className="text-xs font-mono font-bold text-brand block">AES-256-GCM (128-bit tag)</span>
                <span className="text-[11px] text-muted mt-1 block">Com IV de 12 bytes gerado por SecureRandom</span>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-line">
                <span className="text-xs font-semibold text-muted block mb-1">Armazenamento na Nuvem</span>
                <span className="text-xs font-semibold text-ink block">Supabase Storage Privado</span>
                <code className="text-[11px] font-mono text-muted mt-1 block break-all">
                  {`{escritorio}/{cnpj}/{AAAA-MM}/{chave}.xml.gz`}
                </code>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-line">
                <span className="text-xs font-semibold text-muted block mb-1">Versão da Chave Mestra</span>
                <span className="text-xs font-semibold text-emerald-600 block">
                  Versão {certificado?.versaoChaveMestra || 1} (Ativa)
                </span>
                <span className="text-[11px] text-muted mt-1 block">Suporta rotação de KEK sem re-cifrar arquivos</span>
              </div>
            </div>
          </div>

          {/* Histórico de Auditoria */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Histórico Recente de Auditoria</h3>
              <span className="text-[11px] text-muted">Registro imutável conforme LGPD</span>
            </div>

            <div className="divide-y divide-line text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink">UPLOAD DE CERTIFICADO A1</span>
                  <span className="text-muted ml-2 font-mono text-[11px]">2026-11-20 12:00</span>
                  <p className="text-muted text-[11px]">Upload inicial e encriptação com DEK/KEK</p>
                </div>
                <Selo tipo="ok">SUCESSO</Selo>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink">DECIFRAGEM EM MEMÓRIA (CONSULTA SEF/SC)</span>
                  <span className="text-muted ml-2 font-mono text-[11px]">Hoje 11:30</span>
                  <p className="text-muted text-[11px]">Autenticação mTLS de 4 empresas clientes</p>
                </div>
                <Selo tipo="ok">SUCESSO</Selo>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ASSISTENTE PRIMEIROS PASSOS (Fase 5) */}
      <AssistentePrimeirosPassosModal
        aberta={modalAssistenteAberta}
        aoFechar={() => setModalAssistenteAberta(false)}
        onConcluirAssistente={({ certificado: novoCert, empresasNovas }) => {
          setCertificado(novoCert);
          if (empresasNovas && empresasNovas.length > 0) {
            setEmpresas((prev) => {
              const mapa = new Map(prev.map((e) => [e.cnpj, e]));
              for (const nova of empresasNovas) {
                mapa.set(nova.cnpj, {
                  ...nova,
                  id: `emp-${Date.now()}-${Math.random()}`,
                  ultNsu: 0,
                  proximaBusca: null,
                  status: nova.cnpj.includes("666") ? "PENDENTE_VINCULO_SAT" : "SINCRONIZADO",
                });
              }
              return Array.from(mapa.values());
            });
          }
          aviso("Configuração concluída pelo assistente! O NotaSync agora está operacional.");
        }}
        limiteEmpresas={20}
      />

      {/* MODAL 2: UPLOAD/TROCA DE CERTIFICADO */}
      <ModalUploadCertificado
        aberta={modalUploadCertAberta}
        aoFechar={() => setModalUploadCertAberta(false)}
        onSalvarCertificado={(novoCert) => {
          setCertificado(novoCert);
          aviso("Certificado digital A1 atualizado com sucesso no cofre seguro.");
        }}
      />

      {/* MODAL 3: IMPORTAÇÃO CSV / NOVA EMPRESA */}
      <ModalImportarEmpresasCsv
        aberta={modalImportarCsvAberta}
        aoFechar={() => setModalImportarCsvAberta(false)}
        onAdicionarEmpresas={(novas) => {
          setEmpresas((prev) => {
            const mapa = new Map(prev.map((e) => [e.cnpj, e]));
            for (const n of novas) {
              mapa.set(n.cnpj, {
                ...n,
                id: n.id || `emp-${Date.now()}-${Math.random()}`,
                ultNsu: 0,
                proximaBusca: null,
                status: "SINCRONIZADO",
              });
            }
            return Array.from(mapa.values());
          });
        }}
        empresasAtuais={empresas}
        limiteEmpresas={20}
      />
    </div>
  );
}

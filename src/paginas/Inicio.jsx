import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import Icone from "../componentes/Icone.jsx";
import { escritorioAtivo, obterConsumoPlano, podeUsarModulo } from "../lib/multiEscritorio.mjs";

export default function Inicio() {
  const { usuario, pode } = useAuth();
  const [versaoEsc, setVersaoEsc] = useState(0);

  useEffect(() => {
    const f = () => setVersaoEsc((v) => v + 1);
    window.addEventListener("makerpixel:escritorio_mudou", f);
    return () => window.removeEventListener("makerpixel:escritorio_mudou", f);
  }, []);

  const esc = useMemo(() => escritorioAtivo(), [versaoEsc]);
  const consumo = useMemo(() => obterConsumoPlano(esc), [esc]);

  const modulos = [
    {
      id: "notasync",
      titulo: "NotaSync",
      subtitulo: "SEF/SC & DF-e na Nuvem",
      desc: "Captura automática de NFC-e, NF-e e CT-e com certificado digital seguro no cofre.",
      icone: "notasync",
      rota: "/notasync",
      badge: "Fiscal"
    },
    {
      id: "reforma",
      titulo: "Reforma Tributária",
      subtitulo: "Auditor IBS/CBS & RTC",
      desc: "Conferência de alíquotas, cClassTrib, CST e cálculo automático integrado à calculadora oficial.",
      icone: "ibs",
      rota: "/ibs-cbs",
      badge: "Fiscal"
    },
    {
      id: "danfse",
      titulo: "DANFSe",
      subtitulo: "NFS-e Nacional WASM",
      desc: "Emissão e impressão ultrarrápida no padrão nacional de NFS-e direto pelo navegador.",
      icone: "danfse",
      rota: "/danfse",
      badge: "Fiscal"
    },
    {
      id: "xml-excel",
      titulo: "XML → Excel",
      subtitulo: "Conversão e Exportação",
      desc: "Transforme pacotes de XML em planilhas estruturadas e detalhadas por item de produto e imposto.",
      icone: "excel",
      rota: "/xml-excel",
      badge: "Produtividade"
    },
    {
      id: "em-dia",
      titulo: "Em Dia",
      subtitulo: "Gestão Diária de Obrigações",
      desc: "O que cada empresa precisa no mês, quem está cuidando e o status em tempo real com tarefas automáticas.",
      icone: "emdia",
      rota: "/em-dia",
      badge: "Operacional"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Cabeçalho de Boas-vindas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Olá, {usuario ? usuario.nome.split(" ")[0] : "Contador"}! 👋
          </h1>
          <p className="text-muted text-sm mt-1">
            Painel de controle de <strong>{esc ? (esc.nomeFantasia || esc.razaoSocial) : "Central Contábil"}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin-makerpixel"
            className="btn-contorno text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <span>🏢 Gerenciar Escritório</span>
          </Link>
        </div>
      </div>

      {/* Cartões de Consumo do Plano */}
      {consumo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="cartao p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-semibold">
              <span>USUÁRIOS ATIVOS</span>
              <span>👥</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">{consumo.usuarios.total}</span>
              <span className="text-xs text-muted">/ {consumo.usuarios.limite} contratados</span>
            </div>
            <div className="mt-3 w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-brand h-full rounded-full transition-all"
                style={{ width: `${Math.min(consumo.usuarios.percentual, 100)}%` }}
              />
            </div>
          </div>

          <div className="cartao p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-semibold">
              <span>EMPRESAS ATENDIDAS</span>
              <span>🏢</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">{consumo.empresas.total}</span>
              <span className="text-xs text-muted">/ {consumo.empresas.limite} do plano</span>
            </div>
            <div className="mt-3 w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-credit h-full rounded-full transition-all"
                style={{ width: `${Math.min(consumo.empresas.percentual, 100)}%` }}
              />
            </div>
          </div>

          <div className="cartao p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-semibold">
              <span>ARMAZENAMENTO SEGURO</span>
              <span>💾</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-ink">{consumo.armazenamento.usadoGb} GB</span>
              <span className="text-xs text-muted">/ {consumo.armazenamento.limiteGb} GB</span>
            </div>
            <div className="mt-3 w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-info h-full rounded-full transition-all"
                style={{ width: `${Math.min(consumo.armazenamento.percentual, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grade de Ferramentas / Módulos Ativos */}
      <div>
        <h2 className="text-lg font-bold text-ink mb-4">Ferramentas Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modulos.map((m) => {
            const liberado = pode(m.id) && podeUsarModulo(esc, m.id);
            return (
              <Link
                key={m.id}
                to={m.rota}
                className={`cartao p-5 flex flex-col justify-between group transition-all duration-200 hover:shadow-md hover:border-brand/40 ${
                  !liberado ? "opacity-75" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icone nome={m.icone} className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-line">
                      {m.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-ink group-hover:text-brand transition-colors">
                    {m.titulo}
                  </h3>
                  <p className="text-xs font-medium text-brand mb-2">{m.subtitulo}</p>
                  <p className="text-xs text-muted leading-relaxed">{m.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-brand">
                  <span>Acessar ferramenta</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

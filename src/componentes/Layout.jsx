import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth.jsx";
import { gravarLocal, lerJson, lerLocal, useTema } from "../lib/tema.js";
import { montarMenu } from "../lib/menu.js";
import Icone from "./Icone.jsx";
import Suporte from "./Suporte.jsx";
import TrocarSenha from "./TrocarSenha.jsx";
import { instalarApp, usePwa } from "../lib/pwa.js";
import {
  escritorioAtivo,
  statusAcesso,
  statusTeste,
  isSuporteAtivo,
  revogarSuporte,
  linkContratarWhatsApp
} from "../lib/multiEscritorio.mjs";
import { CONFIG } from "../lib/config.js";

const VERSAO = "4.0.0";
const FECHADAS_PADRAO = {};

function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/);
  return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function Item({ item, recolhido, contador, aoNavegar, extra }) {
  return (
    <NavLink to={item.para} end={item.para === "/"} title={item.title || item.label} onClick={aoNavegar}
      className={({ isActive }) => "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] transition-colors " +
        (recolhido ? "justify-center " : "") +
        (isActive ? "bg-brand-soft text-brand font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-brand-fill" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
      <Icone nome={item.icone} className={recolhido ? "w-5 h-5" : ""} />
      {!recolhido && <span className="flex-1 truncate">{item.label}</span>}
      {!recolhido && contador ? <span className="rounded-full bg-debit-soft text-debit text-[11px] font-bold px-1.5 min-w-[20px] text-center">{contador}</span> : null}
      {!recolhido && extra}
    </NavLink>
  );
}

function Secao({ titulo, aberta, alternar, children, recolhido, pequena }) {
  return (
    <div className={pequena ? "mt-1.5" : "mt-3.5 first:mt-1"}>
      {!recolhido && (
        <button type="button" onClick={alternar} aria-expanded={aberta}
          className={"w-full flex items-center justify-between px-2.5 py-1.5 font-semibold uppercase tracking-wider text-muted hover:text-ink " + (pequena ? "text-[11px]" : "text-[12px]")}>
          <span>{titulo}</span><Icone nome="seta" className={"w-4 h-4 transition-transform " + (aberta ? "" : "-rotate-90")} />
        </button>
      )}
      {(aberta || recolhido) && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

export default function Layout() {
  const { usuario, sair, pode } = useAuth();
  const [tema, alternarTema] = useTema();
  const local = useLocation();
  const navegar = useNavigate();
  const ehAdmin = usuario && (usuario.perfil === "admin" || usuario.perfil === "ADMIN_PRODUTO");
  const [versaoEscritorio, setVersaoEscritorio] = useState(0);
  const secoes = useMemo(() => montarMenu(pode, ehAdmin), [pode, ehAdmin, local.pathname, versaoEscritorio]);
  const [fechadas, setFechadas] = useState(() => lerJson("menu:fechadas", FECHADAS_PADRAO));
  const [recolhido, setRecolhido] = useState(() => lerLocal("menu:recolhido") === "1");
  const [gaveta, setGaveta] = useState(false);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const { auth } = useAuth();
  const { instalar } = usePwa();

  const escritorio = useMemo(() => escritorioAtivo(), [versaoEscritorio]);
  const stAcesso = useMemo(() => statusAcesso(escritorio), [escritorio]);
  const stTeste = useMemo(() => statusTeste(escritorio), [escritorio]);
  const [suporteAtivo, setSuporteAtivo] = useState(() => isSuporteAtivo());

  useEffect(() => {
    const fEsc = () => setVersaoEscritorio((v) => v + 1);
    const fSup = () => setSuporteAtivo(isSuporteAtivo());
    window.addEventListener("makerpixel:escritorio_mudou", fEsc);
    window.addEventListener("makerpixel:suporte_mudou", fSup);
    return () => {
      window.removeEventListener("makerpixel:escritorio_mudou", fEsc);
      window.removeEventListener("makerpixel:suporte_mudou", fSup);
    };
  }, []);

  useEffect(() => {
    const f = () => {
      if (document.visibilityState !== "visible" || !auth) return;
      auth.usuarioAtual().then((u) => { if (!u || u.trocarSenha) sair().then(() => navegar("/login", { replace: true, state: { expirou: true } })); });
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [auth]);

  const alternarSecao = (t) => setFechadas((f) => { const n = Object.assign({}, f); if (n[t]) delete n[t]; else n[t] = 1; gravarLocal("menu:fechadas", JSON.stringify(n)); return n; });
  useEffect(() => { gravarLocal("menu:recolhido", recolhido ? "1" : "0"); }, [recolhido]);
  useEffect(() => { setGaveta(false); }, [local.pathname]);

  const titulo = useMemo(() => {
    for (const s of secoes) for (const i of s.itens) {
      if (local.pathname === i.para) return { sub: s.titulo, titulo: i.label };
    }
    return local.pathname === "/" ? { sub: "Visão geral", titulo: "Início" } : { sub: "", titulo: "" };
  }, [secoes, local.pathname]);
  useEffect(() => { document.title = (titulo.titulo ? titulo.titulo + " – " : "") + "Central Contábil"; }, [titulo]);

  const ehTeste = usuario && (usuario.teste || usuario.email === "teste@modo-teste.local");

  const menu = (
    <nav aria-label="Menu principal" className="flex flex-col h-full">
      <div className={"flex items-center gap-2.5 px-3.5 pt-4 pb-3 " + (recolhido ? "flex-col" : "")}>
        <img src="./icons/central-contabil-simbolo.svg" alt="Central Contábil" className="w-8 h-8 shrink-0" />
        {!recolhido && <div className="flex-1 leading-tight min-w-0"><strong className="block text-[15px] tracking-tight truncate text-brand font-bold">Central</strong><span className="text-[12px] font-semibold text-ink-2">Contábil</span></div>}
        <button type="button" onClick={() => setRecolhido(!recolhido)} aria-label={recolhido ? "Abrir o menu" : "Recolher o menu"} title={recolhido ? "Abrir o menu" : "Recolher o menu"}
          className={"hidden lg:inline-flex btn-fantasma h-8 w-8 p-0 border border-line " + (recolhido ? "-scale-x-100" : "")}><Icone nome="recolher" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <Item item={{ para: "/", label: "Início", icone: "inicio" }} recolhido={recolhido} />
        {secoes.map((s) => (
          <Secao key={s.titulo} titulo={s.titulo} aberta={!fechadas[s.titulo]} alternar={() => alternarSecao(s.titulo)} recolhido={recolhido}>
            {s.itens.map((i) => (
              <div key={i.id}>
                <Item item={i} recolhido={recolhido} contador={i.contador || 0} />
              </div>
            ))}
          </Secao>
        ))}
      </div>
      <div className={"border-t border-line p-3 flex items-center gap-2.5 " + (recolhido ? "flex-col" : "")}>
        <span className="h-9 w-9 shrink-0 rounded-full bg-brand-soft text-brand font-bold text-[13px] inline-flex items-center justify-center" aria-hidden="true">{iniciais(usuario && usuario.nome)}</span>
        {!recolhido && <span className="flex-1 min-w-0 leading-tight"><strong className="block truncate text-[14px]">{usuario && usuario.nome}</strong><span className="block truncate text-[12px] text-muted">{usuario && usuario.email}</span></span>}
        {instalar && <button type="button" onClick={instalarApp} aria-label="Instalar como aplicativo" title="Instalar como aplicativo (ícone na área de trabalho, abre sem internet)" className="btn-fantasma h-8 w-8 p-0 text-brand"><Icone nome="instalar" /></button>}
        {!(usuario && usuario.teste) && <button type="button" onClick={() => setTrocarSenha(true)} aria-label="Trocar a minha senha" title="Trocar a minha senha" className="btn-fantasma h-8 w-8 p-0"><Icone nome="cadeado" /></button>}
        <button type="button" onClick={() => sair().then(() => navegar("/login", { replace: true }))} aria-label="Sair do sistema" title="Sair" className="btn-fantasma h-8 w-8 p-0"><Icone nome="sair" /></button>
      </div>
    </nav>
  );

  return (
    <div className={"min-h-full lg:grid " + (recolhido ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[256px_minmax(0,1fr)]")}>
      <aside className="menu-lateral text-ink hidden lg:block sticky top-0 h-screen bg-surface border-r border-line">{menu}</aside>
      {gaveta && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setGaveta(false)} />
          <aside className="menu-lateral text-ink absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-surface shadow-pop">{menu}</aside>
        </div>
      )}
      <main className="min-w-0 flex flex-col min-h-screen">
        {/* Faixa de Demonstração */}
        {CONFIG.modoDemo && (
          <div className="bg-amber-600 text-white px-4 sm:px-8 py-1.5 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 truncate">
              <span>⚙️</span>
              <span className="truncate">Demonstração: dados fictícios em memória (GitHub Pages).</span>
            </div>
            <span className="text-[11px] uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded font-mono font-bold shrink-0">
              Modo Demo
            </span>
          </div>
        )}

        {/* Faixa de Teste Gratuito */}
        {stAcesso.emTeste && !stAcesso.vencido && (
          <div className="bg-gradient-to-r from-brand-fill/90 to-brand text-black px-4 sm:px-8 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 truncate">
              <span className="text-base">⚡</span>
              <span className="truncate">
                {stAcesso.venceHoje ? "Seu teste gratuito termina hoje!" : `Período de teste gratuito: faltam ${stAcesso.diasRestantes} dia(s) (expira em ${stAcesso.acessoAteFmt}).`}
              </span>
            </div>
            <a href={linkContratarWhatsApp(escritorio)} target="_blank" rel="noreferrer" className="bg-black text-white hover:bg-neutral-800 px-3 py-1 rounded text-xs font-bold shrink-0 transition-colors">
              Ativar Plano Definitivo
            </a>
          </div>
        )}

        {/* Faixa de Teste Expirado */}
        {stAcesso.vencido && (
          <div className="bg-debit text-white px-4 sm:px-8 py-2 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
            <span>⚠️ O período de teste deste escritório terminou em {stAcesso.acessoAteFmt}.</span>
            <a href={linkContratarWhatsApp(escritorio)} target="_blank" rel="noreferrer" className="bg-white text-debit px-2.5 py-0.5 rounded text-xs font-bold">Contratar Plano</a>
          </div>
        )}

        {/* Faixa de Suporte MakerPixel Ativo */}
        {suporteAtivo && (
          <div className="bg-purple-950 text-purple-200 border-b border-purple-800 px-4 sm:px-8 py-1.5 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span>Modo Suporte Técnico MakerPixel ativo neste navegador (acesso autorizado pelo cliente).</span>
            </div>
            <button
              onClick={() => {
                revogarSuporte();
                setSuporteAtivo(false);
              }}
              className="text-xs text-white bg-purple-800 hover:bg-purple-700 px-2 py-0.5 rounded border border-purple-600 font-bold"
            >
              Encerrar Suporte
            </button>
          </div>
        )}

        {/* Faixa de Suspensão */}
        {stAcesso.suspenso && (
          <div className="bg-debit text-white px-4 sm:px-8 py-2 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
            <span>⚠️ Acesso do escritório suspenso. Fale com a equipe MakerPixel para regularizar.</span>
            <a href={linkContratarWhatsApp(escritorio)} target="_blank" rel="noreferrer" className="bg-white text-debit px-2.5 py-0.5 rounded text-xs font-bold">Falar no WhatsApp</a>
          </div>
        )}

        <header className="flex items-center gap-3 flex-wrap px-4 sm:px-8 py-4 border-b border-line bg-canvas">
          <button type="button" className="lg:hidden btn-contorno h-10 w-10 p-0" aria-label="Abrir o menu" onClick={() => setGaveta(true)}><Icone nome="menu" /></button>
          <div className="flex-1 min-w-0">
            {titulo.sub && <div className="text-[13px] text-muted truncate">{titulo.sub}</div>}
            <h1 className="text-[21px] sm:text-[22px] font-semibold tracking-tight truncate">{titulo.titulo}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/admin-makerpixel"
              title="Clique para alternar o escritório ou gerenciar planos e testes"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft/40 px-3 py-1 text-xs font-semibold text-brand hover:border-brand-fill transition-colors"
            >
              <span>🏢</span>
              <span className="max-w-[150px] truncate">{escritorio ? (escritorio.nomeFantasia || escritorio.razaoSocial) : "Central Contábil"}</span>
              <span className="text-[10px] opacity-75">▾</span>
            </Link>
            {ehTeste && <span className="rounded-full bg-brand-soft text-brand text-[12px] font-bold uppercase tracking-wide px-2.5 py-1" title="Você entrou sem senha, no modo de teste.">Modo de teste</span>}
            <button type="button" onClick={alternarTema} className="btn-contorno h-10 w-10 p-0 rounded-full" aria-label={tema === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={tema === "dark" ? "Tema claro" : "Tema escuro"}>
              <Icone nome={tema === "dark" ? "sol" : "lua"} /></button>
          </div>
        </header>
        <div className="flex-1 min-w-0 px-4 sm:px-8 py-6 pb-24"><Outlet context={{ titulo }} /></div>
      </main>
      <Suporte />
      <TrocarSenha aberta={trocarSenha} aoFechar={() => setTrocarSenha(false)} />
    </div>
  );
}

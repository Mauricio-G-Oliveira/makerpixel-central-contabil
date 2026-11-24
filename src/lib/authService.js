/*
 * authService.js — gerenciamento de autenticação, perfis e permissões.
 * Exclusivamente para os módulos de produção da Central Contábil v4.
 */
import { CONFIG } from "./config.js";

export const ADMIN_EMAIL = "mauriciogoulart.deoliveira37@gmail.com";
export const CHAVE_SESSAO = "gf.sessao";
export const CHAVE_TOKEN = "mp_auth_token";

export const AREAS = [
  { id: "notasync", nome: "Notas Fiscais (NotaSync)", detalhe: "Buscador de DF-e e SEF/SC para contadores" },
  { id: "reforma", nome: "Reforma Tributária (IBS/CBS)", detalhe: "Auditor IBS/CBS e Calculadora RTC" },
  { id: "danfse", nome: "DANFSe", detalhe: "Gerador e visualizador de NFS-e WASM" },
  { id: "xml-excel", nome: "XML → Excel", detalhe: "Conversão e exportação de planilhas de DF-e" },
  { id: "em-dia", nome: "Em Dia", detalhe: "Gestão diária de tarefas e obrigações do escritório" }
];

export const IDS_AREAS = AREAS.map((a) => a.id);

export function problemaSenha(s) {
  s = String(s || "");
  if (s.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-zÀ-ú]/.test(s) || !/\d/.test(s)) return "A senha precisa ter letras e números.";
  return "";
}

export function senhaProvisoria() {
  const L = "abcdefghjkmnpqrstuvwxyz", N = "23456789";
  const r = (n) => {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] % n;
  };
  let s = L[r(L.length)].toUpperCase();
  for (let i = 0; i < 3; i++) s += L[r(L.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += N[r(N.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += L[r(L.length)];
  return s;
}

export function podeAcessar(usuario, area) {
  if (!usuario) return false;
  if (!area || area === "inicio") return true;
  const p = usuario.perfil || "";
  if (p === "admin" || p === "ADMIN_PRODUTO" || p === "ADMIN_ESCRITORIO") return true;
  if (Array.isArray(usuario.areas) && usuario.areas.includes(area)) return true;
  if (Array.isArray(usuario.modulosLiberados) && usuario.modulosLiberados.includes(area)) return true;
  return false;
}

export function obterToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN) || "";
  } catch {
    return "";
  }
}

export function gravarToken(token) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {}
}

export function obterSessao() {
  try {
    const s = localStorage.getItem(CHAVE_SESSAO);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function gravarSessao(dados) {
  try {
    if (dados) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
    else localStorage.removeItem(CHAVE_SESSAO);
  } catch {}
}

export function limparSessao() {
  gravarSessao(null);
  gravarToken(null);
}

export const AuthCore = {
  ADMIN_EMAIL,
  AREAS,
  IDS_AREAS,
  problemaSenha,
  senhaProvisoria,
  podeAcessar,
  obterToken,
  gravarToken,
  obterSessao,
  gravarSessao,
  limparSessao
};

export default AuthCore;

/*
 * suporte.js — utilitários para canal de atendimento e suporte.
 */
import { CONFIG } from "./config.js";

export const TIPOS = [
  { id: "duvida", nome: "Dúvida" },
  { id: "problema", nome: "Problema" },
  { id: "sugestao", nome: "Sugestão" }
];

export function numeroLegivel(numero) {
  const limpo = String(numero || "").replace(/\D/g, "");
  if (limpo.length >= 13) {
    return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
  }
  if (limpo.length >= 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  return numero || "";
}

export function mensagem({ tipo = "duvida", texto = "", atendente = "", usuario = "", tela = "" } = {}) {
  const tipoObj = TIPOS.find(t => t.id === tipo) || TIPOS[0];
  let msg = `Olá${atendente ? ` ${atendente}` : ""}, tenho uma ${tipoObj.nome.toLowerCase()} no Central Contábil.`;
  if (texto) msg += `\n\n${texto}`;
  if (tela) msg += `\n\nTela: ${tela}`;
  if (usuario) msg += `\nUsuário: ${usuario}`;
  return msg;
}

export function linkWhatsApp(numero, msg = "") {
  const num = String(numero || CONFIG.suporte?.whatsapp || "").replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export const Suporte = {
  TIPOS,
  numeroLegivel,
  mensagem,
  linkWhatsApp,
  contato: CONFIG.suporte
};

export default Suporte;

/*
 * menu.js — montagem da navegação lateral da Central Contábil v4.
 * Exclusivamente os 5 módulos de produção: NotaSync, Reforma (IBS/CBS), DANFSe, XML → Excel e Em Dia.
 */
import { escritorioAtivo, podeUsarModulo } from "./multiEscritorio.mjs";

export const ROTA_REACT = {
  notasync: "/notasync",
  reforma: "/ibs-cbs",
  danfse: "/danfse",
  "xml-excel": "/xml-excel",
  "em-dia": "/em-dia"
};

export function montarMenu(pode = () => true, ehAdmin = false) {
  const esc = escritorioAtivo();
  const moduloLiberado = (mod) => podeUsarModulo(esc, mod);

  const fiscal = [];
  if (pode("notasync") && moduloLiberado("notasync")) {
    fiscal.push({ id: "notasync", label: "NotaSync (SEF/SC & DF-e)", para: "/notasync", icone: "notasync" });
  }
  if (pode("reforma") && moduloLiberado("reforma")) {
    fiscal.push({ id: "reforma", label: "Reforma Tributária (IBS/CBS)", para: "/ibs-cbs", icone: "ibs" });
  }
  if (pode("danfse") && moduloLiberado("danfse")) {
    fiscal.push({ id: "danfse", label: "DANFSe (NFS-e WASM)", para: "/danfse", icone: "danfse" });
  }

  const produtividade = [];
  if (pode("xml-excel") && moduloLiberado("xml-excel")) {
    produtividade.push({ id: "xml-excel", label: "XML → Excel", para: "/xml-excel", icone: "excel" });
  }

  const operacional = [];
  if (pode("em-dia") && moduloLiberado("em-dia")) {
    operacional.push({ id: "em-dia", label: "Em Dia (Obrigações)", para: "/em-dia", icone: "emdia" });
  }

  const secoes = [];
  if (fiscal.length) secoes.push({ titulo: "Fiscal", itens: fiscal });
  if (produtividade.length) secoes.push({ titulo: "Produtividade", itens: produtividade });
  if (operacional.length) secoes.push({ titulo: "Operacional", itens: operacional });

  if (ehAdmin) {
    secoes.push({
      titulo: "Administração",
      itens: [
        { id: "usuarios", label: "Usuários", para: "/usuarios", icone: "usuarios" },
        { id: "admin-makerpixel", label: "Painel MakerPixel (SaaS)", para: "/admin-makerpixel", icone: "empresa" }
      ]
    });
  }

  return secoes;
}

export default montarMenu;

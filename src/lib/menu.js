/*
 * O que aparece no menu (igual à versão anterior): setores, módulos e, dentro da Integração contábil,
 * as contas bancárias, unidades, outras movimentações e cadastros da planilha do mês.
 */
import { Modulos } from "./legado.js";
import { contabil as dados } from "./useContabil.js";
import { nomeDaFonte } from "./contabil.mjs";
import { depCadastro } from "./useDepCadastro.js";
import { escritorioAtivo, podeUsarModulo } from "./multiEscritorio.mjs";

export { MOVIMENTOS, CADASTROS } from "./contabil.mjs";
import { MOVIMENTOS, CADASTROS } from "./contabil.mjs";
/** Módulos que já viraram tela em React: o menu vai direto para a rota nova. */
export const ROTA_REACT = { "mod-iss": "/iss", "mod-icms": "/icms", "mod-horas": "/horas", "mod-ibs-cbs": "/ibs-cbs", "mod-em-dia": "/em-dia", "mod-vencimentos": "/departamento-cadastro/certidoes", "mod-notasync": "/notasync", "mod-danfse": "/danfse", "mod-xml-excel": "/xml-excel" };
const ICONE_MODULO = { "mod-icms": "icms", "mod-ibs-cbs": "ibs", "mod-iss": "iss", "mod-vencimentos": "venc", "mod-em-dia": "emdia", "mod-horas": "horas", "mod-notasync": "notasync", "mod-danfse": "danfse", "mod-xml-excel": "excel" };

export const nomeDaConta = nomeDaFonte;

/** Seções do menu para a pessoa logada e escritório ativo. */
export function montarMenu(pode, ehAdmin) {
  const esc = escritorioAtivo();
  const moduloLiberado = (mod) => podeUsarModulo(esc, mod);

  const modulos = (secao) => Modulos.LISTA.filter((m) => m.secao === secao && pode(m.id) && moduloLiberado(m.id))
    .map((m) => ({ id: m.id, label: m.label, para: ROTA_REACT[m.id] || "/modulo/" + m.id, icone: ICONE_MODULO[m.id] || "cadastro", descricao: m.descricao }));

  const integracao = pode("integracao") && moduloLiberado("integracao");
  const contabil = [];
  if (integracao) {
    const bancos = dados.bancos();
    const unidades = dados.unidades();
    contabil.push({
      id: "master", label: "Integração contábil", para: "/integracao", icone: "master",
      partes: [
        { titulo: "Bancos", itens: bancos.map((b) => ({ id: b.id, label: b.label, grupo: b.bank || "", para: "/conta/" + b.id, icone: "banco", title: nomeDaFonte(b) })), vazio: "Nenhuma conta cadastrada" },
        { titulo: "Unidades", itens: unidades.map((u) => ({ id: u.id, label: u.label, para: "/conta/" + u.id, icone: "unidade" })), vazio: "Criadas ao distribuir por unidade" },
        { titulo: "Outras movimentações", itens: MOVIMENTOS.map((m) => ({ id: m.id, label: m.label, para: "/conta/" + m.id, icone: "mov" })) },
        { titulo: "Cadastros", itens: CADASTROS.map((c) => ({ id: c.id, label: c.label, para: "/cadastro/" + c.id, icone: "cadastro" })) }
      ]
    });
  }
  if (pode("conciliacao") && moduloLiberado("conciliacao")) {
    contabil.push({ id: "conciliacao", label: "Conciliação", para: "/conciliacao", icone: "conciliacao" });
  }
  if (pode("contabil-lucros") && moduloLiberado("lucros")) {
    contabil.push(
      { id: "fechamento", label: "Fechamento contábil", para: "/fechamento", icone: "fechamento" },
      { id: "encerramento", label: "Encerramento do exercício", para: "/encerramento", icone: "encerramento" },
      { id: "lucros", label: "Distribuição de lucros", para: "/lucros", icone: "lucros" },
      { id: "reinf", label: "REINF", para: "/reinf", icone: "reinf" },
      { id: "contabil-faturamentos", label: "Faturamentos", para: "/contabil/faturamentos", icone: "faturamento" },
      { id: "contabil-demonstrativos", label: "Demonstrativos contábeis", para: "/contabil/demonstrativos", icone: "demonstrativo" }
    );
  }
  const certUrgentes = (svc) => svc.certificados().lista.filter((d) => d.situacao.status === "vencido" || d.situacao.status === "7").length;

  // Itens de Departamento Cadastro: Empresas fica sempre visível se tiver permissão de ver empresas
  const temVencimentos = pode("mod-vencimentos") && moduloLiberado("vencimentos");
  const itensCadastro = [];
  if (pode("mod-vencimentos")) {
    itensCadastro.push({ id: "dep-empresas", label: "Empresas", para: "/empresas", icone: "empresa" });
  }
  if (temVencimentos) {
    itensCadastro.push(
      { id: "dep-certidoes", label: "Certidões", para: "/departamento-cadastro/certidoes", icone: "certidao", contador: depCadastro.urgentes("certidoes") },
      { id: "dep-certificados", label: "Certificados digitais", para: "/departamento-cadastro/certificados", icone: "cadeado", contador: certUrgentes(depCadastro) },
      { id: "dep-alvaras", label: "Alvarás", para: "/departamento-cadastro/alvaras", icone: "alvara", contador: depCadastro.urgentes("alvaras") },
      { id: "dep-importar", label: "Importar e demonstração", para: "/departamento-cadastro/importar", icone: "importar" }
    );
  }

  const itensEscritorio = modulos("Escritório").concat(
    pode("mod-em-dia") && moduloLiberado("em-dia") ? [{ id: "em-dia", label: "Em Dia", para: "/em-dia", icone: "emdia" }] : []
  );

  const secoes = [
    { titulo: "Contábil", itens: contabil },
    { titulo: "Fiscal", itens: modulos("Fiscal") },
    { titulo: "Departamento Pessoal", itens: modulos("Departamento Pessoal") },
    { titulo: "Departamento Cadastro", itens: itensCadastro },
    { titulo: "Escritório", itens: itensEscritorio }
  ];

  if (ehAdmin) {
    secoes.push({
      titulo: "Administração",
      itens: [
        { id: "usuarios", label: "Usuários", para: "/usuarios", icone: "usuarios" },
        { id: "admin-makerpixel", label: "Painel MakerPixel (SaaS)", para: "/admin-makerpixel", icone: "empresa" }
      ]
    });
  }
  return secoes.filter((s) => s.itens.length);
}

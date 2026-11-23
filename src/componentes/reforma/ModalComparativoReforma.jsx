import { useState } from "react";
import Janela from "../Janela.jsx";
import { brl, pct, CLASSIFICACOES_REFORMA } from "../../lib/ibsCbs.mjs";
import { Selo } from "../contabil/ui.jsx";

export default function ModalComparativoReforma({ aberta, aoFechar, item }) {
  const [copiado, setCopiado] = useState(false);

  if (!item) return null;

  const infoClas = CLASSIFICACOES_REFORMA[item.classificacao] || {
    id: item.classificacao,
    label: item.classificacao,
    selo: "pendente"
  };

  const copiarParecer = () => {
    const texto = [
      `*AUDITORIA FISCAL IBS/CBS — LC 214/2025*`,
      `Documento: ${item.doc || "NF-e/NFC-e"} ${item.nfNumber ? "nº " + item.nfNumber : ""}`,
      item.empresaNome ? `Empresa: ${item.empresaNome}` : "",
      item.chaveNfe ? `Chave: ${item.chaveNfe}` : "",
      `Item ${item.nItem}: ${item.desc} (Cód. ${item.cProd || "—"} / NCM ${item.ncm || "—"})`,
      `Diagnóstico: ${infoClas.label}`,
      `Motivo: ${item.motivoDivergencia || "—"}`,
      `---`,
      `DESTACADO NA NOTA:`,
      `• CST: ${item.cstInformado || "—"} | cClassTrib: ${item.cClassTribInformado || "—"}`,
      `• Base de Cálculo: R$ ${brl(item.bc)}`,
      `• CBS: R$ ${brl(item.cbsDestacada)} | IBS: R$ ${brl(item.ibsDestacadoTotal)} | Total: R$ ${brl(item.totDestacado)}`,
      `---`,
      `CÁLCULO OFICIAL DA REFORMA (RTC):`,
      `• CST Esperado: ${item.cstOficial || "—"} | cClassTrib Esperado: ${item.cClassTribOficial || "—"}`,
      `• Redução Legal: ${pct(item.reducaoOficial)}`,
      `• CBS Oficial: R$ ${brl(item.cbsCalculada)} | IBS Oficial: R$ ${brl(item.ibsUfCalculado + item.ibsMunCalculado)} | Total Oficial: R$ ${brl(item.totOficial)}`,
      `• Diferença Apurada: R$ ${brl(item.difTotal)}`,
      `---`,
      `AÇÃO CORRETIVA RECOMENDADA NO ERP:`,
      `${item.acaoRecomendada || "—"}`,
      `---`,
      `Fundamentação Legal: ${item.fundamentacaoLegal || "LC 214/2025"}`
    ].filter(Boolean).join("\n");

    try {
      navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {}
  };

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Conferência Lado a Lado: Destacado × Oficial"
      largura="max-w-[820px]"
      rodape={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            className="btn-contorno btn-sm text-[13px]"
            onClick={copiarParecer}
          >
            {copiado ? "✓ Parecer Técnico Copiado!" : "Copiar Parecer Técnico p/ Cliente"}
          </button>
          <button type="button" className="btn-primario btn-sm text-[13px]" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cabeçalho do Item */}
        <div className="rounded-lg bg-surface-2 p-3.5 border border-line space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] font-semibold text-ink">
              Item {item.nItem} · {item.desc}
            </span>
            <Selo tipo={infoClas.selo}>{infoClas.label}</Selo>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
            {item.cProd && <span>Código: <strong className="text-ink">{item.cProd}</strong></span>}
            {item.ncm && <span>NCM: <strong className="text-ink">{item.ncm}</strong></span>}
            {item.cfop && <span>CFOP: <strong className="text-ink">{item.cfop}</strong></span>}
            {item.doc && <span>Documento: <strong className="text-ink">{item.doc}</strong></span>}
            {item.empresaNome && <span>Empresa: <strong className="text-ink">{item.empresaNome}</strong></span>}
          </div>
          {item.chaveNfe && (
            <div className="text-[11.5px] text-muted font-mono truncate pt-0.5">
              Chave: {item.chaveNfe}
            </div>
          )}
        </div>

        {/* Comparativo em Duas Colunas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Coluna 1: Destacado no XML */}
          <div className="rounded-lg border border-line p-3.5 space-y-3 bg-surface">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <strong className="text-[13.5px] text-ink">Destacado na Nota Fiscal (XML)</strong>
              <span className="text-[11.5px] rounded bg-surface-2 px-2 py-0.5 text-muted">Original</span>
            </div>

            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-muted">CST Destacado</span>
                <span className="font-semibold tabular-nums">{item.cstInformado || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-muted">cClassTrib Destacado</span>
                <span className="font-semibold tabular-nums">{item.cClassTribInformado || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-muted">Base de Cálculo</span>
                <span className="font-semibold tabular-nums">R$ {brl(item.bc)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-muted">CBS Destacada</span>
                <span className="font-semibold tabular-nums text-ink">R$ {brl(item.cbsDestacada)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-muted">IBS-UF Destacado</span>
                <span className="font-semibold tabular-nums text-ink">R$ {brl(item.ibsUfDestacado)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-muted">IBS-Mun Destacado</span>
                <span className="font-semibold tabular-nums text-ink">R$ {brl(item.ibsMunDestacado)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-semibold text-[13.5px] bg-surface-2/60 px-2 rounded">
                <span>Total Destacado (IBS + CBS)</span>
                <span className="tabular-nums">R$ {brl(item.totDestacado)}</span>
              </div>
            </div>
          </div>

          {/* Coluna 2: Cálculo Oficial RTC */}
          <div className="rounded-lg border border-brand/40 bg-brand-soft/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-brand/30 pb-2">
              <strong className="text-[13.5px] text-brand">Cálculo Oficial (Motor RTC / LC 214)</strong>
              <span className="text-[11.5px] rounded bg-brand-soft px-2 py-0.5 text-brand font-medium">Oficial</span>
            </div>

            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between py-1 border-b border-brand/20">
                <span className="text-muted">CST Esperado</span>
                <span className="font-semibold tabular-nums">{item.cstOficial || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-brand/20">
                <span className="text-muted">cClassTrib Esperado</span>
                <span className="font-semibold tabular-nums">{item.cClassTribOficial || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-brand/20">
                <span className="text-muted">Redução Legal</span>
                <span className="font-semibold tabular-nums">{pct(item.reducaoOficial)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-brand/20">
                <span className="text-muted">CBS Oficial (0,90% nom.)</span>
                <span className="font-semibold tabular-nums text-brand">R$ {brl(item.cbsCalculada)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-brand/20">
                <span className="text-muted">IBS-UF Oficial (0,10% nom.)</span>
                <span className="font-semibold tabular-nums text-brand">R$ {brl(item.ibsUfCalculado)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-brand/20">
                <span className="text-muted">IBS-Mun Oficial (0,00% 2026)</span>
                <span className="font-semibold tabular-nums text-brand">R$ {brl(item.ibsMunCalculado)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-semibold text-[13.5px] bg-brand-soft px-2 rounded text-brand">
                <span>Total Oficial (IBS + CBS)</span>
                <span className="tabular-nums">R$ {brl(item.totOficial)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Parecer, Motivo e Ação Recomendada */}
        <div className="rounded-lg border border-line bg-surface p-3.5 space-y-2.5 text-[12.5px]">
          <div className="flex items-center justify-between">
            <strong className="text-[13px] text-ink">Diagnóstico da Divergência</strong>
            <span className={"font-semibold tabular-nums " + (item.difTotal > 0.01 ? "text-warn" : "text-credit")}>
              Diferença Total: R$ {brl(item.difTotal)}
            </span>
          </div>
          <p className="text-ink leading-relaxed">
            {item.motivoDivergencia}
          </p>

          <div className="border-t border-line pt-2 space-y-1">
            <strong className="block text-[12.5px] text-brand">Ação Corretiva Recomendada para o ERP do Cliente:</strong>
            <p className="text-ink-2 leading-relaxed bg-surface-2 p-2.5 rounded border border-line/60">
              {item.acaoRecomendada}
            </p>
          </div>

          <div className="border-t border-line pt-2 space-y-1">
            <strong className="block text-[12px] text-muted">Memória de Cálculo:</strong>
            <p className="text-[12px] font-mono text-ink-2 bg-surface-2/40 p-2 rounded">
              {item.memoriaCalculo}
            </p>
          </div>

          {item.fundamentacaoLegal && (
            <div className="text-[11.5px] text-muted pt-1">
              <strong>Fundamentação Legal:</strong> {item.fundamentacaoLegal}
            </div>
          )}
        </div>
      </div>
    </Janela>
  );
}

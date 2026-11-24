import { useRef } from "react";
import Icone from "./Icone.jsx";

export const formatarValor = (v) =>
  Number(Math.abs(v || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dataBR = (iso) => {
  if (!iso) return "";
  const partes = String(iso).split("T")[0].split("-");
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return String(iso);
};

export const numero = (x) => Number(x || 0).toLocaleString("pt-BR");

export function Valor({ valor, sinal, className = "" }) {
  return (
    <span className={"tabular-nums font-medium " + (sinal === "D" ? "text-debit " : "text-credit ") + className}>
      {formatarValor(valor)}{sinal}
    </span>
  );
}

export function Saldo({ valor }) {
  return <Valor valor={valor} sinal={valor >= 0 ? "C" : "D"} />;
}

export function Selo({ tipo = "neutro", children, title }) {
  const cor = {
    pendente: "bg-warn-soft text-warn",
    sugerida: "bg-info-soft text-info",
    erro: "bg-debit-soft text-debit",
    ok: "bg-ok-soft text-credit",
    novo: "bg-brand-soft text-brand",
    ativo: "bg-ok-soft text-credit",
    inativo: "bg-surface-2 text-muted border border-line",
    provisoria: "bg-warn-soft text-warn",
    admin: "bg-brand-soft text-brand",
    neutro: "bg-surface-2 text-muted border border-line"
  }[tipo] || "bg-surface-2 text-muted border border-line";

  return (
    <span title={title} className={"inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold align-middle " + cor}>
      {children}
    </span>
  );
}

export function BotaoArquivo({ aoEscolher, aceita, multiplo, children, className = "btn-contorno", disabled, icone }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => ref.current && ref.current.click()}>
        {icone && <Icone nome={icone} />}{children}
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        accept={aceita}
        multiple={multiplo}
        onChange={(e) => {
          const f = e.target.files;
          if (f && f.length) aoEscolher(multiplo ? Array.from(f) : f[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function Campo({ rotulo, id, children, dica, className = "" }) {
  return (
    <div className={"space-y-1.5 min-w-0 " + className}>
      {rotulo && <label className="rotulo" htmlFor={id}>{rotulo}</label>}
      {children}
      {dica && <p className="text-[12px] text-muted">{dica}</p>}
    </div>
  );
}

export function Segmentado({ opcoes, valor, aoMudar, rotulo, pequeno }) {
  return (
    <div
      className={"inline-flex p-1 gap-1 rounded-lg bg-surface-2 border border-line max-w-full overflow-x-auto " + (pequeno ? "" : "w-full")}
      role="radiogroup"
      aria-label={rotulo}
    >
      {opcoes.map(([id, nome, cls]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={valor === id}
          onClick={() => aoMudar(id)}
          className={"flex-1 whitespace-nowrap rounded-md px-3 py-1 text-[13.5px] " +
            (valor === id ? "bg-surface font-semibold shadow-sm " + (cls || "text-brand") : "text-ink-2 hover:text-ink")}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}

export default {
  Valor,
  Saldo,
  Selo,
  BotaoArquivo,
  Campo,
  Segmentado,
  formatarValor,
  dataBR,
  numero
};

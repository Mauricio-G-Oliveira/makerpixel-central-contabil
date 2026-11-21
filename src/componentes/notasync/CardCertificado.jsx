import { useState } from "react";
import { calcularStatusVencimentoCertificado, mascararTitularCertificado } from "../../lib/notasync.mjs";
import { Selo } from "../contabil/ui.jsx";

export default function CardCertificado({ certificado, onTrocar, onExcluir, onAbrirAssistente }) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  if (!certificado) {
    return (
      <div className="card p-5 border-dashed border-2 border-brand/40 bg-brand-soft/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <h3 className="font-bold text-ink text-sm">Nenhum Certificado Digital A1 Configurado</h3>
          </div>
          <p className="text-xs text-muted max-w-xl">
            Para ativar as buscas automáticas de NFC-e na SEF/SC, configure o certificado digital A1 do contador no Cofre Seguro com criptografia em envelope AES-256-GCM.
          </p>
        </div>

        <button
          type="button"
          onClick={onAbrirAssistente}
          className="btn-primario text-xs font-semibold py-2 px-3.5 whitespace-nowrap flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Configurar via Assistente
        </button>
      </div>
    );
  }

  const { diasRestantes, status, alerta } = calcularStatusVencimentoCertificado(certificado.validoAte);
  const titularFmt = mascararTitularCertificado(certificado.titular, certificado.documento, certificado.tipo);

  const getSeloStatus = () => {
    switch (status) {
      case "EXPIRADO":
        return <Selo tipo="erro">EXPIRADO</Selo>;
      case "CRITICO_7_DIAS":
        return <Selo tipo="erro">VENCE EM {diasRestantes} DIAS</Selo>;
      case "ALERTA_15_DIAS":
        return <Selo tipo="aviso">VENCE EM {diasRestantes} DIAS</Selo>;
      case "AVISO_30_DIAS":
        return <Selo tipo="aviso">VENCE EM {diasRestantes} DIAS</Selo>;
      default:
        return <Selo tipo="ok">ATIVO ({diasRestantes} DIAS)</Selo>;
    }
  };

  return (
    <div className={`card p-5 border transition-all ${
      status === "EXPIRADO" || status === "CRITICO_7_DIAS"
        ? "border-rose-400 bg-rose-50/20 dark:bg-rose-950/10"
        : status === "ALERTA_15_DIAS" || status === "AVISO_30_DIAS"
        ? "border-amber-400 bg-amber-50/20 dark:bg-amber-950/10"
        : "border-line"
    }`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center font-bold text-xs">
            {certificado.tipo === "E_CPF" ? "CPF" : "CNPJ"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-ink">{titularFmt}</span>
              {getSeloStatus()}
            </div>
            <span className="text-xs text-muted font-mono">
              Emissor: {certificado.emissor || "AC ICP-Brasil"} &bull; SHA-256: {certificado.sha256Original?.slice(0, 16)}...
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTrocar}
            className="btn-contorno text-xs py-1.5 px-3"
            title="Substituir certificado digital A1 atual"
          >
            Trocar Certificado
          </button>

          {!confirmandoExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="btn-contorno text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200"
              title="Excluir certificado digital do cofre"
            >
              Excluir
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  onExcluir();
                  setConfirmandoExclusao(false);
                }}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              >
                Confirmar Exclusão
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                className="btn-contorno text-xs py-1 px-2"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {alerta && (
        <div className="mt-3 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 bg-amber-100/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{alerta} Atualize o arquivo .pfx antes do término para não interromper as sincronizações da SEF/SC.</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-muted block text-[11px] uppercase tracking-wider">Válido A Partir De</span>
          <span className="font-medium text-ink">
            {new Date(certificado.validoDe).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div>
          <span className="text-muted block text-[11px] uppercase tracking-wider">Vencimento</span>
          <span className="font-semibold text-ink">
            {new Date(certificado.validoAte).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <div>
          <span className="text-muted block text-[11px] uppercase tracking-wider">Criptografia</span>
          <span className="font-medium text-ink font-mono text-[11px]">Envelope AES-256-GCM</span>
        </div>
        <div>
          <span className="text-muted block text-[11px] uppercase tracking-wider">Termo de Custódia</span>
          <span className="font-medium text-emerald-600">Aceito (v{certificado.termoVersao || "1.0"})</span>
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { escritorioAtivo, statusAcesso, linkContratarWhatsApp, MODULOS_DISPONIVEIS } from "../lib/multiEscritorio.mjs";
import Icone from "./Icone.jsx";

export default function ModuloNaoContratado({ modulo }) {
  const esc = escritorioAtivo();
  const st = statusAcesso(esc);
  const modInfo = MODULOS_DISPONIVEIS.find((m) => m.id === modulo) || { nome: modulo };
  const whatsAppUrl = linkContratarWhatsApp(esc, modInfo.nome);

  const isVencido = st.vencido;
  const isSuspenso = st.suspenso;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="max-w-md w-full bg-surface-1 border border-border rounded-2xl p-8 shadow-xl">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
          <Icone nome={isVencido || isSuspenso ? "alerta" : "cadeado"} className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-surface-2 text-muted mb-3 border border-border">
          {isVencido ? "Licença Expirada" : isSuspenso ? "Acesso Suspenso" : "Módulo Opcional"}
        </span>

        <h1 className="text-xl font-bold text-fg mb-2">
          {isVencido
            ? "Acesso Expirado"
            : isSuspenso
            ? "Acesso Temporariamente Suspenso"
            : "Módulo não Contratado"}
        </h1>

        <p className="text-sm text-muted leading-relaxed mb-6">
          {isVencido ? (
            <>
              O período de acesso do escritório <strong>{esc.razaoSocial || esc.nomeFantasia}</strong> expirou em{" "}
              <span className="text-debit font-medium">{st.acessoAteFmt}</span>. Renove o seu contrato para continuar utilizando todas as ferramentas.
            </>
          ) : isSuspenso ? (
            <>
              O acesso para o escritório <strong>{esc.razaoSocial}</strong> está suspenso administrativamente. Entre em contato com a equipe MakerPixel para reativar.
            </>
          ) : (
            <>
              O módulo <strong>{modInfo.nome}</strong> não faz parte do pacote contratado para o escritório{" "}
              <strong>{esc.razaoSocial || esc.nomeFantasia}</strong>. Ative este módulo de forma avulsa a qualquer momento.
            </>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand hover:bg-brand/90 text-brand-fg font-semibold text-sm transition-all shadow-md shadow-brand/10"
          >
            <Icone nome="whatsapp" className="w-4 h-4" />
            {isVencido || isSuspenso ? "Falar com Suporte MakerPixel" : "Contratar Este Módulo via WhatsApp"}
          </a>

          <Link
            to="/"
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-fg text-sm font-medium border border-border transition-colors"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}

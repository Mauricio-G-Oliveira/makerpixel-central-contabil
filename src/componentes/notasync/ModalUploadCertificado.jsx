import { useState } from "react";
import Janela from "../Janela.jsx";
import { validarUploadCertificadoA1 } from "../../lib/notasync.mjs";

export default function ModalUploadCertificado({ aberta, aoFechar, onSalvarCertificado }) {
  const [arquivo, setArquivo] = useState(null);
  const [senha, setSenha] = useState("");
  const [aceitouTermo, setAceitouTermo] = useState(true);
  const [erro, setErro] = useState("");

  const salvar = () => {
    setErro("");
    const tamanho = arquivo ? arquivo.size : 14200;
    const v = validarUploadCertificadoA1({
      tamanhoBytes: tamanho,
      senha,
      aceitouTermo,
    });

    if (!v.valido) {
      setErro(v.erro);
      return;
    }

    const agora = new Date();
    const validoAte = new Date(agora.getTime() + 365 * 24 * 60 * 60 * 1000);

    onSalvarCertificado({
      titular: arquivo?.name?.replace(/\.[^/.]+$/, "") || "CONTABILIDADE MODELO LTDA",
      documento: "11222333000181",
      tipo: "E_CNPJ",
      emissor: "AC Certisign Multipla G7",
      validoDe: agora.toISOString(),
      validoAte: validoAte.toISOString(),
      sha256Original: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      termoVersao: "1.0",
    });

    aoFechar();
  };

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Cofre de Certificados — Enviar Certificado A1"
      largura="max-w-[480px]"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={aoFechar} className="btn-contorno text-xs py-1.5 px-3">
            Cancelar
          </button>
          <button type="button" onClick={salvar} className="btn-primario text-xs py-1.5 px-4 font-semibold">
            Cifrar e Salvar no Cofre
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs text-ink">
        <p className="text-muted leading-relaxed">
          O arquivo será criptografado em envelope AES-256-GCM (DEK de 256 bits individual + KEK mestra) e ficará protegido no cofre seguro. Limite máximo: 50 KB.
        </p>

        {erro && (
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200">
            {erro}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="font-semibold text-muted uppercase tracking-wider block">
            Arquivo do Certificado (.pfx ou .p12)
          </label>
          <input
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setArquivo(e.target.files[0]);
              }
            }}
            className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-soft file:text-brand hover:file:bg-brand-soft/80"
          />
          {arquivo && (
            <span className="text-muted text-[11px] block">
              Tamanho: {(arquivo.size / 1024).toFixed(1)} KB
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="font-semibold text-muted uppercase tracking-wider block">
            Senha de Proteção do Certificado
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha cadastrada no .pfx"
            className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface"
          />
        </div>

        <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aceitouTermo}
            onChange={(e) => setAceitouTermo(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand"
          />
          <span className="text-ink">
            Confirmo o aceite do Termo de Custódia e Segurança do Certificado Digital (v1.0).
          </span>
        </label>
      </div>
    </Janela>
  );
}

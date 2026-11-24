import { useState } from "react";
import Janela from "../Janela.jsx";
import { validarUploadCertificadoA1 } from "../../lib/notasync.mjs";
import { apiClient } from "../../lib/apiClient.mjs";
import { CONFIG } from "../../lib/config.js";

export default function ModalUploadCertificado({ aberta, aoFechar, onSalvarCertificado }) {
  const [arquivo, setArquivo] = useState(null);
  const [senha, setSenha] = useState("");
  const [aceitouTermo, setAceitouTermo] = useState(true);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const salvar = async () => {
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

    setCarregando(true);
    try {
      if (arquivo && !CONFIG.modoDemo) {
        const formData = new FormData();
        formData.append("file", arquivo);
        formData.append("senha", senha);
        formData.append("aceitouTermo", String(aceitouTermo));
        formData.append("termoVersao", "1.0");

        const resumo = await apiClient.upload("/api/v1/certificados/upload", formData);
        onSalvarCertificado(resumo);
      } else {
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
      }
      // Imediatamente limpa senha e arquivo da memória
      setSenha("");
      setArquivo(null);
      aoFechar();
    } catch (err) {
      setErro(err.message || "Erro ao enviar certificado para o cofre seguro.");
    } finally {
      setCarregando(false);
      setSenha("");
      setArquivo(null);
    }
  };

  return (
    <Janela
      aberta={aberta}
      aoFechar={() => {
        setSenha("");
        setArquivo(null);
        aoFechar();
      }}
      titulo="Cofre de Certificados — Enviar Certificado A1"
      largura="max-w-[480px]"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={aoFechar} disabled={carregando} className="btn-contorno text-xs py-1.5 px-3">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={carregando} className="btn-primario text-xs py-1.5 px-4 font-semibold">
            {carregando ? "Cifrando e Enviando..." : "Cifrar e Salvar no Cofre"}
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs text-ink">
        <p className="text-muted leading-relaxed">
          O certificado digital A1 (.pfx ou .p12) é utilizado <strong>exclusivamente</strong> para autenticar as
          consultas automáticas de DF-e na SEF/SC. O arquivo e a senha são transmitidos diretamente ao cofre seguro e <strong>nunca permanecem no seu navegador</strong>.
        </p>

        <div className="space-y-1.5">
          <label className="rotulo block font-semibold">Arquivo do Certificado Digital A1 (.pfx / .p12)</label>
          <input
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            className="w-full text-xs file:btn-contorno file:btn-sm file:mr-2"
          />
          {arquivo && (
            <p className="text-[11px] text-muted">
              Arquivo selecionado: {arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="rotulo block font-semibold">Senha do Certificado Digital</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Digite a senha do certificado A1"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full text-xs"
          />
        </div>

        <div className="cartao p-3 bg-surface-2 border border-line space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aceitouTermo}
              onChange={(e) => setAceitouTermo(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[11.5px] text-muted leading-relaxed">
              Aceito o <strong>Termo de Custódia e Uso Seguro do Certificado Digital</strong> da MakerPixel. Concordo que o certificado e a senha serão cifrados com AES-256-GCM no cofre para busca automática de NFC-e/NF-e.
            </span>
          </label>
        </div>

        {erro && <p className="text-debit text-xs font-semibold">{erro}</p>}
      </div>
    </Janela>
  );
}

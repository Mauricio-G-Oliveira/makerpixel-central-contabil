import { useState } from "react";
import Janela from "../Janela.jsx";
import { parsearEmpresasCsv, validarUploadCertificadoA1 } from "../../lib/notasync.mjs";

export default function AssistentePrimeirosPassosModal({
  aberta,
  aoFechar,
  onConcluirAssistente,
  limiteEmpresas = 20,
}) {
  const [passo, setPasso] = useState(1); // 1 a 5

  // Passo 1: Termo
  const [aceitouTermo, setAceitouTermo] = useState(false);

  // Passo 2: Certificado
  const [arquivoCert, setArquivoCert] = useState(null);
  const [senhaCert, setSenhaCert] = useState("");
  const [erroCert, setErroCert] = useState("");

  // Passo 3: Importação CSV
  const [conteudoCsv, setConteudoCsv] = useState(
    "cnpj;razao_social\n" +
    "11.222.333/0001-81;Mercado Modelo Ltda\n" +
    "22.333.444/0001-92;Padaria & Confeitaria Central Ltda\n" +
    "33.444.555/0001-03;Farmácia Exemplo Ltda\n" +
    "44.555.666/0001-80;Posto Exemplo Ltda"
  );
  const [resCsv, setResCsv] = useState(null);

  // Passo 4: Busca
  const [buscando, setBuscando] = useState(false);
  const [progressoBusca, setProgressoBusca] = useState(0);

  // Passo 5: Resultado
  const [resultadoFinal, setResultadoFinal] = useState(null);

  const avancarParaPasso2 = () => {
    if (!aceitouTermo) return;
    setPasso(2);
  };

  const avancarParaPasso3 = () => {
    setErroCert("");
    const tamanho = arquivoCert ? arquivoCert.size : 14200; // simula 14.2 KB se selecionado demo
    const validacao = validarUploadCertificadoA1({
      tamanhoBytes: tamanho,
      senha: senhaCert || "senha123",
      aceitouTermo: true,
    });

    if (!validacao.valido) {
      setErroCert(validacao.erro);
      return;
    }
    setPasso(3);
  };

  const avancarParaPasso4 = () => {
    const parsed = parsearEmpresasCsv(conteudoCsv, limiteEmpresas);
    setResCsv(parsed);
    setPasso(4);

    // Inicia busca simulada automaticamente
    setBuscando(true);
    setProgressoBusca(15);
    setTimeout(() => setProgressoBusca(45), 400);
    setTimeout(() => setProgressoBusca(80), 900);
    setTimeout(() => {
      setProgressoBusca(100);
      setBuscando(false);
      // Gera resultado com empresas sincronizadas e destaque do erro 8002
      setResultadoFinal({
        totalNotas: 105,
        valorTotal: 18450.8,
        empresasSincronizadas: parsed.empresasValidas.length,
        pendenciasSat: [
          {
            cnpj: "44.555.666/0001-80",
            razaoSocial: "Posto Exemplo Ltda",
            cStat: 8002,
            motivo: "O contador não está vinculado a este CNPJ no SAT da SEF/SC",
            acao: "Acesse o portal SAT da SEF/SC e solicite o vínculo de contabilista para este CNPJ.",
          },
        ],
      });
      setPasso(5);
    }, 1500);
  };

  const finalizarTudo = () => {
    if (onConcluirAssistente) {
      onConcluirAssistente({
        certificado: {
          titular: "CONTABILIDADE MODELO LTDA",
          documento: "11222333000181",
          tipo: "E_CNPJ",
          emissor: "AC Certisign Multipla G7",
          validoDe: "2026-01-10T00:00:00Z",
          validoAte: "2027-01-10T23:59:59Z",
          sha256Original: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          termoVersao: "1.0",
        },
        empresasNovas: resCsv?.empresasValidas || [],
      });
    }
    aoFechar();
  };

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Assistente de Configuração — NotaSync"
      largura="max-w-[620px]"
      rodape={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted font-medium">Etapa {passo} de 5</span>
          <div className="flex items-center gap-2">
            {passo > 1 && passo < 5 && (
              <button
                type="button"
                onClick={() => setPasso((p) => p - 1)}
                className="btn-contorno text-xs py-1.5 px-3"
              >
                Voltar
              </button>
            )}

            {passo === 1 && (
              <button
                type="button"
                onClick={avancarParaPasso2}
                disabled={!aceitouTermo}
                className="btn-primario text-xs py-1.5 px-4 font-semibold disabled:opacity-50"
              >
                Aceitar e Continuar &rarr;
              </button>
            )}

            {passo === 2 && (
              <button
                type="button"
                onClick={avancarParaPasso3}
                className="btn-primario text-xs py-1.5 px-4 font-semibold"
              >
                Confirmar Certificado &rarr;
              </button>
            )}

            {passo === 3 && (
              <button
                type="button"
                onClick={avancarParaPasso4}
                className="btn-primario text-xs py-1.5 px-4 font-semibold"
              >
                Salvar e Rodar 1ª Busca &rarr;
              </button>
            )}

            {passo === 5 && (
              <button
                type="button"
                onClick={finalizarTudo}
                className="btn-primario text-xs py-1.5 px-4 font-semibold shadow-sm"
              >
                Concluir e Ir para o Painel &rarr;
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-ink">
        {/* Indicador de passos */}
        <div className="flex items-center justify-between border-b border-line pb-3 text-xs">
          {["Termo", "Certificado", "Empresas", "1ª Busca", "Resultado"].map((nome, idx) => {
            const numero = idx + 1;
            const ativo = passo === numero;
            const concluido = passo > numero;
            return (
              <div key={nome} className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    concluido
                      ? "bg-emerald-600 text-white"
                      : ativo
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {concluido ? "✓" : numero}
                </span>
                <span className={`hidden sm:inline ${ativo ? "font-bold text-ink" : "text-muted"}`}>
                  {nome}
                </span>
              </div>
            );
          })}
        </div>

        {/* ETAPA 1: TERMO DE USO */}
        {passo === 1 && (
          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-ink text-sm">Termo de Custódia e Uso Seguro do Certificado</h4>
              <p className="text-xs text-muted mt-0.5">
                Por favor, leia atentamente as garantias de segurança criptográfica aplicadas pelo NotaSync.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-line bg-surface-2/60 text-xs text-ink-2 space-y-2 max-h-48 overflow-y-auto font-sans leading-relaxed">
              <p>
                <strong>1. Criptografia em Envelope (AES-256-GCM):</strong> Seu arquivo .pfx e a respectiva senha são protegidos por chaves de dados aleatórias individuais (DEK) e custodiados sob uma chave mestra (KEK) com rotação periódica.
              </p>
              <p>
                <strong>2. Decifração Exclusiva em Memória:</strong> O certificado digital é decifrado única e exclusivamente em memória volátil durante a autenticação mTLS junto à Secretaria da Fazenda de SC. A API nunca devolve o .pfx nem a senha.
              </p>
              <p>
                <strong>3. Auditoria Permanente:</strong> Todas as operações de upload, leitura para consulta e exclusão são gravadas em log imutável de auditoria.
              </p>
              <p>
                <strong>4. Exclusão sob Demanda:</strong> Você pode remover o certificado a qualquer momento, o que apagará definitivamente todas as chaves e dados cifrados.
              </p>
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceitouTermo}
                onChange={(e) => setAceitouTermo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand"
              />
              <span className="text-xs text-ink font-semibold">
                Declaro que li e aceito as condições do Termo de Custódia e Segurança (versão 1.0) para uso do Certificado Digital A1.
              </span>
            </label>
          </div>
        )}

        {/* ETAPA 2: CERTIFICADO A1 */}
        {passo === 2 && (
          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-ink text-sm">Envio do Certificado Digital A1 do Contador</h4>
              <p className="text-xs text-muted mt-0.5">
                Envie o arquivo no formato <code>.pfx</code> ou <code>.p12</code> (tamanho máximo permitido: 50 KB).
              </p>
            </div>

            {erroCert && (
              <div className="p-2.5 rounded-lg text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200">
                {erroCert}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                Arquivo do Certificado (.pfx ou .p12)
              </label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setArquivoCert(e.target.files[0]);
                  }
                }}
                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-soft file:text-brand hover:file:bg-brand-soft/80"
              />
              <span className="text-[11px] text-muted block">
                {arquivoCert ? `Arquivo selecionado: ${arquivoCert.name} (${Math.round(arquivoCert.size / 1024)} KB)` : "Caso não envie arquivo, o sistema usará o certificado de teste padrão para o demo."}
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                Senha do Certificado
              </label>
              <input
                type="password"
                value={senhaCert}
                onChange={(e) => setSenhaCert(e.target.value)}
                placeholder="Digite a senha de proteção do arquivo..."
                className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface"
              />
              <span className="text-[11px] text-muted">A senha é cifrada com chave de 256 bits e nunca fica exposta.</span>
            </div>
          </div>
        )}

        {/* ETAPA 3: IMPORTAÇÃO CSV */}
        {passo === 3 && (
          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-ink text-sm">Empresas Monitoradas (Carteira de Clientes)</h4>
              <p className="text-xs text-muted mt-0.5">
                Cole abaixo a lista de empresas ou edite as sementes sugeridas. Formato: <code>cnpj;razao_social</code>.
              </p>
            </div>

            <textarea
              rows={5}
              value={conteudoCsv}
              onChange={(e) => setConteudoCsv(e.target.value)}
              className="w-full text-xs font-mono p-3 rounded-lg border border-line bg-surface"
              placeholder="00.000.000/0000-00;Nome da Empresa"
            />

            <div className="p-2.5 rounded-lg bg-surface-2 text-xs flex items-center justify-between">
              <span className="text-muted">Limite do seu plano: <strong>{limiteEmpresas} empresas</strong></span>
              <span className="text-brand font-semibold">Validação de DV Módulo 11 Ativa</span>
            </div>
          </div>
        )}

        {/* ETAPA 4: BUSCA INICIAL */}
        {passo === 4 && (
          <div className="py-8 space-y-4 text-center">
            <div className="inline-block relative">
              <div className="w-16 h-16 rounded-full border-4 border-brand/20 border-t-brand animate-spin mx-auto" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand">
                {progressoBusca}%
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-ink text-base">Consultando Web Service da SEF/SC…</h4>
              <p className="text-xs text-muted max-w-md mx-auto">
                Autenticando mTLS com o certificado digital A1 e recuperando lotes de NFC-e (modelo 65) autorizados e cancelados.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 5: RESULTADO E 8002 */}
        {passo === 5 && resultadoFinal && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">✓</span>
              <div>
                <h4 className="font-bold text-sm">Primeira Busca Concluída com Sucesso!</h4>
                <p className="text-xs">
                  {resultadoFinal.totalNotas} notas fiscais baixadas e deduplicadas ({resultadoFinal.empresasSincronizadas} empresas ativas).
                </p>
              </div>
            </div>

            {/* DESTAQUE DO ERRO 8002 */}
            {resultadoFinal.pendenciasSat.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    Atenção: Empresa com Pendência de Vínculo no SAT/SEF (cStat 8002)
                  </h4>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  A SEF/SC não retornou notas para a empresa abaixo porque o certificado transmissor não está associado ao CNPJ como contabilista responsável:
                </p>

                <div className="space-y-2 pt-1">
                  {resultadoFinal.pendenciasSat.map((p) => (
                    <div key={p.cnpj} className="p-2.5 rounded-lg bg-white/70 dark:bg-surface border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-ink block">{p.razaoSocial}</span>
                        <span className="font-mono text-muted">{p.cnpj}</span>
                      </div>
                      <a
                        href="https://sat.sef.sc.gov.br/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold text-[11px] text-center hover:bg-amber-700 whitespace-nowrap"
                      >
                        Vincular no SAT/SC &rarr;
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Janela>
  );
}

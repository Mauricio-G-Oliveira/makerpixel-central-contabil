import { useState, useEffect, useMemo } from "react";
import {
  lerXmlNfse,
  gerarDanfse,
  criarZipDanfse,
  xmlNfseDeExemplo,
  formatarCpfCnpj,
  formatarDataHora
} from "../lib/danfse.mjs";
import { carregarJsZip } from "../lib/leitores.js";
import { useAvisos } from "../componentes/Avisos.jsx";
import { Campo } from "../componentes/contabil/ui.jsx";

const CHAVE_NOTASYNC_DOCS = "notasync:documentos_v3";
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function Danfse() {
  const { aviso } = useAvisos();
  const [arquivosNfse, setArquivosNfse] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [stc, setStc] = useState(0); // 0=Autorizada, 1=Cancelada, 2=Substituída
  const [canhoto, setCanhoto] = useState(true);
  const [abaOrigem, setAbaOrigem] = useState("upload"); // upload | notasync

  // Carrega exemplo inicial se vazio
  useEffect(() => {
    if (!arquivosNfse.length) {
      const exemploXml = xmlNfseDeExemplo();
      const parsed = lerXmlNfse(exemploXml, "exemplo_nfse_3021.xml");
      if (parsed.ok) {
        setArquivosNfse([
          {
            id: "ex-1",
            nomeArquivo: "exemplo_nfse_3021.xml",
            xml: exemploXml,
            dados: parsed.dados,
            pdf: null,
            pdfUrl: null,
            status: "pendente"
          }
        ]);
      }
    }
  }, []);

  // Processa upload de arquivos .xml ou .zip
  async function processarUpload(lista) {
    const files = Array.from(lista || []);
    if (!files.length) return;

    setGerando(true);
    const novasNotas = [];

    try {
      for (const f of files) {
        const nome = f.name.toLowerCase();
        if (nome.endsWith(".zip")) {
          try {
            const JSZip = await carregarJsZip();
            const zip = await JSZip.loadAsync(await f.arrayBuffer());
            for (const [caminho, zipEntry] of Object.entries(zip.files)) {
              if (!zipEntry.dir && caminho.toLowerCase().endsWith(".xml")) {
                const textoXml = await zipEntry.async("string");
                const res = lerXmlNfse(textoXml, zipEntry.name);
                if (res.ok) {
                  novasNotas.push({
                    id: "zip-" + Math.random().toString(36).substring(2, 9),
                    nomeArquivo: zipEntry.name,
                    xml: textoXml,
                    dados: res.dados,
                    pdf: null,
                    pdfUrl: null,
                    status: "pendente"
                  });
                }
              }
            }
          } catch (zipErr) {
            aviso("Erro ao descompactar ZIP: " + zipErr.message);
          }
        } else if (nome.endsWith(".xml")) {
          try {
            const textoXml = await f.text();
            const res = lerXmlNfse(textoXml, f.name);
            if (res.ok) {
              novasNotas.push({
                id: "file-" + Math.random().toString(36).substring(2, 9),
                nomeArquivo: f.name,
                xml: textoXml,
                dados: res.dados,
                pdf: null,
                pdfUrl: null,
                status: "pendente"
              });
            } else {
              aviso(`Arquivo ${f.name} ignorado: ${res.erro}`);
            }
          } catch (xmlErr) {
            aviso(`Erro ao ler ${f.name}: ` + xmlErr.message);
          }
        }
      }

      if (novasNotas.length > 0) {
        setArquivosNfse((prev) => [...prev, ...novasNotas]);
        aviso(`${novasNotas.length} nota(s) fiscal(is) de serviço carregada(s).`);
      }
    } finally {
      setGerando(false);
    }
  }

  // Importa notas de serviço sincronizadas do NotaSync
  function carregarDoNotasync() {
    try {
      const salvo = localStorage.getItem(CHAVE_NOTASYNC_DOCS);
      if (!salvo) {
        aviso("Nenhum documento sincronizado encontrado no NotaSync.");
        return;
      }
      const docs = JSON.parse(salvo);
      // Filtra documentos que tenham XML com indicativo de serviço ou modelo de NFS-e
      const docsNfse = docs.filter(
        (d) => (d.xml && (d.xml.includes("<NFSe") || d.xml.includes("<DPS>") || d.xml.includes("<serv>")))
      );

      if (!docsNfse.length) {
        aviso("Nenhuma NFS-e identificada no banco local do NotaSync. Carregando notas com modelo de serviço.");
      }

      const novas = (docsNfse.length ? docsNfse : docs.slice(0, 3)).map((d, i) => {
        const xml = d.xml || xmlNfseDeExemplo();
        const res = lerXmlNfse(xml, `notasync_${d.numero || i + 1}.xml`);
        return {
          id: "ns-" + (d.chave || i),
          nomeArquivo: `notasync_${d.numero || i + 1}.xml`,
          xml,
          dados: res.ok ? res.dados : null,
          pdf: null,
          pdfUrl: null,
          status: "pendente"
        };
      });

      setArquivosNfse((prev) => [...prev, ...novas]);
      aviso(`${novas.length} NFS-e(s) importada(s) do NotaSync.`);
    } catch (e) {
      aviso("Erro ao carregar do NotaSync: " + e.message);
    }
  }

  // Gera PDF de um item específico
  async function renderizarItem(item) {
    try {
      setGerando(true);
      const res = await gerarDanfse({
        xml: item.xml,
        stc,
        canhoto,
        nomeArquivo: item.nomeArquivo
      });

      const atualizado = {
        ...item,
        pdf: res.pdfBase64,
        pdfUrl: res.url,
        status: "gerado"
      };

      setArquivosNfse((prev) => prev.map((x) => (x.id === item.id ? atualizado : x)));
      setSelecionado(atualizado);
      aviso(`DANFSe da NFS-e nº ${item.dados?.numero || "1"} gerado com sucesso!`);
    } catch (err) {
      aviso("Falha na geração do DANFSe: " + (err.message || err));
    } finally {
      setGerando(false);
    }
  }

  // Gera todos os PDFs pendentes
  async function gerarTodos() {
    if (!arquivosNfse.length) return;
    setGerando(true);
    let count = 0;
    try {
      const atualizados = [];
      for (const item of arquivosNfse) {
        try {
          const res = await gerarDanfse({
            xml: item.xml,
            stc,
            canhoto,
            nomeArquivo: item.nomeArquivo
          });
          atualizados.push({
            ...item,
            pdf: res.pdfBase64,
            pdfUrl: res.url,
            status: "gerado"
          });
          count++;
        } catch (e) {
          atualizados.push({ ...item, status: "erro" });
        }
      }
      setArquivosNfse(atualizados);
      if (atualizados[0] && atualizados[0].pdfUrl) {
        setSelecionado(atualizados[0]);
      }
      aviso(`${count} DANFSe(s) gerado(s) em PDF.`);
    } finally {
      setGerando(false);
    }
  }

  // Baixa todos os PDFs em um arquivo ZIP
  async function baixarZip() {
    const gerados = arquivosNfse.filter((x) => x.pdf);
    if (!gerados.length) {
      aviso("Gere os PDFs primeiro antes de baixar o ZIP.");
      return;
    }

    try {
      const zipBlob = await criarZipDanfse(
        gerados.map((g) => ({
          nomeArquivo: (g.nomeArquivo || "danfse.xml").replace(/\.xml$/i, ".pdf"),
          pdfBase64: g.pdf
        }))
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `danfse_lote_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      aviso("Arquivo ZIP com todos os DANFSes baixado.");
    } catch (e) {
      aviso("Erro ao gerar ZIP: " + e.message);
    }
  }

  const totalGerados = useMemo(() => arquivosNfse.filter((x) => x.pdf).length, [arquivosNfse]);

  return (
    <div className="space-y-4">
      {/* Banner de Privacidade e WebAssembly */}
      <div className="cartao p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-4 border-l-brand">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-credit animate-pulse" />
            <h1 className="text-[16px] font-semibold text-ink">
              Gerador de DANFSe (WebAssembly Oficial da Receita Federal)
            </h1>
            <span className="rounded bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand">
              WASM Client-Side
            </span>
          </div>
          <p className="text-[12.5px] text-muted leading-relaxed">
            Gere o Documento Auxiliar da NFS-e Nacional diretamente no seu navegador. Os arquivos XML não são enviados para servidores externos, garantindo sigilo fiscal e privacidade total.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {totalGerados > 0 && (
            <button
              type="button"
              className="btn-primario btn-sm text-[13px]"
              onClick={baixarZip}
            >
              Baixar ZIP ({totalGerados} PDFs)
            </button>
          )}
          <button
            type="button"
            className="btn-contorno btn-sm text-[13px]"
            onClick={gerarTodos}
            disabled={gerando || !arquivosNfse.length}
          >
            {gerando ? "Gerando..." : "Gerar Todos os PDFs"}
          </button>
        </div>
      </div>

      {/* Controles de Configuração e Entrada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Painel Esquerdo: Entrada de Arquivos */}
        <section className="cartao p-4 space-y-3.5 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <strong className="text-[14px]">Adicionar NFS-e</strong>
            <div className="inline-flex rounded-md border border-line bg-surface-2 p-0.5 text-[11.5px]">
              <button
                type="button"
                onClick={() => setAbaOrigem("upload")}
                className={"px-2.5 py-0.5 rounded font-medium " + (abaOrigem === "upload" ? "bg-surface shadow text-brand font-semibold" : "text-muted")}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setAbaOrigem("notasync")}
                className={"px-2.5 py-0.5 rounded font-medium " + (abaOrigem === "notasync" ? "bg-surface shadow text-brand font-semibold" : "text-muted")}
              >
                NotaSync
              </button>
            </div>
          </div>

          {abaOrigem === "upload" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); processarUpload(e.dataTransfer.files); }}
            >
              <label className={"block cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors " + (arrastando ? "border-brand bg-brand-soft" : "border-line bg-surface-2 hover:border-brand-fill")}>
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".xml,.zip"
                  onChange={(e) => { processarUpload(e.target.files); e.target.value = ""; }}
                />
                <strong className="block text-[13.5px] text-ink">Arraste XMLs ou ZIP aqui</strong>
                <span className="text-[12px] text-muted block mt-1">ou clique para selecionar</span>
              </label>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              <p className="text-[12.5px] text-muted leading-relaxed">
                Importe os XMLs de NFS-e que o robô NotaSync já baixou das empresas da sua carteira.
              </p>
              <button
                type="button"
                className="btn-primario btn-sm w-full text-[12.5px]"
                onClick={carregarDoNotasync}
              >
                Importar NFS-e do NotaSync
              </button>
            </div>
          )}

          {/* Parâmetros da Geração */}
          <div className="space-y-2.5 pt-2 border-t border-line text-[12.5px]">
            <Campo rotulo="Situação da Nota no DANFSe" id="stc-sel">
              <select id="stc-sel" value={stc} onChange={(e) => setStc(Number(e.target.value))} className="w-full">
                <option value={0}>0 — Autorizada (Normal)</option>
                <option value={1}>1 — Cancelada</option>
                <option value={2}>2 — Substituída</option>
              </select>
            </Campo>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={canhoto}
                onChange={(e) => setCanhoto(e.target.checked)}
                className="rounded border-line"
              />
              <span className="text-ink">Incluir canhoto destacável de recebimento</span>
            </label>
          </div>

          {/* Lista de Documentos Carregados */}
          <div className="pt-2 border-t border-line space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <strong className="text-muted">Fila de Documentos ({arquivosNfse.length})</strong>
              {arquivosNfse.length > 0 && (
                <button
                  type="button"
                  className="text-debit hover:underline text-[11.5px]"
                  onClick={() => { setArquivosNfse([]); setSelecionado(null); }}
                >
                  Limpar lista
                </button>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
              {arquivosNfse.map((item) => {
                const ativo = selecionado?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelecionado(item);
                      if (!item.pdf) renderizarItem(item);
                    }}
                    className={"p-2.5 rounded-lg border text-[12px] cursor-pointer transition-colors " + (ativo ? "bg-brand-soft border-brand" : "bg-surface-2 border-line hover:border-line-strong")}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <strong className="text-ink truncate">
                        NFS-e nº {item.dados?.numero || "1"}
                      </strong>
                      <span className={"text-[11px] font-semibold " + (item.pdf ? "text-credit" : "text-muted")}>
                        {item.pdf ? "✓ PDF Pronto" : "Pendente"}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-muted truncate">
                      {item.dados?.prestador?.razaoSocial || item.nomeArquivo}
                    </div>
                    {item.dados?.servico && (
                      <div className="flex justify-between pt-1 text-[11px] text-muted">
                        <span>Valor: {fmtMoeda.format(item.dados.servico.valorServicos)}</span>
                        <span>ISS: {fmtMoeda.format(item.dados.servico.valorIss)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Painel Direito: Visualizador e Pré-visualização do PDF */}
        <section className="cartao p-4 space-y-3 lg:col-span-2 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Visualização do DANFSe Nacional
              </h2>
              <span className="text-[12px] text-muted">
                {selecionado ? `NFS-e nº ${selecionado.dados?.numero || "1"} · ${selecionado.dados?.prestador?.razaoSocial || ""}` : "Selecione uma nota da fila para visualizar ou gerar o documento."}
              </span>
            </div>

            {selecionado && (
              <div className="flex items-center gap-2">
                {!selecionado.pdf ? (
                  <button
                    type="button"
                    className="btn-primario btn-sm text-[12.5px]"
                    onClick={() => renderizarItem(selecionado)}
                    disabled={gerando}
                  >
                    {gerando ? "Renderizando..." : "Gerar PDF Agora"}
                  </button>
                ) : (
                  <>
                    <a
                      href={selecionado.pdfUrl}
                      download={(selecionado.nomeArquivo || "danfse.xml").replace(/\.xml$/i, ".pdf")}
                      className="btn-primario btn-sm text-[12.5px] inline-flex items-center gap-1.5"
                    >
                      Baixar PDF
                    </a>
                    <button
                      type="button"
                      className="btn-contorno btn-sm text-[12.5px]"
                      onClick={() => renderizarItem(selecionado)}
                      title="Recompila com novos parâmetros de canhoto ou situação"
                    >
                      Regerar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Iframe ou Placeholder do PDF */}
          <div className="flex-1 min-h-[500px] rounded-lg border border-line bg-surface-2 overflow-hidden flex items-center justify-center relative">
            {selecionado && selecionado.pdfUrl ? (
              <iframe
                src={selecionado.pdfUrl}
                title="DANFSe Viewer"
                className="w-full h-full min-h-[600px] border-0"
              />
            ) : selecionado ? (
              <div className="text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-brand-soft text-brand flex items-center justify-center mx-auto text-xl font-bold">
                  📄
                </div>
                <strong className="block text-[14px] text-ink">
                  NFS-e nº {selecionado.dados?.numero || "1"} pronta para renderização
                </strong>
                <p className="text-[12.5px] text-muted max-w-sm mx-auto">
                  Clique em &quot;Gerar PDF Agora&quot; para compilar o DANFSe no navegador.
                </p>
                <button
                  type="button"
                  className="btn-primario btn-sm"
                  onClick={() => renderizarItem(selecionado)}
                  disabled={gerando}
                >
                  {gerando ? "Gerando..." : "Gerar PDF"}
                </button>
              </div>
            ) : (
              <div className="text-center p-8 text-muted text-[13.5px]">
                Nenhum documento selecionado. Arraste arquivos XML ou escolha um item da lista.
              </div>
            )}
          </div>

          {/* Detalhes Resumidos da NFS-e Selecionada */}
          {selecionado?.dados && (
            <div className="rounded-lg bg-surface-2 p-3 border border-line text-[12px] grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-muted block">Prestador</span>
                <strong className="text-ink truncate block">{formatarCpfCnpj(selecionado.dados.prestador.cnpjCpf)}</strong>
              </div>
              <div>
                <span className="text-muted block">Tomador</span>
                <strong className="text-ink truncate block">{formatarCpfCnpj(selecionado.dados.tomador.cnpjCpf)}</strong>
              </div>
              <div>
                <span className="text-muted block">Valor do Serviço</span>
                <strong className="text-ink block">{fmtMoeda.format(selecionado.dados.servico.valorServicos)}</strong>
              </div>
              <div>
                <span className="text-muted block">ISS ({selecionado.dados.servico.aliquotaIss}%)</span>
                <strong className="text-credit block">{fmtMoeda.format(selecionado.dados.servico.valorIss)}</strong>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

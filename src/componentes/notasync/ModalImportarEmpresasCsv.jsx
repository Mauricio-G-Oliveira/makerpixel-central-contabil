import { useState } from "react";
import Janela from "../Janela.jsx";
import { parsearEmpresasCsv, validarCnpjModulo11 } from "../../lib/notasync.mjs";

export default function ModalImportarEmpresasCsv({
  aberta,
  aoFechar,
  onAdicionarEmpresas,
  empresasAtuais = [],
  limiteEmpresas = 20,
}) {
  const [modo, setModo] = useState("csv"); // csv | manual
  const [textoCsv, setTextoCsv] = useState("");
  const [cnpjManual, setCnpjManual] = useState("");
  const [razaoManual, setRazaoManual] = useState("");
  const [erros, setErros] = useState([]);
  const [sucessoMsg, setSucessoMsg] = useState("");

  const cnpjsCadastrados = new Set(empresasAtuais.map((e) => e.cnpj?.replace(/\D/g, "")));

  const importarCsv = () => {
    setErros([]);
    setSucessoMsg("");

    if (!textoCsv.trim()) {
      setErros(["Informe ou cole o conteúdo do CSV para importar."]);
      return;
    }

    const resultado = parsearEmpresasCsv(textoCsv, limiteEmpresas, cnpjsCadastrados);

    if (resultado.empresasValidas.length === 0) {
      if (resultado.erros.length > 0) {
        setErros(resultado.erros.map((e) => `Linha ${e.linha}: ${e.cnpj} - ${e.motivo}`));
      } else if (resultado.jaCadastradasQtd > 0) {
        setErros(["Todas as empresas informadas já estão cadastradas na carteira."]);
      } else {
        setErros(["Nenhuma empresa válida encontrada no CSV."]);
      }
      return;
    }

    onAdicionarEmpresas(resultado.empresasValidas);
    setSucessoMsg(
      `${resultado.empresasValidas.length} empresa(s) importada(s) com sucesso!` +
      (resultado.jaCadastradasQtd > 0 ? ` (${resultado.jaCadastradasQtd} já estavam na base).` : "")
    );

    if (resultado.erros.length > 0) {
      setErros(resultado.erros.map((e) => `Linha ${e.linha}: ${e.cnpj} - ${e.motivo}`));
    } else {
      setTimeout(() => aoFechar(), 900);
    }
  };

  const cadastrarManual = () => {
    setErros([]);
    setSucessoMsg("");

    const limpo = cnpjManual.replace(/\D/g, "");
    if (!validarCnpjModulo11(limpo)) {
      setErros(["CNPJ inválido pelo dígito verificador oficial (Módulo 11)."]);
      return;
    }

    if (cnpjsCadastrados.has(limpo)) {
      setErros(["Esta empresa já está cadastrada na carteira."]);
      return;
    }

    if (empresasAtuais.length >= limiteEmpresas) {
      setErros([`Limite de empresas do plano atingido (${limiteEmpresas}). Faça upgrade para cadastrar mais empresas.`]);
      return;
    }

    const nova = {
      id: `emp-${Date.now()}`,
      cnpj: limpo,
      razaoSocial: razaoManual.trim() || `Empresa ${limpo}`,
      ativo: true,
      ultNsu: 0,
      proximaBusca: new Date().toISOString(),
      status: "SINCRONIZADO",
    };

    onAdicionarEmpresas([nova]);
    setSucessoMsg(`Empresa ${nova.razaoSocial} cadastrada com sucesso!`);
    setTimeout(() => aoFechar(), 900);
  };

  const carregarArquivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTextoCsv(ev.target.result || "");
    };
    reader.readAsText(file, "UTF-8");
  };

  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Adicionar Empresas Monitoradas"
      largura="max-w-[520px]"
      rodape={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted">
            Atuais: {empresasAtuais.length} / {limiteEmpresas} (Limite do Plano)
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={aoFechar} className="btn-contorno text-xs py-1.5 px-3">
              Cancelar
            </button>
            <button
              type="button"
              onClick={modo === "csv" ? importarCsv : cadastrarManual}
              className="btn-primario text-xs py-1.5 px-4 font-semibold"
            >
              {modo === "csv" ? "Processar e Importar CSV" : "Cadastrar Empresa"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-ink">
        <div className="flex border-b border-line gap-2">
          <button
            type="button"
            onClick={() => setModo("csv")}
            className={`pb-2 px-3 font-semibold border-b-2 transition-colors ${
              modo === "csv" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Importar Arquivo CSV
          </button>
          <button
            type="button"
            onClick={() => setModo("manual")}
            className={`pb-2 px-3 font-semibold border-b-2 transition-colors ${
              modo === "manual" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Cadastro Individual
          </button>
        </div>

        {sucessoMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200">
            {sucessoMsg}
          </div>
        )}

        {erros.length > 0 && (
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 space-y-1">
            {erros.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        )}

        {modo === "csv" ? (
          <div className="space-y-3">
            <div>
              <label className="font-semibold text-muted uppercase tracking-wider block mb-1">
                Arquivo CSV do seu sistema contábil
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={carregarArquivo}
                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-soft file:text-brand hover:file:bg-brand-soft/80"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted uppercase tracking-wider block">
                Ou cole o texto aqui (formato: <code>cnpj;razao_social</code>)
              </label>
              <textarea
                rows={5}
                value={textoCsv}
                onChange={(e) => setTextoCsv(e.target.value)}
                placeholder="11.222.333/0001-81;Empresa Exemplo Ltda&#10;22.333.444/0001-92;Outro Cliente Ltda"
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-line bg-surface"
              />
              <span className="text-[11px] text-muted block">
                Separadores aceitos: ponto e vírgula (;) ou vírgula (,). Linhas de cabeçalho com a palavra 'cnpj' são ignoradas automaticamente.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-semibold text-muted uppercase tracking-wider block">
                CNPJ da Empresa (apenas SC)
              </label>
              <input
                type="text"
                value={cnpjManual}
                onChange={(e) => setCnpjManual(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted uppercase tracking-wider block">
                Razão Social ou Nome Fantasia
              </label>
              <input
                type="text"
                value={razaoManual}
                onChange={(e) => setRazaoManual(e.target.value)}
                placeholder="Ex.: Supermercado Modelo Ltda"
                className="w-full text-sm h-9 px-3 rounded-lg border border-line bg-surface"
              />
            </div>
          </div>
        )}
      </div>
    </Janela>
  );
}

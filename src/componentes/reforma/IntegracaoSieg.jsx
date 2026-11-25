import { useState, useEffect } from "react";
import apiClient from "../../lib/apiClient.mjs";
import { CONFIG } from "../../lib/config.js";
import { useAvisos } from "../Avisos.jsx";
import Icone from "../Icone.jsx";

export default function IntegracaoSieg({ aoAtualizar }) {
  const { aviso } = useAvisos();
  const [config, setConfig] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const carregarConfig = async () => {
    try {
      setCarregando(true);
      if (CONFIG.modoDemo) {
        setConfig({
          configurada: true,
          ultimosQuatro: "9876",
          configuradaEm: "15/02/2026 10:30",
          ultimaBusca: "Hoje às 06:15",
          ultimoStatus: "CONEXAO_OK",
          ultimoErro: null
        });
        return;
      }

      const res = await apiClient.get("/api/v1/integracoes/sieg");
      setConfig(res);
      if (res?.configurada) {
        setEditando(false);
      } else {
        setEditando(true);
      }
    } catch (err) {
      aviso("Não foi possível carregar a configuração da SIEG: " + (err.message || err));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarConfig();
  }, []);

  const salvarChave = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim() || apiKeyInput.trim().length < 8) {
      aviso("A chave de API da SIEG informada deve ter pelo menos 8 caracteres.");
      return;
    }

    try {
      setSalvando(true);
      if (CONFIG.modoDemo) {
        const ult = apiKeyInput.slice(-4);
        setConfig({
          configurada: true,
          ultimosQuatro: ult,
          configuradaEm: "Hoje agora",
          ultimaBusca: null,
          ultimoStatus: "CONFIGURADA",
          ultimoErro: null
        });
        setApiKeyInput("");
        setEditando(false);
        aviso("Chave da SIEG criptografada e salva com sucesso no cofre (modo demonstração).");
        if (aoAtualizar) aoAtualizar();
        return;
      }

      const res = await apiClient.post("/api/v1/integracoes/sieg", { apiKey: apiKeyInput.trim() });
      setConfig(res);
      setApiKeyInput("");
      setEditando(false);
      aviso("Chave da SIEG criptografada no cofre AES-256-GCM com sucesso!");
      if (aoAtualizar) aoAtualizar();
    } catch (err) {
      aviso("Erro ao salvar chave da SIEG: " + (err.message || err));
    } finally {
      setSalvando(false);
    }
  };

  const testarConexao = async () => {
    try {
      setTestando(true);
      if (CONFIG.modoDemo) {
        await new Promise((r) => setTimeout(r, 600));
        aviso("Conexão com a SIEG testada com sucesso! Credencial válida e autenticada.");
        return;
      }

      const res = await apiClient.post("/api/v1/integracoes/sieg/testar");
      if (res?.sucesso) {
        aviso(res.mensagem || "Conexão com a API da SIEG autenticada com sucesso!");
        carregarConfig();
      } else {
        aviso("Falha no teste da SIEG: " + (res?.mensagem || "Rejeição"));
      }
    } catch (err) {
      aviso("Erro ao testar conexão SIEG: " + (err.message || err));
    } finally {
      setTestando(false);
    }
  };

  const removerChave = async () => {
    if (!window.confirm("Deseja realmente remover a integração com a SIEG deste escritório?")) {
      return;
    }

    try {
      setRemovendo(true);
      if (CONFIG.modoDemo) {
        setConfig({ configurada: false, ultimosQuatro: null, configuradaEm: null, ultimaBusca: null, ultimoStatus: null, ultimoErro: null });
        setEditando(true);
        aviso("Integração SIEG removida.");
        if (aoAtualizar) aoAtualizar();
        return;
      }

      await apiClient.del("/api/v1/integracoes/sieg");
      aviso("Credencial da SIEG removida com sucesso do cofre.");
      carregarConfig();
      if (aoAtualizar) aoAtualizar();
    } catch (err) {
      aviso("Erro ao remover credencial SIEG: " + (err.message || err));
    } finally {
      setRemovendo(false);
    }
  };

  if (carregando) {
    return (
      <div className="cartao p-6 text-center text-muted">
        <p className="animate-pulse">Carregando credenciais da integração SIEG...</p>
      </div>
    );
  }

  return (
    <div className="cartao p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center font-bold text-[14px]">
            SIEG
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Integração SIEG (NF-e 55 & CT-e 57)</h3>
            <p className="text-[12.5px] text-muted">
              Baixa contínua e automática dos documentos fiscais emitida contra suas empresas, sem digitação manual.
            </p>
          </div>
        </div>

        {config?.configurada && !editando && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Conectada (final ****{config.ultimosQuatro})
          </span>
        )}
      </div>

      {config?.configurada && !editando ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-surface-2 p-3.5 rounded-lg border border-line text-[13px]">
            <div>
              <span className="text-muted block text-[11.5px] uppercase font-medium">Chave no Cofre</span>
              <strong className="text-ink font-mono text-[14px]">•••• •••• •••• {config.ultimosQuatro}</strong>
              <p className="text-[11px] text-muted mt-0.5">Criptografia AES-256-GCM</p>
            </div>
            <div>
              <span className="text-muted block text-[11.5px] uppercase font-medium">Configurada Em</span>
              <span className="text-ink font-medium">{config.configuradaEm || "—"}</span>
              <p className="text-[11px] text-muted mt-0.5">Vínculo do escritório</p>
            </div>
            <div>
              <span className="text-muted block text-[11.5px] uppercase font-medium">Última Sincronização</span>
              <span className="text-ink font-medium">{config.ultimaBusca || "Aguardando próximo ciclo"}</span>
              <p className="text-[11px] text-muted mt-0.5">Status: {config.ultimoStatus || "OK"}</p>
            </div>
          </div>

          {config.ultimoErro && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-[12.5px] text-red-600">
              <strong>Atenção:</strong> {config.ultimoErro}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={testarConexao}
              disabled={testando}
              className="botao-secundario text-[13px] inline-flex items-center gap-1.5 px-3 py-1.5"
            >
              <Icone nome="raio" className="w-3.5 h-3.5" />
              {testando ? "Testando Conexão..." : "Testar Conexão"}
            </button>

            <button
              type="button"
              onClick={() => setEditando(true)}
              className="botao-secundario text-[13px] inline-flex items-center gap-1.5 px-3 py-1.5"
            >
              <Icone nome="editar" className="w-3.5 h-3.5" />
              Trocar Chave de API
            </button>

            <button
              type="button"
              onClick={removerChave}
              disabled={removendo}
              className="botao-perigo text-[13px] inline-flex items-center gap-1.5 px-3 py-1.5 ml-auto"
            >
              <Icone nome="lixeira" className="w-3.5 h-3.5" />
              {removendo ? "Removendo..." : "Remover Integração"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={salvarChave} className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[12.5px] text-amber-700 leading-relaxed">
            <strong>Segurança do Cofre:</strong> Informe a chave de API fornecida no portal da SIEG. A chave será imediatamente encifrada com AES-256-GCM e nunca retornará em texto puro para a tela nem para logs.
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-semibold text-ink">
              Chave de API da SIEG (API Key)
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Cole sua API Key da SIEG..."
              required
              autoComplete="off"
              className="campo w-full font-mono text-[13px]"
            />
            <span className="text-[11.5px] text-muted">
              Você encontra essa chave no painel da SIEG em Configurações &gt; Chaves de API / Integrações.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={salvando || !apiKeyInput.trim()}
              className="botao-primario text-[13px] inline-flex items-center gap-1.5 px-4 py-2"
            >
              <Icone nome="salvar" className="w-4 h-4" />
              {salvando ? "Criptografando e Salvando..." : "Salvar no Cofre"}
            </button>

            {config?.configurada && (
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="botao-secundario text-[13px] px-3 py-2"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

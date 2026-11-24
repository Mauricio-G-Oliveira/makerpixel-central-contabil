import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthCore } from "../lib/authService.js";
import { useAuth } from "../lib/auth.jsx";
import { useAvisos } from "../componentes/Avisos.jsx";
import Janela from "../componentes/Janela.jsx";
import apiClient from "../lib/apiClient.mjs";
import { CONFIG } from "../lib/config.js";

const NOME_AREA = {};
AuthCore.AREAS.forEach((a) => { NOME_AREA[a.id] = a.nome; });

function dataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Selo({ tipo, children, title }) {
  const cor = {
    ativo: "bg-ok-soft text-credit",
    inativo: "bg-surface-2 text-muted border border-line",
    provisoria: "bg-warn-soft text-warn",
    admin: "bg-brand-soft text-brand"
  }[tipo] || "bg-surface-2 text-muted";
  return (
    <span title={title} className={"inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold " + cor}>
      {children}
    </span>
  );
}

function linkDoSistema() {
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

function mensagemAcesso(u, senha) {
  return "Olá, " + u.nome.split(" ")[0] + "! Segue o seu acesso à Central Contábil (MakerPixel):\n\n" +
    "Link: " + linkDoSistema() + "\n" +
    "E-mail: " + u.email + "\n" +
    "Senha provisória: " + senha + "\n\n" +
    "No primeiro acesso o sistema pede para você criar a sua própria senha.";
}

function FormUsuario({ editando, aoSalvar, aoFechar, aberta }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("usuario");
  const [areas, setAreas] = useState([]);
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const u = editando;
    setNome(u ? u.nome : "");
    setEmail(u ? u.email : "");
    setPerfil(u ? u.perfil : "usuario");
    setAreas(u ? (u.perfil === "admin" ? AuthCore.AREAS.map((a) => a.id) : (u.areas || []).slice()) : []);
    setAtivo(u ? u.ativo : true);
    setErro("");
    setOcupado(false);
  }, [aberta, editando]);

  const alternarArea = (id) => setAreas((l) => (l.indexOf(id) > -1 ? l.filter((x) => x !== id) : l.concat(id)));

  const salvar = () => {
    setErro("");
    setOcupado(true);
    aoSalvar({
      nome,
      email,
      perfil,
      areas: perfil === "admin" ? AuthCore.AREAS.map((a) => a.id) : areas,
      ativo
    }).catch((e) => setErro(e.message)).finally(() => setOcupado(false));
  };

  const principal = editando && editando.email === AuthCore.ADMIN_EMAIL;

  return (
    <Janela
      aberta={aberta}
      titulo={editando ? "Editar usuário" : "Novo usuário"}
      aoFechar={aoFechar}
      largura="max-w-[560px]"
      rodape={
        <>
          <button type="button" className="btn-fantasma" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn-primario" disabled={ocupado} onClick={salvar}>
            {editando ? "Salvar" : "Criar usuário"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="rotulo" htmlFor="usr-nome">Nome</label>
            <input id="usr-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <label className="rotulo" htmlFor="usr-email">E-mail</label>
            <input id="usr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={principal} placeholder="nome@empresa.com.br" autoComplete="off" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="rotulo">Perfil</label>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 text-[14px]">
              <input type="radio" name="usr-perfil" value="usuario" checked={perfil === "usuario"} onChange={() => setPerfil("usuario")} />
              <span>Usuário comum</span>
            </label>
            <label className="inline-flex items-center gap-2 text-[14px]">
              <input type="radio" name="usr-perfil" value="admin" checked={perfil === "admin"} onChange={() => setPerfil("admin")} disabled={principal} />
              <span>Administrador</span>
            </label>
          </div>
        </div>

        {perfil !== "admin" && (
          <div className="space-y-2 border-t border-line pt-3">
            <label className="rotulo">Módulos permitidos</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {AuthCore.AREAS.map((a) => (
                <label key={a.id} className="inline-flex items-start gap-2 text-[13px] cartao p-2.5 cursor-pointer hover:bg-surface-2">
                  <input type="checkbox" checked={areas.includes(a.id)} onChange={() => alternarArea(a.id)} className="mt-0.5" />
                  <div>
                    <strong className="block font-semibold">{a.nome}</strong>
                    <span className="text-[11.5px] text-muted">{a.detalhe}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {erro && <p className="text-debit text-[13px]">{erro}</p>}
      </div>
    </Janela>
  );
}

export default function Usuarios() {
  const { usuario: euMesmo, auth } = useAuth();
  const { aviso } = useAvisos();
  const [lista, setLista] = useState([
    {
      id: "usr-admin",
      nome: euMesmo?.nome || "Maurício",
      email: euMesmo?.email || AuthCore.ADMIN_EMAIL,
      perfil: "admin",
      ativo: true,
      areas: AuthCore.IDS_AREAS,
      ultimoAcesso: new Date().toISOString()
    }
  ]);
  const [form, setForm] = useState({ aberta: false, editando: null });
  const [senhaNova, setSenhaNova] = useState(null);
  const [exportandoLgpd, setExportandoLgpd] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [cnpjConfirmacao, setCnpjConfirmacao] = useState("");
  const [cienteExclusao, setCienteExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const exportarDadosLgpd = async () => {
    setExportandoLgpd(true);
    try {
      if (CONFIG.modoDemo) {
        const demoData = {
          escritorio: { razaoSocial: "Escritório Contábil Modelo Ltda", cnpj: "11.222.333/0001-81" },
          usuarios: lista,
          exportadoEm: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(demoData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dados-lgpd-demo.json";
        a.click();
        URL.revokeObjectURL(url);
        aviso("Dados de demonstração exportados com sucesso!");
        return;
      }

      const blob = await apiClient.downloadStream("/api/v1/escritorio/lgpd/exportar-dados");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-lgpd-escritorio-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      aviso("Exportação de dados (LGPD) baixada com sucesso!");
    } catch (e) {
      aviso(e.message || "Erro ao exportar dados.");
    } finally {
      setExportandoLgpd(false);
    }
  };

  const confirmarExclusaoEscritorio = async () => {
    if (!cienteExclusao) {
      aviso("Marque a confirmação de ciência antes de prosseguir.");
      return;
    }
    if (!cnpjConfirmacao.trim()) {
      aviso("Digite o CNPJ do escritório para confirmar a exclusão.");
      return;
    }
    setExcluindo(true);
    try {
      if (CONFIG.modoDemo) {
        aviso("Modo demonstração: dados resetados.");
        auth?.sair?.();
        window.location.reload();
        return;
      }

      await apiClient.post("/api/v1/escritorio/lgpd/excluir-escritorio", {
        confirmacaoCnpj: cnpjConfirmacao,
        justificativa: "Solicitação de direito ao esquecimento pelo titular."
      });

      aviso("Escritório e todos os dados foram definitivamente excluídos.");
      auth?.sair?.();
      window.location.href = "/";
    } catch (e) {
      aviso(e.message || "Erro ao excluir escritório.");
    } finally {
      setExcluindo(false);
    }
  };

  const salvarUsuario = async (dados) => {
    if (!dados.nome.trim() || !dados.email.trim()) {
      throw new Error("Preencha nome e e-mail.");
    }
    if (form.editando) {
      setLista((prev) =>
        prev.map((u) => (u.id === form.editando.id ? Object.assign({}, u, dados) : u))
      );
      aviso("Usuário atualizado.");
    } else {
      const senha = AuthCore.senhaProvisoria();
      const novo = {
        id: "usr-" + Date.now(),
        ...dados,
        trocarSenha: true,
        criadoEm: new Date().toISOString()
      };
      setLista((prev) => [...prev, novo]);
      setSenhaNova({ usuario: novo, senha });
    }
    setForm({ aberta: false, editando: null });
  };

  const alternarAtivo = (u) => {
    setLista((prev) =>
      prev.map((item) => (item.id === u.id ? { ...item, ativo: !item.ativo } : item))
    );
    aviso(u.ativo ? "Usuário desativado." : "Usuário reativado.");
  };

  const excluir = (u) => {
    if (window.confirm(`Excluir o usuário "${u.nome}"?`)) {
      setLista((prev) => prev.filter((item) => item.id !== u.id));
      aviso("Usuário excluído.");
    }
  };

  const gerarNovaSenha = (u) => {
    const s = AuthCore.senhaProvisoria();
    setSenhaNova({ usuario: u, senha: s });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Usuários da Equipe</h1>
          <p className="text-sm text-muted">Controle de acessos e permissões por módulo da Central Contábil.</p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ aberta: true, editando: null })}
          className="btn-primario text-sm"
        >
          + Novo Usuário
        </button>
      </div>

      <div className="cartao overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted text-xs uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Nome / E-mail</th>
                <th className="px-5 py-3">Perfil</th>
                <th className="px-5 py-3">Módulos Liberados</th>
                <th className="px-5 py-3">Situação</th>
                <th className="px-5 py-3">Último Acesso</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lista.map((u) => {
                const souEu = euMesmo && (euMesmo.email === u.email || euMesmo.id === u.id);
                return (
                  <tr key={u.id} className={u.ativo ? "hover:bg-surface-2/40" : "opacity-60 bg-surface-2/20"}>
                    <td className="px-5 py-3.5">
                      <strong className="block text-ink font-semibold">{u.nome}</strong>
                      <span className="text-xs text-muted">{u.email}</span>
                      {souEu && <span className="text-xs text-brand font-semibold ml-1">(você)</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.perfil === "admin" ? <Selo tipo="admin">Administrador</Selo> : <span className="text-xs font-medium">Usuário</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.perfil === "admin" ? (
                        <span className="text-xs text-muted">Todos os módulos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(u.areas || []).map((a) => (
                            <span key={a} className="text-[11px] font-medium bg-surface-2 border border-line px-1.5 py-0.5 rounded">
                              {NOME_AREA[a] || a}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Selo tipo={u.ativo ? "ativo" : "inativo"}>
                        {u.ativo ? "Ativo" : "Desativado"}
                      </Selo>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted">
                      {dataHora(u.ultimoAcesso)}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setForm({ aberta: true, editando: u })}
                        className="btn-fantasma text-xs py-1 px-2"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => gerarNovaSenha(u)}
                        className="btn-fantasma text-xs py-1 px-2"
                      >
                        Senha
                      </button>
                      {!souEu && (
                        <button
                          type="button"
                          onClick={() => alternarAtivo(u)}
                          className="btn-fantasma text-xs py-1 px-2"
                        >
                          {u.ativo ? "Desativar" : "Ativar"}
                        </button>
                      )}
                      {!souEu && (
                        <button
                          type="button"
                          onClick={() => excluir(u)}
                          className="btn-fantasma text-xs py-1 px-2 text-debit hover:bg-debit-soft"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção LGPD / Privacidade */}
      <div className="card space-y-4 border border-line bg-surface p-6 rounded-xl mt-6">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <span>🛡️</span> Privacidade e Conformidade LGPD
          </h2>
          <p className="text-xs text-muted mt-1">
            Garantias e prerrogativas do titular conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-surface-2 border border-line flex flex-col justify-between space-y-3">
            <div>
              <p className="text-sm font-semibold text-ink">Exportar Meus Dados (Art. 18 LGPD)</p>
              <p className="text-xs text-muted mt-1">
                Baixe um arquivo ZIP contendo o cadastro do escritório, empresas gerenciadas, tarefas do Em Dia, metadados de certificados e notas fiscais em formato JSON.
              </p>
            </div>
            <button
              type="button"
              disabled={exportandoLgpd}
              onClick={exportarDadosLgpd}
              className="btn-contorno text-xs py-2 w-full font-semibold"
            >
              {exportandoLgpd ? "Gerando pacote ZIP..." : "📥 Exportar Dados (ZIP)"}
            </button>
          </div>

          <div className="p-4 rounded-lg bg-debit-soft/20 border border-debit/30 flex flex-col justify-between space-y-3">
            <div>
              <p className="text-sm font-semibold text-debit">Direito ao Esquecimento (Exclusão)</p>
              <p className="text-xs text-muted mt-1">
                Solicite a exclusão irreversível de todo o escritório, apagando certificados criptografados, XMLs armazenados, empresas e histórico.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCnpjConfirmacao("");
                setCienteExclusao(false);
                setModalExcluir(true);
              }}
              className="btn-fantasma text-xs py-2 w-full font-semibold text-debit border border-debit/40 hover:bg-debit-soft"
            >
              🗑️ Excluir Escritório Definitivamente
            </button>
          </div>
        </div>
      </div>

      <FormUsuario
        aberta={form.aberta}
        editando={form.editando}
        aoSalvar={salvarUsuario}
        aoFechar={() => setForm({ aberta: false, editando: null })}
      />

      {/* Janela de Senha Provisória Gerada */}
      {senhaNova && (
        <Janela
          aberta={Boolean(senhaNova)}
          titulo="Acesso Criado com Sucesso"
          aoFechar={() => setSenhaNova(null)}
          largura="max-w-[480px]"
          rodape={
            <button type="button" className="btn-primario" onClick={() => setSenhaNova(null)}>
              Fechar
            </button>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Copie a mensagem abaixo e envie para <strong>{senhaNova.usuario.nome}</strong>:
            </p>
            <textarea
              readOnly
              rows={6}
              className="w-full text-xs font-mono p-3 bg-surface-2 rounded-lg border border-line"
              value={mensagemAcesso(senhaNova.usuario, senhaNova.senha)}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(mensagemAcesso(senhaNova.usuario, senhaNova.senha));
                aviso("Mensagem copiada para a área de transferência!");
              }}
              className="btn-contorno w-full text-xs font-semibold py-2"
            >
              📋 Copiar Mensagem de Acesso
            </button>
          </div>
        </Janela>
      )}

      {/* Janela de Confirmação de Exclusão LGPD */}
      {modalExcluir && (
        <Janela
          aberta={modalExcluir}
          titulo="⚠️ Excluir Escritório Definitivamente (LGPD)"
          aoFechar={() => setModalExcluir(false)}
          largura="max-w-[500px]"
          rodape={
            <>
              <button type="button" className="btn-fantasma" onClick={() => setModalExcluir(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-perigo"
                disabled={!cienteExclusao || !cnpjConfirmacao.trim() || excluindo}
                onClick={confirmarExclusaoEscritorio}
              >
                {excluindo ? "Excluindo..." : "Confirmar Exclusão Definitiva"}
              </button>
            </>
          }
        >
          <div className="space-y-4 text-sm text-ink">
            <p className="text-debit font-semibold text-xs bg-debit-soft/40 p-3 rounded-lg border border-debit/30">
              Atenção: Esta ação é permanente e irreversível. Todos os certificados do cofre, documentos fiscais, tarefas e contas de usuários serão destruídos.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={cienteExclusao}
                  onChange={(e) => setCienteExclusao(e.target.checked)}
                  className="mt-0.5 rounded text-debit focus:ring-debit"
                />
                <span>Estou ciente de que todos os dados e backups deste escritório serão eliminados imediatamente.</span>
              </label>
            </div>
            <div className="space-y-1.5 pt-2">
              <label className="rotulo text-xs" htmlFor="cnpj-confirma">
                Digite o CNPJ do escritório para confirmar a exclusão:
              </label>
              <input
                id="cnpj-confirma"
                placeholder="00.000.000/0000-00"
                value={cnpjConfirmacao}
                onChange={(e) => setCnpjConfirmacao(e.target.value)}
                autoComplete="off"
                className="w-full"
              />
            </div>
          </div>
        </Janela>
      )}
    </div>
  );
}

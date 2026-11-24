import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthCore, obterSessao, gravarSessao, limparSessao, podeAcessar } from "./authService.js";
import { CONFIG } from "./config.js";

const Contexto = createContext(null);

export function AuthProvider({ children }) {
  const [estado, setEstado] = useState({
    carregando: true,
    erro: "",
    auth: null,
    usuario: null
  });

  const authAdapter = useMemo(() => {
    return {
      modoTeste: !!CONFIG.modoTeste,
      apiUrl: CONFIG.apiUrl,
      precisaConfigurar: async () => false,
      usuarioAtual: async () => obterSessao(),
      entrar: async (email, senha) => {
        // Mock/demo or local auth
        const usuarioMock = {
          id: "usr-admin",
          usuarioId: "usr-admin",
          nome: "Maurício",
          email: email || AuthCore.ADMIN_EMAIL,
          perfil: "admin",
          ativo: true,
          areas: AuthCore.IDS_AREAS
        };
        gravarSessao(usuarioMock);
        return usuarioMock;
      },
      sair: async () => {
        limparSessao();
      },
      trocarSenha: async (atual, nova) => {
        const u = obterSessao();
        if (u) {
          u.trocarSenha = false;
          gravarSessao(u);
        }
        return true;
      },
      configurarAdmin: async (nome, senha) => {
        const u = {
          id: "usr-admin",
          usuarioId: "usr-admin",
          nome,
          email: AuthCore.ADMIN_EMAIL,
          perfil: "admin",
          ativo: true,
          areas: AuthCore.IDS_AREAS
        };
        gravarSessao(u);
        return u;
      }
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    try {
      const sessao = obterSessao();
      if (vivo) {
        setEstado({
          carregando: false,
          erro: "",
          auth: authAdapter,
          usuario: sessao
        });
      }
    } catch (e) {
      if (vivo) {
        setEstado({
          carregando: false,
          erro: e.message,
          auth: authAdapter,
          usuario: null
        });
      }
    }
    return () => { vivo = false; };
  }, [authAdapter]);

  const definirUsuario = useCallback((u) => {
    const usuarioFormatado = u ? Object.assign({}, u, { usuarioId: u.id || u.usuarioId }) : null;
    if (usuarioFormatado) gravarSessao(usuarioFormatado);
    else limparSessao();
    setEstado((s) => Object.assign({}, s, { usuario: usuarioFormatado }));
  }, []);

  const sair = useCallback(async () => {
    limparSessao();
    definirUsuario(null);
  }, [definirUsuario]);

  const pode = useCallback((area) => podeAcessar(estado.usuario, area), [estado.usuario]);

  const valor = useMemo(
    () => Object.assign({}, estado, { definirUsuario, sair, pode }),
    [estado, definirUsuario, sair, pode]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth() { return useContext(Contexto); }

export default AuthProvider;

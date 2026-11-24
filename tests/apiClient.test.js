// Testes do cliente HTTP oficial apiClient.mjs
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiClient, apiRequest, ApiError, getBaseUrl } from "../src/lib/apiClient.mjs";
import { gravarToken, obterToken } from "../src/lib/authService.js";

describe("apiClient — Interceptores e Resiliência HTTP", () => {
  const originalFetch = global.fetch;
  const storage = new Map();
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear()
  };

  afterEach(() => {
    global.fetch = originalFetch;
    gravarToken(null);
  });

  test("injeta cabeçalho Authorization Bearer quando existe token", async () => {
    gravarToken("token_jwt_teste_123");
    let cabecalhosCapturados = null;

    global.fetch = async (url, init) => {
      cabecalhosCapturados = init.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    const res = await apiClient.get("/api/v1/teste");
    assert.equal(res.ok, true);
    assert.equal(cabecalhosCapturados["Authorization"], "Bearer token_jwt_teste_123");
  });

  test("trata 401: limpa credenciais e dispara evento de expiração", async () => {
    gravarToken("token_expirado");
    let eventoDisparado = false;
    global.window = {
      dispatchEvent: (e) => {
        if (e.type === "makerpixel:auth_expirou") eventoDisparado = true;
      }
    };

    global.fetch = async () => {
      return new Response(JSON.stringify({ erro: "Token expirado" }), { status: 401 });
    };

    await assert.rejects(
      async () => {
        await apiClient.get("/api/v1/protegido");
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.match(err.message, /Sessão expirada/);
        return true;
      }
    );

    assert.equal(obterToken(), "");
    assert.equal(eventoDisparado, true);
  });

  test("trata 402/403: extrai mensagem do servidor para bloqueio de plano", async () => {
    global.window = { dispatchEvent: () => {} };
    global.fetch = async () => {
      return new Response(
        JSON.stringify({ mensagem: "limite do plano atingido; fale conosco para mudar de plano" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    };

    await assert.rejects(
      async () => {
        await apiClient.post("/api/v1/notasync/empresas", { cnpj: "00000000000191" });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.message, "limite do plano atingido; fale conosco para mudar de plano");
        return true;
      }
    );
  });

  test("trata 429: extrai intervalo regulamentar e horário permitido", async () => {
    global.fetch = async () => {
      return new Response(
        JSON.stringify({
          erro: "TOO_MANY_REQUESTS",
          permitidoAPartirDe: "14:35:00"
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    };

    await assert.rejects(
      async () => {
        await apiClient.post("/api/v1/notasync/buscar-agora/00000000000191");
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 429);
        assert.match(err.message, /Permitido a partir de 14:35:00/);
        assert.equal(err.retryAfter, "14:35:00");
        return true;
      }
    );
  });

  test("trata falha de rede sem derrubar o app com unhandled rejection", async () => {
    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    await assert.rejects(
      async () => {
        await apiClient.get("/api/v1/indisponivel");
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 0);
        assert.match(err.message, /Não foi possível conectar ao servidor/);
        return true;
      }
    );
  });
});

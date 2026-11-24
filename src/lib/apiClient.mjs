/**
 * apiClient.mjs — Cliente HTTP oficial para a API REST Central Contábil (Java 21 / Spring Boot / Supabase).
 *
 * Tratamento robusto e padronizado:
 * - 401: redireciona para login e limpa credenciais
 * - 402 / 403: bloqueio de plano / módulo com mensagem emitida pelo servidor
 * - 429: limite de taxa / intervalo regulamentar com extração de 'permitido a partir de'
 * - Erro de rede / timeout
 * - Zero vazamento de segredos: tokens e certificados nunca são impressos em console
 */
import { CONFIG } from "./config.js";
import { CHAVE_TOKEN, limparSessao, obterToken, gravarToken } from "./authService.js";

const DEFAULT_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  constructor(message, status, data = null, retryAfter = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.retryAfter = retryAfter;
  }
}

export function getBaseUrl() {
  const envUrl = (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : (typeof process !== "undefined" && process?.env?.VITE_API_URL)
      ? process.env.VITE_API_URL
      : "";
  return (CONFIG.apiUrl || envUrl || "").replace(/\/+$/, "");
}

/**
 * Executa requisição HTTP com interceptores, timeouts e cabeçalhos de segurança.
 */
export async function apiRequest(endpoint, {
  method = "GET",
  body = null,
  headers = {},
  timeout = DEFAULT_TIMEOUT_MS,
  isMultipart = false,
  responseType = "json"
} = {}) {
  const baseUrl = getBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const token = obterToken();
  const reqHeaders = { ...headers };

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  if (!isMultipart && body && !(body instanceof FormData) && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    let reqBody = body;
    if (body && !isMultipart && !(body instanceof FormData) && typeof body !== "string") {
      reqBody = JSON.stringify(body);
    }

    const response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: reqBody,
      signal: controller.signal
    });

    clearTimeout(timer);

    // 401 Unauthorized -> Sessão expirada
    if (response.status === 401) {
      limparSessao();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("makerpixel:auth_expirou"));
      }
      throw new ApiError("Sessão expirada. Por favor, entre novamente.", 401);
    }

    // 402 Payment Required ou 403 Forbidden -> Limite de plano ou módulo
    if (response.status === 402 || response.status === 403) {
      let erroMsg = response.status === 402
        ? "Limite do plano atingido; fale conosco para mudar de plano."
        : "Acesso não autorizado para o módulo ou operação.";
      let errData = null;
      try {
        errData = await response.json();
        if (errData?.mensagem || errData?.erro || errData?.message) {
          erroMsg = errData.mensagem || errData.erro || errData.message;
        }
      } catch {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("makerpixel:plano_bloqueado", { detail: { mensagem: erroMsg, status: response.status } }));
      }
      throw new ApiError(erroMsg, response.status, errData);
    }

    // 429 Too Many Requests -> Intervalo regulamentar
    if (response.status === 429) {
      let retryAfter = response.headers.get("Retry-After");
      let msg = "Operação em intervalo regulamentar. Tente novamente mais tarde.";
      let errData = null;
      try {
        errData = await response.json();
        const p = errData?.permitidoAPartirDe || errData?.permitido_a_partir_de || errData?.mensagem || errData?.message;
        if (p) {
          msg = `Operação em intervalo regulamentar. Permitido a partir de ${p}`;
          retryAfter = p;
        }
      } catch {}
      throw new ApiError(msg, 429, errData, retryAfter);
    }

    // Erros HTTP 4xx / 5xx
    if (!response.ok) {
      let erroMsg = `Erro na requisição (${response.status})`;
      let errData = null;
      try {
        errData = await response.json();
        if (errData?.mensagem || errData?.erro || errData?.message) {
          erroMsg = errData.mensagem || errData.erro || errData.message;
        }
      } catch {
        try {
          const txt = await response.text();
          if (txt) erroMsg = txt;
        } catch {}
      }
      throw new ApiError(erroMsg, response.status, errData);
    }

    if (response.status === 204) {
      return null;
    }

    if (responseType === "blob") {
      return await response.blob();
    }
    if (responseType === "text") {
      return await response.text();
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new ApiError("Tempo limite de conexão esgotado. Verifique sua conexão.", 408);
    }
    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique sua conexão com a internet.",
      0,
      null
    );
  }
}

export const apiClient = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: "POST", body }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: "PUT", body }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: "PATCH", body }),
  del: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: "DELETE" }),
  upload: (endpoint, formData, options = {}) => apiRequest(endpoint, { ...options, method: "POST", body: formData, isMultipart: true }),
  downloadStream: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: "GET", responseType: "blob" })
};

export default apiClient;

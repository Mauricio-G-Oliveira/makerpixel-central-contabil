/*
 * config.js — configurações do sistema e variáveis de ambiente.
 */
const env = (typeof import.meta !== "undefined" && import.meta?.env)
  ? import.meta.env
  : (typeof process !== "undefined" && process?.env)
    ? process.env
    : {};

export const CONFIG = {
  modoTeste: false,
  apiUrl: env.VITE_API_URL || "",
  modoDemo: env.VITE_MODO_DEMO === "true",
  versao: "4.0.0",
  suporte: {
    nome: "Mauricio",
    papel: "TI · desenvolvimento do sistema",
    whatsapp: "5548991781362"
  }
};

export default CONFIG;

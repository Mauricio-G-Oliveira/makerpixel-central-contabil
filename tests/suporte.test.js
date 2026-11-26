// Botão de suporte: utilitários de suporte e mensagens de atendimento.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Suporte as S } from "../src/lib/suporte.js";
import { CONFIG } from "../src/lib/config.js";

test("mensagem com assunto, texto e contexto", () => {
  const m = S.mensagem({
    tipo: "problema",
    texto: "Erro ao consultar DF-e",
    tela: "NotaSync",
    usuario: "Ana Exemplo · ana@exemplo.com",
    atendente: "Mauricio"
  });
  assert.equal(
    m,
    "Olá Mauricio, tenho uma problema no Central Contábil.\n\nErro ao consultar DF-e\n\nTela: NotaSync\nUsuário: Ana Exemplo · ana@exemplo.com"
  );
});

test("sem texto e sem usuário (tela de login), vira uma dúvida", () => {
  const m = S.mensagem({ tela: "Tela de login" });
  assert.match(m, /^Olá, tenho uma dúvida no Central Contábil\./);
  assert.ok(!/Usuário:/.test(m));
});

test("link do WhatsApp com o texto codificado", () => {
  assert.equal(S.linkWhatsApp("5548991781362", "a b&c"), "https://wa.me/5548991781362?text=a%20b%26c");
});

test("número legível", () => {
  assert.equal(S.numeroLegivel("5548991781362"), "+55 (48) 99178-1362");
  assert.equal(S.numeroLegivel("4832221234"), "4832221234");
});

test("o número configurado é válido", () => {
  assert.match(CONFIG.suporte.whatsapp, /^55\d{10,11}$/);
});

test("Suporte.jsx importa corretamente todos os hooks do React utilizados", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const conteudo = fs.readFileSync(path.resolve("src/componentes/Suporte.jsx"), "utf-8");
  assert.match(conteudo, /import\s+{[^}]*\buseState\b[^}]*}\s+from\s+["']react["']/);
  assert.match(conteudo, /import\s+{[^}]*\buseEffect\b[^}]*}\s+from\s+["']react["']/);
  assert.match(conteudo, /import\s+{[^}]*\buseRef\b[^}]*}\s+from\s+["']react["']/);
});

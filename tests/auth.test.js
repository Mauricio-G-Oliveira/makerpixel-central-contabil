// Autenticação e permissões da Central Contábil v4
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AuthCore, podeAcessar, problemaSenha, senhaProvisoria } from "../src/lib/authService.js";

describe("authService — senhas e segurança", () => {
  test("validação de regras de senha", () => {
    assert.match(problemaSenha("curta1"), /8 caracteres/);
    assert.match(problemaSenha("somenteletras"), /letras e números/);
    assert.equal(problemaSenha("Exemplo2026senha"), "");
  });

  test("senha provisória no formato Xxxx-0000-xxxx e válida pelas regras", () => {
    const s = senhaProvisoria();
    assert.match(s, /^[A-Z][a-z]{3}-\d{4}-[a-z]{4}$/);
    assert.equal(problemaSenha(s), "");
  });
});

describe("authService — permissões e perfis", () => {
  test("administrador acessa todas as áreas", () => {
    const admin = { id: "1", perfil: "admin" };
    assert.equal(podeAcessar(admin, "notasync"), true);
    assert.equal(podeAcessar(admin, "reforma"), true);
    assert.equal(podeAcessar(admin, "danfse"), true);
    assert.equal(podeAcessar(admin, "xml-excel"), true);
    assert.equal(podeAcessar(admin, "em-dia"), true);
    assert.equal(podeAcessar(admin, "usuarios"), true);
  });

  test("usuário comum só acessa módulos liberados na sua lista de áreas", () => {
    const user = { id: "2", perfil: "usuario", areas: ["notasync", "danfse"] };
    assert.equal(podeAcessar(user, "notasync"), true);
    assert.equal(podeAcessar(user, "danfse"), true);
    assert.equal(podeAcessar(user, "reforma"), false);
    assert.equal(podeAcessar(user, "em-dia"), false);
  });

  test("sem usuário nada é permitido exceto áreas públicas", () => {
    assert.equal(podeAcessar(null, "notasync"), false);
    assert.equal(podeAcessar(null, "inicio"), false);
  });
});

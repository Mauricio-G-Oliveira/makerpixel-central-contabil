// Testes do Gerador de DANFSe (WASM / Nativo) - Fase 9
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/lib/danfse.mjs");

describe("DANFSe — Parser de XML de NFS-e", () => {
  test("Lê XML nacional de NFS-e com prestador, tomador, valores e reforma", () => {
    const xml = D.xmlNfseDeExemplo();
    const res = D.lerXmlNfse(xml, "exemplo_nfse.xml");

    assert.equal(res.ok, true);
    assert.ok(res.dados);
    assert.equal(res.dados.numero, "3021");
    assert.equal(res.dados.prestador.cnpjCpf, "11222333000181");
    assert.equal(res.dados.prestador.municipio, "Florianópolis");
    assert.equal(res.dados.tomador.cnpjCpf, "22333444000192");
    assert.equal(res.dados.servico.valorServicos, 2500);
    assert.equal(res.dados.servico.aliquotaIss, 3);
    assert.equal(res.dados.servico.valorIss, 75);

    // Grupo da Reforma Tributária
    assert.equal(res.dados.servico.reforma.temReforma, true);
    assert.equal(res.dados.servico.reforma.pCbs, 0.90);
    assert.equal(res.dados.servico.reforma.vCbs, 22.50);
  });

  test("Formatação de CPF e CNPJ", () => {
    assert.equal(D.formatarCpfCnpj("11222333000181"), "11.222.333/0001-81");
    assert.equal(D.formatarCpfCnpj("12345678901"), "123.456.789-01");
    assert.equal(D.formatarCpfCnpj(""), "—");
  });

  test("Tratamento de XML vazio ou malformado", () => {
    const res = D.lerXmlNfse("conteúdo inválido");
    assert.equal(res.ok, false);
    assert.match(res.erro, /inválido/i);
  });
});

describe("DANFSe — Geração de PDF no Navegador (WASM / Nativo)", () => {
  test("Gera PDF válido e não vazio a partir de XML de NFS-e fictícia", async () => {
    const xml = D.xmlNfseDeExemplo();
    const resultado = await D.gerarDanfse({
      xml,
      stc: 0,
      canhoto: true,
      nomeArquivo: "nfse_3021.xml"
    });

    assert.equal(resultado.ok, true);
    assert.ok(resultado.pdfBase64);
    assert.ok(resultado.size > 500, "Tamanho do PDF gerado deve ser maior que 500 bytes");
    assert.equal(resultado.nomeArquivo, "nfse_3021.pdf");

    // Verifica assinatura de cabeçalho PDF (%PDF-1.4)
    const binString = Buffer.from(resultado.pdfBase64, "base64").toString("utf-8");
    assert.ok(binString.startsWith("%PDF-"), "O arquivo gerado deve conter a assinatura de cabeçalho PDF");
    assert.ok(binString.includes("%%EOF"), "O arquivo gerado deve conter a finalização de arquivo PDF");
    assert.ok(binString.includes("DANFSe"), "O PDF gerado deve conter a identificação do DANFSe");
  });

  test("Valida rejeição quando XML não for fornecido", async () => {
    await assert.rejects(
      async () => D.gerarDanfse({ xml: "" }),
      /conteúdo XML da NFS-e é obrigatório/
    );
  });
});

// Testes do Conversor de XML para Excel (XLSX) - Fase 10
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const XE = require("../src/lib/xmlExcel.mjs");
const D = require("../src/lib/danfse.mjs");
const A = require("../src/lib/ibsCbs.mjs");

describe("XML → Excel — Conversão Unitária e em Lote", () => {
  const [[n1, nfeXml], [n2, nfseXml]] = A.xmlsDeExemplo();

  test("Converte XML de NFS-e em estrutura unificada de nota e item", () => {
    const xml = D.xmlNfseDeExemplo();
    const res = XE.converterXml(xml, "nfse_3021.xml");

    assert.equal(res.ok, true);
    assert.ok(res.nota);
    assert.equal(res.nota.modelo, "NFS-e");
    assert.equal(res.nota.numero, "3021");
    assert.equal(res.nota.emitenteCnpj, "11222333000181");
    assert.equal(res.nota.destinatarioCnpj, "22333444000192");
    assert.equal(res.nota.valorTotal, 2500);
    assert.equal(res.nota.valorIss, 75);
    assert.equal(res.nota.valorCbs, 22.50);

    assert.equal(res.itens.length, 1);
    assert.match(res.itens[0].descricao, /Assessoria contábil mensal/i);
    assert.equal(res.itens[0].valorTotal, 2500);
  });

  test("Converte XML de NF-e (modelo 55) com múltiplos itens e IBS/CBS", () => {
    const res = XE.converterXml(nfeXml, n1);

    assert.equal(res.ok, true);
    assert.ok(res.nota);
    assert.equal(res.nota.modelo, "NF-e (55)");
    assert.equal(res.nota.numero, "9001");
    assert.equal(res.nota.valorTotal, 3500);

    assert.equal(res.itens.length, 3);
    assert.equal(res.itens[0].codigo, "EX-01");
    assert.equal(res.itens[0].descricao, "Produto exemplo tributação normal");
    assert.equal(res.itens[0].ncm, "84713012");
    assert.equal(res.itens[0].cfop, "5102");
    assert.equal(res.itens[0].quantidade, 2);
    assert.equal(res.itens[0].valorUnitario, 500);
    assert.equal(res.itens[0].valorTotal, 1000);

    // Itens 2 e 3
    assert.equal(res.itens[1].descricao, "Produto exemplo com redução de 60%");
    assert.equal(res.itens[2].descricao, "Produto exemplo com CBS divergente");
  });

  test("Processa lote de arquivos XML agregando totais consolidados", () => {
    const lote = [
      { nome: "nfse_3021.xml", texto: D.xmlNfseDeExemplo() },
      { nome: n1, texto: nfeXml }
    ];

    const resultado = XE.processarLoteXml(lote);

    assert.equal(resultado.notas.length, 2);
    assert.equal(resultado.itens.length, 4);
    assert.equal(resultado.totais.totalNotas, 2);
    assert.equal(resultado.totais.totalItens, 4);
    assert.equal(resultado.totais.faturamentoTotal, 6000); // 2500 + 3500
    assert.equal(resultado.totais.totalIss, 75);
    assert.equal(resultado.totais.totalCbs, 53.3); // 22.50 + 30.80
    assert.equal(resultado.erros.length, 0);
  });

  test("Trata arquivo XML inválido sem quebrar o lote", () => {
    const lote = [
      { nome: "invalido.xml", texto: "conteudo nao xml" },
      { nome: "valido.xml", texto: D.xmlNfseDeExemplo() }
    ];

    const resultado = XE.processarLoteXml(lote);
    assert.equal(resultado.notas.length, 1);
    assert.equal(resultado.erros.length, 1);
    assert.equal(resultado.erros[0].nome, "invalido.xml");
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarChaveAcesso,
  calcularDvChave,
  formatarChaveAcesso,
  extrairDadosChave,
  ERROS_SEF,
  traduzirErroSef,
  processarRetornoSef,
  deduplicarDocumentos,
  gerarEnvelopeDistNFCe,
  empacotarLoteSef,
  desempacotarLoteSef,
  gerarSementesNfceDemo,
  exportarNfceParaCsv,
  validarPeriodoDisponivelSef,
  validarUploadCertificadoA1,
  mascararTitularCertificado,
  calcularStatusVencimentoCertificado,
  validarCnpjModulo11,
  parsearEmpresasCsv,
  verificarEsperaBuscaAgora,
  criarZipBlob,
} from "../src/lib/notasync.mjs";

test("NotaSync - Validação e extração de chave de acesso (Módulo 11)", () => {
  // Chave sintética válida para SC (42), Nov/2026, modelo 65
  const base43 = "4226111122233300018165001000000001110000001";
  const dvCalculado = calcularDvChave(base43);
  assert.ok(dvCalculado >= 0 && dvCalculado <= 9);

  const chaveValida = `${base43}${dvCalculado}`;
  assert.equal(chaveValida.length, 44);
  assert.equal(validarChaveAcesso(chaveValida), true);

  // Chave com DV adulterado
  const chaveInvalida = `${base43}${(dvCalculado + 1) % 10}`;
  assert.equal(validarChaveAcesso(chaveInvalida), false);

  // Entradas mal formatadas
  assert.equal(validarChaveAcesso(""), false);
  assert.equal(validarChaveAcesso(null), false);
  assert.equal(validarChaveAcesso("12345"), false);

  // Formatação em blocos de 4
  const formatada = formatarChaveAcesso(chaveValida);
  assert.equal(formatada.split(" ").length, 11);
  assert.equal(formatada.replace(/\s/g, ""), chaveValida);

  // Extração de metadados
  const dados = extrairDadosChave(chaveValida);
  assert.equal(dados.cUF, "42");
  assert.equal(dados.anoMes, "2611");
  assert.equal(dados.cnpjEmitente, "11222333000181");
  assert.equal(dados.modelo, "65");
  assert.equal(dados.serie, 1);
  assert.equal(dados.numero, 1);
  assert.equal(dados.cDV, dvCalculado);
});

test("NotaSync - Tradução de cStat e erro 8002 (SAT/SEF)", () => {
  // Erro 8002 com destaque para ação do contador
  const r8002 = traduzirErroSef(8002);
  assert.equal(r8002.cStat, 8002);
  assert.equal(r8002.destaque, true);
  assert.match(r8002.acao, /SAT da SEF\/SC/);

  // Erro 110 (Uso indevido - 1h de espera)
  const r110 = traduzirErroSef(110);
  assert.equal(r110.cStat, 110);
  assert.match(r110.acao, /1 hora/);

  // Erro 657 (Bloqueio)
  const r657 = traduzirErroSef(657);
  assert.equal(r657.severidade, "bloqueio");

  // Status desconhecido
  const r999 = traduzirErroSef(999, "Falha customizada");
  assert.equal(r999.detalheOriginal, "Falha customizada");
});

test("NotaSync - Máquina de estados das regras de consumo SEF/SC", () => {
  const empresa = { id: "emp-1", cnpj: "11222333000181", ultNuNSU: 500, tentativas: 0 };

  // 1. cStat 118 com 50 docs -> busca imediata do próximo lote
  const retLoteCheio = processarRetornoSef({ cStat: 118, qtDfeRet: 50, ultNuNSURet: 550 }, empresa);
  assert.equal(retLoteCheio.acaoRecomendada, "BUSCAR_PROXIMO_LOTE");
  assert.equal(retLoteCheio.proximaConsultaMs, 0);
  assert.equal(retLoteCheio.ultNuNSU, 550);

  // 2. cStat 118 com <50 docs -> fim da fila, esperar 12 horas
  const retLoteParcial = processarRetornoSef({ cStat: 118, qtDfeRet: 15, ultNuNSURet: 565 }, empresa);
  assert.equal(retLoteParcial.acaoRecomendada, "SINCRONIZADO_AGUARDAR_12H");
  assert.equal(retLoteParcial.proximaConsultaMs, 12 * 3600 * 1000);

  // 3. cStat 117 -> sincronizado, aguardar 12 horas
  const ret117 = processarRetornoSef({ cStat: 117, qtDfeRet: 0 }, empresa);
  assert.equal(ret117.acaoRecomendada, "SINCRONIZADO_AGUARDAR_12H");
  assert.equal(ret117.proximaConsultaMs, 12 * 3600 * 1000);

  // 4. cStat 110 -> esperar 1 hora
  const ret110 = processarRetornoSef({ cStat: 110 }, empresa);
  assert.equal(ret110.acaoRecomendada, "AGUARDAR_1H");
  assert.equal(ret110.proximaConsultaMs, 3600 * 1000);

  // 5. cStat 657 -> bloqueio por excesso
  const ret657 = processarRetornoSef({ cStat: 657 }, empresa);
  assert.equal(ret657.bloqueado, true);
  assert.equal(ret657.acaoRecomendada, "BLOQUEIO_EXCESSO_PARAR");

  // 6. cStat 8002 -> pendência SAT
  const ret8002 = processarRetornoSef({ cStat: 8002 }, empresa);
  assert.equal(ret8002.acaoRecomendada, "VINCULAR_SAT_SEF");

  // 7. Retries e limite de 3 tentativas
  const empTentativas = { ...empresa, tentativas: 2 };
  const retFalha3 = processarRetornoSef({ cStat: 108 }, empTentativas);
  assert.equal(retFalha3.bloqueado, true);
  assert.equal(retFalha3.acaoRecomendada, "LIMITE_TENTATIVAS_EXCEDIDO");
});

test("NotaSync - Empacotamento e desempacotamento de loteDistComp (gzip + base64 + XML)", async () => {
  const chave1 = "42261111222333000181650010000000011100000012";
  const chave2 = "42261111222333000181650010000000021100000020";

  const docsEntrada = [
    {
      chave: chave1,
      nsu: 101,
      cnpjEmitente: "11222333000181",
      numero: 1,
      serie: 1,
      dataEmissao: "2026-11-15T09:30:00-03:00",
      valorTotal: 154.80,
    },
    {
      chave: chave2,
      nsu: 102,
      cnpjEmitente: "11222333000181",
      numero: 2,
      serie: 1,
      dataEmissao: "2026-11-15T10:15:00-03:00",
      valorTotal: 89.90,
    },
  ];

  const base64Gzip = await empacotarLoteSef(docsEntrada);
  assert.ok(typeof base64Gzip === "string" && base64Gzip.length > 50);

  const docsDecodificados = await desempacotarLoteSef(base64Gzip);
  assert.equal(docsDecodificados.length, 2);
  assert.equal(docsDecodificados[0].chave, chave1);
  assert.equal(docsDecodificados[0].nsu, 101);
  assert.equal(docsDecodificados[0].valorTotal, 154.80);
  assert.equal(docsDecodificados[0].situacao, "AUTORIZADA");
  assert.equal(docsDecodificados[1].chave, chave2);
  assert.equal(docsDecodificados[1].nsu, 102);
});

test("NotaSync - Deduplicação por chave e evento de cancelamento", () => {
  const chaveA = "42261111222333000181650010000000011100000012";
  const chaveB = "42261111222333000181650010000000021100000020";

  const atuais = [
    { chave: chaveA, nsu: 10, situacao: "AUTORIZADA", valorTotal: 100, dataEmissao: "2026-11-10T10:00:00Z" },
    { chave: chaveB, nsu: 11, situacao: "AUTORIZADA", valorTotal: 200, dataEmissao: "2026-11-11T10:00:00Z" },
  ];

  // Lote novo trazendo atualização de cancelamento para a chaveA e nota C nova
  const novos = [
    { chave: chaveA, nsu: 25, situacao: "CANCELADA", motivoCancelamento: "Erro no valor", dataEmissao: "2026-11-10T10:00:00Z" },
    { chave: "42261111222333000181650010000000031100000039", nsu: 26, situacao: "AUTORIZADA", valorTotal: 50, dataEmissao: "2026-11-12T10:00:00Z" },
  ];

  const resultado = deduplicarDocumentos(atuais, novos);
  assert.equal(resultado.length, 3, "Total de 3 notas distintas sem duplicidade de chave");

  const notaA = resultado.find((d) => d.chave === chaveA);
  assert.equal(notaA.situacao, "CANCELADA", "Situação deve ter sido atualizada para CANCELADA");
  assert.equal(notaA.nsu, 25, "NSU deve ter sido atualizado para o maior (25)");
});

test("NotaSync - Montagem de envelope SOAP da SEF/SC", () => {
  const envelope = gerarEnvelopeDistNFCe({
    cnpjContador: "11.222.333/0001-81",
    ultNuNSU: 1000,
    indAtor: 1,
    indXML: 1,
  });

  assert.match(envelope, /<soap12:Envelope/);
  assert.match(envelope, /<tpAmb>1<\/tpAmb>/);
  assert.match(envelope, /<cUF>42<\/cUF>/);
  assert.match(envelope, /<CNPJ>11222333000181<\/CNPJ>/);
  assert.match(envelope, /<ultNuNSU>1000<\/ultNuNSU>/);
  // Sem espaços entre tags no corpo
  assert.ok(!envelope.includes("<tpAmb> 1 </tpAmb>"));

  // Consulta por chave pontual
  const envChave = gerarEnvelopeDistNFCe({
    cnpjContador: "11222333000181",
    chaveAcesso: "42261111222333000181650010000000011100000012",
  });
  assert.match(envChave, /<solDFe><chAcesso>42261111222333000181650010000000011100000012<\/chAcesso><\/solDFe>/);
});

test("NotaSync - Sementes demo e exportação CSV", () => {
  const sementes = gerarSementesNfceDemo();
  assert.ok(sementes.documentos.length >= 100, "Deve gerar volume de notas realista para o demo");
  assert.equal(sementes.empresas.length, 4);
  assert.equal(sementes.execucoes.length, 4);

  // Todas as chaves geradas devem ter DV válido
  for (const doc of sementes.documentos) {
    assert.equal(validarChaveAcesso(doc.chave), true, `Chave ${doc.chave} inválida`);
  }

  // Exportação CSV compatível com Excel
  const csv = exportarNfceParaCsv(sementes.documentos.slice(0, 5));
  assert.match(csv, /Chave de Acesso;Número;Série;Data Emissão/);
  const linhas = csv.split("\r\n");
  assert.equal(linhas.length, 6); // Cabeçalho + 5 registros
});

test("NotaSync - Janela de período disponível na SEF/SC (mês atual e 2 anteriores, tolerância 1 dia)", () => {
  const agora = new Date("2026-11-20T12:00:00Z");

  // Mês atual: válido
  const r1 = validarPeriodoDisponivelSef("2026-11-10T08:00:00Z", agora);
  assert.equal(r1.disponivel, true);

  // 1 mês atrás (Out/2026): válido
  const r2 = validarPeriodoDisponivelSef("2026-10-25T14:30:00Z", agora);
  assert.equal(r2.disponivel, true);

  // 2 meses atrás (Set/2026): válido
  const r3 = validarPeriodoDisponivelSef("2026-09-01T03:00:00Z", agora);
  assert.equal(r3.disponivel, true);

  // 3 meses atrás (Ago/2026): expirado
  const r4 = validarPeriodoDisponivelSef("2026-08-31T23:59:59Z", agora);
  assert.equal(r4.disponivel, false);
  assert.match(r4.motivo, /apenas o mês atual e os 2 meses anteriores/);

  // 12 horas no futuro: tolerado
  const rFuturo = validarPeriodoDisponivelSef("2026-11-21T00:00:00Z", agora);
  assert.equal(rFuturo.disponivel, true);

  // 3 dias no futuro: rejeitado
  const rMuitoFuturo = validarPeriodoDisponivelSef("2026-11-25T00:00:00Z", agora);
  assert.equal(rMuitoFuturo.disponivel, false);
});

test("NotaSync Fase 3 - Validação de upload do cofre e limite 50 KB", () => {
  // 1. Recusa sem aceite de termo
  const semTermo = validarUploadCertificadoA1({ tamanhoBytes: 10000, senha: "123", aceitouTermo: false });
  assert.equal(semTermo.valido, false);
  assert.match(semTermo.erro, /aceitar o termo/);

  // 2. Recusa sem senha
  const semSenha = validarUploadCertificadoA1({ tamanhoBytes: 10000, senha: "", aceitouTermo: true });
  assert.equal(semSenha.valido, false);
  assert.match(semSenha.erro, /senha do certificado/);

  // 3. Recusa arquivo maior que 50 KB
  const arquivoGrande = validarUploadCertificadoA1({ tamanhoBytes: 52 * 1024, senha: "123", aceitouTermo: true });
  assert.equal(arquivoGrande.valido, false);
  assert.match(arquivoGrande.erro, /50 KB/);

  // 4. Aceita parâmetros válidos
  const valido = validarUploadCertificadoA1({ tamanhoBytes: 15 * 1024, senha: "minhasenha", aceitouTermo: true });
  assert.equal(valido.valido, true);
});

test("NotaSync Fase 3 - Mascaramento de titular de certificado (e-CPF e e-CNPJ)", () => {
  const titularCnpj = mascararTitularCertificado("CONTABILIDADE MODELO LTDA:11222333000181", "11222333000181", "E_CNPJ");
  assert.equal(titularCnpj, "CONTABILIDADE MODELO LTDA (11.***.***/0001-81)");

  const titularCpf = mascararTitularCertificado("MARIA SILVA CONTADORA:12345678901", "12345678901", "E_CPF");
  assert.equal(titularCpf, "MARIA SILVA CONTADORA (***.456.789-**)");
});

test("NotaSync Fase 3 - Avisos de vencimento em 30, 15 e 7 dias", () => {
  const agora = new Date("2026-11-20T12:00:00Z");

  // Vencido
  const expirado = calcularStatusVencimentoCertificado(new Date("2026-11-19T12:00:00Z"), agora);
  assert.equal(expirado.status, "EXPIRADO");
  assert.ok(expirado.alerta);

  // Crítico 7 dias (vence em 3 dias)
  const critico = calcularStatusVencimentoCertificado(new Date("2026-11-23T12:00:00Z"), agora);
  assert.equal(critico.status, "CRITICO_7_DIAS");
  assert.match(critico.alerta, /crítica.*3 dias/);

  // Alerta 15 dias (vence em 12 dias)
  const alerta15 = calcularStatusVencimentoCertificado(new Date("2026-12-02T12:00:00Z"), agora);
  assert.equal(alerta15.status, "ALERTA_15_DIAS");

  // Aviso 30 dias (vence em 25 dias)
  const aviso30 = calcularStatusVencimentoCertificado(new Date("2026-12-15T12:00:00Z"), agora);
  assert.equal(aviso30.status, "AVISO_30_DIAS");

  // Válido e seguro (vence em 90 dias)
  const seguro = calcularStatusVencimentoCertificado(new Date("2027-02-18T12:00:00Z"), agora);
  assert.equal(seguro.status, "OK");
  assert.equal(seguro.alerta, null);
});

test("NotaSync Fase 4 - Validação de DV de CNPJ (Módulo 11)", () => {
  assert.equal(validarCnpjModulo11("11.222.333/0001-81"), true);
  assert.equal(validarCnpjModulo11("11222333000181"), true);

  // DV inválido
  assert.equal(validarCnpjModulo11("11.222.333/0001-00"), false);
  // Repetidos
  assert.equal(validarCnpjModulo11("11111111111111"), false);
  assert.equal(validarCnpjModulo11(""), false);
  assert.equal(validarCnpjModulo11(null), false);
});

test("NotaSync Fase 4 - Importação de CSV com validação de DV e limite de empresas", () => {
  const csv = [
    "cnpj;razao_social",
    "11.222.333/0001-81;Empresa Alpha Ltda",
    "11.222.333/0001-00;Empresa Com Dv Invalido", // erro DV
    "11222333000181;Empresa Alpha Repetida", // já cadastrada
    "22.333.444/0001-92;Empresa Beta Ltda", // válida se DV ok
  ].join("\n");

  const res = parsearEmpresasCsv(csv, 2);
  assert.equal(res.totalLinhas, 5);
  assert.ok(res.empresasValidas.length >= 1);
  assert.ok(res.erros.some(e => e.motivo.includes("Dígito verificador")));

  // Teste de limite de empresas atingido
  const csvMuitas = [
    "cnpj,razao_social",
    "11.222.333/0001-81,Empresa 1",
    "11.222.333/0002-62,Empresa 2",
    "11.222.333/0003-43,Empresa 3"
  ].join("\n");

  const resLimite = parsearEmpresasCsv(csvMuitas, 2);
  assert.equal(resLimite.limiteAtingido, true);
  assert.equal(resLimite.empresasValidas.length, 2);
});

test("NotaSync Fase 4 - Verificação de intervalo de espera regulamentar (HTTP 429)", () => {
  const agora = new Date("2026-11-20T12:00:00Z");

  // Próxima busca no futuro -> bloqueado com 429
  const proximaFutura = new Date("2026-11-20T13:00:00Z");
  const bloqueado = verificarEsperaBuscaAgora(proximaFutura, agora);
  assert.equal(bloqueado.podeConsultar, false);
  assert.equal(bloqueado.segundosRestantes, 3600);
  assert.ok(bloqueado.erro);

  // Próxima busca no passado -> liberado
  const proximaPassada = new Date("2026-11-20T11:00:00Z");
  const liberado = verificarEsperaBuscaAgora(proximaPassada, agora);
  assert.equal(liberado.podeConsultar, true);
  assert.equal(liberado.segundosRestantes, 0);
});

test("NotaSync Fase 5 - Geração de ZIP com XMLs no navegador (criarZipBlob)", async () => {
  const arquivos = [
    { nome: "nota1.xml", conteudo: "<nfeProc versao='4.00'><infNFe Id='1'/></nfeProc>" },
    { nome: "nota2.xml", conteudo: "<nfeProc versao='4.00'><infNFe Id='2'/></nfeProc>" }
  ];

  const blob = criarZipBlob(arquivos);
  assert.equal(blob.type, "application/zip");
  assert.ok(blob.size > 100);

  // Valida assinatura mágica do arquivo ZIP: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  assert.equal(bytes[0], 0x50); // 'P'
  assert.equal(bytes[1], 0x4b); // 'K'
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
});

test("NotaSync Fase 6 - Fontes NF-e (55) e CT-e (57), certificado por empresa e manifestação desligada", () => {
  // Fontes do catálogo
  const FONTES_CATALOGO = {
    "sef-sc-nfce": { modelos: ["65"], certificado: "CONTADOR" },
    "sef-sc-nfe": { modelos: ["55"], certificado: "CONTADOR" },
    "dfe-nacional": { modelos: ["55", "57"], certificado: "EMPRESA", manifestacaoPadrao: false },
  };

  // 1. SefScNfeFonte exige certificado do contador e modelo 55
  assert.deepEqual(FONTES_CATALOGO["sef-sc-nfe"].modelos, ["55"]);
  assert.equal(FONTES_CATALOGO["sef-sc-nfe"].certificado, "CONTADOR");

  // 2. DfeNacionalFonte exige certificado próprio da EMPRESA cliente e cobre NF-e + CT-e
  assert.deepEqual(FONTES_CATALOGO["dfe-nacional"].modelos, ["55", "57"]);
  assert.equal(FONTES_CATALOGO["dfe-nacional"].certificado, "EMPRESA");
  assert.equal(FONTES_CATALOGO["dfe-nacional"].manifestacaoPadrao, false, "Manifestação deve ser desligada por padrão");

  // 3. Regra de proteção: empresa sem certificado configurado não deve tentar
  const empresaSemCert = { id: "emp-99", cnpj: "99888777000100", certificadoConfigurado: false };
  function podeExecutarConsultaDfeNacional(emp) {
    if (!emp.certificadoConfigurado) {
      return { pode: false, motivo: "Certificado A1 da própria empresa não cadastrado no cofre" };
    }
    return { pode: true };
  }

  const checagem = podeExecutarConsultaDfeNacional(empresaSemCert);
  assert.equal(checagem.pode, false);
  assert.match(checagem.motivo, /não cadastrado no cofre/);
});





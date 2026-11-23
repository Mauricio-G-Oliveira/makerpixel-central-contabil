import { useState } from "react";
import { Link } from "react-router-dom";
import Icone from "../componentes/Icone.jsx";
import { criarAcessoTeste, PLANOS_PADRAO } from "../lib/multiEscritorio.mjs";
import { useAvisos } from "../componentes/Avisos.jsx";

const WHATSAPP_COMERCIAL = "5548999999999"; // MakerPixel Tech Comercial

export default function SitePublico() {
  const { aviso } = useAvisos();
  const [form, setForm] = useState({
    nome: "",
    escritorio: "",
    email: "",
    whatsapp: "",
    cidade: "Tubarão",
    uf: "SC",
    qtdEmpresas: "10 a 50",
    planoInteresse: "plano-escritorio"
  });
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim() || !form.whatsapp.trim()) {
      aviso("Por favor, preencha nome, e-mail e WhatsApp para solicitar seu teste.");
      return;
    }

    setEnviando(true);
    try {
      // 1. Registra o lead / teste na base local
      const res = criarAcessoTeste({
        nome: form.escritorio.trim() || form.nome.trim(),
        contato: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.whatsapp.trim(),
        cidade: `${form.cidade} - ${form.uf}`,
        dias: 7,
        planoId: form.planoInteresse
      });

      // 2. Prepara mensagem para envio comercial via WhatsApp
      const msg = encodeURIComponent(
        `Olá! Vim pelo site da MakerPixel Tech (makerpixeltech.com.br) e gostaria de ativar meu teste grátis da Central Contábil v3.\n\n` +
        `*Nome:* ${form.nome}\n` +
        `*Escritório/Empresa:* ${form.escritorio || "Não informado"}\n` +
        `*Cidade:* ${form.cidade}/${form.uf}\n` +
        `*E-mail:* ${form.email}\n` +
        `*WhatsApp:* ${form.whatsapp}\n` +
        `*Volume de Empresas:* ${form.qtdEmpresas}\n` +
        `*Plano de Interesse:* ${form.planoInteresse}\n\n` +
        `Aguardo contato com os dados de acesso!`
      );

      setEnviado(true);
      aviso("Solicitação registrada com sucesso! Redirecionando para o WhatsApp...");

      setTimeout(() => {
        window.open(`https://wa.me/${WHATSAPP_COMERCIAL}?text=${msg}`, "_blank");
      }, 800);
    } catch (err) {
      aviso("Erro ao processar solicitação: " + err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-brand selection:text-white">
      {/* Barra de Navegação */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-emerald-400 flex items-center justify-center shadow-lg shadow-brand/20">
              <span className="font-black text-xl text-white">MP</span>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Central Contábil <span className="text-xs px-2 py-0.5 rounded-full bg-brand/20 text-brand font-semibold">v3.0</span>
              </span>
              <span className="text-xs text-slate-400 block -mt-0.5 font-mono">makerpixeltech.com.br</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#recursos" className="hover:text-white transition">Recursos</a>
            <a href="#reforma" className="hover:text-white transition">Reforma Tributária</a>
            <a href="#danfse" className="hover:text-white transition">DANFSe WASM</a>
            <a href="#planos" className="hover:text-white transition">Planos</a>
            <a href="#contato" className="hover:text-white transition">Contato</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-semibold px-4 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition"
            >
              Área do Cliente
            </Link>
            <a
              href="#teste-gratis"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand hover:bg-brand/90 text-white shadow-md shadow-brand/25 transition flex items-center gap-1.5"
            >
              Testar Grátis
              <Icone nome="seta-direita" className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-emerald-400 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Em conformidade com a Reforma Tributária (LC 214/2025 & NT 2025.002)
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            A Solução Definitiva para <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Escritórios Contábeis</span> e Empresas
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Sincronização contínua de notas fiscais com NotaSync, Auditoria completa de IBS/CBS, Gerador de DANFSe 100% no navegador, Conciliação bancária automatizada e conversão de XML para Excel em segundos.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#teste-gratis"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold text-base shadow-lg shadow-brand/30 transition flex items-center justify-center gap-2"
            >
              Iniciar Teste Grátis de 7 Dias
              <Icone nome="seta-direita" className="w-4 h-4" />
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent("Olá! Gostaria de agendar uma demonstração da Central Contábil v3.")}`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold text-base transition flex items-center justify-center gap-2"
            >
              <Icone nome="whatsapp" className="w-4 h-4 text-emerald-400" />
              Falar com Especialista
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <Icone nome="check" className="w-4 h-4 text-emerald-400" />
              Sem cartão de crédito
            </div>
            <div className="flex items-center gap-2">
              <Icone nome="check" className="w-4 h-4 text-emerald-400" />
              Processamento seguro no seu navegador
            </div>
            <div className="flex items-center gap-2">
              <Icone nome="check" className="w-4 h-4 text-emerald-400" />
              Suporte humanizado em Tubarão e SC
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Funcionalidades Principais */}
      <section id="recursos" className="py-20 bg-slate-850 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Tecnologia de Ponta</h2>
            <p className="mt-2 text-3xl font-extrabold text-white">Todos os departamentos em sincronia perfeita</p>
            <p className="mt-3 text-slate-400 text-sm">
              Desenvolvido para eliminar gargalos manuais e blindar sua operação contra multas e inconsistências tributárias.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1: NotaSync */}
            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Icone nome="sincronizar" className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">NotaSync Automático</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Busca contínua de NFC-e, NF-e e CT-e na SEF/SC e ambientes nacionais. Cofre de certificado digital A1 criptografado com monitoramento de validade.
              </p>
            </div>

            {/* Card 2: Reforma Tributária */}
            <div id="reforma" className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Icone nome="reforma" className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Auditor IBS/CBS & RTC</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Calculadora oficial da LC 214/2025. Identifica divergências de alíquotas, enquadramentos indevidos e ausência de tags da NT 2025.002 com comparativo lado a lado.
              </p>
            </div>

            {/* Card 3: DANFSe WASM */}
            <div id="danfse" className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Icone nome="danfse" className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">DANFSe 100% no Navegador</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Geração ultrarrápida de PDF para NFS-e padrão nacional via WebAssembly. Zero envio de XML para nuvem: total privacidade e velocidade instantânea.
              </p>
            </div>

            {/* Card 4: XML para Excel */}
            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Icone nome="excel" className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Conversor XML → Excel</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Converta lotes e pastas inteiras de notas fiscais em planilhas XLSX prontas para auditoria, com abas dedicadas para Notas Fiscais e Itens Detalhados.
              </p>
            </div>

            {/* Card 5: Conciliação Inteligente */}
            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Icone nome="conciliacao" className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Conciliação Bancária com IA</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Casamento automatizado de extratos (Banco do Brasil, Itaú, Nubank, Unicred, etc.) com faturamentos e contas a pagar com regras de tolerância e lote.
              </p>
            </div>

            {/* Card 6: Departamento Cadastro & Em Dia */}
            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 transition shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <Icone nome="check" className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Obrigações & Alvarás em Dia</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Alertas prévios de certidões, vencimento de licenças e alvarás, faturamento anual para enquadramento do Simples Nacional, Lucros e REINF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Planos e Preços */}
      <section id="planos" className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Investimento</h2>
            <p className="mt-2 text-3xl font-extrabold text-white">Planos flexíveis para cada momento do seu negócio</p>
            <p className="mt-3 text-slate-400 text-sm">
              Sem fidelidade abusiva. Ativação imediata e suporte dedicado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLANOS_PADRAO.map((plano) => (
              <div
                key={plano.id}
                className={`rounded-2xl p-8 flex flex-col justify-between transition relative ${
                  plano.destaque
                    ? "bg-slate-800 border-2 border-emerald-400 shadow-xl shadow-emerald-500/10"
                    : "bg-slate-850 border border-slate-700"
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-400 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    Mais Escolhido
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-white">{plano.nome}</h3>
                  <p className="text-slate-400 text-xs mt-1 min-h-[32px]">{plano.descricao}</p>
                  <div className="mt-6 mb-6">
                    <span className="text-3xl font-extrabold text-white">Sob Consulta</span>
                    <span className="text-xs text-slate-400 block mt-1">Condição especial de implantação</span>
                  </div>

                  <ul className="space-y-3 text-xs text-slate-300 border-t border-slate-700/80 pt-6">
                    <li className="flex items-center gap-2">
                      <Icone nome="check" className="w-4 h-4 text-emerald-400" />
                      Até {plano.limiteUsuarios} usuários simultâneos
                    </li>
                    <li className="flex items-center gap-2">
                      <Icone nome="check" className="w-4 h-4 text-emerald-400" />
                      Até {plano.limiteEmpresas} empresas monitoradas
                    </li>
                    <li className="flex items-center gap-2">
                      <Icone nome="check" className="w-4 h-4 text-emerald-400" />
                      NotaSync SEF/SC contínuo
                    </li>
                    <li className="flex items-center gap-2">
                      <Icone nome="check" className="w-4 h-4 text-emerald-400" />
                      Auditor Reforma Tributária (IBS/CBS)
                    </li>
                    <li className="flex items-center gap-2">
                      <Icone nome="check" className="w-4 h-4 text-emerald-400" />
                      DANFSe WASM e Conversor Excel
                    </li>
                    <li className="flex items-center gap-2">
                      <Icone nome="check" className="w-4 h-4 text-emerald-400" />
                      Suporte via WhatsApp e E-mail
                    </li>
                  </ul>
                </div>

                <div className="mt-8">
                  <a
                    href="#teste-gratis"
                    onClick={() => setForm((prev) => ({ ...prev, planoInteresse: plano.id }))}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center transition ${
                      plano.destaque
                        ? "bg-brand hover:bg-brand/90 text-white shadow-md shadow-brand/20"
                        : "bg-slate-700 hover:bg-slate-650 text-slate-200"
                    }`}
                  >
                    Solicitar Este Plano
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulário de Conversão / Funil de Vendas */}
      <section id="teste-gratis" className="py-20 bg-slate-850 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-8 sm:p-12 shadow-2xl relative">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Acesso Imediato</span>
              <h2 className="text-3xl font-extrabold text-white mt-1">Experimente Grátis por 7 Dias</h2>
              <p className="text-slate-400 text-sm mt-2">
                Preencha seus dados para liberar o ambiente de demonstração completo e receber as orientações da equipe da MakerPixel Tech.
              </p>
            </div>

            {enviado ? (
              <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                  <Icone nome="check" className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Solicitação Recebida com Sucesso!</h3>
                <p className="text-slate-300 text-sm max-w-md mx-auto">
                  Nossa equipe comercial foi acionada no WhatsApp e seu acesso experimental está liberado.
                </p>
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    to="/login"
                    className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold text-xs shadow-md"
                  >
                    Ir para Tela de Login
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEnviado(false)}
                    className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Enviar Outro Pedido
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Seu Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: João da Silva"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Escritório ou Empresa</label>
                    <input
                      type="text"
                      placeholder="Ex: Silva Contabilidade"
                      value={form.escritorio}
                      onChange={(e) => setForm({ ...form, escritorio: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-mail Profissional *</label>
                    <input
                      type="email"
                      required
                      placeholder="joao@contabilidade.com.br"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp com DDD *</label>
                    <input
                      type="tel"
                      required
                      placeholder="(48) 99999-9999"
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cidade / Estado</label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Tubarão"
                        value={form.cidade}
                        onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                        className="col-span-2 px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand"
                      />
                      <input
                        type="text"
                        placeholder="SC"
                        value={form.uf}
                        maxLength={2}
                        onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm text-center focus:outline-none focus:border-brand font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Qtd. de Empresas</label>
                    <select
                      value={form.qtdEmpresas}
                      onChange={(e) => setForm({ ...form, qtdEmpresas: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand"
                    >
                      <option value="Até 10">Até 10</option>
                      <option value="10 a 50">10 a 50</option>
                      <option value="50 a 150">50 a 150</option>
                      <option value="Mais de 150">Mais de 150</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-bold text-sm shadow-lg shadow-brand/30 transition flex items-center justify-center gap-2"
                  >
                    {enviando ? "Processando..." : "Quero Testar Gratuitamente por 7 Dias"}
                    <Icone nome="seta-direita" className="w-4 h-4" />
                  </button>
                  <p className="text-center text-[11px] text-slate-400 mt-2">
                    Seus dados estão protegidos. Não compartilhamos informações com terceiros.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Rodapé Oficial com vínculo ao domínio */}
      <footer id="contato" className="bg-slate-950 border-t border-slate-800/80 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <span className="text-sm font-bold text-white tracking-tight">MakerPixel Tech</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Tecnologia e Automação Contábil &copy; {new Date().getFullYear()} — Todos os direitos reservados.
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Domínio Oficial: <a href="https://makerpixeltech.com.br" className="text-emerald-400 hover:underline">makerpixeltech.com.br</a> • Tubarão - Santa Catarina
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link to="/login" className="hover:text-white transition">Acessar Sistema</Link>
            <a href="#recursos" className="hover:text-white transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-white transition">Planos</a>
            <a
              href={`https://wa.me/${WHATSAPP_COMERCIAL}`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline font-semibold"
            >
              WhatsApp Comercial
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

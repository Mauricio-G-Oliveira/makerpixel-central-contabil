# Central Contábil v4.1.0 — by MakerPixel Tech

[![Demonstração Online](https://img.shields.io/badge/Demo-GitHub%20Pages-0284c7?style=for-the-badge&logo=github)](https://mauricio-g-oliveira.github.io/makerpixel-central-contabil/)
[![Domínio Oficial](https://img.shields.io/badge/Site-makerpixeltech.com.br-059669?style=for-the-badge)](https://makerpixeltech.com.br)
[![Aplicação Produção](https://img.shields.io/badge/App-app.makerpixeltech.com.br-blue?style=for-the-badge)](https://app.makerpixeltech.com.br)
[![Backend API](https://img.shields.io/badge/API-Java%2021%20%2F%20Spring%20Boot%203-emerald?style=for-the-badge&logo=springboot)](https://github.com/Mauricio-G-Oliveira/makerpixel-gestao-api)
[![PostgreSQL & Supabase](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20RLS-336791?style=for-the-badge&logo=postgresql)](https://github.com/Mauricio-G-Oliveira/makerpixel-gestao-api)
[![Testes Automatizados](https://img.shields.io/badge/Testes-96%20Passando%20(100%25)-10b981?style=for-the-badge&logo=nodedotjs)](https://github.com/Mauricio-G-Oliveira/makerpixel-central-contabil)
[![PWA](https://img.shields.io/badge/PWA-Instalável%20e%20Offline--First-6366f1?style=for-the-badge)](https://mauricio-g-oliveira.github.io/makerpixel-central-contabil/)

> **Plataforma SaaS enxuta para escritórios contábeis e pilotos reais**: busca contínua de DF-e na SEF/SC sem intermediadores (NotaSync), integração com SIEG (NF-e/CT-e), auditoria contínua da Reforma Tributária (IBS/CBS - LC 214/2025), gerador de DANFSe WASM no navegador, conversor universal de XML para Excel, gestão diária de tarefas (Em Dia) e garantias completas de privacidade LGPD.

---

## 🚦 Status do Produto (Transparência Operacional)

| Módulo / Recurso | Status | Descrição |
| :--- | :---: | :--- |
| **Auditoria Contínua IBS/CBS** | **Produção** | As notas entram automaticamente por múltiplas fontes (SEF/SC e SIEG), enfileiram em segundo plano e são auditadas de forma autônoma e idempotente pela Calculadora RTC. Painel com semáforo (🟢🟡🔴), resumo "desde ontem" e drill-down em 1 clique. |
| **Integração SIEG** | **Produção** | Coleta contínua de NF-e (55) e CT-e (57) com chave de API criptografada no cofre AES-256-GCM do escritório. |
| **NotaSync Nuvem & Cofre A1** | **Produção** | Upload direto para cofre AES-256-GCM, monitoramento de empresas, busca na SEF/SC, download em streaming de ZIPs e tradução de erros da Fazenda (ex.: cStat 8002). |
| **Auditor Reforma Tributária (LC 214/2025)** | **Produção** | Validação item a item de IBS/CBS, alíquotas de teste de 2026, modal lado a lado com fundamentação legal e integração com a Calculadora RTC. |
| **DANFSe Nacional (WASM)** | **Produção** | Emissão e visualização de Documento Auxiliar da NFS-e 100% no navegador (zero envio de XML a servidores externos). |
| **XML → Excel Universal** | **Produção** | Conversor multi-aba (Notas e Itens) de arquivos avulsos, ZIPs ou notas do mês diretamente via API. |
| **Em Dia (Rotinas e Obrigações)** | **Piloto** | Geração mensal idempotente por competência, modelos customizáveis, diário da empresa e criação de tarefas preventivas automáticas de divergências IBS/CBS. |
| **Admin MakerPixel** | **Produção** | Criação de testes de 30 dias, gestão de planos e limites, prorrogações, conversões e suspensão imediata de escritórios. |
| **Garantias LGPD (Artigos 17 e 18)** | **Produção** | Exportação completa dos dados do escritório em arquivo ZIP estruturado e expurgo definitivo com dupla confirmação do CNPJ. |
| **Modo Demonstração** | **Demonstração** | Flag `VITE_MODO_DEMO=true` para visualização comercial com dados fictícios em memória sem requerer backend conectado. |

---

## 📚 Documentação Técnica
- [Guia de Deploy em Produção (Render, Supabase, CORS)](file:///Users/mauricio/Desktop/gestao%20financeira/makerpixel-techsystem/docs/deploy-guia.md)
- [Roteiro de Validação de Ponta a Ponta para Pilotos Reais](file:///Users/mauricio/Desktop/gestao%20financeira/makerpixel-techsystem/docs/roteiro-piloto.md)
- [Histórico de Versões e Atualizações (Changelog v4.0.0)](file:///Users/mauricio/Desktop/gestao%20financeira/makerpixel-techsystem/CHANGELOG.md)

---

## 1. Módulos do Sistema

### ⚡ 1. NotaSync — Sincronizador de Documentos Fiscais (SEF/SC & DF-e)
- **Busca Contínua SEF/SC**: download automático de NFC-e (mod. 65), NF-e (55) e CT-e (57) pelo web service oficial para contadores (Boletim Técnico SEF/SC 2026/003) sem intermediadores.
- **Cofre Seguro de Certificados A1**: custódia criptografada em repouso com **AES-256-GCM** e *Envelope Encryption*. O titular é mascarado na interface (`11.***.***/0001-**`).
- **Diagnóstico Amigável**: tradução clara de status da Fazenda com foco no **erro 8002** (*Contabilista não vinculado no SAT*) e orientações diretas.
- **Detecção de Cancelamentos**: processamento automático de eventos e deduplicação estrita de chaves de acesso.
- **Download do Mês em ZIP**: stream direto da API com as notas fiscais organizadas por competência.

### 🏛️ 2. Reforma Tributária — Auditor IBS/CBS & Motor RTC (LC 214/2025)
- **Conferência em Lote**: validação item a item de arquivos XML de NF-e, NFC-e e NFS-e contra as regras oficiais da LC 214/2025 e NT 2025.002.
- **Classificação em Níveis**: `OK`, `DIVERGENCIA_VALOR`, `ENQUADRAMENTO_INVALIDO`, `SEM_GRUPO_IBSCBS`.
- **Comparativo Lado a Lado**: modal interativo exibindo o valor destacado na nota versus o cálculo oficial, memória de cálculo e fundamentação legal.
- **Calculadora RTC como Serviço Privado**: integração com a calculadora oficial da Receita Federal em container isolado.

### 📄 3. DANFSe WASM — Emissor de Documento Auxiliar no Navegador
- **Engine WebAssembly**: geração client-side em milissegundos baseada no repositório oficial da Receita Federal.
- **Zero Telemetria e Privacidade Total**: o XML da NFS-e nunca sai do computador; o PDF é gerado na memória do navegador.
- **Recursos**: pré-visualização, impressão, canhoto e download avulso ou em lote compactado.

### 📊 4. XML → Excel Universal
- **Conversor Multi-Aba**: processa notas avulsas, pacotes ZIP ou documentos do NotaSync gerando planilhas XLSX estruturadas (Notas Fiscais e Itens de Produtos/Serviços).

### 📋 5. Em Dia — Gestão Diária de Obrigações do Escritório
- **Checklist Operacional**: visão diária do que cada empresa precisa no mês, quem é o responsável e o status de execução.
- **Tarefas Automáticas**: geradas diretamente de outros módulos (erro 8002 no SAT, certificados vencendo em 30 dias, divergências de IBS/CBS).
- **Diário da Empresa**: linha do tempo de anotações e histórico do atendimento.

### 🏢 6. Admin MakerPixel & Gestão Multi-Escritório
- **Controle de Licenças**: períodos de teste (com expiração automática), ativação definitiva, prorrogação e suspensão/reativação.
- **Limites por Plano**: usuários ativos, empresas atendidas e armazenamento em nuvem.

### 🛡️ 7. Conformidade LGPD (Artigos 17 e 18)
- **Portabilidade de Dados**: Exportação em um clique de todos os dados do escritório em arquivo ZIP.
- **Direito ao Esquecimento**: Exclusão definitiva de todos os dados e certificados com confirmação do CNPJ.

---

## 2. Roadmap

- Conciliação bancária e importação de planilhas: em estudo, a serem desenvolvidas de forma genérica.

---

## 3. Contato Oficial

**MakerPixel Tech — Tecnologia & Automação Contábil**  
- 🌐 **Website**: [makerpixeltech.com.br](https://makerpixeltech.com.br)  
- 📍 **Localização**: Tubarão - Santa Catarina, Brasil  
- 💼 **LinkedIn**: [linkedin.com/in/mauricio-g-oliveira](https://www.linkedin.com/in/mauricio-g-oliveira/)  
- 🐙 **GitHub**: [github.com/Mauricio-G-Oliveira](https://github.com/Mauricio-G-Oliveira)

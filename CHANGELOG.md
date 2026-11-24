# Changelog — Central Contábil

Todas as modificações e melhorias relevantes da plataforma são registradas neste documento.

---

## [4.0.0] - 2026-11-24

### 🚀 Central Contábil v4: Produto Enxuto, Conexão à API, Em Dia Reescrito e Pronto para Piloto

#### Produto Enxuto & Arquitetura Limpa
- **Descontinuação de Módulos Legados:** Remoção completa de módulos obsoletos (Controle de Horas, ISS municipal, ICMS estadual, Conciliação legada, Integração de planilhas, Contábil/Encerramento/Fechamento/Lucros, Dep. Cadastro e pasta `src/legado`).
- **Foco no Core Value:** O produto passa a ser composto estritamente pelos pilares: **NotaSync** (coleta SEF/SC), **Reforma Tributária** (auditor IBS/CBS LC 214/2025), **DANFSe** (emissão WASM local), **XML → Excel Universal**, **Em Dia** (gestão de rotinas) e **Admin MakerPixel**.

#### Integração Total Front-End ↔ API (`apiClient.mjs`)
- **Cliente HTTP Centralizado:** Tratamento unificado de tokens JWT, renovação de sessão, tratamento amigável de limites de plano (HTTP 402/403) e intervalo regulamentar da SEFAZ (HTTP 429).
- **Cofre Seguro de Certificados A1:** Upload direto multipart para cofre criptografado com chave mestra AES-256-GCM. Eliminação de qualquer dado sensível do navegador ou localStorage.
- **Download em Streaming:** Obtenção de pacotes ZIP com XMLs do mês e planilhas XLSX diretamente da API.
- **Admin MakerPixel Integrado:** Gestão de testes gratuitos, conversão de contratos, prorrogação e suspensão em tempo real.

#### Módulo Em Dia (Reescrito do Zero)
- **Gestão Diária de Obrigações:** Novo motor de geração de tarefas mensais por competência, totalmente idempotente (execuções repetidas não duplicam registros).
- **Tarefas Automáticas Cruzadas:** Criação inteligente de tarefas preventivas:
  - *Vincular contador no SAT* (quando detectado erro 8002 no NotaSync);
  - *Renovar Certificado Digital A1* (quando a validade estiver a menos de 30 dias);
  - *Revisar divergências IBS/CBS* (quando houver divergências no lote auditado).
- **Vistas Operacionais:** *Minhas Tarefas*, *Mês por Empresa*, *Painel do Mês* com métricas gráficas, *Diário da Empresa* (linha do tempo) e *Modelos de Tarefa* customizáveis.

#### Privacidade & Conformidade LGPD
- **Portabilidade (Art. 18):** Botão para exportação instantânea de todo o acervo de dados do escritório em arquivo ZIP contendo JSONs estruturados.
- **Direito ao Esquecimento (Art. 17):** Procedimento de exclusão definitiva com dupla validação do CNPJ cadastrado, realizando expurgo atômico de certificados, XMLs, empresas e tarefas.

#### Deploy & Piloto
- **Documentação de Deploy:** Guia detalhado em `docs/deploy-guia.md` com Render Blueprint (`render.yaml`), Vercel/DNS e Supabase.
- **Roteiro do Piloto:** Script de validação de 6 passos de ponta a ponta em `docs/roteiro-piloto.md`.

---

## [3.0.0] - 2026-11-23

### 🚀 Lançamento Oficial da Central Contábil v3 (MakerPixel Tech)

#### Módulo Fiscal & Reforma Tributária (LC 214/2025)
- **Auditor IBS/CBS em Lote**: Conferência detalhada item a item de documentos fiscais contra as regras oficiais da LC 214/2025 e NT 2025.002.
- **Motor Calculadora RTC**: Integração desacoplada com a calculadora de referência da Receita Federal como microsserviço privado em container Docker.
- **Classificação Inteligente**: Separação em 5 status de auditoria (`OK`, `DIVERGENCIA_VALOR`, `ENQUADRAMENTO_INVALIDO`, `SEM_GRUPO_IBSCBS`, `ERRO_CALCULO`).
- **Modal Comparativo Lado a Lado**: Visualização clara entre o tributo destacado na nota fiscal e o cálculo oficial esperado pela legislação, com fundamentação legal e memória de cálculo.
- **Exportação de Divergências**: Relatório formatado em Excel/CSV para orientação e saneamento de cadastro tributário junto aos clientes.

#### Motor de Busca Automatizada NotaSync
- **Sincronizador SEF/SC & DF-e Nacional**: Download contínuo de NFC-e (65), NF-e (55) e CT-e (57) sem necessidade de mensalidades a intermediadores externos.
- **Cofre Seguro de Certificados A1**: Criptografia em repouso AES-256-GCM com Envelope Encryption, chave mestra em camadas e mascaramento de dados sensíveis.
- **Diagnóstico Técnico Traduzido**: Tradução amigável de status da Fazenda com foco no erro SEF/SC 8002 (*Contabilista não vinculado no SAT*).
- **Exportação e Backup**: Geração de arquivos ZIP com os XMLs do mês estruturados e download rápido em planilha.

#### Gerador de DANFSe (WASM no Navegador)
- **Zero Telemetria**: Emissão e renderização do Documento Auxiliar da NFS-e padrão nacional 100% no navegador do usuário via WebAssembly.
- **Privacidade Absoluta**: O arquivo XML não trafega nem é armazenado em servidores externos durante a geração do PDF.
- **Exportação em Lote**: Pré-visualização com zoom e download avulso em PDF ou empacotado em ZIP.

#### Utilitários & Painel Unificado
- **Conversor XML → Excel Universal**: Transformação de lotes de notas fiscais em planilhas XLSX estruturadas em duas abas separadas: *Notas Fiscais* e *Itens dos Produtos e Serviços*.
- **Início Unificado Executivo**: Painel consolidado com métricas de notas sincronizadas, alertas de validade de certificados e auditoria de tributos.
- **Site Público & Funil de Vendas**: Apresentação institucional vinculada ao domínio oficial `makerpixeltech.com.br`, planos flexíveis e solicitação de teste gratuito por 7 dias via WhatsApp.

---
*MakerPixel Tech — Inovação e Automação Contábil*

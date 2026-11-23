# Changelog — Central Contábil

Todas as modificações e melhorias relevantes da plataforma são registradas neste documento.

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

# Histórico de Migração — Central Contábil

**MakerPixel Tech — Central Contábil v4.1.1**

---

## 1. Módulos Ativos do Core (v4.1.1)

O **Central Contábil** opera com foco estrito em automação de alta performance e valor contábil:

1. **NotaSync Nuvem (SEF/SC):** Busca automatizada e deduplicação de NFC-e com cofre seguro para certificados digitais A1 em AES-256-GCM.
2. **Auditor IBS/CBS (Reforma Tributária - LC 214/2025):** Conferência em lote e contínua de notas fiscais com comparativo lado a lado e integração com a Calculadora RTC oficial da Receita Federal.
3. **DANFSe WASM Instantâneo:** Geração de PDFs de notas fiscais de serviço 100% no navegador via WebAssembly, com zero telemetria e sem que o XML saia da máquina do cliente.
4. **Conversor Universal XML → Excel:** Exportação automática de notas e itens em planilhas XLSX prontas para auditoria.
5. **Departamento Cadastro:** Controle preventivo de certidões e alvarás com leitor de PDF e consulta automatizada à Receita Federal.
6. **Em Dia (Obrigações e Divergências):** Controle de entregas fiscais por setor e criação automática de tarefas preventivas de auditoria tributária.

---

## 2. Módulos Descontinuados na v4.0

Conforme homologação do produto v4, foram expurgados do sistema módulos legados que não faziam parte do core essencial:
- *Controle de Horas / Ponto (DP)*
- *Apuração legada de ICMS / ISS municipal isolado*
- *Fechamento / Encerramento manual legado*
- *Conciliação bancária legada*

Todos os resquícios de banco de dados, rotas, telas e dependências desses módulos foram removidos das branches ativas.

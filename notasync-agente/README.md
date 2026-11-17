# NotaSync Agente — Coletor Local de NFC-e SEF/SC

O **NotaSync Agente** é uma aplicação leve em Java 21 / Spring Boot projetada para rodar **localmente** no servidor ou computador do escritório de contabilidade.

Ele se conecta diretamente ao web service da Secretaria da Fazenda de Santa Catarina (**SEF/SC**), faz o download periódico e gratuito de todas as notas fiscais de consumidor eletrônicas (**NFC-e, modelo 65**) emitidas pelos clientes do escritório, grava os arquivos XML em disco e sincroniza apenas os metadados contábeis com a Central Contábil.

---

## 🔒 Arquitetura de Segurança (Modelo Push SCI)

- **Certificado Digital A1 100% Local**: O arquivo `.pfx` ou `.p12` do contador e suas senhas **nunca saem da máquina do escritório**.
- **Autenticação Mútua (mTLS)**: O agente estabelece canal TLS 1.2 direto com a SEF/SC (`dfe.sat.sef.sc.gov.br`) usando o certificado ICP-Brasil do contabilista.
- **Armazenamento Físico de XMLs**:
  ```
  xml-saida/
  └── {CNPJ_EMITENTE}/
      └── {AAAA-MM}/
          └── {CHAVE_ACESSO_44_DIGITOS}.xml
  ```
- **Sincronização Nuvem**: Apenas metadados (chave, número, série, data, valor, situação) são enviados via API REST autenticada para a Central Contábil.

---

## 📋 Regras de Consumo do Web Service SEF/SC

Em conformidade com o **Boletim Técnico SEF/SC 2026/003, v1.00-1**:
- **cStat 118 com 50 documentos**: busca o próximo lote imediatamente;
- **cStat 118 com <50 documentos ou cStat 117**: fila sincronizada, aguarda **12 horas** para este CNPJ;
- **cStat 110 (Uso Indevido)**: requisição sem intervalo, aguarda **1 hora** obrigatória;
- **cStat 657 (Bloqueio por Excesso)**: suspende temporariamente e aguarda 24 horas (máximo 3 tentativas);
- **cStat 8002 (Sem Vínculo SAT)**: alerta a equipe para vincular o CPF do contador ao CNPJ no portal SAT da SEF/SC.

---

## 🚀 Como Executar

### 1. Configuração via Variáveis de Ambiente (`.env`)
```bash
# Configuração do Certificado Digital do Escritório
NOTASYNC_CERT_PATH=/caminho/para/certificado_contador.pfx
NOTASYNC_CERT_PASSWORD=senha_do_certificado

# Central Contábil API
NOTASYNC_CENTRAL_URL=https://api.centralcontabil.app/api/v1/notasync/lote
NOTASYNC_ESCRITORIO_TOKEN=seu_jwt_token_escritorio

# Pasta de saída dos XMLs
NOTASYNC_XML_SAIDA_DIR=xml-saida
```

### 2. Executar via Maven / Jar
```bash
java -jar notasync-agente.jar
```
Ou com o simulador local na porta 8089 para testes sem certificado real.

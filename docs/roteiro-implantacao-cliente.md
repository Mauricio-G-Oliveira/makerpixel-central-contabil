# Roteiro de Implantação em Novo Cliente

**MakerPixel Tech — Central Contábil v3**  
*Passo a passo para entrada em produção de um novo escritório ou empresa.*

---

## Etapa 1: Primeiro Acesso e Cadastro Inicial
1. O administrador do escritório contábil acessa a plataforma (`makerpixeltech.com.br` ou link de acesso local);
2. Realiza o login utilizando o e-mail cadastrado e a senha provisória;
3. No primeiro acesso, o sistema solicita a criação de uma senha definitiva segura (mínimo de 8 caracteres, com letras e números).

---

## Etapa 2: Carga do Certificado Digital A1 no Cofre Seguro
1. No menu lateral, acesse **NotaSync**;
2. Na aba **Cofre Seguro & Auditoria**, clique em **"Carregar Certificado A1"**;
3. Selecione o arquivo `.pfx` ou `.p12` do escritório ou da empresa titular;
4. Digite a senha do certificado e aceite o termo de autorização e custódia;
5. O sistema valida os bytes, extrai a validade e armazena o arquivo com criptografia AES-256-GCM em repouso. O titular aparece mascarado no card.

---

## Etapa 3: Importação das Empresas Monitoradas
1. Na aba **Empresas Monitoradas** do NotaSync, clique em **"Importar Empresas (CSV)"**;
2. Faça o upload da planilha de clientes no formato:
   ```csv
   CNPJ;Razão Social;Inscrição Estadual;Regime
   11222333000181;Empresa Modelo Ltda;254123987;Simples Nacional
   ```
3. O sistema valida os dígitos verificadores (Módulo 11) de todos os CNPJs e cadastra as empresas ativas.

---

## Etapa 4: Diagnóstico de Retorno SEF/SC e Resolução do Erro 8002
1. Clique em **"Sincronizar Todas"** para disparar a consulta inicial à SEF/SC;
2. Na aba **Execuções da Busca**, acompanhe os status retornados:
   - **`138` (Documento Localizado)**: Sucesso; notas baixadas e armazenadas.
   - **`137` (Nenhum Documento Localizado)**: Sem novas notas no período consultado.
   - **`8002` (Contabilista não vinculado no SAT)**:
     - Acesse o portal do SAT da SEF/SC (`sat.sef.sc.gov.br`);
     - Solicite ao cliente que confirme a vinculação do CNPJ/CPF do contabilista no cadastro de contabilistas da SEF/SC;
     - Após o aceite no SAT, a sincronização passa a baixar normalmente sem novas configurações.

---

## Etapa 5: Validação da Auditoria da Reforma e DANFSe
1. No menu **Auditor IBS/CBS**, faça o upload de um lote de notas ou selecione as notas sincronizadas pelo NotaSync;
2. Verifique o comparativo lado a lado e confirme a apuração de tributos conforme a LC 214/2025;
3. No menu **DANFSe**, teste a geração de PDF de uma NFS-e para conferir a visualização instantânea no navegador.

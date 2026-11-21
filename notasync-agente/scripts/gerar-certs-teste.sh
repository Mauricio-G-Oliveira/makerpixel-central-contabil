#!/usr/bin/env bash
# ==============================================================================
# gerar-certs-teste.sh — Gera certificado PKCS12 autoassinado para testes mTLS
# NotaSync Agente (Ambiente de Desenvolvimento / Simulador)
# NUNCA USE CERTIFICADOS REAIS DA ICP-BRASIL EM AMBIENTE DE TESTE
# ==============================================================================

set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs-teste"
mkdir -p "${CERT_DIR}"

ALIAS="notasync-contador-teste"
SENHA="senha-teste-notasync"
ARQUIVO_P12="${CERT_DIR}/contador-teste.p12"

echo "==> Gerando par de chaves e certificado PKCS12 autoassinado para testes..."
keytool -genkeypair \
  -alias "${ALIAS}" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 365 \
  -keystore "${ARQUIVO_P12}" \
  -storetype PKCS12 \
  -storepass "${SENHA}" \
  -keypass "${SENHA}" \
  -dname "CN=Contabilidade Modelo Teste:00000000000, OU=Certificado Teste NotaSync, O=MakerPixel Tech, L=Cidade Ficticia, ST=SC, C=BR"

echo "==> Certificado gerado com sucesso em: ${ARQUIVO_P12}"
echo "    Alias: ${ALIAS}"
echo "    Senha: ${SENHA}"
echo "    Para usar:"
echo "    export NOTASYNC_CERT_PATH=\"${ARQUIVO_P12}\""
echo "    export NOTASYNC_CERT_SENHA=\"${SENHA}\""

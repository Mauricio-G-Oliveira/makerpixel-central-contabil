#!/usr/bin/env bash
# ==============================================================================
# Central Contábil - Compilação do DANFSe WebAssembly (WASM)
# Repositório Oficial: https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse (MIT)
# Requisito: Go (Golang) 1.21+ instalado no ambiente de compilação.
# ==============================================================================
set -euo pipefail

REPO_URL="https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse.git"
COMMIT_TAG="main"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$(cd "${SCRIPT_DIR}/../public/danfse" && pwd)"
TMP_DIR="$(mktemp -d)"

echo "==> [DANFSe WASM] Verificando compilador Go no ambiente..."
if ! command -v go &> /dev/null; then
    echo "------------------------------------------------------------------"
    echo "AVISO / ERRO: O compilador Go (Golang) é necessário APENAS para"
    echo "compilar o arquivo danfse.wasm a partir do repositório oficial."
    echo "Por favor instale o Go 1.21+ (https://go.dev/dl/) no seu sistema."
    echo "No navegador, a Central Contábil já possui fallback nativo offline."
    echo "------------------------------------------------------------------"
    exit 1
fi

echo "==> [DANFSe WASM] Diretório de saída: ${OUT_DIR}"
mkdir -p "${OUT_DIR}"

echo "==> [DANFSe WASM] Clonando repositório oficial da Receita Federal (${COMMIT_TAG})..."
git clone --depth 1 "${REPO_URL}" "${TMP_DIR}/danfse-repo"
cd "${TMP_DIR}/danfse-repo"

echo "==> [DANFSe WASM] Copiando wasm_exec.js oficial do Go SDK..."
GOROOT="$(go env GOROOT)"
if [ -f "${GOROOT}/misc/wasm/wasm_exec.js" ]; then
    cp "${GOROOT}/misc/wasm/wasm_exec.js" "${OUT_DIR}/wasm_exec.js"
fi

echo "==> [DANFSe WASM] Compilando danfse.wasm (GOOS=js GOARCH=wasm)..."
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o "${OUT_DIR}/danfse.wasm" ./cmd/danfse-wasm

echo "==> [DANFSe WASM] Limpando diretórios temporários..."
rm -rf "${TMP_DIR}"

echo "==> [DANFSe WASM] Concluído com sucesso! danfse.wasm gerado em: ${OUT_DIR}"

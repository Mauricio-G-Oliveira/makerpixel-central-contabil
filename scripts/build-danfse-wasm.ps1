# ==============================================================================
# Central Contabil - Compilacao do DANFSe WebAssembly (WASM) para Windows
# Repositorio Oficial: https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse (MIT)
# Requisito: Go (Golang) 1.21+ instalado no ambiente de compilacao.
# ==============================================================================
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse.git"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutDir = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\public\danfse"))

Write-Host "==> [DANFSe WASM] Verificando compilador Go no ambiente..." -ForegroundColor Cyan
if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) {
    Write-Host "------------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "AVISO / ERRO: O compilador Go (Golang) eh necessario APENAS para" -ForegroundColor Yellow
    Write-Host "compilar o arquivo danfse.wasm a partir do repositorio oficial." -ForegroundColor Yellow
    Write-Host "Por favor instale o Go 1.21+ (https://go.dev/dl/) no seu sistema." -ForegroundColor Yellow
    Write-Host "No navegador, a Central Contabil possui fallback nativo offline." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------------" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("danfse-" + [System.Guid]::NewGuid().ToString())
Write-Host "==> [DANFSe WASM] Clonando repositorio oficial da Receita Federal em $TmpDir..." -ForegroundColor Cyan
git clone --depth 1 $RepoUrl $TmpDir

Push-Location $TmpDir

try {
    $GoRoot = (go env GOROOT).Trim()
    $WasmExec = Join-Path $GoRoot "misc\wasm\wasm_exec.js"
    if (Test-Path $WasmExec) {
        Copy-Item $WasmExec (Join-Path $OutDir "wasm_exec.js") -Force
    }

    Write-Host "==> [DANFSe WASM] Compilando danfse.wasm (GOOS=js GOARCH=wasm)..." -ForegroundColor Cyan
    $env:GOOS = "js"
    $env:GOARCH = "wasm"
    go build -ldflags="-s -w" -o (Join-Path $OutDir "danfse.wasm") ./cmd/danfse-wasm
}
finally {
    Pop-Location
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}

Write-Host "==> [DANFSe WASM] Concluido com sucesso! Arquivos gerados em $OutDir" -ForegroundColor Green

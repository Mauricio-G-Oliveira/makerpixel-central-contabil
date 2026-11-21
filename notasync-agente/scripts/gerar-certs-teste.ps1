# ==============================================================================
# gerar-certs-teste.ps1 — Gera certificado PKCS12 autoassinado para testes mTLS
# NotaSync Agente (Ambiente de Desenvolvimento / Simulador no Windows PowerShell)
# NUNCA USE CERTIFICADOS REAIS DA ICP-BRASIL EM AMBIENTE DE TESTE
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = Split-Path -Parent $ScriptDir
$CertDir = Join-Path $BaseDir "certs-teste"

if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir | Out-Null
}

$Alias = "notasync-contador-teste"
$Senha = "senha-teste-notasync"
$ArquivoP12 = Join-Path $CertDir "contador-teste.p12"

Write-Host "==> Gerando par de chaves e certificado PKCS12 autoassinado para testes..." -ForegroundColor Cyan

keytool -genkeypair `
  -alias $Alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 365 `
  -keystore $ArquivoP12 `
  -storetype PKCS12 `
  -storepass $Senha `
  -keypass $Senha `
  -dname "CN=Contabilidade Modelo Teste:00000000000, OU=Certificado Teste NotaSync, O=MakerPixel Tech, L=Cidade Ficticia, ST=SC, C=BR"

Write-Host "==> Certificado gerado com sucesso em: $ArquivoP12" -ForegroundColor Green
Write-Host "    Alias: $Alias"
Write-Host "    Senha: $Senha"
Write-Host "    Para usar no PowerShell:"
Write-Host "    `$env:NOTASYNC_CERT_PATH = `"$ArquivoP12`""
Write-Host "    `$env:NOTASYNC_CERT_SENHA = `"$Senha`""

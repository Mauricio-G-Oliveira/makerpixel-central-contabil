# Roteiro de Atualização — Calculadora RTC (Receita Federal)

**MakerPixel Tech — Central Contábil v3**  
*Procedimento para atualização de versão da Calculadora RTC da Reforma Tributária.*

---

## 1. Contexto Arquitetural
A Calculadora RTC é um projeto oficial de código aberto da Receita Federal do Brasil (licença MIT), desenvolvido em Java 21 com Spring Boot e banco SQLite embarcado com tabelas de alíquotas oficiais.

No ecossistema Central Contábil, a calculadora executa desacoplada em container Docker privado (`infra/calculadora-rtc`), sem código clonado diretamente no repositório principal.

---

## 2. Passo a Passo para Atualização de Versão

### Etapa 1: Identificar a Nova Release no GitHub da Receita
1. Acesse o repositório oficial: `https://github.com/ReceitaFederal/calculadora-rtc-regime-regular`;
2. Verifique na aba **Releases** ou nas **Tags** o identificador da nova versão estável (exemplo: `v1.2.0` ou commit hash específico).

### Etapa 2: Atualizar o Argumento de Versão no Dockerfile
No arquivo [`infra/calculadora-rtc/Dockerfile`](file:///Users/mauricio/Desktop/gestao%20financeira/infra/calculadora-rtc/Dockerfile):
```dockerfile
# Atualize para a tag ou commit desejado
ARG RTC_GIT_REF=v1.2.0
```

### Etapa 3: Reconstruir o Container Localmente
No terminal da raiz do projeto, execute:
```bash
# Rebuild forçado do serviço da calculadora sem cache
docker compose build --no-cache calculadora-rtc

# Reiniciar o serviço atualizado em segundo plano
docker compose up -d calculadora-rtc
```

### Etapa 4: Validação da Versão Ativa
1. Verifique a resposta do endpoint de versão:
   ```bash
   curl http://localhost:8081/versao
   ```
2. No painel do sistema da Central Contábil, o número de versão ativo será atualizado automaticamente no card de status da Reforma Tributária.

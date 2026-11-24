# Guia de Deploy e Produção — Central Contábil v4.0.0 (MakerPixel)

Consulte o documento completo em [makerpixel-gestao-api/docs/deploy-guia.md](file:///Users/mauricio/Desktop/gestao%20financeira/makerpixel-gestao-api/docs/deploy-guia.md) para detalhes de Render, Supabase, segredos e infraestrutura da API.

---

## Deploy do Frontend (Vercel ou Render Static)

### 1. Variáveis de Ambiente do Frontend (.env.production)
```bash
VITE_API_URL=https://central-contabil-api.onrender.com
VITE_MODO_DEMO=false
```

### 2. Configuração de DNS (Registro.br / Cloudflare)
Para vincular o domínio `makerpixeltech.com.br`:
- **`makerpixeltech.com.br`** (Apex) e **`www.makerpixeltech.com.br`**:
  - Aponta para o site público / funil de vendas.
- **`app.makerpixeltech.com.br`**:
  - CNAME apontando para `cname.vercel-dns.com` (ou alias do Render).
  - Este é o endereço do painel autenticado da Central Contábil.

### 3. Roteamento SPA e PWA (vercel.json)
Para evitar erro 404 ao atualizar páginas em rotas como `/notasync`, `/reforma`, `/em-dia`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

# Deploy — Cloudflare Pages

Este guia explica como fazer deploy do **PLANTÃO+** na **Cloudflare Pages** (estateless, Node.js 18+, KV para persistência).

## Pré-requisitos

- Conta Cloudflare (gratuita funciona)
- Repositório Git no GitHub com este código
- CLI do Wrangler: `npm install -g wrangler`

## Setup Local

### 1. Instale dependências

```bash
npm install
```

### 2. Configure variáveis de ambiente

Crie `.env.local` com sua chave DeepSeek:

```bash
cp .env.example .env.local
# Cole sua DEEPSEEK_API_KEY no arquivo
```

### 3. Teste localmente

```bash
npm run dev
# Abra http://localhost:3000
```

## Deploy na Cloudflare Pages

### Opção A: Git (recomendado)

1. **Faça push do seu código para GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: PLANTÃO+ MVP"
   git push origin main
   ```

2. **Conecte no Cloudflare Dashboard:**
   - Vá para https://dash.cloudflare.com/
   - Pages > Create project > Connect to Git
   - Selecione seu repositório
   - Build settings:
     - Framework: **Next.js**
     - Build command: `npm run build`
     - Build output: `.next`

3. **Configure variáveis de ambiente:**
   - No Cloudflare Dashboard, vá para Pages > seu projeto > Settings > Environment variables
   - Adicione:
     - `DEEPSEEK_API_KEY` = sua chave (criptografada automaticamente)
     - `DEEPSEEK_MODEL` = `deepseek-chat`

4. **Configure KV Namespace (para persistência de leads):**
   - Vá para Workers & Pages > KV > Create namespace
   - Chame de `leads-kv`
   - Volte para seu projeto Pages > Settings > Functions
   - Bindings > KV namespace > `LEADS_KV` → aponte para `leads-kv`

5. **Deploy automático:**
   - Cada push para `main` dispara build automático
   - Seu app estará em `https://<seu-projeto>.pages.dev`

### Opção B: CLI (`wrangler pages publish`)

Para deploy imediato sem Git:

```bash
npm run build

# Crie o KV namespace primeiro (via Dashboard)

# Deploy os arquivos .next
wrangler pages publish .next \
  --project-name plantao-medgame \
  --branch main
```

## Variáveis de Ambiente no Cloudflare

Adicione via Cloudflare Dashboard > Pages > Settings > Environment variables:

| Nome | Valor | Tipo |
|---|---|---|
| `DEEPSEEK_API_KEY` | sua-chave-aqui | Secret |
| `DEEPSEEK_MODEL` | deepseek-chat | Standard |

As **Secret variables** não aparecem em logs e são criptografadas.

## KV Namespace Binding

1. Crie namespace `leads-kv` no Dashboard (Workers & Pages > KV)
2. Vá para seu projeto Pages > Settings > Functions > KV namespace bindings
3. Adicione binding:
   - Variable name: `LEADS_KV`
   - Namespace: `leads-kv`
4. Salve

Agora `globalThis.LEADS_KV` estará disponível nas API routes e o app grava leads lá.

## Monitorar Logs

```bash
# Ver logs em tempo real (requer account_id no wrangler.toml)
wrangler pages deployment tail \
  --project-name plantao-medgame \
  --branch main
```

Ou via Dashboard: Pages > seu projeto > Deployments > últimas execuções

## Troubleshooting

### "Build failed"
- Verifique se `npm run build` passa localmente
- Veja logs completos no Cloudflare Dashboard

### "DEEPSEEK_API_KEY undefined"
- Certifique-se de que adicionou a variável em Settings > Environment variables (não em wrangler.toml)
- Redeploy após adicionar

### Leads não são salvos
- Verifique se o KV namespace binding está configurado
- Veja nos logs se há erro ao salvar
- Em desenvolvimento (localhost), falls back para `data/leads.json`

## Limits & Pricing

**Cloudflare Pages (Free):**
- 500 deploys/mês
- Unlimited requests & bandwidth
- 5 minutos por requisição
- Node.js: até 50MB de artifacts

**Cloudflare KV (Free):**
- 100,000 operações/dia
- Armazenamento ilimitado (até capacidade)
- Replicação global automática

O MVP cabe fácil no free tier.

## Upgrade para Produção

Quando escalar:

1. **Supabase** em vez de KV (melhor para queries complexas)
2. **Webhook → CRM** na rota de lead (`/api/lead`)
3. **Analytics** via Cloudflare Analytics + PostHog
4. **Durable Objects** se precisar de estado persistente (fila de casos, multiplayer)

---

**Pronto!** Seu app estará em `https://seu-projeto.pages.dev` com todas as APIs funcionando.

Para mais: https://developers.cloudflare.com/pages/framework-guides/nextjs/

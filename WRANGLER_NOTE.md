# ⚠️ Nota sobre `wrangler.toml`

## TL;DR
**Cloudflare Pages NÃO usa `wrangler.toml` ou `wrangler CLI`.**

Se você está vendo erro como:
```
✘ [ERROR] The entry-point file at "dist/index.js" was not found.
```

É porque algo está tentando rodar `npx wrangler deploy`.

## Solução

1. **No Cloudflare Dashboard**, vá para seu projeto Pages
2. **Settings** > **Build & deploy**
3. Procure a seção "Deploy command" ou "Post-build command"
4. **Remova qualquer coisa que diga `wrangler`**
5. Deixe em branco ou delete

Pages **não precisa** de nenhum comando de deploy além do build.

## Por que está acontecendo?

Você pode ter:
- ❌ Um `wrangler.toml` no repo (Pages o ignora, mas alguém pode estar rodando-o)
- ❌ Uma config de CI/CD que chama `wrangler deploy`
- ❌ Um hook pós-build no Cloudflare

## O correto para Pages

**Build command:** `npm run build`
**Output directory:** `.next`
**Deploy command:** (deixe vazio!)

Pronto! Pages faz todo o resto automaticamente.

## Se ainda assim der erro

1. Vá para **Deployments** no seu projeto Pages
2. Clique no deploy que deu erro
3. **View build log** completo
4. Procure exatamente qual comando está falhando
5. Desabilite-o (settings no Dashboard)

---

**Arquivo `wrangler.toml.disabled`:** deixei renomeado pra referência. Delete se quiser — Pages não o usa.

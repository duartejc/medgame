# ⚠️ Este projeto é CLOUDFLARE PAGES, não Workers

## Importante

**PLANTÃO+ é um Next.js app deployado em Cloudflare PAGES, não Cloudflare WORKERS.**

- ❌ NÃO use `wrangler deploy`
- ❌ NÃO crie arquivo `wrangler.toml` neste repo
- ❌ NÃO configure service bindings ou Workers aqui

## Deployment Correto

1. **Push para GitHub**
   ```bash
   git push origin main
   ```

2. **No Cloudflare Dashboard**
   - Vá para **Pages**
   - Crie um projeto > Connect to Git
   - Selecione este repo
   - Build settings:
     - Framework: **Next.js**
     - Build command: `npm run build`
     - Build output: `.next`

3. **Pronto!** Pages auto-detecta e deploya

## Se receber erro sobre Workers/wrangler

**Isso significa que há um arquivo `wrangler.toml` em outro lugar ou em CI/CD que está tentando deployer isso como Worker.**

Solução:
1. No Dashboard, vá para **Settings > Build & deploy**
2. Procure por "Deploy command" ou "Post-build command"
3. Se tiver algo com `wrangler`, **remova-o**
4. Deixe em branco (Pages não precisa)

---

**Este projeto não é um Worker.** Se você precisa de um Worker separado, crie em outro repo.

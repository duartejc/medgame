# Setup Rápido — Cloudflare Pages

⚠️ **Importante:** Não use `wrangler deploy` ou `wrangler cli` — use apenas **Dashboard ou Git**. Pages não é Workers.

## Em 5 passos você sobe a app

### 1️⃣ Prepare o repositório Git
```bash
git init
git add .
git commit -m "Initial: PLANTÃO+ MVP"
git remote add origin https://github.com/SEU_USER/plantao-medgame.git
git push -u origin main
```

### 2️⃣ Conecte no Cloudflare Dashboard
1. Vá para https://dash.cloudflare.com/
2. **Pages** > **Create project** > **Connect to Git**
3. Selecione seu repositório (`plantao-medgame`)
4. Clique **Next**

### 3️⃣ Configure o Build
A tela deve pré-preencher assim:

```
Framework: Next.js
Build command: npm run build
Build output directory: .next
Root directory: (deixe vazio)
Environment: (deixe vazio por enquanto)
```

Se não estiver pré-preenchido, digite esses valores. Depois: **Save and Deploy**

### 4️⃣ Aguarde o primeiro build (2-3 min)
- Você verá "Building..." depois "Deployment successful"
- URL será algo como `https://plantao-medgame.pages.dev`
- Se falhar, veja os logs (clique em "View build log")

### 5️⃣ Configure Variáveis de Ambiente
Agora sua app está up mas **as APIs de IA não funcionam** (falta a chave).

**No Dashboard:**
1. Vá para seu projeto Pages
2. **Settings** > **Environment variables**
3. Clique **Add variables**

**Adicione:**

| Nome | Valor | Tipo |
|---|---|---|
| `DEEPSEEK_API_KEY` | `sk-...sua-chave...` | **Secret** (importante!) |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Standard |

4. Clique **Save**
5. **Redeploy** o projeto (vá para **Deployments**, clique no último, clique **Redeploy**)

---

**Pronto!** Em 5-10 minutos você tem a app ao vivo com:
- ✅ Jogo rodando
- ✅ Paciente IA respondendo
- ✅ Debrief gerado
- ✅ Leads salvando (localmente, depois KV)

---

## Se der erro na build

### "Build failed" / "Command failed"
1. Clique em **View build log**
2. Procure por `error:` ou `Error:`
3. Comum:
   - **Falta de node_modules**: `npm install` no seu PC e comita `package-lock.json`
   - **TypeScript error**: rode `npm run build` localmente e corrija

### "App loads but APIs don't work"
- ✅ Você fez o redeploy **após** adicionar a secret `DEEPSEEK_API_KEY`?
- ✅ A secret está marcada como **Secret** (não Standard)?
- Se sim, limpe cache do navegador (Ctrl+Shift+Del) e recarregue

### "Leads não salvam"
No MVP, leads salvam **localmente** (`data/leads.json`). Isso só funciona em dev.

Em produção (Cloudflare Pages), o fallback em `app/api/lead/route.ts` tenta usar **Cloudflare KV**, que não está configurado ainda.

**Para habilitar KV:**
1. Vá para **Workers & Pages** > **KV** no Dashboard
2. Clique **Create namespace**
3. Nome: `leads-kv` > **Create**
4. Volte pro seu projeto Pages
5. **Settings** > **Functions** > **KV namespace bindings**
6. Clique **Add binding**:
   - Variable: `LEADS_KV`
   - Namespace: `leads-kv`
7. **Save** > **Redeploy**

Agora leads salvam em KV (replicado globalmente!).

---

## URLs Úteis

- **Seu app**: https://plantao-medgame.pages.dev (ajuste o nome)
- **Logs**: Dashboard > Pages > Seu projeto > Deployments > último > View log
- **Settings**: Dashboard > Pages > Seu projeto > Settings
- **KV**: Dashboard > Workers & Pages > KV

---

## Se tudo der errado

1. Vá para **Deployments** > clique no deploy que deu erro
2. **View build log** e procure a mensagem de erro
3. Se for `Node version`, tente outro node (`v18`, `v20`)
4. Se for `dependency`, rode `npm install` local e commita
5. Se não conseguir resolver em 10 min, [abra issue aqui](https://github.com/cloudflare/workers-sdk/issues)

---

**Boa sorte! 🚀**

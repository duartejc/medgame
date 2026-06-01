# Deploy na Vercel — Super Rápido

Vercel é a forma **mais simples** de deployer Next.js. Sem configurações complicadas.

## Em 3 passos você sobe

### 1️⃣ Push para GitHub
```bash
git push origin main
```

### 2️⃣ Conecte no Vercel
1. Vá para https://vercel.com/new
2. Clique **Import Git Repository**
3. Selecione seu repo (`plantao-medgame`)
4. Vercel auto-detecta Next.js ✨
5. Clique **Deploy**

### 3️⃣ Configure variáveis de ambiente
Enquanto deploya (ou depois):

1. Vá para **Settings** > **Environment Variables**
2. Adicione:
   - `DEEPSEEK_API_KEY` = sua chave
   - `DEEPSEEK_MODEL` = `deepseek-chat`
3. **Save**
4. Clique **Redeploy** no último deployment

---

**Pronto!** Em ~1 minuto seu app está ao vivo em `https://plantao-medgame.vercel.app`

## Diferenças vs Cloudflare

| Coisa | Vercel | Cloudflare Pages |
|---|---|---|
| Setup | 2 min | 20 min (muita config) |
| Next.js suporte | ✅ Perfeito | ✅ Ok, mas com Workers |
| Env vars | ✅ Simples | ✅ Funciona |
| KV / Persistência | ❌ Precisa DB externa | ✅ Nativa (KV) |
| Custo | Grátis + hobby | Grátis (Paid melhor) |

Para o MVP, **Vercel é melhor** — menos fricção, mais tempo pra features.

---

## Mais tarde (Produção)

Quando tiver tráfego real:
- Adicione **Supabase** ou **MongoDB** pra leads (em vez de KV)
- Configure **Analytics** (Vercel tem nativo)
- Domine **Environment** (staging vs prod)

Por enquanto: **Vercel = felicidade** 😄

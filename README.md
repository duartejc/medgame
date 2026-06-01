# PLANTÃO+ — protótipo (MVP Fase 0)

Simulador de plantão para estudantes de medicina e novos médicos. O jogador
recebe um caso no PS, conversa com o **paciente movido a IA**, pede exames,
decide a conduta e recebe um **desfecho** + **debrief** no personagem do nosso
**Assistente Clínico com IA** (o produto que estes leads alimentam).

## Como rodar

```bash
npm install
cp .env.example .env.local      # e cole sua DEEPSEEK_API_KEY
npm run dev                     # http://localhost:3000
```

Sem a chave, o jogo roda mas o paciente não responde e o debrief cai no
fallback determinístico (o desfecho/score continuam funcionando — são
calculados localmente em `lib/engine.ts`).

## Arquitetura

```
app/page.tsx          Jogo (máquina de estados: anamnese→exames→conduta→desfecho→lead)
app/api/patient       IA encena o paciente (DeepSeek, em personagem)
app/api/judge         Desfecho determinístico + debrief gerado por IA
app/api/lead          Captura de lead (protótipo: grava em data/leads.json)
lib/cases.ts          Conteúdo: 1 caso = 1 objeto (a "verdade" fica oculta)
lib/engine.ts         Motor de score/desfecho (determinístico, auditável)
lib/deepseek.ts       Cliente OpenAI-compatible para DeepSeek
```

## O que este protótipo prova

- O loop é divertido e educativo (paciente conversável + decisão sob pressão de tempo).
- A IA é o coração: encenação do paciente + tutoria personalizada no debrief.
- O funil de marketing: hook sem login → resultado compartilhável → captura de lead segmentado.
- O fio com o produto: o debrief é literalmente uma demo do Assistente Clínico.

## Próximos passos (Fase 1 — MVP)

- Mais casos (8–10 templates de queixa) + geração procedural por IA.
- Persistência real (Supabase) + auth magic-link + ranking.
- "Caso do dia" compartilhável (estilo Wordle).
- Analytics de funil (PostHog) + webhook para o CRM.

## Deploy

Veja [DEPLOY.md](DEPLOY.md) para instruções completas.

**TL;DR:**
```bash
# Localmente
npm install && npm run dev

# Deploy na Cloudflare Pages (git + Dashboard)
git push origin main
# Depois configure DEEPSEEK_API_KEY + KV binding no Dashboard

# Ou CLI (imediato)
npm run deploy:cf-pages
```

Apps em produção em `https://seu-projeto.pages.dev`.

## Hardening antes de produção

- `lib/cases.ts` é importado no client — a "verdade" do caso vai no bundle.
  Em produção, servir ao client só uma visão sanitizada (sem `correct`/`harmful`/`truth`).
- Rate limit nas rotas de IA; validação de input; custo por sessão.
- Leads persistem em Cloudflare KV (replicado globalmente); webhook → CRM em produção.

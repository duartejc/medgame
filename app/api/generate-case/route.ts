import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/deepseek";

export const runtime = "nodejs";

const SPECIALTIES = [
  "Emergência / Cardiologia",
  "Emergência / Pneumologia",
  "Emergência / Neurologia",
  "Emergência / Gastroenterologia",
  "Emergência / Endocrinologia",
  "Emergência / Nefrologia",
  "Emergência / Infectologia",
];

const DIFFICULTIES: Array<"fácil" | "média" | "difícil"> = ["fácil", "média", "difícil"];

const SYSTEM = `Você é um especialista em educação médica, criando casos clínicos para o simulador PLANTÃO+.
Gere casos clinicamente precisos, baseados em guidelines atuais, com dados plausíveis para um pronto-socorro.
Responda APENAS com JSON válido (sem markdown, sem texto fora do objeto).`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    specialty?: string;
    difficulty?: string;
  };

  const specialty = body.specialty || SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const difficulty = body.difficulty || DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];

  const prompt = `Crie um caso clínico para o simulador PLANTÃO+ com as seguintes características:
- Especialidade: ${specialty}
- Dificuldade: ${difficulty}

Retorne um objeto JSON com EXATAMENTE esta estrutura (sem campos extras, sem markdown):

{
  "id": "gerado-001",
  "title": "Título curto e descritivo do caso",
  "specialty": "${specialty}",
  "difficulty": "${difficulty}",
  "patient": {
    "name": "Nome completo (use Sr./Sra.)",
    "age": 45,
    "sex": "M",
    "persona": "Descrição de como o paciente fala, age e se comporta durante o atendimento (2-3 frases detalhadas)"
  },
  "chiefComplaint": "Queixa principal em 1 frase curta",
  "scene": "Cena de chegada ao PS — o que a equipe vê (2-3 frases vívidas)",
  "vitals": {
    "pa": "130/85",
    "fc": 98,
    "fr": 20,
    "sat": 96,
    "temp": 37.2,
    "glicemia": 110
  },
  "truth": {
    "diagnosis": "Diagnóstico completo e específico",
    "keyHistory": [
      "Fato clínico 1 — o que o paciente revelaria ao ser perguntado",
      "Fato clínico 2",
      "Fato clínico 3",
      "Fato clínico 4",
      "Fato clínico 5"
    ]
  },
  "questions": [
    { "id": "q1", "ask": "Pergunta do médico correspondente ao fato 1", "tag": "Rótulo curto", "flag": false },
    { "id": "q2", "ask": "Pergunta do médico correspondente ao fato 2", "tag": "Rótulo curto", "flag": true },
    { "id": "q3", "ask": "Pergunta do médico correspondente ao fato 3", "tag": "Rótulo curto", "flag": false },
    { "id": "q4", "ask": "Pergunta do médico correspondente ao fato 4", "tag": "Rótulo curto", "flag": false },
    { "id": "q5", "ask": "Pergunta do médico correspondente ao fato 5", "tag": "Rótulo curto", "flag": true }
  ],
  "exams": [
    { "id": "ex1", "label": "Nome do exame", "cost": 5, "category": "beira_leito", "result": "Resultado descritivo e clinicamente preciso", "redFlag": true },
    { "id": "ex2", "label": "Nome do exame 2", "cost": 20, "category": "laboratorio", "result": "Resultado descritivo", "redFlag": false },
    { "id": "ex3", "label": "Nome do exame 3", "cost": 15, "category": "imagem", "result": "Resultado descritivo", "redFlag": false },
    { "id": "ex4", "label": "Nome do exame 4", "cost": 10, "category": "exame_fisico", "result": "Resultado descritivo", "redFlag": true }
  ],
  "hypotheses": [
    { "id": "h_correta", "label": "Diagnóstico correto" },
    { "id": "h2", "label": "Diagnóstico diferencial plausível" },
    { "id": "h3", "label": "Outro diferencial" },
    { "id": "h4", "label": "Diferencial menos provável" },
    { "id": "h5", "label": "Diagnóstico improvável mas citável" }
  ],
  "correctHypothesisId": "h_correta",
  "conducts": [
    { "id": "c1", "label": "Conduta correta e crítica — se faltar, piora o desfecho", "correct": true, "critical": true },
    { "id": "c2", "label": "Conduta correta e crítica 2", "correct": true, "critical": true },
    { "id": "c3", "label": "Conduta correta mas não crítica", "correct": true },
    { "id": "c4", "label": "Conduta correta mas não crítica 2", "correct": true },
    { "id": "c5", "label": "Conduta prejudicial — contraindicada neste caso", "correct": false, "harmful": true },
    { "id": "c6", "label": "Conduta inadequada — sem indicação", "correct": false, "harmful": true }
  ],
  "timeBudget": 60,
  "guideline": "Resumo da conduta correta baseada em guidelines atuais (3-4 frases didáticas)"
}

REGRAS OBRIGATÓRIAS:
1. keyHistory e questions devem ter o mesmo número de itens (5 a 7), com cada question correspondendo ao keyHistory de mesmo índice
2. flag: true nas questions que revelam achados mais críticos/importantes
3. exams: inclua 3-5 exames variados (pelo menos 1 beira_leito, 1 laboratorio, 1 imagem) com redFlag:true nos que mudam conduta
4. conducts: 2-3 corretas (ao menos 1 critical), 1-2 harmful — totalizando 5-8 condutas
5. hypotheses: exatamente 5 opções, 1 correta (id = correctHypothesisId)
6. vitals: clinicamente coerentes com a urgência da cena (ex: saturação baixa se há dispneia)
7. glicemia: inclua apenas se relevante para o caso (diabetes, estado de consciência, etc)
8. timeBudget: entre 30 e 90 minutos conforme a gravidade
9. O caso deve ser educativamente valioso, desafiador e clinicamente correto`;

  try {
    const resp = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 3500,
      temperature: 0.9,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });

    const text = resp.choices[0]?.message?.content || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: "LLM não retornou JSON válido" }, { status: 500 });
    }

    const generated = JSON.parse(text.slice(start, end + 1));

    // Stamp with timestamp so id is unique across generations
    generated.id = `gen-${Date.now()}`;

    return NextResponse.json({ case: generated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar caso";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

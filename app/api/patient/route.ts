import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/deepseek";
import { getCase } from "@/lib/cases";

export const runtime = "nodejs";

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const { caseId, history, message } = (await req.json()) as {
      caseId: string;
      history: Turn[];
      message: string;
    };

    const medCase = getCase(caseId);
    if (!medCase) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

    const systemPrompt =
      `Você está INTERPRETANDO um paciente em uma simulação clínica para treino de médicos. ` +
      `Permaneça SEMPRE no personagem. Você é o paciente, não um assistente.\n\n` +
      `PACIENTE: ${medCase.patient.name}, ${medCase.patient.age} anos, sexo ${medCase.patient.sex}.\n` +
      `PERSONA: ${medCase.patient.persona}\n` +
      `QUEIXA: ${medCase.chiefComplaint}\n\n` +
      `FATOS DA SUA HISTÓRIA (revele APENAS quando o médico perguntar algo relacionado; ` +
      `não entregue tudo de uma vez; não invente nada além disto):\n` +
      medCase.truth.keyHistory.map((f) => `- ${f}`).join("\n") +
      `\n\nREGRAS:\n` +
      `- Fale como um paciente leigo, em 1-3 frases curtas. Sem termos médicos.\n` +
      `- NUNCA diga seu diagnóstico nem dê dicas clínicas. Você não sabe o que tem.\n` +
      `- Se perguntarem algo fora da sua história, responda de forma plausível e leiga (ex.: "não, doutor").\n` +
      `- Demonstre o desconforto da persona (dor, ansiedade) no tom.\n` +
      `- Se o médico pedir exame físico/exames, apenas reaja ("tá bom, doutor") — os resultados aparecem por outro canal.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((t) => ({ role: t.role as "user" | "assistant", content: t.content })),
      { role: "user" as const, content: message },
    ];

    const resp = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 200,
      messages,
    });

    const text = resp.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ reply: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

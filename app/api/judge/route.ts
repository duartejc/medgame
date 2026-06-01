import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/deepseek";
import { getCase } from "@/lib/cases";
import { evaluate, outcomeLabel } from "@/lib/engine";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { caseId, hypothesisId, conductIds, examsOrdered, timeUsed } =
      (await req.json()) as {
        caseId: string;
        hypothesisId: string | null;
        conductIds: string[];
        examsOrdered: string[];
        timeUsed: number;
      };

    const medCase = getCase(caseId);
    if (!medCase) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });

    // 1) Desfecho clínico calculado de forma determinística (justo e auditável).
    const result = evaluate(medCase, hypothesisId, conductIds, timeUsed);

    // 2) IA gera o DEBRIEF no personagem do produto: o assistente clínico com IA.
    const chosenHyp =
      medCase.hypotheses.find((h) => h.id === hypothesisId)?.label || "nenhuma hipótese";
    const examLabels = medCase.exams
      .filter((e) => examsOrdered.includes(e.id))
      .map((e) => e.label);

    const system = `Você é o "Assistente Clínico" — a IA da nossa marca que apoia médicos à beira do leito. ` +
      `Acabou de acompanhar um médico em treino resolver um caso simulado. Faça um debrief curto, ` +
      `acolhedor e didático, do jeito que um bom preceptor faria. Use 2ª pessoa ("você"). ` +
      `Seja específico sobre o raciocínio, não genérico. Português do Brasil.`;

    const prompt =
      `CASO: ${medCase.title}\n` +
      `DIAGNÓSTICO CORRETO: ${medCase.truth.diagnosis}\n` +
      `DIRETRIZ: ${medCase.guideline}\n\n` +
      `O QUE O JOGADOR FEZ:\n` +
      `- Exames pedidos: ${examLabels.join(", ") || "nenhum"}\n` +
      `- Hipótese escolhida: ${chosenHyp}\n` +
      `- Condutas certas: ${result.chosenCorrect.join(", ") || "nenhuma"}\n` +
      `- Condutas prejudiciais: ${result.chosenHarmful.join(", ") || "nenhuma"}\n` +
      `- Condutas críticas que FALTARAM: ${result.missedCritical.join(", ") || "nenhuma"}\n` +
      `- Tempo usado: ${result.timeUsed} min (orçamento ${medCase.timeBudget} min)\n` +
      `- Desfecho: ${outcomeLabel(result.state)} (score ${result.score}/100)\n\n` +
      `Escreva o debrief em JSON com este formato EXATO:\n` +
      `{\n  "headline": "uma frase de impacto sobre o desempenho",\n` +
      `  "acertos": ["..."],\n  "ajustes": ["..."],\n` +
      `  "ensino": "1 parágrafo curto ensinando o ponto-chave do caso",\n` +
      `  "gancho": "1 frase conectando ao valor de ter um assistente clínico com IA no plantão real"\n}\n` +
      `Responda APENAS com o JSON, sem texto fora dele.`;

    let debrief: {
      headline: string;
      acertos: string[];
      ajustes: string[];
      ensino: string;
      gancho: string;
    };

    try {
      const resp = await getClient().chat.completions.create({
        model: MODEL,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      const text = resp.choices[0]?.message?.content || "";
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      debrief = JSON.parse(json);
    } catch {
      // Fallback determinístico caso a IA/key falhe — o jogo nunca trava.
      debrief = {
        headline: `${outcomeLabel(result.state)} — score ${result.score}/100`,
        acertos: result.chosenCorrect,
        ajustes: result.missedCritical.length
          ? [`Faltaram condutas críticas: ${result.missedCritical.join(", ")}`]
          : result.chosenHarmful.length
          ? [`Condutas que prejudicaram: ${result.chosenHarmful.join(", ")}`]
          : ["Refine a priorização e o tempo de decisão."],
        ensino: medCase.guideline,
        gancho:
          "No plantão real, um assistente clínico com IA te aponta a conduta crítica antes que o tempo aperte.",
      };
    }

    return NextResponse.json({ result, debrief, correctDiagnosis: medCase.truth.diagnosis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

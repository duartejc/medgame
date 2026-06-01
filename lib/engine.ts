import type { Case } from "./cases";

export type OutcomeState = "recuperado" | "estavel" | "complicacao" | "obito";

export type Result = {
  state: OutcomeState;
  score: number; // 0-100
  correctDiagnosis: boolean;
  criticalDone: boolean;
  chosenCorrect: string[]; // labels
  chosenHarmful: string[]; // labels
  missedCritical: string[]; // labels
  timeUsed: number;
  overTime: boolean;
};

const OUTCOME_LABEL: Record<OutcomeState, string> = {
  recuperado: "Paciente recuperado",
  estavel: "Paciente estável",
  complicacao: "Complicação evitável",
  obito: "Óbito",
};

export function outcomeLabel(s: OutcomeState) {
  return OUTCOME_LABEL[s];
}

// Cálculo determinístico do desfeche clínico a partir das decisões.
export function evaluate(
  medCase: Case,
  hypothesisId: string | null,
  conductIds: string[],
  timeUsed: number
): Result {
  const correctDiagnosis = hypothesisId === medCase.correctHypothesisId;

  const selected = medCase.conducts.filter((c) => conductIds.includes(c.id));
  const chosenCorrect = selected.filter((c) => c.correct).map((c) => c.label);
  const chosenHarmful = selected.filter((c) => c.harmful).map((c) => c.label);

  const criticals = medCase.conducts.filter((c) => c.critical);
  const missedCritical = criticals
    .filter((c) => !conductIds.includes(c.id))
    .map((c) => c.label);
  const criticalDone = missedCritical.length === 0;

  const overTime = timeUsed > medCase.timeBudget;

  // ---- Score ----
  let score = 0;
  if (correctDiagnosis) score += 40;
  score += criticals.filter((c) => conductIds.includes(c.id)).length * 15;
  const otherCorrect = selected.filter((c) => c.correct && !c.critical).length;
  score += Math.min(otherCorrect * 5, 20);
  score -= chosenHarmful.length * 25;
  if (overTime) score -= 15;
  score = Math.max(0, Math.min(100, score));

  // ---- Estado do paciente ----
  let state: OutcomeState;
  const harmed = chosenHarmful.length > 0;
  if ((harmed || !criticalDone) && !correctDiagnosis) {
    state = "obito";
  } else if (harmed || !criticalDone) {
    state = "complicacao";
  } else if (correctDiagnosis && criticalDone && !harmed) {
    state = overTime ? "estavel" : "recuperado";
  } else {
    state = "estavel";
  }

  return {
    state,
    score,
    correctDiagnosis,
    criticalDone,
    chosenCorrect,
    chosenHarmful,
    missedCritical,
    timeUsed,
    overTime,
  };
}

// =============================================================
// Modelo de conteúdo: 1 caso = 1 objeto.
// `truth` é OCULTO do jogador — só a IA do paciente e o motor de
// desfecho enxergam. O jogador descobre via anamnese e exames.
// =============================================================

export type Vitals = {
  pa: string; // pressão arterial
  fc: number; // freq. cardíaca
  fr: number; // freq. respiratória
  sat: number; // saturação O2
  temp: number; // temperatura
  glicemia?: number;
};

export type Exam = {
  id: string;
  label: string;
  cost: number; // custo em minutos do plantão
  category: "exame_fisico" | "laboratorio" | "imagem" | "beira_leito";
  result: string; // revelado ao pedir
  redFlag?: boolean; // achado que muda a conduta
};

export type Conduct = {
  id: string;
  label: string;
  correct: boolean;
  critical?: boolean; // conduta que, se faltar, leva a desfecho ruim
  harmful?: boolean; // conduta que piora o paciente se escolhida
};

export type Hypothesis = { id: string; label: string };

export type Case = {
  id: string;
  title: string;
  specialty: string;
  difficulty: "fácil" | "média" | "difícil";
  patient: {
    name: string;
    age: number;
    sex: "M" | "F";
    persona: string; // como o paciente fala/age — usado pela IA
  };
  chiefComplaint: string;
  scene: string;
  vitals: Vitals;
  truth: {
    diagnosis: string;
    keyHistory: string[]; // fatos revelados quando o jogador pergunta
  };
  exams: Exam[];
  hypotheses: Hypothesis[];
  correctHypothesisId: string;
  conducts: Conduct[];
  timeBudget: number; // minutos disponíveis antes da fila apertar
  guideline: string; // resumo de conduta correta p/ o debrief
};

export const CASES: Case[] = [
  {
    id: "iam-001",
    title: "Dor torácica no plantão",
    specialty: "Emergência / Cardiologia",
    difficulty: "média",
    patient: {
      name: "Sr. Antônio",
      age: 58,
      sex: "M",
      persona:
        "Homem de 58 anos, ansioso e suado, com dor no peito há cerca de 40 minutos. " +
        "Fala em frases curtas porque está desconfortável. Minimiza um pouco os sintomas ('acho que foi a comida'), " +
        "mas responde com sinceridade quando perguntado diretamente. É hipertenso, fuma e o pai morreu do coração cedo. " +
        "Não sabe termos médicos; descreve as coisas de forma leiga.",
    },
    chiefComplaint: "Dor no peito que começou há ~40 minutos",
    scene:
      "São 02h14 do plantão. A enfermagem traz o Sr. Antônio direto para a sala de emergência: " +
      "ele chegou pálido, sudoreico, com a mão sobre o peito. Está consciente e orientado.",
    vitals: { pa: "150/95", fc: 102, fr: 22, sat: 95, temp: 36.4, glicemia: 138 },
    truth: {
      diagnosis: "Infarto agudo do miocárdio com supra de ST (IAMCSST) de parede inferior",
      keyHistory: [
        "Dor em aperto/opressão no centro do peito, irradiando para o braço esquerdo e mandíbula.",
        "Começou em repouso, assistindo TV, há cerca de 40 minutos; é a pior dor que já sentiu.",
        "Acompanhada de sudorese fria, náusea e sensação de falta de ar.",
        "Não melhorou com nada; nunca teve dor parecida antes.",
        "Hipertenso, faz uso irregular de losartana. Fumante de 1 maço/dia há 30 anos.",
        "Pai faleceu de 'ataque cardíaco' aos 54 anos.",
        "Nega febre, tosse, trauma ou dor que piora ao respirar/apalpar.",
      ],
    },
    exams: [
      {
        id: "ecg",
        label: "ECG de 12 derivações",
        cost: 5,
        category: "beira_leito",
        result:
          "Supradesnivelamento de ST em DII, DIII e aVF (parede inferior), com infra recíproco em DI e aVL. " +
          "Ritmo sinusal, FC 102.",
        redFlag: true,
      },
      {
        id: "troponina",
        label: "Troponina",
        cost: 30,
        category: "laboratorio",
        result: "Troponina elevada (5x o limite). Obs: resultado demora — não atrase a conduta esperando por ela.",
      },
      {
        id: "exame_fisico",
        label: "Exame físico dirigido",
        cost: 5,
        category: "exame_fisico",
        result:
          "Ausculta cardíaca sem sopros; pulmões limpos. Sem turgência jugular. " +
          "Dor não reproduzível à palpação do tórax. Extremidades frias e sudoreicas.",
      },
      {
        id: "rx",
        label: "Raio-X de tórax",
        cost: 20,
        category: "imagem",
        result: "Sem alargamento de mediastino, sem pneumotórax, sem consolidações. Área cardíaca normal.",
      },
      {
        id: "dimero",
        label: "D-dímero",
        cost: 25,
        category: "laboratorio",
        result: "Levemente elevado (inespecífico). Não direciona o diagnóstico aqui.",
      },
    ],
    hypotheses: [
      { id: "iam", label: "Síndrome coronariana aguda (IAM com supra de ST)" },
      { id: "tep", label: "Tromboembolismo pulmonar" },
      { id: "disseccao", label: "Dissecção de aorta" },
      { id: "dispepsia", label: "Dispepsia / dor de origem gástrica" },
      { id: "costocondrite", label: "Dor musculoesquelética (costocondrite)" },
    ],
    correctHypothesisId: "iam",
    conducts: [
      { id: "mov", label: "Monitorização, oxigênio se SatO2<90%, acesso venoso", correct: true },
      { id: "aas", label: "AAS 300mg mastigável", correct: true, critical: true },
      { id: "antiplaq2", label: "Segundo antiagregante (ticagrelor/clopidogrel)", correct: true },
      { id: "anticoag", label: "Anticoagulação (heparina)", correct: true },
      { id: "reperfusao", label: "Acionar reperfusão urgente (angioplastia primária / trombolítico)", correct: true, critical: true },
      { id: "nitrato", label: "Nitrato sublingual para alívio da dor", correct: true },
      { id: "alta", label: "Liberar para casa com sintomáticos", correct: false, harmful: true },
      { id: "omeprazol", label: "Omeprazol + observação por dispepsia", correct: false, harmful: true },
      { id: "tc_aorta", label: "Aguardar angio-TC de aorta antes de qualquer conduta", correct: false, harmful: true },
    ],
    timeBudget: 60,
    guideline:
      "Dor torácica de alto risco: ECG em até 10 min é prioridade absoluta. Supra de ST em parede inferior (DII/DIII/aVF) " +
      "fecha IAMCSST e indica REPERFUSÃO IMEDIATA (angioplastia primária preferencial; trombolítico se indisponível em tempo). " +
      "MONA-B perdeu força como mnemônico rígido, mas: AAS 300mg mastigável o quanto antes, segundo antiagregante, anticoagulação, " +
      "controle de dor (nitrato com cautela — evitar em IAM inferior/VD com hipotensão), oxigênio só se SatO2<90%. " +
      "Não esperar troponina para tratar supra de ST. Tempo é músculo: cada minuto de atraso aumenta a área infartada.",
  },
];

export function getCase(id: string): Case | undefined {
  return CASES.find((c) => c.id === id);
}

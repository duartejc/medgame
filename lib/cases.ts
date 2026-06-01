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
  // ── Caso 2: Crise Asmática Grave ─────────────────────────
  {
    id: "asma-001",
    title: "Crise asmática grave",
    specialty: "Emergência / Pneumologia",
    difficulty: "difícil",
    patient: {
      name: "Marina Alves",
      age: 24,
      sex: "F",
      persona:
        "Você é Marina Alves, 24 anos, estudante. Está com crise asmática grave, chegou ao PS apoiada na irmã. " +
        "Fala apenas palavras soltas entre respiradas — está exausta e assustada. " +
        "Quando a dispneia é muito intensa, a irmã (presente) responde por você. Não usa termos médicos. " +
        "Responda em frases muito curtas, entrecortadas. Demonstre cansaço e medo no tom.",
    },
    chiefComplaint: "Falta de ar e chiado no peito há ~4h, piorando",
    scene:
      "A paciente chega ao PS apoiada na irmã. Senta inclinada para frente, respira rápido e fala em frases muito curtas. Triagem: vermelho.",
    vitals: { pa: "138/86", fc: 124, fr: 32, sat: 88, temp: 36.7 },
    truth: {
      diagnosis: "Crise asmática grave / quase fatal",
      keyHistory: [
        "Falta de ar começou há ~4 horas após limpar casa cheia de poeira. Piorou progressivamente.",
        "Tem asma desde criança. Já internou na UTI uma vez na adolescência.",
        "Usou salbutamol (bombinha) 6-7 vezes hoje. Não está adiantando quase nada.",
        "Fala apenas palavras soltas — irmã responde pela paciente quando questionada.",
        "Sem febre. Aperto no peito e chiado intenso. Sem catarro.",
      ],
    },
    exams: [
      {
        id: "ausc",
        label: "Ausculta pulmonar",
        cost: 3,
        category: "exame_fisico",
        result:
          "Sibilos expiratórios difusos, murmúrio vesicular globalmente reduzido. Tempo expiratório prolongado.",
        redFlag: true,
      },
      {
        id: "gaso",
        label: "Gasometria arterial",
        cost: 20,
        category: "laboratorio",
        result:
          "pH 7,32 · pCO₂ 48 mmHg · pO₂ 70 mmHg · HCO₃ 23. pCO₂ 'normalizando' em paciente taquipneica = fadiga respiratória.",
        redFlag: true,
      },
      {
        id: "rx",
        label: "Raio-X de tórax",
        cost: 20,
        category: "imagem",
        result:
          "Hiperinsuflação pulmonar, sem condensações nem pneumotórax. Afasta complicações.",
      },
      {
        id: "ecg",
        label: "ECG",
        cost: 10,
        category: "beira_leito",
        result:
          "Taquicardia sinusal, sem alterações isquêmicas. Compatível com esforço respiratório.",
      },
    ],
    hypotheses: [
      { id: "asma_grave", label: "Crise asmática grave / quase fatal" },
      { id: "tep", label: "Tromboembolismo pulmonar" },
      { id: "pneumotorax", label: "Pneumotórax espontâneo" },
      { id: "dpoc", label: "Exacerbação de DPOC" },
      { id: "anafilaxia", label: "Anafilaxia com broncoespasmo" },
    ],
    correctHypothesisId: "asma_grave",
    conducts: [
      { id: "o2", label: "O₂ suplementar", correct: true, critical: true },
      { id: "b2", label: "β₂ + ipratrópio nebulização (salbutamol + brometo de ipratrópio)", correct: true, critical: true },
      { id: "cort", label: "Corticoide sistêmico (hidrocortisona / prednisolona precoce)", correct: true, critical: true },
      { id: "mg", label: "Sulfato de magnésio IV (crise grave refratária)", correct: true },
      { id: "atb", label: "Antibiótico de rotina (sem evidência de infecção)", correct: false, harmful: true },
      { id: "sed", label: "Sedação para 'acalmar' (contraindicado — risco de PCR)", correct: false, harmful: true },
    ],
    timeBudget: 45,
    guideline:
      "Asma grave: O₂ alvo SpO₂ ≥94%, β₂-agonista + ipratrópio nebulizados em série, " +
      "corticoide sistêmico PRECOCE (hidrocortisona 200mg IV ou prednisolona 40mg VO). " +
      "Magnésio IV 2g em crise grave refratária. SEDAÇÃO É CONTRAINDICADA sem via aérea segura. " +
      "Monitorar pCO₂ — 'normalização' em paciente exausta é sinal de alarme para fadiga e parada respiratória iminente.",
  },
];

export function getCase(id: string): Case | undefined {
  return CASES.find((c) => c.id === id);
}

// Caso padrão exibido no jogo (design: crise asmática)
export const FEATURED_CASE_ID = "asma-001";

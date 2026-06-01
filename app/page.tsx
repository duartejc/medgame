"use client";

import { useState, useRef, useEffect } from "react";
import { CASES } from "@/lib/cases";
import type { Result } from "@/lib/engine";
import { Footer } from "@/components/Footer";

type Phase = "intro" | "anamnese" | "exams" | "decision" | "result" | "lead";
type ChatMsg = { role: "user" | "assistant"; content: string };

const medCase = CASES[0];
const QUESTION_COST = 2; // minutos por pergunta na anamnese
const PHASE_TRANSITION_MS = 350; // duração da saída antes de mudar

const SUGGESTED = [
  "O que o senhor estava fazendo quando a dor começou?",
  "A dor irradia para algum lugar?",
  "Como o senhor descreveria a dor?",
  "O senhor tem pressão alta, fuma ou tem casos de coração na família?",
  "Já sentiu uma dor parecida antes?",
  "Veio acompanhada de mais algum sintoma?",
];

const PHASES: { id: Phase; label: string }[] = [
  { id: "anamnese", label: "Anamnese" },
  { id: "exams", label: "Exames" },
  { id: "decision", label: "Conduta" },
  { id: "result", label: "Desfecho" },
];

export default function Game() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [isExiting, setIsExiting] = useState(false);
  const [time, setTime] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [patientTyping, setPatientTyping] = useState(false);
  const [exams, setExams] = useState<string[]>([]);
  const [hypothesis, setHypothesis] = useState<string | null>(null);
  const [conducts, setConducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [debrief, setDebrief] = useState<any>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ x: number; y: number; value: number } | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, patientTyping]);

  function transitionTo(nextPhase: Phase) {
    setIsExiting(true);
    setTimeout(() => {
      setPhase(nextPhase);
      setIsExiting(false);
    }, PHASE_TRANSITION_MS);
  }

  const overBudget = time > medCase.timeBudget;

  async function askPatient(question: string) {
    if (!question.trim() || patientTyping) return;
    const history = chat;
    setChat([...history, { role: "user", content: question }]);
    setInput("");
    setTime((t) => t + QUESTION_COST);
    setPatientTyping(true);
    setError("");
    try {
      const res = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: medCase.id, history, message: question }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChat((c) => [...c, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setError(e.message || "Falha ao falar com o paciente.");
      setChat((c) => c.slice(0, -1)); // desfaz a pergunta sem resposta
    } finally {
      setPatientTyping(false);
    }
  }

  function toggleExam(id: string) {
    setExams((prev) => {
      if (prev.includes(id)) return prev;
      const ex = medCase.exams.find((e) => e.id === id)!;
      setTime((t) => t + ex.cost);
      return [...prev, id];
    });
  }

  function toggleConduct(id: string) {
    setConducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function confirmConduct() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: medCase.id,
          hypothesisId: hypothesis,
          conductIds: conducts,
          examsOrdered: exams,
          timeUsed: time,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      setDebrief(data.debrief);

      // Atualiza XP e streak baseado no resultado
      const gainedXp = data.result.score;
      setXp((prev) => Math.min(prev + gainedXp, 100));

      // Mostra popup de XP
      setXpPopup({ x: window.innerWidth / 2, y: window.innerHeight / 2, value: gainedXp });
      setTimeout(() => setXpPopup(null), 1200);

      // Incrementa streak se recuperou
      if (data.result.state === "recuperado") {
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0); // Reseta streak
      }

      transitionTo("result");
    } catch (e: any) {
      setError(e.message || "Falha ao calcular o desfecho.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    transitionTo("intro");
    setTime(0);
    setChat([]);
    setExams([]);
    setHypothesis(null);
    setConducts([]);
    setResult(null);
    setDebrief(null);
    setError("");
    // Mantém XP e streak entre casos
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="logo">🫀</span>
          Plantão<b>+</b>
        </div>
        {phase !== "intro" && phase !== "lead" && (
          <div className={`clock ${overBudget ? "danger" : ""}`}>
            ⏱ <b>{time}</b> / {medCase.timeBudget} min
          </div>
        )}
      </div>

      {/* XP/Streak Meter */}
      {(xp > 0 || streak > 0) && (
        <div className="meter">
          <div className={`meter-streak ${streak > 0 ? "hot" : "cold"}`}>
            {streak > 0 ? streak : "—"}
          </div>
          <div className="meter-xp">
            <div className="label">
              ⭐ experiência
              {xp >= 100 && " · LEVEL UP! 🚀"}
            </div>
            <div className="bar">
              <div className="milestone" style={{ "--milestone-pos": "25%" } as any} />
              <div className="milestone" style={{ "--milestone-pos": "50%" } as any} />
              <div className="milestone" style={{ "--milestone-pos": "75%" } as any} />
              <div className="fill" style={{ width: `${xp}%` }} />
            </div>
            <div className="text">
              {xp}/100 XP {xp === 100 && "🎉"}
            </div>
          </div>
        </div>
      )}

      {/* XP Popup */}
      {xpPopup && (
        <div
          className="xp-popup"
          style={{
            left: `${xpPopup.x}px`,
            top: `${xpPopup.y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          +{xpPopup.value} XP
        </div>
      )}

      {phase !== "intro" && phase !== "lead" && (
        <div className="phase-nav">
          {PHASES.map((p) => (
            <div
              key={p.id}
              className={`step ${phase === p.id ? "active" : ""} ${
                PHASES.findIndex((x) => x.id === p.id) <
                PHASES.findIndex((x) => x.id === phase)
                  ? "done"
                  : ""
              }`}
            >
              {p.label}
            </div>
          ))}
        </div>
      )}

      {/* INTRO */}
      {phase === "intro" && (
        <div className={`phase ${isExiting ? "exit" : ""}`}>
          <div className="card">
            <span className="hero-kicker">🚨 Caso ao vivo · 02h14</span>
            <div style={{ marginTop: 10 }}>
              <span className="tag">{medCase.specialty}</span>
              <span className="tag alt">{medCase.difficulty}</span>
            </div>
            <h1>{medCase.title}</h1>
            <p className="muted small">{medCase.scene}</p>
            <div className="patient-row">
              <div className="avatar">{initials(medCase.patient.name)}</div>
              <div className="meta">
                <div className="nm">
                  {medCase.patient.name}, {medCase.patient.age}
                </div>
                <div className="sub">{medCase.chiefComplaint}</div>
              </div>
            </div>
            <Vitals />
          </div>
          <button className="btn-primary btn-block" onClick={() => transitionTo("anamnese")}>
            Bora salvar esse paciente →
          </button>
          <p className="center small muted" style={{ marginTop: 16 }}>
            Treino simulado · não substitui conduta médica real.
          </p>
        </div>
      )}

      {/* ANAMNESE */}
      {phase === "anamnese" && (
        <div className={`phase ${isExiting ? "exit" : ""}`}>
          <div className="card">
            <div className="patient-row" style={{ marginTop: 0, marginBottom: 14 }}>
              <div className="avatar">{initials(medCase.patient.name)}</div>
              <div className="meta">
                <div className="nm">{medCase.patient.name}</div>
                <div className="sub">😰 desconfortável · responde se você perguntar</div>
              </div>
            </div>
            <div className="chat">
              {chat.length === 0 && (
                <div className="msg patient">
                  Doutor... essa dor no peito não passa. (aperta o peito)
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`msg ${m.role === "user" ? "doctor" : "patient"}`}>
                  {m.content}
                </div>
              ))}
              {patientTyping && <div className="msg patient typing">digitando…</div>}
              <div ref={chatEnd} />
            </div>

            <div className="suggest">
              {SUGGESTED.map((q) => (
                <button key={q} onClick={() => askPatient(q)} disabled={patientTyping}>
                  {q}
                </button>
              ))}
            </div>

            <div className="chat-input">
              <input
                type="text"
                placeholder="Pergunte algo ao paciente…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askPatient(input)}
              />
              <button onClick={() => askPatient(input)} disabled={patientTyping}>
                Enviar
              </button>
            </div>
            {error && <div className="error">{error}</div>}
            <p className="hint">⏱ cada pergunta queima {QUESTION_COST} min do plantão.</p>
          </div>
          <button className="btn-primary btn-block" onClick={() => transitionTo("exams")}>
            Pedir exames →
          </button>
        </div>
      )}

      {/* EXAMS */}
      {phase === "exams" && (
        <div className={`phase ${isExiting ? "exit" : ""}`}>
          <div className="card">
            <h2>Exames e beira-leito</h2>
            <p className="small muted">
              Peça só o que vai mudar sua conduta — cada exame custa tempo e a fila aperta.
            </p>
            {medCase.exams.map((ex) => {
              const ordered = exams.includes(ex.id);
              return (
                <div key={ex.id}>
                  <div
                    className={`option ${ordered ? "selected" : ""}`}
                    onClick={() => toggleExam(ex.id)}
                  >
                    <div className="box">{ordered ? "✓" : ""}</div>
                    <div>{ex.label}</div>
                    <div className="cost">+{ex.cost} min</div>
                  </div>
                  {ordered && <div className="exam-result">{ex.result}</div>}
                </div>
              );
            })}
          </div>
          <button className="btn-primary btn-block" onClick={() => transitionTo("decision")}>
            Definir hipótese e conduta →
          </button>
        </div>
      )}

      {/* DECISION */}
      {phase === "decision" && (
        <div className={`phase ${isExiting ? "exit" : ""}`}>
          <div className="card">
            <h2>Hipótese diagnóstica</h2>
            <p className="small muted">Escolha a principal.</p>
            {medCase.hypotheses.map((h) => (
              <div
                key={h.id}
                className={`option ${hypothesis === h.id ? "selected" : ""}`}
                onClick={() => setHypothesis(h.id)}
              >
                <div className="box">{hypothesis === h.id ? "●" : ""}</div>
                <div>{h.label}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Conduta</h2>
            <p className="small muted">Selecione tudo que você faria agora.</p>
            {medCase.conducts.map((c) => (
              <div
                key={c.id}
                className={`option ${conducts.includes(c.id) ? "selected" : ""}`}
                onClick={() => toggleConduct(c.id)}
              >
                <div className="box">{conducts.includes(c.id) ? "✓" : ""}</div>
                <div>{c.label}</div>
              </div>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
          <button
            className="btn-primary btn-block"
            disabled={!hypothesis || conducts.length === 0 || loading}
            onClick={confirmConduct}
          >
            {loading ? <span className="spinner" /> : "Confirmar conduta e ver desfecho"}
          </button>
        </div>
      )}

      {/* RESULT */}
      {phase === "result" && result && debrief && (
        <div className={`phase ${isExiting ? "exit" : ""}`}>
          <div className={`outcome-banner ${result.state}`}>
            <div className="state">{stateLabel(result.state)}</div>
            <div className="score">{result.score}</div>
            <div className="muted">{debrief.headline}</div>
          </div>

          <div className="card debrief">
            <div className="ai-head">
              <span className="ai-dot" /> Debrief do seu{" "}
              <b style={{ color: "var(--violet-2)" }}>Assistente Clínico</b>
            </div>

            {debrief.acertos?.length > 0 && (
              <>
                <div className="label">O que você acertou</div>
                <ul>
                  {debrief.acertos.map((a: string, i: number) => (
                    <li key={i}>✅ {a}</li>
                  ))}
                </ul>
              </>
            )}
            {debrief.ajustes?.length > 0 && (
              <>
                <div className="label">O que ajustar</div>
                <ul>
                  {debrief.ajustes.map((a: string, i: number) => (
                    <li key={i}>⚠️ {a}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="label">Ponto-chave</div>
            <p style={{ lineHeight: 1.5, margin: 0 }}>{debrief.ensino}</p>
            <div className="label">Diagnóstico correto</div>
            <p style={{ margin: 0 }}>{medCase.title} → resposta esperada no debrief acima.</p>

            <div className="gancho">
              💡 <b>{debrief.gancho}</b>
            </div>
          </div>

          <div className="card">
            <h2>Compartilhe seu plantão</h2>
            <div className="share-card">{shareText(result)}</div>
            <div className="btn-row">
              <button onClick={() => copyShare(result)}>Copiar resultado</button>
              <button className="btn-primary" onClick={() => transitionTo("lead")}>
                Salvar streak e ver ranking →
              </button>
            </div>
          </div>

          <button onClick={reset} className="btn-block">
            Jogar outro caso
          </button>
        </div>
      )}

      {/* LEAD CAPTURE */}
      {phase === "lead" && (
        <div className={`phase ${isExiting ? "exit" : ""}`}>
          <LeadForm result={result} onDone={reset} />
        </div>
      )}

      <Footer />
    </div>
  );
}

function Vitals() {
  const v = medCase.vitals;
  const items = [
    { l: "PA", v: v.pa, warn: false },
    { l: "FC", v: `${v.fc}`, warn: v.fc > 100 },
    { l: "FR", v: `${v.fr}`, warn: v.fr > 20 },
    { l: "SatO₂", v: `${v.sat}%`, warn: v.sat < 94 },
    { l: "Temp", v: `${v.temp}°`, warn: false },
    { l: "Glicemia", v: `${v.glicemia}`, warn: false },
  ];
  return (
    <div className="vitals">
      {items.map((it) => (
        <div key={it.l} className={`vital ${it.warn ? "warn" : ""}`}>
          <div className="v">{it.v}</div>
          <div className="l">{it.l}</div>
        </div>
      ))}
    </div>
  );
}

function initials(name: string) {
  const clean = name.replace(/^(Sr|Sra|Dr|Dra)\.?\s+/i, "");
  const parts = clean.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function stateLabel(s: string) {
  return {
    recuperado: "🟢 Paciente recuperado",
    estavel: "🔵 Paciente estável",
    complicacao: "🟡 Complicação evitável",
    obito: "🔴 Óbito",
  }[s];
}

function shareText(r: Result) {
  const icon = { recuperado: "🟢", estavel: "🔵", complicacao: "🟡", obito: "🔴" }[r.state];
  const dx = r.correctDiagnosis ? "✅ Dx certo" : "❌ Dx errado";
  const crit = r.criticalDone ? "✅ Conduta crítica" : "❌ Faltou conduta crítica";
  return `PLANTÃO+ · ${medCase.title}\n${icon} Score ${r.score}/100\n${dx}  ${crit}\n⏱ ${r.timeUsed} min\n\nTreine no plantão você também 👉`;
}

function copyShare(r: Result) {
  navigator.clipboard?.writeText(shareText(r));
}

function LeadForm({ result, onDone }: { result: Result | null; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        role,
        specialty,
        lastScore: result?.score,
        lastOutcome: result?.state,
      }),
    }).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card center">
        <h1>Tudo certo! 🎉</h1>
        <p className="muted">
          Seu streak está salvo. Vamos te avisar quando o <b>caso do dia</b> sair — e te mandar
          o caso comentado da semana.
        </p>
        <div className="gancho" style={{ textAlign: "left" }}>
          💡 <b>Gostou do debrief?</b> Ele é movido pelo nosso{" "}
          <b style={{ color: "var(--violet-2)" }}>Assistente Clínico com IA</b> — o mesmo que apoia
          decisões no plantão real. Em breve no seu e-mail.
        </div>
        <button className="btn-primary btn-block" style={{ marginTop: 14 }} onClick={onDone}>
          Jogar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Salve seu progresso</h1>
      <p className="muted small">
        Mantenha seu streak, dispute o ranking e receba o caso do dia. Sem senha.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        <input
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Você é…</option>
          <option>Estudante (1º–4º ano)</option>
          <option>Estudante (internato)</option>
          <option>Médico recém-formado</option>
          <option>Residente (R1–R3)</option>
          <option>Médico especialista</option>
        </select>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          <option value="">Área de interesse…</option>
          <option>Emergência</option>
          <option>Clínica médica</option>
          <option>Cardiologia</option>
          <option>Pediatria</option>
          <option>Cirurgia</option>
          <option>Ainda decidindo</option>
        </select>
        <button
          className="btn-primary btn-block"
          disabled={!email || !role || busy}
          onClick={submit}
        >
          {busy ? <span className="spinner" /> : "Salvar e continuar"}
        </button>
      </div>
      <button className="btn-block" style={{ marginTop: 8 }} onClick={onDone}>
        Agora não
      </button>
    </div>
  );
}

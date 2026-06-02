"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CASES, FEATURED_CASE_ID, Case, Vitals, Exam } from "@/lib/cases";

// ── Tipos ──────────────────────────────────────────────────────
type Phase = 0 | 1 | 2 | 3 | 4 | 5;
type ChatMsg = { side: "doctor" | "patient"; text: string; tag?: string; key: string };

type VitalUI = {
  id: string;
  label: string;
  value: string;
  unit: string;
  state: "crit" | "warn" | "ok";
  note: string;
};

type QuestionType = {
  id: string;
  ask: string;
  fallback: string;
  tag: string;
  flag?: boolean;
};

type JudgeResult = {
  result: {
    state: "recuperado" | "estavel" | "complicacao" | "obito";
    score: number;
    correctDiagnosis: boolean;
    criticalDone: boolean;
    chosenCorrect: string[];
    chosenHarmful: string[];
    missedCritical: string[];
    timeUsed: number;
    overTime: boolean;
  };
  debrief: {
    headline: string;
    acertos: string[];
    ajustes: string[];
    ensino: string;
    gancho: string;
  };
};

const STATE_DISPLAY: Record<string, { label: string; hue: string }> = {
  recuperado: { label: "Recuperado", hue: "emerald" },
  estavel: { label: "Estável", hue: "blue" },
  complicacao: { label: "Complicação evitável", hue: "amber" },
  obito: { label: "Óbito", hue: "red" },
};

const PHASES_NAV = ["Intro", "Anamnese", "Exames", "Conduta", "Resultado"];

// ── Helpers derivados do caso ───────────────────────────────────

function vitalsFromCase(v: Vitals): VitalUI[] {
  const items: VitalUI[] = [];

  items.push({
    id: "spo2", label: "SpO₂", value: String(v.sat), unit: "%",
    state: v.sat < 90 ? "crit" : v.sat < 94 ? "warn" : "ok",
    note: v.sat < 90 ? "hipoxemia grave" : v.sat < 94 ? "hipoxemia" : "",
  });
  items.push({
    id: "fr", label: "FR", value: String(v.fr), unit: "irpm",
    state: v.fr > 30 ? "crit" : v.fr > 24 ? "warn" : "ok",
    note: v.fr > 30 ? "taquipneia grave" : v.fr > 24 ? "taquipneia" : "",
  });
  items.push({
    id: "fc", label: "FC", value: String(v.fc), unit: "bpm",
    state: v.fc > 120 ? "crit" : v.fc > 100 ? "warn" : "ok",
    note: v.fc > 120 ? "taquicardia" : v.fc > 100 ? "taquicardia leve" : "",
  });

  const sys = parseInt(v.pa.split("/")[0]);
  items.push({
    id: "pa", label: "PA", value: v.pa, unit: "mmHg",
    state: sys < 90 ? "crit" : sys > 160 || sys < 100 ? "warn" : "ok",
    note: sys < 90 ? "hipotensão" : sys > 160 ? "hipertensão" : "",
  });
  items.push({
    id: "tax", label: "Tax", value: String(v.temp), unit: "°C",
    state: v.temp > 38.5 ? "warn" : v.temp < 36 ? "warn" : "ok",
    note: v.temp > 38.5 ? "febre" : v.temp < 36 ? "hipotermia" : "afebril",
  });

  if (v.glicemia !== undefined) {
    items.push({
      id: "hgt", label: "HGT", value: String(v.glicemia), unit: "mg/dL",
      state: v.glicemia < 70 || v.glicemia > 250 ? "crit" : v.glicemia > 180 ? "warn" : "ok",
      note: v.glicemia < 70 ? "hipoglicemia" : v.glicemia > 250 ? "hiperglicemia grave" : "",
    });
  }

  return items;
}

function alertFromVitals(v: Vitals): string | null {
  const alerts: string[] = [];
  if (v.sat < 92) alerts.push(`SpO₂ ${v.sat}%`);
  if (v.fr > 28) alerts.push(`FR ${v.fr} irpm`);
  if (v.fc > 115) alerts.push(`FC ${v.fc} bpm`);
  const sys = parseInt(v.pa.split("/")[0]);
  if (sys < 90) alerts.push(`PA ${v.pa} (hipotensão)`);
  if (v.glicemia !== undefined && v.glicemia < 70) alerts.push(`HGT ${v.glicemia} mg/dL`);
  if (alerts.length === 0) return null;
  return `${alerts.join(", ")} — avalie criticamente.`;
}

function questionsFromCase(c: Case): QuestionType[] {
  const qs = c.questions || [];
  return qs.map((q, i) => ({
    id: q.id,
    ask: q.ask,
    fallback: c.truth.keyHistory[i] ?? c.truth.keyHistory[c.truth.keyHistory.length - 1],
    tag: q.tag,
    flag: q.flag,
  }));
}

function examIcon(exam: Exam): string {
  const MAP: Record<string, string> = {
    ecg: "heart", echo: "heart",
    rx: "xray", tc: "xray", rm: "xray",
    ausc: "lung", ex_resp: "lung",
    gaso: "drop",
  };
  if (MAP[exam.id]) return MAP[exam.id];
  const CAT: Record<Exam["category"], string> = {
    exame_fisico: "lung", laboratorio: "drop", imagem: "xray", beira_leito: "pulse",
  };
  return CAT[exam.category] ?? "pulse";
}

// ── Ícones SVG inline ──────────────────────────────────────────
function Icon({ name, size = 20, color = "currentColor", stroke = 2 }: {
  name: string; size?: number; color?: string; stroke?: number;
}) {
  const p = { fill: "none" as const, stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    lung: <g {...p}><path d="M12 4v8"/><path d="M12 8c0-1.5-1-2.5-2.5-2.5S7 7 7 9c0 3-2 4-2 7 0 1.5 1 2.5 2.5 2.5S10 17 10 14"/><path d="M12 8c0-1.5 1-2.5 2.5-2.5S17 7 17 9c0 3 2 4 2 7 0 1.5-1 2.5-2.5 2.5S14 17 14 14"/></g>,
    drop: <g {...p}><path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9Z"/></g>,
    xray: <g {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3v18M15 3v18M4 9h16M4 15h16" strokeWidth={1.2}/></g>,
    heart: <g {...p}><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z"/></g>,
    pulse: <g {...p}><path d="M3 12h4l2-6 4 12 2-6h6"/></g>,
    check: <g {...p}><path d="M20 6 9 17l-5-5"/></g>,
    alert: <g {...p}><path d="M12 8v5M12 17h.01"/><path d="M10.3 3.7 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/></g>,
    flame: <g {...p}><path d="M12 3s4 3.5 4 8a4 4 0 0 1-8 0c0-1.2.4-2 .8-2.6C9 9.5 9 8 9 8s1 1 1.5 2C11 9 12 7 12 3Z"/></g>,
    send: <g {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></g>,
    clock: <g {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
    chevR: <g {...p}><path d="m9 18 6-6-6-6"/></g>,
    spark: <g {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" strokeWidth={1.6}/></g>,
    share: <g {...p}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></g>,
    dice: <g {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill={color} stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill={color} stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill={color} stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill={color} stroke="none"/><circle cx="12" cy="12" r="1" fill={color} stroke="none"/></g>,
    spin: <g {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  );
}

// ── Logo ───────────────────────────────────────────────────────
function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/assets/plantao-plus-dark.svg" alt="Plantão+ by Avelis" className="av-logo-svg" draggable={false} />
  );
}

// ── Phase nav ──────────────────────────────────────────────────
function PhaseNav({ current }: { current: number }) {
  const cap = Math.min(current, 4);
  return (
    <div className="av-phasenav">
      {PHASES_NAV.map((label, i) => {
        const done = i < cap;
        const active = i === cap && current < 5;
        return (
          <span key={label} style={{ display: "contents" }}>
            <div className={`av-pill${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
              {done ? <Icon name="check" size={11} stroke={2.6} /> : <span className="av-pill-dot" />}
              <span>{label}</span>
            </div>
            {i < PHASES_NAV.length - 1 && <span className={`av-pill-sep${done ? " is-done" : ""}`} />}
          </span>
        );
      })}
    </div>
  );
}

// ── XP Meter ───────────────────────────────────────────────────
function XPMeter({ xp, streak }: { xp: number; streak: number }) {
  const max = 300;
  const pct = Math.min(100, (xp / max) * 100);
  const milestones = [33, 66, 100];
  return (
    <div className="av-header-xp">
      <div className="av-xp">
        <div className="av-xp-head">
          <div className="av-xp-streak">
            <Icon name="flame" size={13} color="var(--amber)" stroke={2.2} />
            <span>{streak} em sequência</span>
          </div>
          <span className="av-xp-num">{xp} XP</span>
        </div>
        <div className="av-xp-track">
          <div className="av-xp-fill" style={{ width: `${pct}%` }} />
          {milestones.map((m) => (
            <span key={m} className={`av-xp-mile${xp >= (m / 100) * max ? " hit" : ""}`} style={{ left: `${m}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Glass card ─────────────────────────────────────────────────
function Glass({ children, className = "", style = {}, accent }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; accent?: string;
}) {
  return (
    <div className={`av-glass ${className}`} style={style}>
      {accent && <span className="av-glass-accent" style={{ background: accent }} />}
      {children}
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────
function Avatar({ initials, size = 46 }: { initials: string; size?: number }) {
  return (
    <div className="av-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

// ── Button ─────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", disabled, full, icon }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean; full?: boolean; icon?: string;
}) {
  return (
    <button
      className={`av-btn av-btn-${variant}${full ? " is-full" : ""}${disabled ? " is-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
    >
      <span>{children}</span>
      {icon && <Icon name={icon} size={17} stroke={2.4} />}
    </button>
  );
}

// ── Vital chip ─────────────────────────────────────────────────
function VitalChip({ v, revealed }: { v: VitalUI; revealed: boolean }) {
  return (
    <div className={`av-vital state-${v.state}${revealed ? " is-on" : ""}`}>
      <div className="av-vital-top">
        <span className="av-vital-label">{v.label}</span>
        {v.state !== "ok" && <span className="av-vital-flag"><Icon name="alert" size={11} stroke={2.4} /></span>}
      </div>
      <div className="av-vital-value">
        {revealed ? v.value : "——"}
        <span className="av-vital-unit">{v.unit}</span>
      </div>
      {v.note && <div className="av-vital-note">{v.note}</div>}
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────
function Typing() {
  return (
    <div className="av-msg-row patient">
      <div className="av-msg patient av-typing-bubble"><span /><span /><span /></div>
    </div>
  );
}

// ── Tela 0: Intro ──────────────────────────────────────────────
function IntroScreen({
  medCase,
  onStart,
  onGenerate,
  isGenerating,
  generateError,
}: {
  medCase: Case;
  onStart: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generateError: string;
}) {
  const p = medCase.patient;
  const initials = p.name.replace(/^(Sr|Sra|Dr|Dra)\.?\s+/i, "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const isGenerated = medCase.id.startsWith("gen-");

  return (
    <div className="av-screen">
      <div className="av-intro-header av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div>
            <div className="av-intro-tag">Simulador Clínico</div>
            <div className="av-intro-tagline">Treine raciocínio clínico com IA</div>
          </div>
        </div>
        <div className="av-gamification-badges">
          <div className="av-badge-item"><span className="av-badge-icon">⭐</span> 0–100 XP</div>
          <div className="av-badge-item"><span className="av-badge-icon">🔥</span> Streak</div>
          <div className="av-badge-item">
            <span className="av-badge-icon">⚠️</span>
            {medCase.difficulty === "difícil" ? "Difícil" : medCase.difficulty === "média" ? "Média" : "Fácil"}
          </div>
        </div>
      </div>

      <div className="av-eyebrow av-stagger" style={{ "--d": "60ms" } as React.CSSProperties}>
        <span className="av-dot-live" />
        {isGenerated ? "Caso gerado por IA · Sala de Emergência" : "Caso ao vivo · Sala Vermelha"}
      </div>

      <Glass className="av-stagger av-patient-card" style={{ "--d": "120ms" } as React.CSSProperties} accent="linear-gradient(180deg,var(--blue),var(--emerald))">
        <div className="av-patient-head">
          <Avatar initials={initials} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="av-patient-name">{p.name}</div>
            <div className="av-patient-meta">{p.age} anos · {p.sex} · {medCase.specialty}</div>
          </div>
          <div className="av-triage">Vermelho</div>
        </div>
        <div className="av-chief">
          <div className="av-chief-label">Queixa principal</div>
          <div className="av-chief-text">"{medCase.chiefComplaint}"</div>
        </div>
        <p className="av-context">{medCase.scene}</p>
      </Glass>

      <div className="av-stagger" style={{ "--d": "180ms" } as React.CSSProperties}>
        <div className="av-intro-howto">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cloud-dim)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Seu fluxo neste plantão
          </div>
          <div className="av-phase-flow">
            {["Anamnese", "Exames", "Conduta", "Resultado"].map((l, i, arr) => (
              <span key={l} style={{ display: "contents" }}>
                <div className="av-phase-step">
                  <div className="av-phase-circle">{i + 1}</div>
                  <div className="av-phase-label">{l}</div>
                </div>
                {i < arr.length - 1 && <div className="av-phase-arrow">→</div>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="av-stagger" style={{ "--d": "260ms" } as React.CSSProperties}>
        <Glass className="av-mission">
          <Icon name="spark" size={18} color="var(--amber)" stroke={1.8} />
          <div>
            <strong>Sua missão</strong>
            <span>Avalie, investigue e estabilize o paciente. A IA vai analisar suas decisões ao final.</span>
          </div>
        </Glass>
      </div>

      {generateError && (
        <div className="av-error av-fade-in" style={{ margin: "12px 0" }}>{generateError}</div>
      )}

      <div className="av-stagger av-cta-fixed" style={{ "--d": "320ms", display: "flex", flexDirection: "column", gap: 10 } as React.CSSProperties}>
        <Btn variant="primary" full icon="chevR" onClick={onStart} disabled={isGenerating}>
          Iniciar atendimento
        </Btn>
        <Btn variant="secondary" full icon={isGenerating ? "spin" : "dice"} onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Gerando caso com IA…" : "🎲 Gerar caso aleatório"}
        </Btn>
      </div>
    </div>
  );
}

// ── Tela 1: Anamnese ───────────────────────────────────────────
function AnamneseScreen({
  medCase,
  onAdvance,
  onXP,
}: {
  medCase: Case;
  onAdvance: () => void;
  onXP: (n: number) => void;
}) {
  const questions = questionsFromCase(medCase);
  const MIN_QUESTIONS = Math.min(3, questions.length);

  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [thread, typing]);

  const ask = useCallback(async (q: QuestionType) => {
    if (asked.includes(q.id) || typing) return;
    setAsked((a) => [...a, q.id]);
    setThread((t) => [...t, { side: "doctor", text: q.ask, key: q.id + "d" }]);
    setTyping(true);
    setError("");

    let reply = q.fallback;
    try {
      const res = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseData: medCase,
          history: thread.map((m) => ({ role: m.side === "doctor" ? "user" : "assistant", content: m.text })),
          message: q.ask,
        }),
      });
      const data = await res.json();
      if (data.reply) reply = data.reply;
    } catch {
      // usa fallback
    }

    setTimeout(() => {
      setTyping(false);
      setThread((t) => [...t, { side: "patient", text: reply, tag: q.tag, key: q.id + "p" }]);
      onXP(20);
    }, 1100);
  }, [asked, typing, thread, onXP, medCase]);

  const remaining = questions.filter((q) => !asked.includes(q.id));
  const canAdvance = asked.length >= MIN_QUESTIONS;

  return (
    <div className="av-screen">
      <div className="av-section-title av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        Anamnese
        <span className="av-counter">{asked.length}/{questions.length}</span>
      </div>

      <Glass className="av-chat-card av-stagger" style={{ "--d": "90ms" } as React.CSSProperties}>
        <div className="av-chat-scroll" ref={scrollRef}>
          {thread.length === 0 && (
            <div className="av-chat-empty">
              O paciente aguarda. Conduza a anamnese — escolha o que perguntar.
            </div>
          )}
          {thread.map((m) => (
            <div key={m.key} className={`av-msg-row ${m.side}`}>
              <div className={`av-msg ${m.side}`}>
                {m.tag && <div className="av-msg-tag">{m.tag}</div>}
                {m.text}
              </div>
            </div>
          ))}
          {typing && <Typing />}
          <div ref={(el) => { if (el) el.scrollIntoView(); }} />
        </div>
      </Glass>

      {error && <div className="av-error av-fade-in">{error}</div>}

      <div className="av-qchips av-stagger" style={{ "--d": "160ms" } as React.CSSProperties}>
        {remaining.map((q) => (
          <button key={q.id} className="av-qchip" onClick={() => ask(q)} disabled={typing}>
            <span>{q.ask}</span>
            <Icon name="send" size={14} color="var(--blue-bright)" stroke={2.2} />
          </button>
        ))}
        {remaining.length === 0 && <div className="av-allasked">Anamnese completa ✓</div>}
      </div>

      <div className="av-cta-fixed">
        <Btn
          variant={canAdvance ? "primary" : "ghost"}
          full icon="chevR"
          disabled={!canAdvance}
          onClick={onAdvance}
        >
          {canAdvance ? "Solicitar exames" : `Pergunte mais ${MIN_QUESTIONS - asked.length}`}
        </Btn>
      </div>
    </div>
  );
}

// ── Tela 2: Exames ─────────────────────────────────────────────
function ExamesScreen({
  medCase,
  onAdvance,
  onXP,
}: {
  medCase: Case;
  onAdvance: (examsOrdered: string[]) => void;
  onXP: (n: number) => void;
}) {
  const vitalsUI = vitalsFromCase(medCase.vitals);
  const alertText = alertFromVitals(medCase.vitals);

  const [vitalsOn, setVitalsOn] = useState(false);
  const [ordered, setOrdered] = useState<string[]>([]);

  const order = (exId: string) => {
    if (ordered.includes(exId)) return;
    setOrdered((o) => [...o, exId]);
    onXP(15);
  };

  const canAdvance = vitalsOn && ordered.length >= 2;

  return (
    <div className="av-screen">
      <div className="av-section-title av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        Sinais vitais
      </div>

      <div className="av-stagger" style={{ "--d": "70ms" } as React.CSSProperties}>
        <div className="av-vitals-grid">
          {vitalsUI.map((v) => <VitalChip key={v.id} v={v} revealed={vitalsOn} />)}
        </div>
      </div>

      {!vitalsOn && (
        <div className="av-stagger" style={{ "--d": "140ms", marginTop: 12 } as React.CSSProperties}>
          <Btn variant="secondary" full icon="pulse" onClick={() => { setVitalsOn(true); onXP(25); }}>
            Aferir sinais vitais
          </Btn>
        </div>
      )}

      {vitalsOn && alertText && (
        <div className="av-alertline av-fade-in">
          <Icon name="alert" size={14} color="var(--amber)" stroke={2.4} />
          {alertText}
        </div>
      )}

      <div className="av-section-title" style={{ marginTop: 22 }}>Exames complementares</div>

      <div className="av-exam-list">
        {medCase.exams.map((ex, i) => {
          const on = ordered.includes(ex.id);
          const stateClass = ex.redFlag ? "state-crit" : "state-ok";
          return (
            <Glass key={ex.id} className={`av-exam av-stagger${on ? " is-on" : ""}`} style={{ "--d": `${200 + i * 80}ms`, padding: 0 } as React.CSSProperties}>
              <button className="av-exam-head" onClick={() => order(ex.id)} disabled={on}>
                <span className={`av-exam-icon ${stateClass}`}>
                  <Icon name={examIcon(ex)} size={18} stroke={1.9} />
                </span>
                <span className="av-exam-name">{ex.label}</span>
                {on
                  ? <span className="av-exam-done"><Icon name="check" size={13} stroke={2.6} /></span>
                  : <span className="av-exam-cta">Solicitar</span>}
              </button>
              {on && <div className="av-exam-result av-fade-in">{ex.result}</div>}
            </Glass>
          );
        })}
      </div>

      <div className="av-cta-fixed">
        <Btn
          variant={canAdvance ? "primary" : "ghost"}
          full icon="chevR"
          disabled={!canAdvance}
          onClick={() => onAdvance(ordered)}
        >
          {canAdvance ? "Definir conduta" : !vitalsOn ? "Afira os sinais vitais" : "Solicite ao menos 2 exames"}
        </Btn>
      </div>
    </div>
  );
}

// ── Tela 3: Conduta ────────────────────────────────────────────
function CondutaScreen({
  medCase,
  onConfirm,
  onXP,
}: {
  medCase: Case;
  onConfirm: (hypothesisId: string | null, conductIds: string[]) => void;
  onXP: (n: number) => void;
}) {
  const [hypothesis, setHypothesis] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const canConfirm = hypothesis !== null && sel.length > 0;

  return (
    <div className="av-screen">
      {/* Hipótese diagnóstica */}
      <div className="av-section-title av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        Hipótese diagnóstica
      </div>
      <p className="av-prompt av-stagger" style={{ "--d": "50ms" } as React.CSSProperties}>
        Qual é o seu diagnóstico principal?
      </p>

      <div className="av-conduta-list" style={{ marginBottom: 8 }}>
        {medCase.hypotheses.map((h, i) => {
          const on = hypothesis === h.id;
          return (
            <button
              key={h.id}
              className={`av-conduta av-stagger${on ? " is-sel" : ""}`}
              style={{ "--d": `${80 + i * 50}ms` } as React.CSSProperties}
              onClick={() => setHypothesis(h.id)}
            >
              <span className={`av-check${on ? " on" : ""}`}>
                {on && <Icon name="check" size={13} stroke={3} />}
              </span>
              <span className="av-conduta-text">
                <span className="av-conduta-label">{h.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Condutas */}
      <div className="av-section-title av-stagger" style={{ "--d": "300ms", marginTop: 20 } as React.CSSProperties}>
        Condutas
      </div>
      <p className="av-prompt av-stagger" style={{ "--d": "340ms" } as React.CSSProperties}>
        Selecione as intervenções que você faria agora.
      </p>

      <div className="av-conduta-list">
        {medCase.conducts.map((c, i) => {
          const on = sel.includes(c.id);
          return (
            <button
              key={c.id}
              className={`av-conduta av-stagger${on ? " is-sel" : ""}`}
              style={{ "--d": `${360 + i * 60}ms` } as React.CSSProperties}
              onClick={() => toggle(c.id)}
            >
              <span className={`av-check${on ? " on" : ""}`}>
                {on && <Icon name="check" size={13} stroke={3} />}
              </span>
              <span className="av-conduta-text">
                <span className="av-conduta-label">{c.label.split("(")[0].trim()}</span>
                {c.label.includes("(") && (
                  <span className="av-conduta-sub">{c.label.match(/\(([^)]+)\)/)?.[1]}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="av-cta-fixed">
        <Btn
          variant={canConfirm ? "primary" : "ghost"}
          full icon="chevR"
          disabled={!canConfirm}
          onClick={() => { onXP(40); onConfirm(hypothesis, sel); }}
        >
          {!hypothesis
            ? "Selecione a hipótese diagnóstica"
            : !sel.length
            ? "Selecione ao menos 1 conduta"
            : `Confirmar (${sel.length} conduta${sel.length > 1 ? "s" : ""})`}
        </Btn>
      </div>
    </div>
  );
}

// ── Tela 4: Resultado ──────────────────────────────────────────
function ResultScreen({
  medCase,
  hypothesisId,
  selectedConducts,
  examsOrdered,
  timeUsed,
  totalXP,
  onNext,
  onResult,
}: {
  medCase: Case;
  hypothesisId: string | null;
  selectedConducts: string[];
  examsOrdered: string[];
  timeUsed: number;
  totalXP: number;
  onNext: () => void;
  onResult?: (state: string, score: number) => void;
}) {
  const [judgeData, setJudgeData] = useState<JudgeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseData: medCase,
        hypothesisId,
        conductIds: selectedConducts,
        examsOrdered,
        timeUsed,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.result) {
          setJudgeData(d);
          onResult?.(d.result.state, d.result.score);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="av-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ textAlign: "center", color: "var(--cloud-dim)" }}>
          <div className="av-spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14 }}>Calculando desfecho…</div>
        </div>
      </div>
    );
  }

  if (!judgeData) {
    return (
      <div className="av-screen">
        <Glass style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: "var(--cloud-dim)" }}>Não foi possível calcular o desfecho. Tente novamente.</p>
          <div style={{ marginTop: 16 }}>
            <Btn variant="primary" onClick={onNext}>Continuar</Btn>
          </div>
        </Glass>
      </div>
    );
  }

  const { result, debrief } = judgeData;
  const display = STATE_DISPLAY[result.state] ?? STATE_DISPLAY.estavel;
  const scoreDisplay = result.score * 10; // escala para 0-1000 pts de exibição

  const stats = [
    { k: "Score", v: `${result.score}/100` },
    { k: "Diagnóstico", v: result.correctDiagnosis ? "Correto ✓" : "Incorreto ✗" },
    { k: "Condutas críticas", v: result.criticalDone ? "Completas ✓" : "Faltaram ✗" },
  ];

  return (
    <div className="av-screen av-result">
      <div className={`av-outcome hue-${display.hue}`}>
        <div className="av-outcome-glow" />
        <div className="av-outcome-label">{display.label}</div>
        <div className="av-outcome-score">{scoreDisplay}</div>
        <div className="av-outcome-scorelabel">pontos de desempenho</div>
        <div className="av-outcome-title">{medCase.patient.name} · {medCase.title}</div>
      </div>

      <Glass className="av-stagger" style={{ "--d": "120ms" } as React.CSSProperties}>
        <p className="av-summary">
          {debrief?.headline || `Score ${result.score}/100 — ${display.label}.`}
        </p>
        <div className="av-result-stats">
          {stats.map((s) => (
            <div key={s.k} className="av-rstat">
              <span className="av-rstat-v">{s.v}</span>
              <span className="av-rstat-k">{s.k}</span>
            </div>
          ))}
        </div>
      </Glass>

      <div className={`av-verdict hue-${display.hue} av-stagger`} style={{ "--d": "200ms" } as React.CSSProperties}>
        <Icon name="spark" size={16} color="currentColor" stroke={1.9} />
        <span>Diagnóstico correto: <strong>{medCase.truth.diagnosis}</strong></span>
      </div>

      {/* Debrief da IA */}
      {debrief && (
        <Glass className="av-stagger" style={{ "--d": "280ms" } as React.CSSProperties}>
          <div className="av-debrief-head">
            <span className="av-debrief-dot" />
            Debrief do seu <strong style={{ color: "var(--blue-bright)", marginLeft: 3 }}>Assistente Clínico</strong>
          </div>

          {debrief.acertos?.length > 0 && (
            <>
              <div className="av-debrief-section">O que você acertou</div>
              {debrief.acertos.map((a, i) => (
                <div key={i} className="av-debrief-item">
                  <span className="av-debrief-item-icon" style={{ color: "var(--emerald)" }}>✅</span>
                  <span>{a}</span>
                </div>
              ))}
            </>
          )}

          {debrief.ajustes?.length > 0 && (
            <>
              <div className="av-debrief-section">O que ajustar</div>
              {debrief.ajustes.map((a, i) => (
                <div key={i} className="av-debrief-item">
                  <span className="av-debrief-item-icon">⚠️</span>
                  <span>{a}</span>
                </div>
              ))}
            </>
          )}

          {debrief.ensino && (
            <>
              <div className="av-debrief-section">Ponto-chave</div>
              <p className="av-debrief-insight">{debrief.ensino}</p>
            </>
          )}
        </Glass>
      )}

      <div className="av-xptotal av-stagger" style={{ "--d": "350ms" } as React.CSSProperties}>
        <Icon name="flame" size={14} color="var(--amber)" stroke={2.2} />
        Você acumulou <strong style={{ marginLeft: 4, marginRight: 4 }}>{totalXP} XP</strong> neste plantão
      </div>

      <div className="av-cta-fixed">
        <Btn variant="primary" full onClick={onNext}>Salvar resultado e continuar →</Btn>
      </div>
    </div>
  );
}

// ── Tela 5: Lead Capture ───────────────────────────────────────
function LeadScreen({
  medCase,
  xp,
  judgeState,
  judgeScore,
  onRestart,
  onGenerateNew,
}: {
  medCase: Case;
  xp: number;
  judgeState: string;
  judgeScore: number;
  onRestart: () => void;
  onGenerateNew: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const display = STATE_DISPLAY[judgeState] ?? STATE_DISPLAY.estavel;
  const hueEmoji = { emerald: "🟢", blue: "🔵", amber: "🟡", red: "🔴" }[display.hue] ?? "⚪";
  const scoreDisplay = judgeScore * 10;

  const shareText =
    `🩺 PLANTÃO+ · ${medCase.title}\n` +
    `${hueEmoji} ${scoreDisplay} pontos · ${display.label}\n` +
    `⚡ ${xp} XP acumulados\n\n` +
    `Treine raciocínio clínico com IA 👉 plantao.avelis.com.br`;

  const submit = async () => {
    setBusy(true);
    await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, specialty, lastScore: scoreDisplay, lastOutcome: judgeState, xp }),
    }).catch(() => {});
    setBusy(false);
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="av-lead">
        <div className="av-lead-saved">
          <div className="av-lead-saved-icon">🎉</div>
          <h2>Tudo certo!</h2>
          <p>Seu streak está salvo. Vamos te avisar quando o caso do dia sair.</p>
          <div className="av-lead-hook">
            💡 Gostou do debrief? Ele é movido pelo nosso{" "}
            <strong style={{ color: "var(--blue-bright)" }}>Assistente Clínico com IA</strong>{" "}
            — o mesmo que apoia decisões no plantão real.
          </div>
          <div className="av-share-card">{shareText}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexDirection: "column" }}>
            <Btn variant="secondary" full icon="share" onClick={() => navigator.clipboard?.writeText(shareText)}>
              Copiar resultado
            </Btn>
            <Btn variant="primary" full onClick={onGenerateNew}>🎲 Jogar novo caso com IA</Btn>
            <Btn variant="ghost" full onClick={onRestart}>Repetir este caso</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="av-lead">
      <div className="av-eyebrow av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        <Icon name="flame" size={12} color="var(--amber)" stroke={2} /> Salve seu progresso
      </div>
      <h1 className="av-lead-title av-stagger" style={{ "--d": "60ms" } as React.CSSProperties}>
        Mantenha o streak.
      </h1>
      <p className="av-lead-sub av-stagger" style={{ "--d": "100ms" } as React.CSSProperties}>
        Dispute o ranking, receba o caso do dia e acompanhe sua evolução. Sem senha.
      </p>

      <div className="av-field av-stagger" style={{ "--d": "160ms" } as React.CSSProperties}>
        <input
          type="email"
          className="av-input"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="av-input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Você é…</option>
          <option>Estudante (1º–4º ano)</option>
          <option>Estudante (internato)</option>
          <option>Médico recém-formado</option>
          <option>Residente (R1–R3)</option>
          <option>Médico especialista</option>
        </select>
        <select className="av-input" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          <option value="">Área de interesse…</option>
          <option>Emergência</option>
          <option>Clínica médica</option>
          <option>Pneumologia</option>
          <option>Cardiologia</option>
          <option>Pediatria</option>
          <option>Ainda decidindo</option>
        </select>
      </div>

      <div className="av-cta-fixed" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn
          variant="primary"
          full
          disabled={!email || !role || busy}
          onClick={submit}
        >
          {busy ? <span className="av-spinner" /> : "Salvar e continuar"}
        </Btn>
        <Btn variant="ghost" full onClick={onRestart}>Agora não</Btn>
      </div>
    </div>
  );
}

// ── Footer Avelis ──────────────────────────────────────────────
function FooterAvelis() {
  return (
    <div className="av-footer">
      <a href="https://avelis.com.br" target="_blank" rel="noopener noreferrer" className="av-footer-link">
        <span className="av-footer-text">construído por</span>
        <svg className="av-footer-logo" viewBox="0 0 126.36231 21.337191" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(-29.964579,-40.918406)">
            <path style={{ fill: "currentColor" }} d="m 139.39924,40.947859 c -0.78917,0 -1.51925,0.197626 -2.19004,0.592211 -0.6708,0.394585 -1.20326,0.927042 -1.59784,1.597836 -0.39459,0.651071 -0.59221,1.381151 -0.59221,2.190051 v 0.23409 h 21.30774 v -0.23409 c 0,-0.8089 -0.20735,-1.53898 -0.62167,-2.190051 -0.39457,-0.670794 -0.92703,-1.203251 -1.59783,-1.597836 -0.65106,-0.394585 -1.37142,-0.592211 -2.16059,-0.592211 z m -4.38009,6.907588 v 1.67483 c 0,0.8089 0.19762,1.54871 0.59221,2.21951 0.39458,0.65106 0.92704,1.17379 1.59784,1.56838 0.67079,0.39458 1.40087,0.59221 2.19004,0.59221 h 12.28142 v 3.72845 h -12.07419 v -1.74614 h -4.58732 v 1.98282 c 0,0.78917 0.19762,1.51925 0.59221,2.19005 0.39458,0.67079 0.92704,1.20376 1.59784,1.59835 0.67079,0.39459 1.40087,0.59169 2.19004,0.59169 h 12.54756 c 0.78917,0 1.50953,-0.1971 2.16059,-0.59169 0.6708,-0.39459 1.20326,-0.92756 1.59783,-1.59835 0.41432,-0.6708 0.62167,-1.40088 0.62167,-2.19005 v -4.20233 c 0,-0.8089 -0.20735,-1.53846 -0.62167,-2.18953 -0.39457,-0.6708 -0.92703,-1.20377 -1.59783,-1.59835 -0.65106,-0.39459 -1.37142,-0.59169 -2.16059,-0.59169 h -12.34033 v -1.43816 z" />
            <path style={{ fill: "currentColor" }} d="m 128.00562,47.855447 v 14.40015 h 4.52789 v -14.40015 z" />
            <path style={{ fill: "#0061e0" }} d="m 128.00562,40.947859 v 4.614188 h 4.52789 v -4.614188 z" />
            <path style={{ fill: "currentColor" }} d="m 104.66286,47.855447 v 14.40015 h 21.30775 v -4.61677 h -16.72043 v -9.78338 z" />
            <path style={{ fill: "#0061e0" }} d="m 104.66286,40.918403 v 4.643644 h 4.58732 v -4.643644 z" />
            <path style={{ fill: "currentColor" }} d="m 81.49425,40.947859 v 4.614188 h 19.67994 v -4.614188 z m 0,6.907588 v 14.40015 h 19.67994 v -4.61677 H 86.140479 v -3.72845 h 12.10417 v -4.61677 h -12.10417 v -1.43816 z" />
            <path style={{ fill: "currentColor" }} d="m 51.660413,40.947859 10.306347,17.795808 2.64635,-4.58886 -7.625891,-13.206948 z m 23.201684,0 -0.376721,0.652156 0.01189,0.0067 -11.203968,19.427232 0.707451,1.22163 h 3.817854 L 80.158931,40.947859 Z" />
            <path style={{ fill: "currentColor" }} d="m 42.304911,40.947859 -0.709,1.224214 11.582755,20.083524 h 5.284432 L 46.122766,40.947859 Z m -2.035534,3.514518 -10.304798,17.79322 h 5.326807 l 7.624341,-13.20384 z" />
          </g>
        </svg>
      </a>
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────
const FEATURED_CASE = CASES.find((c) => c.id === FEATURED_CASE_ID) ?? CASES[0];

export default function Game() {
  const [phase, setPhase] = useState<Phase>(0);
  const [isExiting, setIsExiting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ id: number; n: number } | null>(null);
  const [selectedConducts, setSelectedConducts] = useState<string[]>([]);
  const [selectedHypothesis, setSelectedHypothesis] = useState<string | null>(null);
  const [examsOrdered, setExamsOrdered] = useState<string[]>([]);
  const [currentCase, setCurrentCase] = useState<Case>(FEATURED_CASE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  // judgeState/score armazenados no lead screen via ResultScreen→LeadScreen
  const [lastJudgeState, setLastJudgeState] = useState("estavel");
  const [lastJudgeScore, setLastJudgeScore] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    if (phase >= 4) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Reset scroll on phase change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [phase]);

  function awardXP(n: number) {
    setXp((x) => x + n);
    setStreak((s) => s + 1);
    const id = Date.now();
    setXpPopup({ id, n });
    setTimeout(() => setXpPopup((p) => p?.id === id ? null : p), 1200);
  }

  function transitionTo(p: Phase) {
    setIsExiting(true);
    setTimeout(() => {
      setPhase(p);
      setIsExiting(false);
    }, 220);
  }

  async function generateCase(resetPhase: boolean = false) {
    setIsGenerating(true);
    setGenerateError("");
    if (resetPhase) {
      setPhase(0 as Phase);
      setSeconds(0);
      setXp(0);
      setStreak(0);
      setSelectedConducts([]);
      setSelectedHypothesis(null);
      setExamsOrdered([]);
    }
    try {
      const res = await fetch("/api/generate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.case) throw new Error("Resposta inválida do servidor");
      setCurrentCase(data.case);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Erro ao gerar caso. Tente novamente.");
      if (resetPhase) setCurrentCase(FEATURED_CASE);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCondutaConfirm(hypothesisId: string | null, conductIds: string[]) {
    setSelectedHypothesis(hypothesisId);
    setSelectedConducts(conductIds);
    transitionTo(4);
  }

  function handleExamesAdvance(ordered: string[]) {
    setExamsOrdered(ordered);
    transitionTo(3);
  }

  function restart() {
    setPhase(0);
    setSeconds(0);
    setXp(0);
    setStreak(0);
    setSelectedConducts([]);
    setSelectedHypothesis(null);
    setExamsOrdered([]);
    setCurrentCase(FEATURED_CASE);
    setGenerateError("");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="av-app">
      {/* Header */}
      <div className="av-header">
        <div className="av-topbar">
          <Logo />
          {phase > 0 && phase < 5 && (
            <div className="av-clock">
              <Icon name="clock" size={13} color="var(--emerald)" stroke={2.2} />
              <span className="av-clock-num">{mm}:{ss}</span>
            </div>
          )}
        </div>
        <PhaseNav current={phase} />
        {phase > 0 && phase < 4 && <XPMeter xp={xp} streak={streak} />}
      </div>

      {/* Content */}
      <div className="av-content" ref={scrollRef}>
        <div className={`av-phase-anim${isExiting ? " exiting" : ""}`} key={phase}>
          {phase === 0 && (
            <IntroScreen
              medCase={currentCase}
              onStart={() => {
                setSelectedConducts([]);
                setSelectedHypothesis(null);
                setExamsOrdered([]);
                setSeconds(0);
                transitionTo(1);
              }}
              onGenerate={() => generateCase(false)}
              isGenerating={isGenerating}
              generateError={generateError}
            />
          )}
          {phase === 1 && (
            <AnamneseScreen
              medCase={currentCase}
              onAdvance={() => transitionTo(2)}
              onXP={awardXP}
            />
          )}
          {phase === 2 && (
            <ExamesScreen
              medCase={currentCase}
              onAdvance={handleExamesAdvance}
              onXP={awardXP}
            />
          )}
          {phase === 3 && (
            <CondutaScreen
              medCase={currentCase}
              onConfirm={handleCondutaConfirm}
              onXP={awardXP}
            />
          )}
          {phase === 4 && (
            <ResultScreen
              medCase={currentCase}
              hypothesisId={selectedHypothesis}
              selectedConducts={selectedConducts}
              examsOrdered={examsOrdered}
              timeUsed={Math.floor(seconds / 60)}
              totalXP={xp}
              onNext={() => transitionTo(5)}
              onResult={(state, score) => {
                setLastJudgeState(state);
                setLastJudgeScore(score);
              }}
            />
          )}
          {phase === 5 && (
            <LeadScreen
              medCase={currentCase}
              xp={xp}
              judgeState={lastJudgeState}
              judgeScore={lastJudgeScore}
              onRestart={restart}
              onGenerateNew={() => generateCase(true)}
            />
          )}
        </div>

        {(phase === 0 || phase === 5) && <FooterAvelis />}
      </div>

      {/* XP Popup */}
      {xpPopup && (
        <div className="av-xp-pop" key={xpPopup.id}>+{xpPopup.n} XP</div>
      )}
    </div>
  );
}

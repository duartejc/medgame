"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CASES, FEATURED_CASE_ID } from "@/lib/cases";

// ── Tipos ──────────────────────────────────────────────────────
type Phase = 0 | 1 | 2 | 3 | 4 | 5; // intro|anamnese|exames|conduta|resultado|lead
type ChatMsg = { side: "doctor" | "patient"; text: string; tag?: string; key: string };

// ── Caso ───────────────────────────────────────────────────────
const medCase = CASES.find((c) => c.id === FEATURED_CASE_ID) ?? CASES[0];

// Dados de UI do caso (asthma — do design, com fallbacks scriptados)
const QUESTIONS = [
  { id: "q1", ask: "Há quanto tempo começou a falta de ar?", fallback: "Começou há umas 4 horas, depois que limpei a casa cheia de poeira. Foi piorando o tempo todo.", tag: "Início" },
  { id: "q2", ask: "Você tem asma? Já teve crises antes?", fallback: "Tenho asma desde criança. Já internei uma vez na UTI quando era adolescente.", tag: "Antecedentes", flag: true },
  { id: "q3", ask: "Usou a bombinha hoje? Quantas vezes?", fallback: "Usei o salbutamol umas 6 ou 7 vezes... mas não tá adiantando quase nada.", tag: "Medicação", flag: true },
  { id: "q4", ask: "Consegue completar frases sem parar pra respirar?", fallback: "(a irmã responde) Ela tá falando só palavras soltas, doutor. Tá muito cansada.", tag: "Esforço", flag: true },
  { id: "q5", ask: "Tem febre, dor no peito ou catarro?", fallback: "Febre não. Sinto aperto no peito e o chiado, mas catarro nenhum.", tag: "Sintomas" },
];

const VITALS_UI = [
  { id: "spo2", label: "SpO₂", value: "88", unit: "%", state: "crit", note: "ar ambiente" },
  { id: "fr", label: "FR", value: "32", unit: "irpm", state: "crit", note: "taquipneia" },
  { id: "fc", label: "FC", value: "124", unit: "bpm", state: "warn", note: "taquicardia" },
  { id: "pa", label: "PA", value: "138/86", unit: "mmHg", state: "warn", note: "" },
  { id: "tax", label: "Tax", value: "36.7", unit: "°C", state: "ok", note: "afebril" },
  { id: "pfe", label: "PFE", value: "140", unit: "L/min", state: "crit", note: "~35% previsto" },
];

const EXAM_ICONS: Record<string, string> = { ausc: "lung", gaso: "drop", rx: "xray", ecg: "heart" };

const OUTCOMES = {
  recuperado: { key: "recuperado", label: "Recuperada", hue: "emerald", score: 920, title: "Marina respondeu ao tratamento", summary: "Com O₂, broncodilatadores contínuos e corticoide precoce, a SpO₂ subiu para 96% e a paciente voltou a falar frases completas. Internada em enfermaria para observação.", stats: [{ k: "SpO₂ final", v: "96%" }, { k: "Tempo até conduta", v: "6 min" }, { k: "Decisões corretas", v: "4/4" }], verdict: "Conduta exemplar para asma quase fatal." },
  estavel: { key: "estavel", label: "Estável", hue: "blue", score: 740, title: "Marina estabilizou, com ressalvas", summary: "A paciente melhorou parcialmente. A demora em iniciar o corticoide prolongou a crise. Mantida em observação prolongada na sala vermelha.", stats: [{ k: "SpO₂ final", v: "93%" }, { k: "Tempo até conduta", v: "12 min" }, { k: "Decisões corretas", v: "2/4" }], verdict: "No caminho certo — agilidade salva minutos preciosos." },
  observacao: { key: "observacao", label: "Em observação", hue: "amber", score: 520, title: "Resposta lenta — risco mantido", summary: "Sem corticoide e com oxigenação tardia, a fadiga respiratória progrediu. Equipe de UTI acionada para vigilância de via aérea.", stats: [{ k: "SpO₂ final", v: "90%" }, { k: "Tempo até conduta", v: "18 min" }, { k: "Decisões corretas", v: "1/4" }], verdict: "Reavalie: broncodilatador + corticoide são pilares." },
  critico: { key: "critico", label: "Crítico", hue: "red", score: 280, title: "Falência respiratória iminente", summary: "Condutas inadequadas (sedação / antibiótico isolado) atrasaram o tratamento. Paciente evoluiu para necessidade de via aérea avançada.", stats: [{ k: "SpO₂ final", v: "84%" }, { k: "Tempo até conduta", v: "—" }, { k: "Decisões corretas", v: "0/4" }], verdict: "Sedar uma asma grave sem suporte de via aérea pode ser fatal." },
};

const PHASES_NAV = ["Intro", "Anamnese", "Exames", "Conduta", "Resultado"];
const MIN_QUESTIONS = 3;

function computeOutcome(conductIds: string[]): keyof typeof OUTCOMES {
  const has = (id: string) => conductIds.includes(id);
  if (has("sed")) return "critico";
  const idealHits = ["o2", "b2", "cort"].filter(has).length;
  if (idealHits === 3 && !has("atb")) return "recuperado";
  if (idealHits >= 2) return "estavel";
  return "observacao";
}

// ── Ícones SVG inline ──────────────────────────────────────────
function Icon({ name, size = 20, color = "currentColor", stroke = 2 }: { name: string; size?: number; color?: string; stroke?: number }) {
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
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      {paths[name] ?? null}
    </svg>
  );
}

// ── Logo — lockup oficial Avelis Plantão+ ──────────────────────
// Usa plantao-plus-dark.svg (fundo escuro): PLANTÃO em #EDF1F5,
// "+" em coral #FF6C8A, "by Avelis" com wordmark vetorial.
function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/plantao-plus-dark.svg"
      alt="Plantão+ by Avelis"
      className="av-logo-svg"
      draggable={false}
    />
  );
}

// ── Phase nav ──────────────────────────────────────────────────
function PhaseNav({ current }: { current: number }) {
  const cap = Math.min(current, 4); // lead (5) não tem fase no nav
  return (
    <div className="av-phasenav">
      {PHASES_NAV.map((label, i) => {
        const done = i < cap;
        const active = i === cap && current < 5;
        return (
          <span key={label} style={{ display: "contents" }}>
            <div className={`av-pill${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
              {done
                ? <Icon name="check" size={11} stroke={2.6} />
                : <span className="av-pill-dot" />}
              <span>{label}</span>
            </div>
            {i < PHASES_NAV.length - 1 && (
              <span className={`av-pill-sep${done ? " is-done" : ""}`} />
            )}
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
function Glass({ children, className = "", style = {}, accent }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; accent?: string }) {
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
function Btn({ children, onClick, variant = "primary", disabled, full, icon }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; full?: boolean; icon?: string; }) {
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
function VitalChip({ v, revealed }: { v: typeof VITALS_UI[number]; revealed: boolean }) {
  return (
    <div className={`av-vital state-${v.state}${revealed ? " is-on" : ""}`}>
      <div className="av-vital-top">
        <span className="av-vital-label">{v.label}</span>
        {v.state !== "ok" && (
          <span className="av-vital-flag"><Icon name="alert" size={11} stroke={2.4} /></span>
        )}
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
      <div className="av-msg patient av-typing-bubble">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ── Tela 0: Intro ──────────────────────────────────────────────
function IntroScreen({ onStart }: { onStart: () => void }) {
  const p = medCase.patient;
  const initials = p.name.replace(/^(Sr|Sra|Dr|Dra)\.?\s+/i, "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="av-screen">
      {/* Headline: deixar claro que é um jogo */}
      <div className="av-intro-header av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div>
            <div className="av-intro-tag">Simulador Clínico</div>
            <div className="av-intro-tagline">Treine raciocínio clínico com IA</div>
          </div>
        </div>
        <div className="av-gamification-badges">
          <div className="av-badge-item">
            <span className="av-badge-icon">⭐</span> 0–100 XP
          </div>
          <div className="av-badge-item">
            <span className="av-badge-icon">🔥</span> Streak
          </div>
          <div className="av-badge-item">
            <span className="av-badge-icon">⚠️</span> Difícil
          </div>
        </div>
      </div>

      <div className="av-eyebrow av-stagger" style={{ "--d": "60ms" } as React.CSSProperties}>
        <span className="av-dot-live" /> Caso ao vivo · Sala Vermelha
      </div>

      <Glass className="av-stagger av-patient-card" style={{ "--d": "120ms" } as React.CSSProperties} accent="linear-gradient(180deg,var(--blue),var(--emerald))">
        <div className="av-patient-head">
          <Avatar initials={initials} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="av-patient-name">{p.name}</div>
            <div className="av-patient-meta">{p.age} anos · {p.sex} · chegou a pé, acompanhada</div>
          </div>
          <div className="av-triage">Vermelho</div>
        </div>
        <div className="av-chief">
          <div className="av-chief-label">Queixa principal</div>
          <div className="av-chief-text">"{medCase.chiefComplaint}"</div>
        </div>
        <p className="av-context">{medCase.scene}</p>
      </Glass>

      {/* Como jogar — visual do fluxo de fases */}
      <div className="av-stagger" style={{ "--d": "180ms" } as React.CSSProperties}>
        <div className="av-intro-howto">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cloud-dim)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Seu fluxo neste plantão
          </div>
          <div className="av-phase-flow">
            <div className="av-phase-step">
              <div className="av-phase-circle">1</div>
              <div className="av-phase-label">Anamnese</div>
            </div>
            <div className="av-phase-arrow">→</div>
            <div className="av-phase-step">
              <div className="av-phase-circle">2</div>
              <div className="av-phase-label">Exames</div>
            </div>
            <div className="av-phase-arrow">→</div>
            <div className="av-phase-step">
              <div className="av-phase-circle">3</div>
              <div className="av-phase-label">Conduta</div>
            </div>
            <div className="av-phase-arrow">→</div>
            <div className="av-phase-step">
              <div className="av-phase-circle">4</div>
              <div className="av-phase-label">Resultado</div>
            </div>
          </div>
        </div>
      </div>

      <div className="av-stagger" style={{ "--d": "260ms" } as React.CSSProperties}>
        <Glass className="av-mission">
          <Icon name="spark" size={18} color="var(--amber)" stroke={1.8} />
          <div>
            <strong>Sua missão</strong>
            <span>Avalie, investigue e estabilize a paciente. Cada minuto conta. A IA vai analisar suas decisões ao final.</span>
          </div>
        </Glass>
      </div>

      <div className="av-stagger av-cta-fixed" style={{ "--d": "320ms" } as React.CSSProperties}>
        <Btn variant="primary" full icon="chevR" onClick={onStart}>Iniciar atendimento</Btn>
      </div>
    </div>
  );
}

// ── Tela 1: Anamnese ───────────────────────────────────────────
function AnamneseScreen({ onAdvance, onXP }: { onAdvance: () => void; onXP: (n: number) => void }) {
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [thread, typing]);

  const ask = useCallback(async (q: typeof QUESTIONS[number]) => {
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
          caseId: medCase.id,
          history: thread.map((m) => ({ role: m.side === "doctor" ? "user" : "assistant", content: m.text })),
          message: q.ask,
        }),
      });
      const data = await res.json();
      if (data.reply) reply = data.reply;
    } catch {
      // fallback to scripted response
    }

    setTimeout(() => {
      setTyping(false);
      setThread((t) => [...t, { side: "patient", text: reply, tag: q.tag, key: q.id + "p" }]);
      onXP(20);
    }, 1100);
  }, [asked, typing, thread, onXP]);

  const remaining = QUESTIONS.filter((q) => !asked.includes(q.id));
  const canAdvance = asked.length >= MIN_QUESTIONS;

  return (
    <div className="av-screen">
      <div className="av-section-title av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>
        Anamnese
        <span className="av-counter">{asked.length}/{QUESTIONS.length}</span>
      </div>

      <Glass className="av-chat-card av-stagger" style={{ "--d": "90ms" } as React.CSSProperties}>
        <div className="av-chat-scroll" ref={scrollRef}>
          {thread.length === 0 && (
            <div className="av-chat-empty">A paciente está dispneica. Conduza a anamnese — escolha o que perguntar.</div>
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
        {remaining.length === 0 && (
          <div className="av-allasked">Anamnese completa ✓</div>
        )}
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
function ExamesScreen({ onAdvance, onXP }: { onAdvance: () => void; onXP: (n: number) => void }) {
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
          {VITALS_UI.map((v) => (
            <VitalChip key={v.id} v={v} revealed={vitalsOn} />
          ))}
        </div>
      </div>

      {!vitalsOn && (
        <div className="av-stagger" style={{ "--d": "140ms", marginTop: 12 } as React.CSSProperties}>
          <Btn variant="secondary" full icon="pulse" onClick={() => { setVitalsOn(true); onXP(25); }}>
            Aferir sinais vitais
          </Btn>
        </div>
      )}

      {vitalsOn && (
        <div className="av-alertline av-fade-in">
          <Icon name="alert" size={14} color="var(--amber)" stroke={2.4} />
          SpO₂ 88% e PFE 35% — crise grave. Investigue e trate.
        </div>
      )}

      <div className="av-section-title" style={{ marginTop: 22 }}>Exames complementares</div>

      <div className="av-exam-list">
        {medCase.exams.map((ex, i) => {
          const on = ordered.includes(ex.id);
          const iconName = EXAM_ICONS[ex.id] ?? "heart";
          const stateClass = ex.redFlag ? "state-crit" : "state-ok";
          return (
            <Glass key={ex.id} className={`av-exam av-stagger${on ? " is-on" : ""}`} style={{ "--d": `${200 + i * 80}ms`, padding: 0 } as React.CSSProperties}>
              <button className="av-exam-head" onClick={() => order(ex.id)} disabled={on}>
                <span className={`av-exam-icon ${stateClass}`}>
                  <Icon name={iconName} size={18} stroke={1.9} />
                </span>
                <span className="av-exam-name">{ex.label}</span>
                {on
                  ? <span className="av-exam-done"><Icon name="check" size={13} stroke={2.6} /></span>
                  : <span className="av-exam-cta">Solicitar</span>}
              </button>
              {on && (
                <div className="av-exam-result av-fade-in">{ex.result}</div>
              )}
            </Glass>
          );
        })}
      </div>

      <div className="av-cta-fixed">
        <Btn
          variant={canAdvance ? "primary" : "ghost"}
          full icon="chevR"
          disabled={!canAdvance}
          onClick={onAdvance}
        >
          {canAdvance
            ? "Definir conduta"
            : !vitalsOn
            ? "Afira os sinais vitais"
            : "Solicite ao menos 2 exames"}
        </Btn>
      </div>
    </div>
  );
}

// ── Tela 3: Conduta ────────────────────────────────────────────
function CondutaScreen({ onConfirm, onXP }: { onConfirm: (sel: string[]) => void; onXP: (n: number) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <div className="av-screen">
      <div className="av-section-title av-stagger" style={{ "--d": "0ms" } as React.CSSProperties}>Conduta</div>
      <p className="av-prompt av-stagger" style={{ "--d": "70ms" } as React.CSSProperties}>
        {medCase.conducts.length > 0 && "Asma quase fatal. Monte a conduta inicial — selecione o que fazer agora."}
      </p>

      <div className="av-conduta-list">
        {medCase.conducts.map((c, i) => {
          const on = sel.includes(c.id);
          return (
            <button
              key={c.id}
              className={`av-conduta av-stagger${on ? " is-sel" : ""}`}
              style={{ "--d": `${130 + i * 70}ms` } as React.CSSProperties}
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
          variant={sel.length ? "primary" : "ghost"}
          full icon="chevR"
          disabled={!sel.length}
          onClick={() => { onXP(40); onConfirm(sel); }}
        >
          {sel.length ? `Confirmar conduta (${sel.length})` : "Selecione a conduta"}
        </Btn>
      </div>
    </div>
  );
}

// ── Tela 4: Resultado ──────────────────────────────────────────
function ResultScreen({ outcomeKey, totalXP, onNext, conducts }: { outcomeKey: keyof typeof OUTCOMES; totalXP: number; onNext: () => void; conducts: string[]; }) {
  const o = OUTCOMES[outcomeKey];
  const [debrief, setDebrief] = useState<{ headline: string; acertos: string[]; ajustes: string[]; ensino: string; gancho: string } | null>(null);
  const [loadingDebrief, setLoadingDebrief] = useState(true);

  useEffect(() => {
    fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: medCase.id,
        hypothesisId: "asma_grave",
        conductIds: conducts,
        examsOrdered: [],
        timeUsed: 0,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.debrief) setDebrief(d.debrief); })
      .catch(() => {})
      .finally(() => setLoadingDebrief(false));
  }, [conducts]);

  return (
    <div className="av-screen av-result">
      <div className={`av-outcome hue-${o.hue}`}>
        <div className="av-outcome-glow" />
        <div className="av-outcome-label">{o.label}</div>
        <div className="av-outcome-score">{o.score}</div>
        <div className="av-outcome-scorelabel">pontos de desempenho</div>
        <div className="av-outcome-title">{o.title}</div>
      </div>

      <Glass className="av-stagger" style={{ "--d": "120ms" } as React.CSSProperties}>
        <p className="av-summary">{o.summary}</p>
        <div className="av-result-stats">
          {o.stats.map((s) => (
            <div key={s.k} className="av-rstat">
              <span className="av-rstat-v">{s.v}</span>
              <span className="av-rstat-k">{s.k}</span>
            </div>
          ))}
        </div>
      </Glass>

      <div className={`av-verdict hue-${o.hue} av-stagger`} style={{ "--d": "200ms" } as React.CSSProperties}>
        <Icon name="spark" size={16} color="currentColor" stroke={1.9} />
        <span>{o.verdict}</span>
      </div>

      {/* Debrief da IA */}
      {(loadingDebrief || debrief) && (
        <Glass className="av-stagger" style={{ "--d": "280ms" } as React.CSSProperties}>
          <div className="av-debrief-head">
            <span className="av-debrief-dot" />
            Debrief do seu <strong style={{ color: "var(--blue-bright)", marginLeft: 3 }}>Assistente Clínico</strong>
          </div>
          {loadingDebrief ? (
            <div style={{ fontSize: 13, color: "var(--cloud-faint)", display: "flex", gap: 8, alignItems: "center" }}>
              <span className="av-spinner" /> Gerando análise…
            </div>
          ) : debrief ? (
            <>
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
            </>
          ) : null}
        </Glass>
      )}

      <div className="av-xptotal av-stagger" style={{ "--d": "350ms" } as React.CSSProperties}>
        <Icon name="flame" size={14} color="var(--amber)" stroke={2.2} />
        Você acumulou <strong style={{ marginLeft: 4, marginRight: 4 }}>{totalXP} XP</strong> neste plantão
      </div>

      <div className="av-cta-fixed" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn variant="primary" full onClick={onNext}>Salvar resultado e continuar →</Btn>
      </div>
    </div>
  );
}

// ── Tela 5: Lead Capture ───────────────────────────────────────
function LeadScreen({ xp, outcomeKey, onRestart }: { xp: number; outcomeKey: keyof typeof OUTCOMES; onRestart: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const o = OUTCOMES[outcomeKey];

  const shareText =
    `🩺 PLANTÃO+ · Crise asmática grave\n` +
    `${o.hue === "emerald" ? "🟢" : o.hue === "blue" ? "🔵" : o.hue === "amber" ? "🟡" : "🔴"} ${o.score} pontos · ${o.label}\n` +
    `⚡ ${xp} XP acumulados\n\n` +
    `Treine raciocínio clínico com IA 👉 plantao.avelis.com.br`;

  const submit = async () => {
    setBusy(true);
    await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, specialty, lastScore: o.score, lastOutcome: outcomeKey, xp }),
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
            <Btn variant="primary" full onClick={onRestart}>Jogar outro caso</Btn>
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
export default function Game() {
  const [phase, setPhase] = useState<Phase>(0);
  const [isExiting, setIsExiting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ id: number; n: number } | null>(null);
  const [selectedConducts, setSelectedConducts] = useState<string[]>([]);
  const [outcomeKey, setOutcomeKey] = useState<keyof typeof OUTCOMES>("estavel");
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

  function handleCondutaConfirm(sel: string[]) {
    setSelectedConducts(sel);
    setOutcomeKey(computeOutcome(sel));
    transitionTo(4);
  }

  function restart() {
    setPhase(0);
    setSeconds(0);
    setXp(0);
    setStreak(0);
    setSelectedConducts([]);
    setOutcomeKey("estavel");
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
        {phase > 0 && phase < 4 && (
          <XPMeter xp={xp} streak={streak} />
        )}
      </div>

      {/* Content */}
      <div className="av-content" ref={scrollRef}>
        <div className={`av-phase-anim${isExiting ? " exiting" : ""}`} key={phase}>
          {phase === 0 && <IntroScreen onStart={() => transitionTo(1)} />}
          {phase === 1 && <AnamneseScreen onAdvance={() => transitionTo(2)} onXP={awardXP} />}
          {phase === 2 && <ExamesScreen onAdvance={() => transitionTo(3)} onXP={awardXP} />}
          {phase === 3 && <CondutaScreen onConfirm={handleCondutaConfirm} onXP={awardXP} />}
          {phase === 4 && <ResultScreen outcomeKey={outcomeKey} totalXP={xp} conducts={selectedConducts} onNext={() => transitionTo(5)} />}
          {phase === 5 && <LeadScreen xp={xp} outcomeKey={outcomeKey} onRestart={restart} />}
        </div>

        {/* Footer visível na intro e no lead */}
        {(phase === 0 || phase === 5) && <FooterAvelis />}
      </div>

      {/* XP Popup */}
      {xpPopup && (
        <div className="av-xp-pop" key={xpPopup.id}>
          +{xpPopup.n} XP
        </div>
      )}
    </div>
  );
}

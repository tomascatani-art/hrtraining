"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { roundToPlates, plateBreakdown, fmtKg } from "@/lib/plates";

/* ------------------------------ Temporizador por intervalos ------------------------------ */
type Phase = "PREP" | "WORK" | "REST" | "DONE";

export function IntervalTimer() {
  const [cfg, setCfg] = useState({ work: 20, rest: 10, rounds: 8, prep: 10 });
  const [st, setSt] = useState<{ phase: Phase; left: number; round: number }>({ phase: "PREP", left: cfg.prep, round: 1 });
  const { phase, left, round } = st;
  const [running, setRunning] = useState(false);
  const ctx = useRef<AudioContext | null>(null);

  const beep = (freq: number, ms = 160) => {
    try {
      ctx.current ??= new AudioContext();
      const o = ctx.current.createOscillator(), g = ctx.current.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(ctx.current.destination);
      g.gain.setValueAtTime(0.25, ctx.current.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.current.currentTime + ms / 1000);
      o.start(); o.stop(ctx.current.currentTime + ms / 1000);
    } catch { /* sin audio */ }
  };

  // Un paso por segundo: la transición de fase es pura; los sonidos van en otro efecto
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSt((s) => {
        if (s.left > 1) return { ...s, left: s.left - 1 };
        if (s.phase === "PREP") return { phase: "WORK", left: cfg.work, round: 1 };
        if (s.phase === "REST") return { phase: "WORK", left: cfg.work, round: s.round + 1 };
        if (s.phase === "WORK") return s.round >= cfg.rounds ? { ...s, phase: "DONE", left: 0 } : { ...s, phase: "REST", left: cfg.rest };
        return s;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, cfg]);

  const lastPhase = useRef<Phase>("PREP");
  useEffect(() => {
    if (!running && phase !== "DONE") return;
    if (phase !== lastPhase.current) {
      beep(phase === "WORK" ? 990 : phase === "REST" ? 440 : 1320, phase === "DONE" ? 600 : 300);
      if (phase === "DONE") setRunning(false);
      lastPhase.current = phase;
    } else if (left <= 3 && left > 0) beep(660, 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left]);

  const reset = () => { setRunning(false); lastPhase.current = "PREP"; setSt({ phase: "PREP", left: cfg.prep, round: 1 }); };
  const total = cfg.rounds * cfg.work + (cfg.rounds - 1) * cfg.rest;
  const colors: Record<Phase, string> = { PREP: "text-neutral-300", WORK: "text-volt", REST: "text-sky-400", DONE: "text-emerald-400" };
  const labels: Record<Phase, string> = { PREP: "Preparate", WORK: "¡Trabajo!", REST: "Descanso", DONE: "Terminado" };
  const set = (k: keyof typeof cfg) => (e: React.ChangeEvent<HTMLInputElement>) => { const v = Math.max(1, Number(e.target.value) || 1); setCfg({ ...cfg, [k]: v }); if (!running) { lastPhase.current = "PREP"; setSt({ phase: "PREP", left: k === "prep" ? v : cfg.prep, round: 1 }); } };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className={`card card-pad text-center lg:col-span-2 ${phase === "WORK" ? "border-volt/60" : ""}`}>
        <div className={`label text-base ${colors[phase]}`}>{labels[phase]}</div>
        <div className={`num my-4 text-[7rem] font-bold leading-none sm:text-[10rem] ${colors[phase]}`}>{phase === "DONE" ? "✓" : left}</div>
        <div className="num text-lg text-neutral-300">Ronda {Math.min(round, cfg.rounds)} de {cfg.rounds}</div>
        <div className="mx-auto mt-3 flex max-w-md gap-1">{Array.from({ length: cfg.rounds }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < round - (phase === "WORK" || phase === "DONE" ? 0 : 1) ? "bg-volt" : "bg-ink-700"}`} />)}</div>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={() => { if (phase === "DONE") reset(); setRunning((r) => !r); beep(880, 60); }} className="btn-primary px-8 py-3 text-base">{running ? <><Pause size={18} />Pausa</> : <><Play size={18} />{phase === "PREP" && left === cfg.prep ? "Empezar" : "Seguir"}</>}</button>
          <button type="button" onClick={reset} className="btn-ghost px-5"><RotateCcw size={16} />Reiniciar</button>
        </div>
      </div>
      <div className="card card-pad space-y-3">
        <h2 className="h2">Configuración</h2>
        <div className="flex flex-wrap gap-1.5">
          {[["Tabata", 20, 10, 8], ["EMOM 40/20", 40, 20, 10], ["30/30", 30, 30, 10], ["Sprints 10/50", 10, 50, 6]].map(([n, w, r, k]) => (
            <button type="button" key={n as string} onClick={() => { setCfg({ ...cfg, work: w as number, rest: r as number, rounds: k as number }); reset(); }} className="chip-mute hover:text-white">{n}</button>
          ))}
        </div>
        {([["work", "Trabajo (s)"], ["rest", "Descanso (s)"], ["rounds", "Rondas"], ["prep", "Preparación (s)"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-3 text-sm"><span className="text-neutral-300">{l}</span><input type="number" min={1} value={cfg[k]} onChange={set(k)} className="input w-24 text-center" /></label>
        ))}
        <p className="text-xs muted">Duración total: {Math.floor(total / 60)} min {total % 60} s. Suena un aviso en los últimos 3 segundos de cada fase.</p>
      </div>
    </div>
  );
}

/* ------------------------------ Calculadora de fuerza ------------------------------ */
export function StrengthCalculator() {
  const [kg, setKg] = useState("80");
  const [reps, setReps] = useState("5");
  const [target, setTarget] = useState("");
  const w = Number(kg.replace(",", ".")), r = Math.round(Number(reps));
  const valid = w > 0 && r >= 1 && r <= 12;
  const epley = valid ? (r === 1 ? w : w * (1 + r / 30)) : 0;
  const brzycki = valid ? (r === 1 ? w : (w * 36) / (37 - r)) : 0;
  const rm = valid ? (epley + brzycki) / 2 : 0;
  const t = Number(target.replace(",", "."));
  const repsTable = [1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({ n, kg: rm ? roundToPlates(rm / (1 + n / 30)) : 0 }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card card-pad space-y-4">
        <h2 className="h2">RM estimado</h2>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label mb-1.5 block">Kilos</span><input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="input text-center text-lg" /></label>
          <label><span className="label mb-1.5 block">Repeticiones</span><input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="input text-center text-lg" /></label>
        </div>
        {valid ? (
          <div className="rounded-xl bg-ink-900 p-4 text-center">
            <div className="label">1RM estimado</div>
            <div className="num text-5xl font-bold text-volt">{fmtKg(roundToPlates(rm))}<span className="text-lg text-neutral-500"> kg</span></div>
            <div className="mt-1 text-xs muted">Epley {fmtKg(Math.round(epley * 10) / 10)} · Brzycki {fmtKg(Math.round(brzycki * 10) / 10)}</div>
          </div>
        ) : <p className="text-sm muted">Ingresá un peso y entre 1 y 12 repeticiones.</p>}
        <p className="text-xs muted">Las fórmulas son más precisas con pocas repeticiones (hasta 6). Es una estimación, no reemplaza un test.</p>
        <div className="border-t border-ink-700 pt-4">
          <div className="label mb-1.5">Discos para un peso</div>
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ej: 87,5" className="input" />
          {t >= 20 && <p className="mt-2 text-sm text-neutral-200">Barra 20 kg + por lado: <b className="num text-white">{plateBreakdown(roundToPlates(t)).join(" + ") || "nada"}</b>{roundToPlates(t) !== t && <span className="block text-xs muted">Se redondeó a {fmtKg(roundToPlates(t))} kg.</span>}</p>}
        </div>
      </div>
      <div className="card lg:col-span-2" >
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="p-5">
            <h2 className="h2 mb-3">Porcentajes</h2>
            <table className="table">
              <thead><tr><th>%</th><th className="text-right">Kg</th><th className="text-right">Discos por lado</th></tr></thead>
              <tbody>
                {[100, 95, 90, 85, 80, 75, 70, 65, 60, 50].map((p) => { const v = rm ? roundToPlates((rm * p) / 100) : 0; return <tr key={p}><td className="num">{p}%</td><td className="num text-right font-semibold text-white">{rm ? fmtKg(v) : "—"}</td><td className="num text-right text-xs text-neutral-400">{rm && v >= 20 ? plateBreakdown(v).join(" + ") || "barra" : "—"}</td></tr>; })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink-700 p-5 sm:border-l sm:border-t-0">
            <h2 className="h2 mb-3">Peso por repeticiones</h2>
            <table className="table">
              <thead><tr><th>Reps</th><th className="text-right">Kg aprox.</th></tr></thead>
              <tbody>{repsTable.map((x) => <tr key={x.n}><td className="num">{x.n}</td><td className="num text-right font-semibold text-white">{rm ? fmtKg(x.kg) : "—"}</td></tr>)}</tbody>
            </table>
            <p className="mt-3 text-xs muted">Pesos redondeados a barra de 20 kg con discos desde 1,25 kg.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Calculadora de energía ------------------------------ */
const ACTIVITY = [
  { f: 1.375, label: "Entrena 1-3 días por semana" },
  { f: 1.55, label: "Entrena 3-5 días por semana" },
  { f: 1.725, label: "Entrena 6-7 días por semana" },
  { f: 1.9, label: "Doble turno o trabajo físico" },
];

export function EnergyCalculator({ initial }: { initial: { weightKg?: number | null; heightCm?: number | null; age?: number | null; sex?: string | null } }) {
  const [v, setV] = useState({ weight: String(initial.weightKg ?? ""), height: String(initial.heightCm ?? ""), age: String(initial.age ?? ""), sex: initial.sex === "M" ? "M" : "F", act: 1.55, goal: "MANTENER" });
  const w = Number(v.weight), h = Number(v.height), a = Number(v.age);
  const ok = w > 25 && h > 100 && a >= 12;
  const bmr = ok ? 10 * w + 6.25 * h - 5 * a + (v.sex === "M" ? 5 : -161) : 0;
  const tdee = bmr * v.act;
  const kcal = Math.round(tdee * (v.goal === "BAJAR" ? 0.85 : v.goal === "SUBIR" ? 1.1 : 1));
  const prot = Math.round(w * (v.goal === "BAJAR" ? 2 : 1.8));
  const fat = Math.round((kcal * 0.27) / 9);
  const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  const field = (k: "weight" | "height" | "age", l: string) => <label><span className="label mb-1.5 block">{l}</span><input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="input" /></label>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card card-pad space-y-3">
        <h2 className="h2">Tus datos</h2>
        <div className="grid grid-cols-3 gap-3">{field("weight", "Peso (kg)")}{field("height", "Altura (cm)")}{field("age", "Edad")}</div>
        <div className="flex gap-1.5">{[["F", "Mujer"], ["M", "Hombre"]].map(([k, l]) => <button type="button" key={k} onClick={() => setV({ ...v, sex: k })} className={v.sex === k ? "tab tab-active" : "tab border border-ink-700"}>{l}</button>)}</div>
        <label className="block"><span className="label mb-1.5 block">Actividad</span><select value={v.act} onChange={(e) => setV({ ...v, act: Number(e.target.value) })} className="input">{ACTIVITY.map((x) => <option key={x.f} value={x.f}>{x.label}</option>)}</select></label>
        <div className="flex gap-1.5">{[["BAJAR", "Bajar grasa"], ["MANTENER", "Mantener"], ["SUBIR", "Ganar masa"]].map(([k, l]) => <button type="button" key={k} onClick={() => setV({ ...v, goal: k })} className={v.goal === k ? "tab tab-active" : "tab border border-ink-700"}>{l}</button>)}</div>
      </div>
      <div className="card card-pad lg:col-span-2">
        {ok ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-ink-900 p-4"><div className="label">Metabolismo basal</div><div className="num text-2xl font-semibold text-white">{Math.round(bmr)} <span className="text-sm text-neutral-500">kcal</span></div></div>
              <div className="rounded-xl bg-ink-900 p-4"><div className="label">Gasto diario estimado</div><div className="num text-2xl font-semibold text-white">{Math.round(tdee)} <span className="text-sm text-neutral-500">kcal</span></div></div>
              <div className="rounded-xl border border-volt/40 bg-volt/10 p-4"><div className="label text-volt">Objetivo diario</div><div className="num text-2xl font-bold text-volt">{kcal} <span className="text-sm">kcal</span></div></div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[["Proteínas", prot, 4], ["Carbohidratos", carb, 4], ["Grasas", fat, 9]].map(([l, g, f]) => (
                <div key={l as string} className="rounded-xl border border-ink-700 p-3"><div className="label">{l}</div><div className="num text-xl font-semibold text-white">{g} g</div><div className="text-xs muted">{Math.round(((g as number) * (f as number) * 100) / kcal)}% · {(Number(g) / w).toFixed(1)} g/kg</div></div>
              ))}
            </div>
          </>
        ) : <p className="text-sm muted">Completá peso, altura y edad para ver el cálculo.</p>}
        <p className="mt-4 text-xs muted">Estimación con la fórmula de Mifflin-St Jeor. Es una referencia general, no un plan de alimentación: para eso consultá con un nutricionista.</p>
      </div>
    </div>
  );
}

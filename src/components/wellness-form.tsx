"use client";
import { useState } from "react";
import { Submit } from "./forms";

const ITEMS: { key: string; label: string; low: string; high: string }[] = [
  { key: "sleepQuality", label: "Calidad del sueño", low: "Muy mala", high: "Excelente" },
  { key: "fatigue", label: "Nivel de energía", low: "Muy fatigado", high: "Muy fresco" },
  { key: "soreness", label: "Dolor muscular", low: "Mucho dolor", high: "Sin dolor" },
  { key: "stress", label: "Estrés", low: "Muy estresado", high: "Relajado" },
  { key: "mood", label: "Estado de ánimo", low: "Muy bajo", high: "Excelente" },
];

export function WellnessForm({ action, initial }: { action: (fd: FormData) => Promise<void>; initial?: Record<string, unknown> }) {
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(ITEMS.map((i) => [i.key, Number(initial?.[i.key] ?? 3)])));
  const [ready, setReady] = useState(Number(initial?.readiness ?? 7));
  const [pain, setPain] = useState(!!initial?.painArea);
  const total = Object.values(v).reduce((a, b) => a + b, 0);
  return (
    <form action={action} className="space-y-5">
      {ITEMS.map((it) => (
        <div key={it.key}>
          <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-white">{it.label}</span><span className="text-xs muted">{it.low} → {it.high}</span></div>
          <input type="hidden" name={it.key} value={v[it.key]} />
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setV({ ...v, [it.key]: n })}
                className={`num rounded-xl border py-3 text-base font-semibold transition active:scale-95 ${v[it.key] === n ? "border-volt bg-volt text-black" : "border-ink-600 bg-ink-900 text-neutral-400 hover:text-white"}`}>{n}</button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-white">Disponibilidad para entrenar hoy</span><span className="num text-2xl font-bold text-volt">{ready}<span className="text-sm text-neutral-500">/10</span></span></div>
        <input type="range" name="readiness" min={1} max={10} value={ready} onChange={(e) => setReady(Number(e.target.value))} className="w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label mb-1.5 block">Horas de sueño</span><input name="sleepHours" type="number" step="0.5" min={0} max={16} defaultValue={(initial?.sleepHours as number) ?? ""} className="input" /></label>
        <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} />Tengo alguna molestia o dolor</label></div>
      </div>
      {pain && <label className="block"><span className="label mb-1.5 block">¿Dónde?</span><input name="painArea" defaultValue={(initial?.painArea as string) ?? ""} className="input" placeholder="Ej: rodilla derecha, zona lumbar…" required /></label>}
      <label className="block"><span className="label mb-1.5 block">Comentario (opcional)</span><textarea name="notes" defaultValue={(initial?.notes as string) ?? ""} className="input" /></label>
      <div className="flex items-center justify-between rounded-xl bg-ink-900 p-3"><span className="text-sm muted">Puntaje de bienestar</span><span className="num text-xl font-semibold text-white">{total}/25</span></div>
      <Submit className="btn-primary w-full">Enviar</Submit>
      <p className="text-[11px] text-neutral-600">Esta información la ve solo tu cuerpo técnico. Si tenés un dolor persistente, consultá a un profesional de la salud.</p>
    </form>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, PlayCircle, Timer } from "lucide-react";
import { fmtKg, plateBreakdown } from "@/lib/plates";
import { Submit } from "./forms";

type SetRow = { reps: string; loadKg: string; rir: string; velocity: string; done: boolean };
type Item = { id: string; exerciseId: string; name: string; sets: number; reps: string; suggestedKg: number | null; targetRir: number | null; restSec: number | null; tempo: string | null; notes: string | null; videoUrl: string | null; percent: number | null; rm: number | null; rounded: number | null; block: { label: string; color: string } | null };

const CR10: Record<number, string> = { 0: "Reposo", 1: "Muy, muy fácil", 2: "Fácil", 3: "Moderado", 4: "Algo duro", 5: "Duro", 6: "Duro+", 7: "Muy duro", 8: "Muy duro+", 9: "Casi máximo", 10: "Máximo" };

export function WorkoutLogger({ action, sessionId, athleteId, items, defaultDuration, existing, quickNotes, isAthlete }: {
  action: (fd: FormData) => Promise<void>;
  sessionId: string; athleteId?: string; items: Item[]; defaultDuration: number; quickNotes: string[]; isAthlete: boolean;
  existing?: { status: string; rpe: number | null; durationMin: number | null; feeling: string | null; sets: { itemId: string; setNumber: number; reps: number | null; loadKg: number | null; rir: number | null; velocity: number | null }[]; notes?: { itemId: string; note: string }[] } | null;
}) {
  const [rows, setRows] = useState<Record<string, SetRow[]>>(() =>
    Object.fromEntries(items.map((it) => [it.id, Array.from({ length: it.sets }, (_, i) => {
      const ex = existing?.sets.find((s) => s.itemId === it.id && s.setNumber === i + 1);
      return {
        reps: ex?.reps?.toString() ?? (parseInt(it.reps) ? String(parseInt(it.reps)) : ""),
        loadKg: ex?.loadKg?.toString() ?? (it.suggestedKg ? String(it.suggestedKg) : ""),
        rir: ex?.rir?.toString() ?? (it.targetRir != null ? String(it.targetRir) : ""),
        velocity: ex?.velocity?.toString() ?? "",
        done: !!ex,
      };
    })])),
  );
  const [rpe, setRpe] = useState(existing?.rpe ?? 6);
  const [dur, setDur] = useState(existing?.durationMin ?? defaultDuration);
  const [status, setStatus] = useState(existing?.status ?? "COMPLETADO");
  const [feeling, setFeeling] = useState(existing?.feeling ?? "");
  const [vbt, setVbt] = useState(!!existing?.sets.some((s) => s.velocity));
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries((existing?.notes ?? []).map((n) => [n.itemId, n.note])));
  const addQuick = (id: string, q: string) => setNotes((m) => ({ ...m, [id]: m[id] ? (m[id].includes(q) ? m[id] : `${m[id]}. ${q}`) : q }));

  const upd = (id: string, i: number, patch: Partial<SetRow>) => setRows((r) => ({ ...r, [id]: r[id].map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addSet = (id: string) => setRows((r) => ({ ...r, [id]: [...r[id], { ...(r[id].at(-1) ?? { reps: "", loadKg: "", rir: "", velocity: "" }), done: false }] }));
  const n = (v: string) => (v === "" ? null : Number(v));
  const allSets = Object.entries(rows).flatMap(([itemId, list]) => list.map((s, i) => ({ itemId, setNumber: i + 1, ...s })).filter((s) => s.done));
  const volume = allSets.reduce((a, s) => a + (Number(s.reps) || 0) * (Number(s.loadKg) || 0), 0);
  const done = status === "COMPLETADO" || status === "PARCIAL";
  const payload = JSON.stringify({
    sessionId, athleteId, status, durationMin: done ? dur : null, rpe: done ? rpe : null, feeling,
    notes: Object.entries(notes).map(([itemId, note]) => ({ itemId, note })),
    sets: allSets.map((s) => ({ itemId: s.itemId, setNumber: s.setNumber, reps: n(s.reps), loadKg: n(s.loadKg), rir: n(s.rir), rpe: s.rir !== "" ? 10 - Number(s.rir) : null, velocity: n(s.velocity), timeSec: null })),
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <div className="flex flex-wrap items-center gap-2">
        {[["COMPLETADO", "Completada"], ["PARCIAL", "Parcial"], ["AUSENTE", "No asistí"], ["JUSTIFICADO", "Ausencia justificada"]].map(([v, l]) => (
          <button type="button" key={v} onClick={() => setStatus(v)} className={status === v ? "tab tab-active" : "tab border border-ink-700"}>{l}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-neutral-400"><input type="checkbox" checked={vbt} onChange={(e) => setVbt(e.target.checked)} />Registrar velocidad (VBT)</label>
      </div>

      {done && items.map((it, idx) => (
        <div key={it.id}>
        {it.block && it.block.label !== items[idx - 1]?.block?.label && <div className="mb-2 mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: it.block.color }}><span className="h-2 w-2 rounded-full" style={{ background: it.block.color }} />{it.block.label}</div>}
        <div className="card card-pad" style={it.block ? { borderLeft: `4px solid ${it.block.color}` } : undefined}>
          <div className="mb-3 flex flex-wrap items-start gap-3">
            <span className="num grid h-7 w-7 place-items-center rounded-lg bg-volt text-sm font-bold text-black">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{it.name}</div>
              <div className="text-xs muted">
                Plan: {it.sets}×{it.reps}{it.percent ? ` · ${Math.round(it.percent * 100)}% 1RM` : ""}{it.suggestedKg ? ` (≈${it.suggestedKg} kg)` : ""}{it.targetRir != null ? ` · RIR ${it.targetRir}` : ""}{it.restSec ? ` · pausa ${it.restSec}s` : ""}{it.tempo ? ` · tempo ${it.tempo}` : ""}
              </div>
              {it.notes && <div className="mt-1 text-xs text-volt/90">{it.notes}</div>}
              {it.percent ? (
                it.rm ? (
                  <div className="mt-1.5 text-xs text-neutral-300">
                    Peso calculado con {isAthlete ? "tu" : "su"} RM de <b className="num text-white">{fmtKg(it.rm)} kg</b>
                    {it.suggestedKg ? <> · discos por lado: <span className="num">{plateBreakdown(it.suggestedKg).join(" + ") || "solo barra"}</span></> : null}
                    {it.rounded != null && <span className="ml-1 text-neutral-500">(el {Math.round(it.percent * 100)}% da {fmtKg(it.rounded)} kg, se redondeó a discos)</span>}
                    {isAthlete && <Link href="/app/rm" className="ml-2 text-volt hover:underline">Cambiar</Link>}
                  </div>
                ) : (
                  <div className="mt-1.5 text-xs text-neutral-400">Sin RM cargado para este ejercicio. {isAthlete ? <Link href="/app/rm" className="text-volt hover:underline">Cargar mi RM</Link> : "Cargalo en la pestaña RM del deportista."}</div>
                )
              ) : null}
            </div>
            {it.videoUrl && <a href={it.videoUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><PlayCircle size={14} />Ver técnica</a>}
          </div>
          <div className="space-y-1.5">
            <div className={`grid gap-2 px-1 text-[10px] uppercase tracking-wider text-neutral-500 ${vbt ? "grid-cols-[28px_1fr_1fr_1fr_1fr_40px]" : "grid-cols-[28px_1fr_1fr_1fr_40px]"}`}>
              <span>#</span><span>Reps</span><span>Kg</span><span>RIR</span>{vbt && <span>m/s</span>}<span />
            </div>
            {rows[it.id].map((s, i) => (
              <div key={i} className={`grid items-center gap-2 rounded-lg p-1 transition ${s.done ? "bg-volt/10" : ""} ${vbt ? "grid-cols-[28px_1fr_1fr_1fr_1fr_40px]" : "grid-cols-[28px_1fr_1fr_1fr_40px]"}`}>
                <span className="num text-center text-sm text-neutral-400">{i + 1}</span>
                <input inputMode="numeric" className="input py-2 text-center" value={s.reps} onChange={(e) => upd(it.id, i, { reps: e.target.value })} aria-label="Repeticiones" />
                <input inputMode="decimal" className="input py-2 text-center" value={s.loadKg} onChange={(e) => upd(it.id, i, { loadKg: e.target.value })} aria-label="Kilos" />
                <input inputMode="numeric" className="input py-2 text-center" value={s.rir} onChange={(e) => upd(it.id, i, { rir: e.target.value })} aria-label="RIR" />
                {vbt && <input inputMode="decimal" className="input py-2 text-center" value={s.velocity} onChange={(e) => upd(it.id, i, { velocity: e.target.value })} aria-label="Velocidad" />}
                <button type="button" onClick={() => upd(it.id, i, { done: !s.done })} className={`grid h-10 w-10 place-items-center rounded-lg border transition ${s.done ? "border-volt bg-volt text-black" : "border-ink-600 text-neutral-600 hover:text-white"}`} aria-label="Serie hecha"><Check size={18} /></button>
              </div>
            ))}
            <button type="button" onClick={() => addSet(it.id)} className="mt-1 text-xs text-volt hover:underline">+ Agregar serie</button>
            {it.restSec ? <span className="ml-3 inline-flex items-center gap-1 text-xs text-neutral-500"><Timer size={12} />Pausa {it.restSec}s</span> : null}
          </div>
          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {quickNotes.map((q) => <button type="button" key={q} onClick={() => addQuick(it.id, q)} className="chip-mute px-2 py-0.5 text-[11px] hover:text-white">{q}</button>)}
            </div>
            <input className="input py-1.5 text-sm" value={notes[it.id] ?? ""} onChange={(e) => setNotes((m) => ({ ...m, [it.id]: e.target.value }))} placeholder="¿Cómo te fue en este ejercicio? (opcional)" maxLength={500} />
          </div>
        </div>
        </div>
      ))}

      <div className="card card-pad space-y-4 border-volt/30">
        {done && (
          <>
            <div>
              <div className="flex items-end justify-between">
                <span className="label">Esfuerzo percibido de la sesión (RPE CR-10)</span>
                <span className="text-right"><span className="num text-3xl font-bold text-volt">{rpe}</span><span className="ml-2 text-sm text-neutral-400">{CR10[rpe]}</span></span>
              </div>
              <input type="range" min={0} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="mt-2 w-full" />
              <p className="mt-1 text-[11px] text-neutral-600">Respondé unos 30 minutos después de terminar: ¿qué tan dura fue la sesión completa?</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label><span className="label mb-1.5 block">Duración (min)</span><input type="number" className="input" value={dur} onChange={(e) => setDur(Number(e.target.value))} /></label>
              <div className="rounded-xl bg-ink-900 p-3"><div className="label">Carga sRPE</div><div className="num text-xl font-semibold text-white">{rpe * dur} <span className="text-xs text-neutral-500">UA</span></div></div>
              <div className="rounded-xl bg-ink-900 p-3"><div className="label">Volumen</div><div className="num text-xl font-semibold text-white">{volume.toLocaleString("es-AR")} <span className="text-xs text-neutral-500">kg</span></div></div>
              <div className="rounded-xl bg-ink-900 p-3"><div className="label">Series hechas</div><div className="num text-xl font-semibold text-white">{allSets.length}</div></div>
            </div>
          </>
        )}
        <label className="block"><span className="label mb-1.5 block">Sensaciones / comentario para el entrenador</span><textarea className="input" value={feeling} onChange={(e) => setFeeling(e.target.value)} placeholder="¿Cómo te sentiste? ¿Alguna molestia?" /></label>
        <Submit className="btn-primary w-full sm:w-auto">{existing ? "Actualizar registro" : "Guardar entrenamiento"}</Submit>
      </div>
    </form>
  );
}

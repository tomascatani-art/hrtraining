"use client";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, HeartPulse, X } from "lucide-react";
import Link from "next/link";
import { type RoutineData, FOCUS, type FocusMap, blockSummary, WEEKDAYS } from "@/lib/routine";
import { VideoButton } from "@/components/video-player";
import { toggleCheck } from "@/app/app/routine/actions";

type Checks = { routineId: string; done: string[]; wellnessDone?: boolean };

/** Lo que ve el alumno: un día por pestaña, la semana en curso resaltada y el video adentro de la app. */
export function RoutineView({ data, week, checks, roles = FOCUS }: { data: RoutineData; week: number | null; checks?: Checks; roles?: FocusMap }) {
  // Día que se abre: el que tiene tics hoy, o el que coincide con el día de la semana, o el primero.
  const [di, setDi] = useState(() => {
    if (checks?.done.length) { const i = data.days.findIndex((d) => d.blocks.some((b) => b.rows.some((r) => checks.done.includes(r.id)))); if (i >= 0) return i; }
    const today = WEEKDAYS[(new Date().getDay() + 6) % 7];
    const i = data.days.findIndex((d) => d.weekday === today);
    return i >= 0 ? i : 0;
  });
  const [done, setDone] = useState<Set<string>>(() => new Set(checks?.done ?? []));
  const [askWellness, setAskWellness] = useState(false);
  const [, start] = useTransition();
  const toggle = (dayId: string, rowId: string) => {
    if (!checks) return;
    const on = !done.has(rowId);
    // Se marca al instante; si no se pudo guardar, vuelve atrás.
    setDone((s) => { const n = new Set(s); if (on) n.add(rowId); else n.delete(rowId); return n; });
    // Terminó todo el día: le pedimos la encuesta de bienestar (si hoy no la hizo).
    if (on && !checks.wellnessDone) {
      const d = data.days.find((x) => x.id === dayId);
      const rs = d ? rowsOf(d) : [];
      if (rs.length && rs.every((r) => r.id === rowId || done.has(r.id))) setAskWellness(true);
    }
    start(async () => {
      try { await toggleCheck(checks.routineId, dayId, rowId, on); }
      catch { setDone((s) => { const n = new Set(s); if (on) n.delete(rowId); else n.add(rowId); return n; }); }
    });
  };
  const rowsOf = (d: RoutineData["days"][number]) => d.blocks.flatMap((b) => b.rows.filter((r) => r.name));
  const [w, setW] = useState<number | null>(week);
  const day = data.days[Math.min(di, data.days.length - 1)];
  const cols = w == null ? Array.from({ length: data.weeks }, (_, i) => i) : [w];
  return (
    <div className="space-y-4">
      {(data.meta.objective || data.meta.notes || data.meta.rest) && (
        <div className="card card-pad grid gap-2 text-sm sm:grid-cols-3">
          {data.meta.objective && <div><div className="label">Objetivo</div><div className="text-white">{data.meta.objective}</div></div>}
          {data.meta.rest && <div><div className="label">Pausa entre series</div><div className="text-white">{data.meta.rest}</div></div>}
          {data.meta.notes && <div className="sm:col-span-3"><div className="label">Indicaciones</div><div className="text-neutral-200">{data.meta.notes}</div></div>}
        </div>
      )}

      {data.warmup.some((x) => x.name) && (
        <div className="card card-pad">
          <div className="h2 mb-2">Calentamiento</div>
          <ul className="divide-y divide-ink-800">
            {data.warmup.filter((x) => x.name).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-white">{x.name}{x.detail && <span className="ml-2 text-sm text-volt">{x.detail}</span>}</span>
                <VideoButton url={x.video} name={x.name} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {data.days.map((d, i) => { const rs = rowsOf(d); const full = !!checks && rs.length > 0 && rs.every((r) => done.has(r.id)); return <button key={d.id} type="button" onClick={() => setDi(i)} className={day?.id === d.id ? "tab tab-active whitespace-nowrap" : "tab whitespace-nowrap"}>{full && <Check size={14} className="mr-1 inline" />}{d.name}{d.weekday ? ` · ${d.weekday}` : ""}</button>; })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="muted mr-1">Semana:</span>
        {Array.from({ length: data.weeks }, (_, i) => (
          <button key={i} type="button" onClick={() => setW(i)} className={w === i ? "chip-volt" : "chip-mute hover:text-white"}>{i + 1}{week === i ? " · esta" : ""}</button>
        ))}
        <button type="button" onClick={() => setW(null)} className={w == null ? "chip-volt" : "chip-mute hover:text-white"}>Todas</button>
      </div>

      {checks && day && (() => {
        const rs = rowsOf(day); const n = rs.filter((r) => done.has(r.id)).length; const pct = rs.length ? Math.round((n / rs.length) * 100) : 0;
        return rs.length > 0 && (
          <div className={`card card-pad ${n === rs.length ? "border-volt/60 bg-volt/[.06]" : ""}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-white">{n === rs.length ? "¡Día completo! Buen trabajo 💪" : "Marcá cada ejercicio cuando lo termines"}</span>
              <span className="num shrink-0 font-bold text-volt">{n}/{rs.length}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-volt transition-all" style={{ width: `${pct}%` }} /></div>
            {n === rs.length && !checks.wellnessDone && (
              <Link href="/app/wellness?desde=rutina" className="btn-primary mt-3 w-full"><HeartPulse size={16} />Contanos cómo terminaste (encuesta de bienestar)</Link>
            )}
          </div>
        );
      })()}
      {askWellness && createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/75 p-4 sm:place-items-center" onClick={() => setAskWellness(false)}>
          <div className="card card-pad w-full max-w-sm border-volt/60 text-center animate-rise" onClick={(e) => e.stopPropagation()} style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            <button type="button" onClick={() => setAskWellness(false)} className="float-right -mr-2 -mt-2 p-2 text-neutral-500 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-volt text-black"><HeartPulse size={26} /></div>
            <div className="font-display text-xl font-bold text-white">¡Terminaste el entrenamiento!</div>
            <p className="mt-1 text-sm muted">Contale a tu preparador cómo te sentiste. Son 30 segundos.</p>
            <Link href="/app/wellness?desde=rutina" className="btn-primary mt-4 w-full">Responder encuesta de bienestar</Link>
            <button type="button" onClick={() => setAskWellness(false)} className="mt-2 w-full py-2 text-sm text-neutral-400 hover:text-white">Ahora no</button>
          </div>
        </div>, document.body
      )}

      {day && day.blocks.map((b) => b.rows.some((r) => r.name) && (
        <div key={b.id} className="card overflow-hidden">
          <div className="border-b border-ink-700 bg-ink-900 px-4 py-2">
            <div className="text-xs font-bold uppercase tracking-wider text-volt">{b.name}</div>
            {blockSummary(b) && <div className="mt-0.5 text-xs font-semibold text-white">{blockSummary(b)}</div>}
          </div>
          <div className="divide-y divide-ink-800">
            {b.rows.filter((r) => r.name).map((r, i, rows) => (
              <div key={r.id} className={`${r.link || rows[i - 1]?.link ? "border-l-2 border-volt/70" : ""} ${checks && done.has(r.id) ? "bg-volt/[.04]" : ""}`}>
                <div className={`flex gap-3 px-4 py-3 ${checks && done.has(r.id) ? "opacity-70" : ""}`}>
                  {checks && (
                    <button type="button" onClick={() => toggle(day.id, r.id)} aria-pressed={done.has(r.id)} aria-label={done.has(r.id) ? `Desmarcar ${r.name}` : `Marcar ${r.name} como hecho`}
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${done.has(r.id) ? "border-volt bg-volt text-black" : "border-ink-500 text-transparent hover:border-volt"}`}>
                      <Check size={18} strokeWidth={3} />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><span className="mr-2 text-xs text-neutral-500">{i + 1}</span><span className="font-semibold text-white">{r.name}</span>{r.focus && roles[r.focus] && <span className={`ml-2 inline-block rounded-full border px-2 py-0.5 align-middle text-[10px] font-bold ${roles[r.focus].cls}`}>{roles[r.focus].label}</span>}</div>
                    <VideoButton url={r.video} name={r.name} />
                  </div>
                  {r.mode === "tabata" ? (
                    <div className="mt-1.5"><span className="rounded-lg border border-volt/60 bg-volt/10 px-2 py-1 text-sm text-volt">Tabata {r.tabata?.work || 20}″ trabajo / {r.tabata?.rest || 10}″ descanso × {r.tabata?.rounds || 8}</span></div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {cols.map((c) => (r.cells[c] || r.rm?.[c] ? (
                        <span key={c} className={`rounded-lg border px-2 py-1 text-sm ${c === week ? "border-volt/60 bg-volt/10 text-volt" : "border-ink-700 text-neutral-200"}`}>
                          {cols.length > 1 && <span className="mr-1 text-[10px] text-neutral-500">S{c + 1}</span>}{r.cells[c]}{(r.rm?.[c] || r.rmBase) && <span className="ml-1.5 text-xs text-neutral-400">{r.rm?.[c] || r.rmBase}</span>}
                        </span>
                      ) : null))}
                    </div>
                  )}
                  {(r.note || (r.rest && r.mode !== "tabata")) && <div className="mt-1 text-xs muted">{[r.rest && r.mode !== "tabata" ? `Descanso ${r.rest}″` : "", r.note].filter(Boolean).join(" · ")}</div>}
                  </div>
                </div>
                {r.link && i < rows.length - 1 && <div className="px-4 pb-2 text-[11px] font-bold uppercase tracking-wide text-volt">{r.link === "circuito" ? "↻ Circuito con el siguiente" : "⛓ Sin descanso, seguí con el siguiente"}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {day && !day.blocks.some((b) => b.rows.some((r) => r.name)) && <div className="card card-pad text-sm muted">Este día todavía no tiene ejercicios.</div>}
    </div>
  );
}

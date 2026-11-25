"use client";
import { useState } from "react";
import { type RoutineData, FOCUS, blockSummary } from "@/lib/routine";
import { VideoButton } from "@/components/video-player";

/** Lo que ve el deportista: un día por pestaña, la semana en curso resaltada y el video adentro de la app. */
export function RoutineView({ data, week }: { data: RoutineData; week: number | null }) {
  const [di, setDi] = useState(0);
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
        {data.days.map((d, i) => <button key={d.id} type="button" onClick={() => setDi(i)} className={day?.id === d.id ? "tab tab-active whitespace-nowrap" : "tab whitespace-nowrap"}>{d.name}{d.weekday ? ` · ${d.weekday}` : ""}</button>)}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="muted mr-1">Semana:</span>
        {Array.from({ length: data.weeks }, (_, i) => (
          <button key={i} type="button" onClick={() => setW(i)} className={w === i ? "chip-volt" : "chip-mute hover:text-white"}>{i + 1}{week === i ? " · esta" : ""}</button>
        ))}
        <button type="button" onClick={() => setW(null)} className={w == null ? "chip-volt" : "chip-mute hover:text-white"}>Todas</button>
      </div>

      {day && day.blocks.map((b) => b.rows.some((r) => r.name) && (
        <div key={b.id} className="card overflow-hidden">
          <div className="border-b border-ink-700 bg-ink-900 px-4 py-2">
            <div className="text-xs font-bold uppercase tracking-wider text-volt">{b.name}</div>
            {blockSummary(b) && <div className="mt-0.5 text-xs font-semibold text-white">{blockSummary(b)}</div>}
          </div>
          <div className="divide-y divide-ink-800">
            {b.rows.filter((r) => r.name).map((r, i, rows) => (
              <div key={r.id} className={r.link || rows[i - 1]?.link ? "border-l-2 border-volt/70" : ""}>
                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1"><span className="mr-2 text-xs text-neutral-500">{i + 1}</span><span className="font-semibold text-white">{r.name}</span>{r.focus && FOCUS[r.focus] && <span className={`ml-2 inline-block rounded-full border px-2 py-0.5 align-middle text-[10px] font-bold ${FOCUS[r.focus].cls}`}>{FOCUS[r.focus].label}</span>}</div>
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

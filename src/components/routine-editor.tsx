"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Plus, Save, Trash2, Link2, Search, Send } from "lucide-react";
import { type RoutineData, type RoutineRow, type RoutineDay, emptyDay, emptyBlock, emptyRow, cloneDay, newId, MAX_WEEKS } from "@/lib/routine";
import { youtubeSearch } from "@/lib/video";
import { VideoButton } from "@/components/video-player";

type Ex = [id: string, name: string, video: string | null];
type Athlete = { id: string; name: string };

const move = <T,>(a: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= a.length) return a; const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Planilla de la rutina: días → bloques → ejercicios, una columna por semana. Estilo hoja de cálculo, pensado para el celular también. */
export function RoutineEditor({ id, initialName, initial, exercises, athletes, isTemplate, save, copyDay }: {
  id: string; initialName: string; initial: RoutineData; exercises: Ex[]; athletes: Athlete[]; isTemplate: boolean;
  save: (id: string, name: string, data: unknown) => Promise<{ ok: boolean; savedAt: string }>;
  copyDay: (fromId: string, dayId: string, toAthleteId: string) => Promise<{ ok: boolean; name: string }>;
}) {
  const [data, setData] = useState<RoutineData>(initial);
  const [name, setName] = useState(initialName);
  const [dayIdx, setDayIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const byName = useMemo(() => new Map(exercises.map((e) => [norm(e[1]), e])), [exercises]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setDirty(true); }, [data, name]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const day = data.days[Math.min(dayIdx, data.days.length - 1)];
  const di = data.days.indexOf(day);
  const set = (f: (d: RoutineData) => RoutineData) => setData((d) => f(structuredClone(d)));
  const setDay = (f: (d: RoutineDay) => void) => set((d) => { f(d.days[di]); return d; });

  const doSave = () => start(async () => {
    try { await save(id, name, data); setDirty(false); setMsg({ ok: true, text: "Guardado" }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar" }); }
  });

  /** Si el nombre coincide con uno de la biblioteca, se vincula y trae su video. */
  const pickName = (row: { name: string; exerciseId?: string | null; video?: string | null }, value: string) => {
    row.name = value;
    const ex = byName.get(norm(value));
    if (ex) { row.exerciseId = ex[0]; row.name = ex[1]; if (!row.video && ex[2]) row.video = ex[2]; }
    else if (row.exerciseId) { row.exerciseId = null; }
  };

  const setWeeks = (n: number) => set((d) => {
    const w = Math.max(1, Math.min(MAX_WEEKS, n));
    for (const dd of d.days) for (const b of dd.blocks) for (const r of b.rows) r.cells = Array.from({ length: w }, (_, i) => r.cells[i] ?? r.cells[r.cells.length - 1] ?? "");
    d.weeks = w; return d;
  });

  return (
    <div className="space-y-4">
      <datalist id="ex-lib">{exercises.map((e) => <option key={e[0]} value={e[1]} />)}</datalist>

      {/* Encabezado */}
      <div className="card card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2"><span className="label">Nombre de la rutina</span><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></label>
        <label><span className="label">Objetivo</span><input value={data.meta.objective ?? ""} onChange={(e) => set((d) => { d.meta.objective = e.target.value; return d; })} placeholder="Ej: fuerza máxima pretemporada" className="input" /></label>
        {!isTemplate ? <label><span className="label">Empieza el</span><input type="date" value={data.meta.start ?? ""} onChange={(e) => set((d) => { d.meta.start = e.target.value; return d; })} className="input" /></label> : <div />}
        <label className="sm:col-span-2 lg:col-span-3"><span className="label">Indicaciones generales</span><input value={data.meta.notes ?? ""} onChange={(e) => set((d) => { d.meta.notes = e.target.value; return d; })} placeholder="Ej: RIR 2 en todo. Si duele, avisá antes de seguir." className="input" /></label>
        <label><span className="label">Pausa entre series</span><input value={data.meta.rest ?? ""} onChange={(e) => set((d) => { d.meta.rest = e.target.value; return d; })} placeholder="Ej: 2-3 min" className="input" /></label>
      </div>

      {/* Calentamiento */}
      <div className="card card-pad">
        <div className="mb-2 flex items-center justify-between gap-2"><div className="h2">Calentamiento</div><span className="text-xs muted">Igual para todos los días</span></div>
        <div className="space-y-2">
          {data.warmup.map((w, i) => (
            <div key={w.id} className="flex flex-wrap items-center gap-2">
              <input list="ex-lib" value={w.name} onChange={(e) => set((d) => { pickName(d.warmup[i], e.target.value); return d; })} placeholder="Ejercicio" className="input min-w-0 flex-[2] basis-48 py-1.5 text-sm" />
              <input value={w.detail ?? ""} onChange={(e) => set((d) => { d.warmup[i].detail = e.target.value; return d; })} placeholder="Ej: 2x10 / 5 min" className="input min-w-0 flex-1 basis-28 py-1.5 text-sm" />
              <VideoField value={w.video} name={w.name} onChange={(v) => set((d) => { d.warmup[i].video = v; return d; })} />
              <button type="button" onClick={() => set((d) => { d.warmup.splice(i, 1); return d; })} className="text-neutral-500 hover:text-red-400" aria-label="Quitar"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set((d) => { d.warmup.push({ id: newId(), name: "", detail: "" }); return d; })} className="btn-ghost mt-2 px-3 py-1.5 text-sm"><Plus size={14} />Agregar al calentamiento</button>
      </div>

      {/* Días */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 pb-1">
          {data.days.map((d, i) => (
            <button key={d.id} type="button" onClick={() => setDayIdx(i)} className={i === di ? "tab tab-active whitespace-nowrap" : "tab whitespace-nowrap"}>{d.name || `Día ${i + 1}`}</button>
          ))}
        </div>
        <button type="button" onClick={() => { set((d) => { d.days.push(emptyDay(d.days.length + 1)); return d; }); setDayIdx(data.days.length); }} className="btn-ghost px-3 py-1.5 text-sm"><Plus size={14} />Día</button>
      </div>

      {day ? (
        <div className="card">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
            <input value={day.name} onChange={(e) => setDay((d) => { d.name = e.target.value; })} className="input w-auto min-w-0 flex-1 basis-40 py-1.5 font-semibold" aria-label="Nombre del día" />
            <div className="flex items-center gap-1">
              <IconBtn label="Mover a la izquierda" onClick={() => { set((d) => { d.days = move(d.days, di, -1); return d; }); setDayIdx(Math.max(0, di - 1)); }}><ArrowLeft size={15} /></IconBtn>
              <IconBtn label="Mover a la derecha" onClick={() => { set((d) => { d.days = move(d.days, di, 1); return d; }); setDayIdx(Math.min(data.days.length - 1, di + 1)); }}><ArrowRight size={15} /></IconBtn>
              <IconBtn label="Duplicar día" onClick={() => { set((d) => { const c = cloneDay(d.days[di]); c.name = `${c.name} (copia)`; d.days.splice(di + 1, 0, c); return d; }); setDayIdx(di + 1); }}><Copy size={15} /></IconBtn>
              <IconBtn label="Borrar día" danger onClick={() => { if (data.days.length > 0) { set((d) => { d.days.splice(di, 1); return d; }); setDayIdx(Math.max(0, di - 1)); } }}><Trash2 size={15} /></IconBtn>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2 text-xs">
            <span className="muted">Semanas: {data.weeks}</span>
            <button type="button" onClick={() => setWeeks(data.weeks + 1)} disabled={data.weeks >= MAX_WEEKS} className="btn-ghost px-2 py-1 text-xs"><Plus size={12} />Semana (copia la anterior)</button>
            <button type="button" onClick={() => setWeeks(data.weeks - 1)} disabled={data.weeks <= 1} className="btn-ghost px-2 py-1 text-xs">Quitar la última</button>
          </div>

          <div className="space-y-5 p-3">
            {day.blocks.map((b, bi) => (
              <div key={b.id}>
                <div className="mb-2 flex items-center gap-2">
                  <input value={b.name} onChange={(e) => setDay((d) => { d.blocks[bi].name = e.target.value; })} className="input min-w-0 flex-1 border-volt/30 py-1 text-sm font-semibold uppercase tracking-wide text-volt" aria-label="Nombre del bloque" />
                  <IconBtn label="Subir bloque" onClick={() => setDay((d) => { d.blocks = move(d.blocks, bi, -1); })}><ArrowUp size={14} /></IconBtn>
                  <IconBtn label="Bajar bloque" onClick={() => setDay((d) => { d.blocks = move(d.blocks, bi, 1); })}><ArrowDown size={14} /></IconBtn>
                  <IconBtn label="Borrar bloque" danger onClick={() => setDay((d) => { d.blocks.splice(bi, 1); })}><Trash2 size={14} /></IconBtn>
                </div>
                <div className="overflow-x-auto rounded-xl border border-ink-700">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-ink-900 text-left text-[11px] uppercase tracking-wide text-neutral-400">
                      <tr>
                        <th className="w-8 px-2 py-2">#</th>
                        <th className="min-w-[280px] px-2 py-2">Ejercicio</th>
                        {Array.from({ length: data.weeks }, (_, w) => <th key={w} className="min-w-[88px] px-2 py-2">Sem {w + 1}</th>)}
                        <th className="min-w-[140px] px-2 py-2">Nota</th>
                        <th className="w-20 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, ri) => (
                        <Row key={r.id} n={ri + 1} r={r} weeks={data.weeks}
                          onName={(v) => setDay((d) => pickName(d.blocks[bi].rows[ri], v))}
                          onCell={(w, v) => setDay((d) => { d.blocks[bi].rows[ri].cells[w] = v; })}
                          onFill={(w) => setDay((d) => { const row = d.blocks[bi].rows[ri]; for (let k = w + 1; k < row.cells.length; k++) row.cells[k] = row.cells[w]; })}
                          onNote={(v) => setDay((d) => { d.blocks[bi].rows[ri].note = v; })}
                          onVideo={(v) => setDay((d) => { d.blocks[bi].rows[ri].video = v; })}
                          onUp={() => setDay((d) => { d.blocks[bi].rows = move(d.blocks[bi].rows, ri, -1); })}
                          onDown={() => setDay((d) => { d.blocks[bi].rows = move(d.blocks[bi].rows, ri, 1); })}
                          onDel={() => setDay((d) => { d.blocks[bi].rows.splice(ri, 1); })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setDay((d) => { d.blocks[bi].rows.push(emptyRow(data.weeks)); })} className="btn-ghost mt-2 px-3 py-1.5 text-sm"><Plus size={14} />Ejercicio</button>
              </div>
            ))}
            <button type="button" onClick={() => setDay((d) => { d.blocks.push(emptyBlock(`BLOQUE ${d.blocks.length + 1}`)); })} className="btn-ghost w-full border-dashed py-2 text-sm"><Plus size={14} />Agregar bloque</button>
          </div>

          {!isTemplate && athletes.length > 0 && <CopyDay disabled={dirty} onCopy={(to) => copyDay(id, day.id, to)} athletes={athletes} dayName={day.name} />}
        </div>
      ) : <div className="card card-pad text-sm muted">Sin días todavía. Tocá “+ Día” para empezar.</div>}

      {/* Barra de guardado */}
      <div className="sticky bottom-[84px] lg:bottom-3 z-20 flex items-center justify-end gap-3 rounded-2xl border border-ink-700 bg-ink-950/95 p-3 shadow-xl backdrop-blur" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <span className={`text-sm ${msg && !msg.ok ? "text-red-400" : "muted"}`}>{dirty ? "Cambios sin guardar" : msg?.text ?? "Todo guardado"}</span>
        <button type="button" onClick={doSave} disabled={pending || !dirty} className="btn-primary"><Save size={15} />{pending ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-lg p-1.5 text-neutral-400 hover:bg-ink-800 ${danger ? "hover:text-red-400" : "hover:text-white"}`}>{children}</button>;
}

function Row({ n, r, weeks, onName, onCell, onFill, onNote, onVideo, onUp, onDown, onDel }: {
  n: number; r: RoutineRow; weeks: number; onName: (v: string) => void; onCell: (w: number, v: string) => void; onFill: (w: number) => void;
  onNote: (v: string) => void; onVideo: (v: string | null) => void; onUp: () => void; onDown: () => void; onDel: () => void;
}) {
  return (
    <tr className="border-t border-ink-800 align-top">
      <td className="px-2 py-2 text-xs text-neutral-500">{n}</td>
      <td className="px-2 py-1.5">
        <input list="ex-lib" value={r.name} onChange={(e) => onName(e.target.value)} placeholder="Escribí o elegí de la biblioteca" className="input w-full py-1.5 text-sm" />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {r.exerciseId ? <span className="text-[10px] uppercase tracking-wide text-neutral-500">De la biblioteca</span> : r.name ? <span className="text-[10px] uppercase tracking-wide text-neutral-600">Escrito a mano</span> : null}
          <VideoField value={r.video} name={r.name} onChange={onVideo} />
        </div>
      </td>
      {Array.from({ length: weeks }, (_, w) => (
        <td key={w} className="px-1 py-1.5">
          <input value={r.cells[w] ?? ""} onChange={(e) => onCell(w, e.target.value)} onDoubleClick={() => onFill(w)} title="Doble clic: copiar a las semanas siguientes" placeholder="3x8" className="input w-full px-2 py-1.5 text-center text-sm" />
        </td>
      ))}
      <td className="px-1 py-1.5"><input value={r.note ?? ""} onChange={(e) => onNote(e.target.value)} placeholder="Pausa, tempo, RIR…" className="input w-full py-1.5 text-sm" /></td>
      <td className="px-1 py-1.5">
        <div className="flex items-center justify-end">
          <IconBtn label="Subir" onClick={onUp}><ArrowUp size={14} /></IconBtn>
          <IconBtn label="Bajar" onClick={onDown}><ArrowDown size={14} /></IconBtn>
          <IconBtn label="Quitar" danger onClick={onDel}><Trash2 size={14} /></IconBtn>
        </div>
      </td>
    </tr>
  );
}

/** Ver el video o pegar el link de YouTube de esa fila. */
function VideoField({ value, name, onChange }: { value?: string | null; name: string; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(value ?? "");
  useEffect(() => setVal(value ?? ""), [value]);
  const ok = !val.trim() || /^https:\/\/\S+\.\S{2,}/.test(val.trim());
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {value && <VideoButton url={value} name={name || "Video"} />}
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-volt"><Link2 size={12} />{value ? "Cambiar link" : "Link de YouTube"}</button>
      {open && (
        <span className="flex basis-full items-center gap-1.5">
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="https://youtu.be/…" className="input min-w-0 flex-1 py-1 text-xs" />
          <button type="button" disabled={!ok} onClick={() => { onChange(val.trim() || null); setOpen(false); }} className="btn-primary px-2 py-1 text-xs">OK</button>
          {name && <a href={youtubeSearch(name)} target="_blank" rel="noopener noreferrer" title="Buscar en YouTube" className="text-neutral-400 hover:text-volt"><Search size={13} /></a>}
        </span>
      )}
    </span>
  );
}

function CopyDay({ athletes, dayName, disabled, onCopy }: { athletes: Athlete[]; dayName: string; disabled: boolean; onCopy: (to: string) => Promise<{ ok: boolean; name: string }> }) {
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 p-3 text-sm">
      <span className="text-neutral-300">Pasar “{dayName}” a</span>
      <select value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto min-w-0 flex-1 basis-40 py-1.5 text-sm">
        <option value="">Elegí un deportista…</option>
        {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="button" disabled={!to || pending || disabled} onClick={() => start(async () => { try { const r = await onCopy(to); setMsg(`Listo: se agregó al final de la rutina de ${r.name}.`); setTo(""); } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo copiar"); } })} className="btn-ghost px-3 py-1.5 text-sm"><Send size={14} />{pending ? "Copiando…" : "Copiar día"}</button>
      {disabled && <span className="basis-full text-xs muted">Guardá los cambios antes de copiar.</span>}
      {msg && <span className="basis-full text-xs text-volt">{msg}</span>}
    </div>
  );
}

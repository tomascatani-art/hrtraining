"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Plus, Save, X, Search, Send, ClipboardCopy, ClipboardPaste, Link2, Repeat, Megaphone, Cloud, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { type RoutineData, type RoutineRow, type RoutineDay, emptyDay, emptyBlock, emptyRow, cloneDay, newId, MAX_WEEKS, BLOCK_KINDS, FOCUS, type FocusMap, WEEKDAYS, type BlockKind } from "@/lib/routine";
import { youtubeSearch, normalizeLink } from "@/lib/video";
import { VideoButton } from "@/components/video-player";
import { parseSheet, type Parsed } from "@/lib/excel-paste";

type Ex = [id: string, name: string, video: string | null];
type Athlete = { id: string; name: string };
type Clip = { cells: string[]; rm: string[] } | null;

const move = <T,>(a: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= a.length) return a; const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hhmm = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Planilla del plan del alumno. Se guarda sola mientras editás. */
export function RoutineEditor({ id, initialName, initial, exercises, athletes, isTemplate, athleteName, save, copyDay, children, roles = FOCUS }: {
  roles?: FocusMap; id: string; initialName: string; initial: RoutineData; exercises: Ex[]; athletes: Athlete[]; isTemplate: boolean; athleteName?: string | null;
  save: (id: string, name: string, data: unknown) => Promise<{ ok: boolean; savedAt: string }>;
  copyDay: (fromId: string, dayId: string, toAthleteId: string) => Promise<{ ok: boolean; name: string }>;
  children?: React.ReactNode;
}) {
  const [data, setData] = useState<RoutineData>(initial);
  const [name, setName] = useState(initialName);
  const [dayIdx, setDayIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>({ ok: true, text: "Todo guardado" });
  const [pending, start] = useTransition();
  const [clip, setClip] = useState<Clip>(null);
  const byName = useMemo(() => new Map(exercises.map((e) => [norm(e[1]), e])), [exercises]);
  const first = useRef(true);
  const latest = useRef({ data, name });
  latest.current = { data, name };
  useEffect(() => { if (first.current) { first.current = false; return; } setDirty(true); }, [data, name]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const [savedMsg, setSavedMsg] = useState(false);
  const doSave = (explicit?: unknown) => start(async () => {
    setStatus({ ok: true, text: "Guardando…" });
    try {
      await save(id, latest.current.name, latest.current.data); setDirty(false); setStatus({ ok: true, text: `Guardado ${hhmm(new Date())}` });
      if (explicit) { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 3500); }
    }
    catch (e) { setStatus({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar. Tocá Guardar planificación." }); }
  });
  // Se guarda solo: 1,5 s después del último cambio.
  useEffect(() => { if (!dirty) return; const t = setTimeout(doSave, 1500); return () => clearTimeout(t); }, [data, name, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = data.days[Math.min(dayIdx, data.days.length - 1)];
  const di = data.days.indexOf(day);
  const set = (f: (d: RoutineData) => RoutineData | void) => setData((d) => { const c = structuredClone(d); return f(c) ?? c; });
  const setDay = (f: (d: RoutineDay) => void) => set((d) => { f(d.days[di]); });

  /** Si el nombre coincide con uno de la biblioteca, se vincula y trae su video. */
  const pickName = (row: { name: string; exerciseId?: string | null; video?: string | null }, value: string, picked?: Ex) => {
    row.name = value;
    const ex = picked ?? byName.get(norm(value));
    if (ex) { row.exerciseId = ex[0]; row.name = ex[1]; if (!row.video && ex[2]) row.video = ex[2]; }
    else if (row.exerciseId) { row.exerciseId = null; }
  };
  const allRows = (d: RoutineData) => d.days.flatMap((x) => x.blocks.flatMap((b) => b.rows));
  const addWeek = () => set((d) => {
    if (d.weeks >= MAX_WEEKS) return;
    for (const r of allRows(d)) { r.cells.push(r.cells[r.cells.length - 1] ?? ""); r.rm = [...(r.rm ?? []), (r.rm ?? [])[d.weeks - 1] ?? ""]; }
    d.weeks += 1;
  });
  const removeWeek = (w: number) => set((d) => {
    if (d.weeks <= 1) return;
    for (const r of allRows(d)) { r.cells.splice(w, 1); r.rm?.splice(w, 1); }
    d.weeks -= 1;
  });

  return (
    <div className="space-y-4">
      {athleteName && (
        <div className="rounded-2xl border border-volt/60 bg-volt/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-volt"><Megaphone size={16} />Aviso para {athleteName ?? "el alumno"}</div>
          <p className="mt-1 text-xs text-neutral-400">Lo que escribas acá le aparece destacado en su Inicio, antes de entrenar. Si lo dejás vacío, no se muestra nada.</p>
          <textarea value={data.meta.notice ?? ""} onChange={(e) => set((d) => { d.meta.notice = e.target.value; })} rows={2}
            placeholder="Ej: Esta semana bajamos el volumen, priorizá la técnica. Cualquier molestia me avisás." className="input mt-2 w-full text-sm" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs ${status.ok ? "muted" : "text-red-400"}`}><Cloud size={14} />{dirty && !pending ? "Cambios sin guardar · se guarda solo" : `Se guarda solo · ${status.text}`}</span>
        <button type="button" onClick={() => doSave(true)} disabled={pending} className="btn-primary ml-auto"><Save size={15} />{pending ? "Guardando…" : "Guardar planificación"}</button>
      </div>

      {children}

      <div className="card card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2"><span className="label">Nombre del plan</span><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></label>
        <label><span className="label">Objetivo / mesociclo</span><input value={data.meta.objective ?? ""} onChange={(e) => set((d) => { d.meta.objective = e.target.value; })} placeholder="Ej: fuerza máxima pretemporada" className="input" /></label>
        {!isTemplate ? <label><span className="label">Empieza el</span><input type="date" value={data.meta.start ?? ""} onChange={(e) => set((d) => { d.meta.start = e.target.value; })} className="input" /></label> : <div />}
        <label className="sm:col-span-2 lg:col-span-4"><span className="label">Indicaciones generales</span><input value={data.meta.notes ?? ""} onChange={(e) => set((d) => { d.meta.notes = e.target.value; })} placeholder="Ej: RIR 2 en todo. Si duele, avisá antes de seguir." className="input" /></label>
      </div>

      <div className="card card-pad">
        <div className="mb-2 flex items-center justify-between gap-2"><div className="h2">Entrada en calor</div><span className="text-xs muted">Igual para todos los días</span></div>
        <div className="space-y-3 divide-y divide-ink-800">
          {data.warmup.map((w, i) => (
            <div key={w.id} className="grid grid-cols-[1fr_auto] gap-2 pt-3 first:pt-0 sm:grid-cols-[2fr_1fr_auto]">
              <div className="col-span-2 min-w-0 sm:col-span-1"><ExercisePicker value={w.name} exercises={exercises} placeholder="Ejercicio" onChange={(v, ex) => set((d) => { pickName(d.warmup[i], v, ex); })} /></div>
              <input value={w.detail ?? ""} onChange={(e) => set((d) => { d.warmup[i].detail = e.target.value; })} placeholder="Ej: 2x10 / 5 min" className="input min-w-0 py-1.5 text-sm" />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => set((d) => { d.warmup.splice(i, 1); })} className="text-neutral-500 hover:text-red-400" aria-label="Quitar"><X size={16} /></button>
              </div>
              <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
                <input value={w.video ?? ""} onChange={(e) => set((d) => { d.warmup[i].video = e.target.value.trim() || null; })} placeholder="Link del video (YouTube, Drive…)" aria-label="Link del video"
                  className={`input min-w-0 flex-1 py-1.5 text-sm ${!w.video || normalizeLink(w.video) ? "" : "border-red-500/60"}`} />
                <a href={youtubeSearch(w.name || "entrada en calor")} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-volt hover:underline"><Search size={12} />Buscar</a>
                {w.video && normalizeLink(w.video) && <VideoButton url={normalizeLink(w.video)!} name={w.name || "Video"} compact />}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set((d) => { d.warmup.push({ id: newId(), name: "", detail: "" }); })} className="btn-ghost mt-2 px-3 py-1.5 text-sm"><Plus size={14} />Agregar a la entrada en calor</button>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-ink-600 bg-ink-950 p-3">
        <div className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">Días de la rutina</div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {data.days.map((d, i) => (
            <button key={d.id} type="button" onClick={() => setDayIdx(i)} aria-pressed={i === di}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl border-2 py-1.5 pl-1.5 pr-3.5 text-left transition ${i === di ? "border-volt bg-volt/10" : "border-ink-600 hover:border-ink-500"}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-lg font-display text-xl font-black ${i === di ? "bg-volt text-black" : "bg-ink-800 text-white"}`}>{i + 1}</span>
              <span className="leading-tight">
                <span className={`block max-w-[9rem] truncate font-display text-sm font-bold uppercase tracking-wide ${i === di ? "text-volt" : "text-white"}`}>{d.name || `Día ${i + 1}`}</span>
                <span className="block text-[11px] text-neutral-500">{d.weekday || "Sin día fijo"}</span>
              </span>
            </button>
          ))}
          <button type="button" onClick={() => { set((d) => { d.days.push(emptyDay(d.days.length + 1)); }); setDayIdx(data.days.length); }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-ink-500 px-4 text-sm font-semibold text-neutral-300 hover:border-volt hover:text-volt"><Plus size={16} />Agregar día</button>
        </div>
        <PasteSheet weeks={data.weeks} onApply={(p, replace) => {
          set((d) => {
            const w = Math.max(replace ? p.weeks : d.weeks, p.weeks);
            const fit = (r: RoutineRow) => { while (r.cells.length < w) r.cells.push(r.cells[r.cells.length - 1] ?? ""); if (r.rm) while (r.rm.length < w) r.rm.push(""); };
            for (const day of p.days) for (const b of day.blocks) for (const r of b.rows) pickName(r, r.name);
            for (const it of p.warmup) pickName(it, it.name);
            if (replace) { d.days = p.days; if (p.warmup.length) d.warmup = p.warmup; }
            else { d.days.push(...p.days); d.warmup.push(...p.warmup); }
            d.weeks = w;
            for (const r of allRows(d)) fit(r);
          });
          setDayIdx(replace ? 0 : data.days.length);
        }} />
      </div>

      {day ? (
        <div className="card border-t-4 border-t-volt">
          <div className="space-y-3 border-b border-ink-700 p-3">
            <div className="flex items-center gap-2">
              <select value={day.weekday ?? ""} onChange={(e) => setDay((d) => { d.weekday = e.target.value; })} className="input w-auto py-1.5 text-sm" aria-label="Día de la semana">
                <option value="">Sin día fijo</option>{WEEKDAYS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <div className="ml-auto flex items-center">
                <IconBtn label="Mover a la izquierda" onClick={() => { set((d) => { d.days = move(d.days, di, -1); }); setDayIdx(Math.max(0, di - 1)); }}><ArrowLeft size={15} /></IconBtn>
                <IconBtn label="Mover a la derecha" onClick={() => { set((d) => { d.days = move(d.days, di, 1); }); setDayIdx(Math.min(data.days.length - 1, di + 1)); }}><ArrowRight size={15} /></IconBtn>
                <IconBtn label="Duplicar día" onClick={() => { set((d) => { const c = cloneDay(d.days[di]); c.name = `${c.name} (copia)`; d.days.splice(di + 1, 0, c); }); setDayIdx(di + 1); }}><Copy size={15} /></IconBtn>
                <button type="button" onClick={() => { set((d) => { d.days.splice(di, 1); }); setDayIdx(Math.max(0, di - 1)); }} className="ml-1 inline-flex items-center gap-1 whitespace-nowrap text-sm text-neutral-400 hover:text-red-400">Eliminar día <X size={14} /></button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-volt font-display text-2xl font-black text-black">{di + 1}</span>
              <input value={day.name} onChange={(e) => setDay((d) => { d.name = e.target.value; })} className="input w-full py-2 font-display text-xl font-black uppercase tracking-wide text-volt" aria-label="Nombre del día" />
            </div>
            {!isTemplate && athletes.length > 0 && <CopyDay disabled={dirty} onCopy={(to) => copyDay(id, day.id, to)} athletes={athletes} dayName={day.name} />}
          </div>

          <div className="space-y-6 p-3">
            {day.blocks.map((b, bi) => (
              <div key={b.id}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex flex-col">
                    <IconBtn label="Subir bloque" onClick={() => setDay((d) => { d.blocks = move(d.blocks, bi, -1); })}><ArrowUp size={14} /></IconBtn>
                    <IconBtn label="Bajar bloque" onClick={() => setDay((d) => { d.blocks = move(d.blocks, bi, 1); })}><ArrowDown size={14} /></IconBtn>
                  </div>
                  <input value={b.name} onChange={(e) => setDay((d) => { d.blocks[bi].name = e.target.value; })} className="min-w-0 flex-1 border-b border-ink-600 bg-transparent py-1 font-display text-lg font-semibold text-volt outline-none focus:border-volt" aria-label="Nombre del bloque" />
                  <button type="button" onClick={() => setDay((d) => { d.blocks.splice(bi, 1); })} className="inline-flex shrink-0 items-center gap-1 text-sm text-neutral-400 hover:text-red-400">Eliminar bloque <X size={14} /></button>
                </div>
                <div className="mb-2 flex flex-wrap items-end gap-2 pl-9">
                  <label><span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500">Cómo se hace el bloque</span>
                    <select value={b.kind ?? "normal"} onChange={(e) => setDay((d) => { d.blocks[bi].kind = e.target.value as BlockKind; })} className="input w-auto py-1.5 text-sm">
                      {Object.entries(BLOCK_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  {(b.kind === "circuito" || b.kind === "tabata") && <Mini label={b.kind === "tabata" ? "Rounds" : "Vueltas"} value={b.rounds} ph={b.kind === "tabata" ? "8" : "3"} onChange={(v) => setDay((d) => { d.blocks[bi].rounds = v; })} />}
                  {b.kind === "tabata" && <Mini label="Trabajo (seg)" value={b.work} ph="20" onChange={(v) => setDay((d) => { d.blocks[bi].work = v; })} />}
                  {(b.kind === "tabata" || b.kind === "circuito" || b.kind === "superserie") && <Mini label={b.kind === "tabata" ? "Descanso (seg)" : "Pausa"} value={b.rest} ph={b.kind === "tabata" ? "10" : "2 min"} onChange={(v) => setDay((d) => { d.blocks[bi].rest = v; })} />}
                  {(b.kind === "amrap" || b.kind === "emom") && <Mini label="Minutos" value={b.minutes} ph="10" onChange={(v) => setDay((d) => { d.blocks[bi].minutes = v; })} />}
                </div>
                <div className="space-y-0">
                  {b.rows.map((r, ri) => {
                    const prevLink = ri > 0 ? b.rows[ri - 1].link : "";
                    const upd = (f: (row: RoutineRow) => void) => setDay((d) => { f(d.blocks[bi].rows[ri]); });
                    return (
                      <div key={r.id}>
                        <div className={`${r.link || prevLink ? "border-l-2 border-volt/70 pl-2" : ""}`}>
                          <Row roles={roles} n={ri + 1} r={r} weeks={data.weeks} exercises={exercises} clip={clip} isLast={ri === b.rows.length - 1}
                            upd={upd} onPick={(v, ex) => upd((row) => pickName(row, v, ex))}
                            onCopy={() => setClip({ cells: [...r.cells], rm: [...(r.rm ?? [])] })}
                            onAddWeek={addWeek} onRemoveWeek={removeWeek}
                            onUp={() => setDay((d) => { d.blocks[bi].rows = move(d.blocks[bi].rows, ri, -1); })}
                            onDown={() => setDay((d) => { d.blocks[bi].rows = move(d.blocks[bi].rows, ri, 1); })}
                            onDel={() => setDay((d) => { d.blocks[bi].rows.splice(ri, 1); })} />
                        </div>
                        {r.link && ri < b.rows.length - 1 ? (
                          <div className="flex justify-center py-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                              {r.link === "circuito" ? <><Repeat size={13} />Circuito con el siguiente</> : <><Link2 size={13} />Sin descanso con el siguiente</>}
                            </span>
                          </div>
                        ) : <div className="h-3" />}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setDay((d) => { d.blocks[bi].rows.push(emptyRow(data.weeks)); })} className="btn-ghost px-3 py-1.5 text-sm"><Plus size={14} />Ejercicio</button>
              </div>
            ))}
            <button type="button" onClick={() => setDay((d) => { d.blocks.push(emptyBlock(`Bloque ${d.blocks.length + 1}`)); })} className="btn-ghost w-full border-dashed py-2 text-sm"><Plus size={14} />Agregar bloque</button>
          </div>
        </div>
      ) : <div className="card card-pad text-sm muted">Sin días todavía. Tocá “+ Día” para empezar.</div>}

      {/* Botón Guardar siempre a mano, abajo de la pantalla (Diego) */}
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl border border-ink-600 bg-ink-900/95 p-2.5 pl-4 shadow-2xl backdrop-blur">
          <span className="min-w-0 flex-1 truncate text-sm">
            {savedMsg ? <span className="inline-flex items-center gap-1.5 font-semibold text-volt"><CheckCircle2 size={16} />{isTemplate ? "Plantilla guardada" : "Guardada"}</span>
              : <span className={status.ok ? "muted" : "text-volt"}>{dirty ? "Tenés cambios sin guardar" : status.text}</span>}
          </span>
          <button type="button" onClick={() => doSave(true)} disabled={pending} className="btn-primary shrink-0 px-6"><Save size={16} />{pending ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, ph, onChange }: { label: string; value?: string; ph: string; onChange: (v: string) => void }) {
  return <label className="w-24"><span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500">{label}</span><input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={ph} className="input w-full py-1.5 text-center text-sm" /></label>;
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-lg p-1.5 text-neutral-400 hover:bg-ink-800 ${danger ? "hover:text-red-400" : "hover:text-white"}`}>{children}</button>;
}

const cap = "mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500";

function Row({ roles, n, r, weeks, exercises, clip, isLast, upd, onPick, onCopy, onAddWeek, onRemoveWeek, onUp, onDown, onDel }: {
  roles: FocusMap; n: number; r: RoutineRow; weeks: number; exercises: Ex[]; clip: Clip; isLast: boolean;
  upd: (f: (row: RoutineRow) => void) => void; onPick: (v: string, ex?: Ex) => void; onCopy: () => void;
  onAddWeek: () => void; onRemoveWeek: (w: number) => void; onUp: () => void; onDown: () => void; onDel: () => void;
}) {
  const [changing, setChanging] = useState(!r.name);
  const [copied, setCopied] = useState(false);
  // Cerrado muestra un resumen; al tocarlo se abren todas las opciones (Diego).
  const [open, setOpen] = useState(!r.name);
  const summary = r.mode === "tabata" ? `Tabata ${r.tabata?.work || 20}"/${r.tabata?.rest || 10}" x${r.tabata?.rounds || 8}` : r.cells.slice(0, weeks).map((c) => c || "—").join(" · ");
  const tabata = r.mode === "tabata";
  const ok = !r.video || !!normalizeLink(r.video);
  return (
    <div className="flex gap-2">
      <div className="flex flex-col pt-2">
        <IconBtn label="Subir" onClick={onUp}><ArrowUp size={14} /></IconBtn>
        <IconBtn label="Bajar" onClick={onDown}><ArrowDown size={14} /></IconBtn>
      </div>
      <div className="min-w-0 flex-1 rounded-2xl border border-ink-600 bg-ink-900 p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <span className="mt-1 text-xs text-neutral-500">{n}</span>
          <div className="min-w-0 flex-1">
            {changing ? <ExercisePicker value={r.name} exercises={exercises} onChange={(v, ex) => { onPick(v, ex); if (ex) setChanging(false); }} />
              : <div className="font-display text-lg font-semibold leading-tight text-white">{r.name}</div>}
            {!changing && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{r.exerciseId ? "De la biblioteca" : "Escrito a mano"}</div>}
          </div>
          {!changing && open && <button type="button" onClick={() => setChanging(true)} className="btn-ghost shrink-0 px-2.5 py-1 text-xs"><Search size={13} />Cambiar</button>}
          {!changing && <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-lg border border-ink-600 p-1.5 text-neutral-300 hover:text-volt" aria-label={open ? "Cerrar opciones" : "Abrir opciones"} aria-expanded={open}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>}
          {changing && r.name && <button type="button" onClick={() => setChanging(false)} className="btn-ghost shrink-0 px-2.5 py-1 text-xs">Listo</button>}
          <IconBtn label="Quitar ejercicio" danger onClick={onDel}><X size={16} /></IconBtn>
        </div>

        {!open && !changing && (
          <button type="button" onClick={() => setOpen(true)} className="mt-2 flex w-full flex-wrap items-center gap-1.5 text-left">
            {r.focus && roles[r.focus] && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${roles[r.focus].cls}`}>{roles[r.focus].label}</span>}
            <span className="num min-w-0 truncate text-sm text-neutral-300">{summary}</span>
            {r.rest && r.mode !== "tabata" && <span className="text-xs text-neutral-500">· {r.rest}&quot;</span>}
            {r.video && <span className="text-xs text-volt">· video</span>}
            {r.link && <span className="shrink-0 rounded-full border border-white/50 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{r.link === "circuito" ? "circuito" : "sin descanso"}</span>}
            <span className="ml-auto text-xs text-neutral-500">Tocá para editar</span>
          </button>
        )}

        {(open || changing) && <>
        <div className="mt-3"><span className={cap}>Rol en la sesión</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(roles).map(([k, f]) => (
              <button key={k} type="button" onClick={() => upd((x) => { x.focus = x.focus === k ? "" : k; })}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${r.focus === k ? f.cls : "border-ink-600 text-neutral-500 hover:text-neutral-200"}`}>{f.label}</button>
            ))}
            <a href="/app/settings#roles" className="rounded-full border border-dashed border-ink-600 px-2.5 py-1 text-xs text-neutral-500 hover:text-volt">+ Agregar o borrar roles</a>
          </div>
        </div>

        {!isLast && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => upd((x) => { x.link = x.link === "superserie" ? "" : "superserie"; })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${r.link === "superserie" ? "border-volt bg-volt/10 text-volt" : "border-ink-600 text-neutral-300 hover:border-ink-500"}`}>
              <Link2 size={14} className="mr-1.5 inline" />Unir con el siguiente, sin descanso{r.link === "superserie" ? " (activado)" : ""}
            </button>
            <button type="button" onClick={() => upd((x) => { x.link = x.link === "circuito" ? "" : "circuito"; })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${r.link === "circuito" ? "border-volt bg-volt/10 text-volt" : "border-ink-600 text-neutral-300 hover:border-ink-500"}`}>
              <Repeat size={14} className="mr-1.5 inline" />Circuito con el siguiente{r.link === "circuito" ? " (activado)" : ""}
            </button>
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs text-neutral-400">Link de YouTube</span>
            <a href={youtubeSearch(r.name || "ejercicio")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-volt hover:underline"><Search size={12} />Buscar en YouTube</a></div>
          <div className="flex items-center gap-2">
            <input value={r.video ?? ""} onChange={(e) => upd((x) => { x.video = e.target.value.trim() || null; })} placeholder="https://youtu.be/…" className={`input min-w-0 flex-1 py-1.5 text-sm ${ok ? "" : "border-red-500/60"}`} />
            {r.video && ok && <VideoButton url={normalizeLink(r.video)!} name={r.name || "Video"} />}
            {r.video && <button type="button" onClick={() => upd((x) => { x.video = null; })} className="rounded-lg border border-ink-600 p-2 text-red-400 hover:bg-ink-800" aria-label="Sacar link"><X size={14} /></button>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-ink-600 p-0.5">
            <button type="button" onClick={() => upd((x) => { x.mode = "normal"; })} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!tabata ? "bg-volt text-ink-950" : "text-neutral-400"}`}>Normal</button>
            <button type="button" onClick={() => upd((x) => { x.mode = "tabata"; })} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tabata ? "bg-volt text-ink-950" : "text-neutral-400"}`}>Tabata</button>
          </div>
          {!tabata && <>
            <button type="button" onClick={() => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost px-3 py-1.5 text-sm"><ClipboardCopy size={14} />{copied ? "Copiadas" : "Copiar semanas"}</button>
            <button type="button" disabled={!clip} onClick={() => clip && upd((x) => { x.cells = x.cells.map((c, i) => clip.cells[i] ?? c); x.rm = (x.rm ?? []).map((c, i) => clip.rm[i] ?? c); })} className="btn-ghost px-3 py-1.5 text-sm"><ClipboardPaste size={14} />Pegar</button>
          </>}
        </div>

        {tabata ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:w-96">
            {([["work", "Trabajo (seg)"], ["rest", "Descanso (seg)"], ["rounds", "Rounds"]] as const).map(([k, l]) => (
              <label key={k}><span className={cap}>{l}</span><input inputMode="numeric" value={r.tabata?.[k] ?? ""} onChange={(e) => upd((x) => { x.tabata = { work: "20", rest: "10", rounds: "8", ...x.tabata, [k]: e.target.value }; })} className="input w-full py-1.5 text-center text-sm" /></label>
            ))}
          </div>
        ) : (
          <>
            <p className="mt-3 text-xs text-neutral-500">Series/reps y RM/RIR de cada semana (el % puede cambiar en cada una):</p>
            <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 sm:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: weeks }, (_, w) => (
                <div key={w} className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between"><span className="text-[11px] text-neutral-400">Sem.{w + 1}</span>
                    {weeks > 1 && <button type="button" onClick={() => onRemoveWeek(w)} title={`Quitar la semana ${w + 1} de todo el plan`} className="rounded-full bg-red-500/80 p-0.5 text-white hover:bg-red-500"><X size={9} /></button>}</div>
                  <input value={r.cells[w] ?? ""} onChange={(e) => upd((x) => { x.cells[w] = e.target.value; })} placeholder="3x8" className="input w-full px-1 py-1.5 text-center text-sm" />
                  <span className="mt-1 block text-[10px] text-neutral-500">RM Sem.{w + 1}</span>
                  <input value={r.rm?.[w] ?? ""} onChange={(e) => upd((x) => { const a = x.rm ?? Array(weeks).fill(""); a[w] = e.target.value; x.rm = a; })} placeholder="—" className="input w-full px-1 py-1.5 text-center text-sm" />
                </div>
              ))}
              {weeks < MAX_WEEKS && <button type="button" onClick={onAddWeek} title="Agregar semana (copia la anterior)" className="mt-4 grid place-items-center rounded-xl border border-dashed border-ink-500 text-volt hover:border-volt"><Plus size={18} /></button>}
            </div>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="col-span-2"><span className={cap}>Nota</span><input value={r.note ?? ""} onChange={(e) => upd((x) => { x.note = e.target.value; })} placeholder="Tempo, técnica, molestias…" className="input w-full py-1.5 text-sm" /></label>
          {!tabata && <label><span className={cap}>RM / RIR (respaldo)</span><input value={r.rmBase ?? ""} onChange={(e) => upd((x) => { x.rmBase = e.target.value; })} placeholder="Ej: RIR 2" className="input w-full py-1.5 text-center text-sm" /></label>}
          <label><span className={cap}>Descanso (seg)</span><input inputMode="numeric" value={r.rest ?? ""} onChange={(e) => upd((x) => { x.rest = e.target.value; })} placeholder="90" className="input w-full py-1.5 text-center text-sm" /></label>
        </div>
        </>}
      </div>
    </div>
  );
}

function ExercisePicker({ value, exercises, onChange, placeholder = "Escribí y elegí de la biblioteca" }: { value: string; exercises: Ex[]; onChange: (v: string, ex?: Ex) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const matches = useMemo(() => {
    const words = norm(value).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const res: Ex[] = [];
    for (const e of exercises) {
      const n = norm(e[1]);
      if (words.every((w) => n.includes(w))) { res.push(e); if (res.length >= 40) break; }
    }
    return res.sort((x, y) => Number(!norm(x[1]).startsWith(words[0])) - Number(!norm(y[1]).startsWith(words[0]))).slice(0, 8);
  }, [value, exercises]);
  const exact = matches.some((m) => norm(m[1]) === norm(value));
  const show = open && matches.length > 0 && !(exact && matches.length === 1);
  const choose = (e: Ex) => { onChange(e[1], e); setOpen(false); };
  return (
    <div className="relative">
      <input value={value} placeholder={placeholder} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(matches.length - 1, h + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(matches[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="input w-full py-1.5 text-sm" />
      {show && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 py-1 shadow-2xl">
          {matches.map((m, i) => (
            <li key={m[0]}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(m)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${i === hi ? "bg-volt/15 text-volt" : "text-neutral-200 hover:bg-ink-800"}`}>
                <span className="truncate">{m[1]}</span>{m[2] && <span className="shrink-0 text-[10px] text-volt">▶ video</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CopyDay({ athletes, dayName, disabled, onCopy }: { athletes: Athlete[]; dayName: string; disabled: boolean; onCopy: (to: string) => Promise<{ ok: boolean; name: string }> }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-sm"><Send size={14} />Copiar este día a otro alumno</button>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-600 p-2 text-sm">
      <span className="text-neutral-300">Pasar “{dayName}” a</span>
      <select value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto min-w-0 flex-1 basis-40 py-1.5 text-sm">
        <option value="">Elegí un alumno…</option>
        {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="button" disabled={!to || pending || disabled} onClick={() => start(async () => { try { const r = await onCopy(to); setMsg(`Listo: se agregó al final del plan de ${r.name}.`); setTo(""); } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo copiar"); } })} className="btn-primary px-3 py-1.5 text-sm">{pending ? "Copiando…" : "Copiar día"}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white" aria-label="Cerrar"><X size={16} /></button>
      {disabled && <span className="basis-full text-xs muted">Esperá a que se guarde y copialo.</span>}
      {msg && <span className="basis-full text-xs text-volt">{msg}</span>}
    </div>
  );
}

function PasteSheet({ weeks, onApply }: { weeks: number; onApply: (p: Parsed, replace: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const p = useMemo(() => (text.trim() ? parseSheet(text, weeks) : null), [text, weeks]);
  const close = () => { setOpen(false); setText(""); };
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="btn-ghost mt-2 px-3 py-1.5 text-sm"><ClipboardPaste size={14} />Pegar desde Excel</button>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={close}>
      <div className="card w-full max-w-xl space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold uppercase">Pegar desde Excel</h3>
            <p className="mt-1 text-sm text-neutral-400">Seleccioná las celdas en Excel o Google Sheets, copialas y pegalas acá. Una fila por ejercicio: nombre y después una columna por semana (por ejemplo 3x8). Una fila que diga &quot;Día 1&quot; arranca un día, y una fila con un solo título arranca un bloque.</p>
          </div>
          <button type="button" onClick={close} className="text-neutral-500 hover:text-white" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} autoFocus placeholder={"Día 1 - Inferior\nFUERZA\nSentadilla\t4x8\t4x6\t5x5\nPeso muerto\t3x8\t3x8\t4x6"}
          className="input w-full font-mono text-xs" />
        {p && (p.exercises || p.warmup.length ? (
          <div className="rounded-xl border border-ink-600 p-3 text-sm">
            <p className="font-semibold text-volt">Se van a cargar {p.days.length} {p.days.length === 1 ? "día" : "días"}, {p.exercises} ejercicios y {p.weeks} {p.weeks === 1 ? "semana" : "semanas"}{p.warmup.length ? `, más ${p.warmup.length} de entrada en calor` : ""}.</p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-neutral-300">
              {p.days.map((d) => <li key={d.id}><span className="font-bold text-white">{d.name}</span>: {d.blocks.map((b) => `${b.name} (${b.rows.length})`).join(" · ")}</li>)}
            </ul>
          </div>
        ) : <p className="text-sm text-neutral-400">No encontré ejercicios. Revisá que cada fila tenga el nombre en la primera columna.</p>)}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={!p?.exercises} onClick={() => { if (p) { onApply(p, false); close(); } }} className="btn-ghost px-3 py-2 text-sm disabled:opacity-40">Agregar a los días que hay</button>
          <button type="button" disabled={!p?.exercises} onClick={() => { if (p) { onApply(p, true); close(); } }} className="btn-primary px-3 py-2 text-sm disabled:opacity-40">Reemplazar los días</button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Search } from "lucide-react";
import { Submit } from "./forms";

type Ex = { id: string; name: string; primaryMuscle: string; pattern: string; suggestedSets: string | null; suggestedReps: string | null };
type Item = { key: string; exerciseId: string; sets: number; reps: string; loadKg: string; percent1RM: string; targetRir: string; restSec: string; tempo: string; notes: string };
type Option = { value: string; label: string };

export function SessionBuilder({ action, exercises, targets, plans, capacities, types, initial }: {
  action: (fd: FormData) => Promise<void>;
  exercises: Ex[];
  targets: { groups: Option[]; athletes: Option[] };
  plans: Option[];
  capacities: Option[];
  types: Option[];
  initial: { id?: string; title: string; date: string; type: string; durationMin: number; targetRpe: number | null; capacities: string[]; target: string; planId: string; notes: string; items: Omit<Item, "key">[] };
}) {
  // La fecha llega en ISO (UTC) y se edita en la hora local del navegador
  const [f, setF] = useState(() => ({ ...initial, date: toLocal(initial.date) }));
  const [items, setItems] = useState<Item[]>(initial.items.map((i, k) => ({ ...i, key: String(k) + Math.random() })));
  const [q, setQ] = useState("");
  const [repeat, setRepeat] = useState(0);
  const byId = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (s ? exercises.filter((e) => (e.name + e.primaryMuscle).toLowerCase().includes(s)) : exercises).slice(0, 40);
  }, [q, exercises]);

  const add = (e: Ex) =>
    setItems((xs) => [...xs, { key: Math.random().toString(36), exerciseId: e.id, sets: parseInt(e.suggestedSets ?? "3") || 3, reps: (e.suggestedReps ?? "8").split(" ")[0].split("-").at(-1) ?? "8", loadKg: "", percent1RM: "", targetRir: "", restSec: "", tempo: "", notes: "" }]);
  const upd = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setItems((xs) => { const c = [...xs]; const [x] = c.splice(i, 1); c.splice(Math.max(0, Math.min(c.length, i + d)), 0, x); return c; });
  const nz = (v: string) => (v === "" ? null : Number(v));
  const payload = JSON.stringify({
    ...f, date: f.date ? new Date(f.date).toISOString() : "", targetRpe: f.targetRpe || null, repeatWeeks: repeat,
    items: items.map(({ key: _k, ...i }) => ({ ...i, loadKg: nz(i.loadKg), percent1RM: nz(i.percent1RM), targetRir: nz(i.targetRir), restSec: nz(i.restSec) })),
  });

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-3">
      <input type="hidden" name="payload" value={payload} />
      <div className="space-y-6 xl:col-span-2">
        <section className="card card-pad grid gap-4 sm:grid-cols-2">
          <L label="Título" className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required placeholder="Ej: Fuerza máxima tren inferior" /></L>
          <L label="Para">
            <select className="input" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} required>
              <option value="">Elegir…</option>
              <optgroup label="Grupos">{targets.groups.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
              <optgroup label="Deportistas">{targets.athletes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
            </select>
          </L>
          <L label="Fecha y hora"><input type="datetime-local" suppressHydrationWarning className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></L>
          <L label="Tipo"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Duración (min)"><input type="number" className="input" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /></L>
            <L label="RPE objetivo"><input type="number" min={1} max={10} className="input" value={f.targetRpe ?? ""} onChange={(e) => setF({ ...f, targetRpe: e.target.value ? Number(e.target.value) : null })} /></L>
          </div>
          <L label="Planificación"><select className="input" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}><option value="">Sin vincular</option>{plans.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></L>
          {!f.id && <L label="Repetir semanalmente"><select className="input" value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>{[0, 1, 2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n ? `${n} semanas más` : "No repetir"}</option>)}</select></L>}
          <div className="sm:col-span-2">
            <span className="label mb-2 block">Capacidades</span>
            <div className="flex flex-wrap gap-1.5">
              {capacities.map((c) => {
                const on = f.capacities.includes(c.value);
                return <button type="button" key={c.value} onClick={() => setF({ ...f, capacities: on ? f.capacities.filter((x) => x !== c.value) : [...f.capacities, c.value] })} className={on ? "chip-volt !bg-volt !text-black" : "chip-mute hover:text-white"}>{c.label}</button>;
              })}
            </div>
          </div>
          <L label="Indicaciones generales" className="sm:col-span-2"><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Entrada en calor, objetivos de la sesión, aclaraciones…" /></L>
        </section>

        <section className="card">
          <div className="flex items-center justify-between p-4 sm:p-5"><h2 className="h2">Ejercicios</h2><span className="label">{items.length} ejercicios</span></div>
          {items.length === 0 && <p className="px-5 pb-5 text-sm muted">Agregá ejercicios desde la biblioteca (panel derecho).</p>}
          <ol className="space-y-3 px-3 pb-4 sm:px-5">
            {items.map((it, i) => (
              <li key={it.key} className="rounded-xl border border-ink-700 bg-ink-900 p-3 animate-rise">
                <div className="mb-2 flex items-center gap-2">
                  <span className="num grid h-6 w-6 place-items-center rounded-md bg-volt text-xs font-bold text-black">{i + 1}</span>
                  <span className="flex-1 truncate font-semibold text-white">{byId[it.exerciseId]?.name ?? "Ejercicio"}</span>
                  <button type="button" onClick={() => move(i, -1)} className="rounded p-1 text-neutral-500 hover:text-white" aria-label="Subir"><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded p-1 text-neutral-500 hover:text-white" aria-label="Bajar"><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} className="rounded p-1 text-neutral-500 hover:text-red-400" aria-label="Quitar"><Trash2 size={15} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                  <Mini label="Series"><input type="number" min={1} className="input py-1.5" value={it.sets} onChange={(e) => upd(it.key, { sets: Number(e.target.value) })} /></Mini>
                  <Mini label="Reps"><input className="input py-1.5" value={it.reps} onChange={(e) => upd(it.key, { reps: e.target.value })} /></Mini>
                  <Mini label="% 1RM"><input type="number" className="input py-1.5" value={it.percent1RM} onChange={(e) => upd(it.key, { percent1RM: e.target.value })} /></Mini>
                  <Mini label="Kg"><input type="number" step="0.5" className="input py-1.5" value={it.loadKg} onChange={(e) => upd(it.key, { loadKg: e.target.value })} /></Mini>
                  <Mini label="RIR"><input type="number" min={0} max={6} className="input py-1.5" value={it.targetRir} onChange={(e) => upd(it.key, { targetRir: e.target.value })} /></Mini>
                  <Mini label="Pausa (s)"><input type="number" className="input py-1.5" value={it.restSec} onChange={(e) => upd(it.key, { restSec: e.target.value })} /></Mini>
                  <Mini label="Tempo"><input className="input py-1.5" value={it.tempo} placeholder="3-1-X" onChange={(e) => upd(it.key, { tempo: e.target.value })} /></Mini>
                </div>
                <input className="input mt-2 py-1.5" value={it.notes} placeholder="Nota para el deportista (opcional)" onChange={(e) => upd(it.key, { notes: e.target.value })} />
              </li>
            ))}
          </ol>
        </section>
        <div className="flex justify-end"><Submit>{f.id ? "Guardar cambios" : "Crear sesión"}</Submit></div>
      </div>

      <aside className="card card-pad h-fit xl:sticky xl:top-20">
        <h2 className="h2 mb-3">Biblioteca</h2>
        <div className="relative"><Search size={15} className="absolute left-3 top-3 text-neutral-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio o músculo…" className="input pl-9" /></div>
        <ul className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
          {filtered.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => add(e)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-ink-800">
                <Plus size={15} className="shrink-0 text-volt" />
                <span className="flex-1"><span className="block text-white">{e.name}</span><span className="text-xs muted">{e.primaryMuscle}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </form>
  );
}

function toLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function L({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="label mb-1.5 block">{label}</span>{children}</label>;
}
function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>{children}</label>;
}

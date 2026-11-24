// Rutina del deportista (estilo planilla): días → bloques → ejercicios, con una columna por semana.
// Se guarda como JSON en Routine.data. Estas funciones sirven en servidor y navegador.

export type RoutineRow = { id: string; exerciseId?: string | null; name: string; video?: string | null; note?: string; cells: string[] };
export type RoutineBlock = { id: string; name: string; rows: RoutineRow[] };
export type RoutineDay = { id: string; name: string; blocks: RoutineBlock[] };
export type WarmupItem = { id: string; exerciseId?: string | null; name: string; video?: string | null; detail?: string };
export type RoutineMeta = { objective?: string; start?: string; notes?: string; rest?: string };
export type RoutineData = { meta: RoutineMeta; weeks: number; warmup: WarmupItem[]; days: RoutineDay[] };

export const MAX_WEEKS = 12;
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const emptyRow = (weeks: number, init?: Partial<RoutineRow>): RoutineRow => ({ id: newId(), name: "", note: "", cells: Array(weeks).fill(""), ...init });
export const emptyBlock = (name = "BLOQUE PRINCIPAL"): RoutineBlock => ({ id: newId(), name, rows: [] });
export const emptyDay = (n: number): RoutineDay => ({ id: newId(), name: `DÍA ${n}`, blocks: [emptyBlock()] });
export const emptyRoutine = (): RoutineData => ({ meta: { objective: "", start: "", notes: "", rest: "" }, weeks: 4, warmup: [], days: [emptyDay(1)] });

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Limpia y valida lo que llega del navegador (nunca se confía en la forma del JSON). */
export function sanitizeRoutine(raw: unknown): RoutineData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const weeks = Math.max(1, Math.min(MAX_WEEKS, Math.round(Number(r.weeks) || 4)));
  const m = (r.meta ?? {}) as Record<string, unknown>;
  const url = (v: unknown) => { const s = str(v, 500).trim(); return /^https:\/\/\S+$/.test(s) ? s : null; };
  const id = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : newId());
  return {
    weeks,
    meta: { objective: str(m.objective, 200), start: /^\d{4}-\d{2}-\d{2}$/.test(str(m.start)) ? str(m.start) : "", notes: str(m.notes, 1000), rest: str(m.rest, 100) },
    warmup: arr<Record<string, unknown>>(r.warmup).slice(0, 40).map((w) => ({ id: id(w.id), exerciseId: typeof w.exerciseId === "string" ? w.exerciseId : null, name: str(w.name, 120), video: url(w.video), detail: str(w.detail, 120) })),
    days: arr<Record<string, unknown>>(r.days).slice(0, 14).map((d) => ({
      id: id(d.id), name: str(d.name, 60) || "DÍA",
      blocks: arr<Record<string, unknown>>(d.blocks).slice(0, 12).map((b) => ({
        id: id(b.id), name: str(b.name, 60),
        rows: arr<Record<string, unknown>>(b.rows).slice(0, 40).map((x) => {
          const cells = arr<unknown>(x.cells).map((c) => str(c, 40));
          return { id: id(x.id), exerciseId: typeof x.exerciseId === "string" ? x.exerciseId : null, name: str(x.name, 120), video: url(x.video), note: str(x.note, 200), cells: Array.from({ length: weeks }, (_, i) => cells[i] ?? "") };
        }),
      })),
    })),
  };
}

/** Copia con ids nuevos (para pasar a otra persona o duplicar). */
export function cloneRoutine(d: RoutineData): RoutineData {
  return {
    ...d, meta: { ...d.meta },
    warmup: d.warmup.map((w) => ({ ...w, id: newId() })),
    days: d.days.map(cloneDay),
  };
}
export function cloneDay(day: RoutineDay): RoutineDay {
  return { ...day, id: newId(), blocks: day.blocks.map((b) => ({ ...b, id: newId(), rows: b.rows.map((r) => ({ ...r, id: newId(), cells: [...r.cells] })) })) };
}

/** Ajusta un día a otra cantidad de semanas (corta o completa columnas). */
export function fitDay(day: RoutineDay, weeks: number): RoutineDay {
  return { ...day, blocks: day.blocks.map((b) => ({ ...b, rows: b.rows.map((r) => ({ ...r, cells: Array.from({ length: weeks }, (_, i) => r.cells[i] ?? r.cells[r.cells.length - 1] ?? "") })) })) };
}

/** Semana en curso (0 = primera) según la fecha de inicio. null si no hay fecha o ya terminó. */
export function currentWeek(d: RoutineData, now = new Date()) {
  if (!d.meta.start) return null;
  const start = new Date(`${d.meta.start}T00:00:00-03:00`);
  const w = Math.floor((+now - +start) / (7 * 86400000));
  return w >= 0 && w < d.weeks ? w : null;
}

export const countExercises = (d: RoutineData) => d.days.reduce((n, day) => n + day.blocks.reduce((m, b) => m + b.rows.filter((r) => r.name).length, 0), 0);

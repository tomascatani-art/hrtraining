// Rutina del alumno (estilo planilla): días → bloques → ejercicios, con una columna por semana.
// Se guarda como JSON en Routine.data. Estas funciones sirven en servidor y navegador.

export type RowLink = "" | "superserie" | "circuito";
export type RoutineRow = {
  id: string; exerciseId?: string | null; name: string; video?: string | null; note?: string; focus?: string; cells: string[];
  rm?: string[]; rmBase?: string; rest?: string; mode?: "normal" | "tabata"; tabata?: { work: string; rest: string; rounds: string };
  link?: RowLink; // se une con el ejercicio siguiente: sin descanso o en circuito
};
export type BlockKind = "normal" | "superserie" | "circuito" | "tabata" | "amrap" | "emom";
export type RoutineBlock = { id: string; name: string; kind?: BlockKind; rounds?: string; work?: string; rest?: string; minutes?: string; rows: RoutineRow[] };

/** Cómo se ejecuta el bloque. */
export const BLOCK_KINDS: Record<BlockKind, { label: string; hint: string }> = {
  normal: { label: "Normal", hint: "Series con su pausa" },
  superserie: { label: "Sin descanso", hint: "Superserie: los ejercicios seguidos, pausa al final" },
  circuito: { label: "Circuito", hint: "Vueltas a todos los ejercicios" },
  tabata: { label: "Tabata", hint: "Trabajo / descanso por rounds" },
  amrap: { label: "AMRAP", hint: "Todas las vueltas posibles en X minutos" },
  emom: { label: "EMOM", hint: "Cada minuto, durante X minutos" },
};
export function blockSummary(b: RoutineBlock) {
  switch (b.kind) {
    case "superserie": return `Sin descanso entre ejercicios${b.rest ? ` · pausa ${b.rest} al final` : ""}`;
    case "circuito": return `Circuito${b.rounds ? ` · ${b.rounds} vueltas` : ""}${b.rest ? ` · pausa ${b.rest} entre vueltas` : ""}`;
    case "tabata": return `Tabata ${b.work || "20"}″ trabajo / ${b.rest || "10"}″ descanso × ${b.rounds || "8"} rounds`;
    case "amrap": return `AMRAP ${b.minutes || "?"} min: todas las vueltas posibles`;
    case "emom": return `EMOM ${b.minutes || "?"} min: arrancás cada minuto`;
    default: return "";
  }
}

/** Foco de cada ejercicio. Colores dentro de la identidad (negro, amarillo y blanco), siempre con su nombre escrito. */
export const FOCUS: Record<string, { label: string; cls: string }> = {
  activacion: { label: "Activación", cls: "border-dashed border-neutral-300 text-neutral-200" },
  estructura: { label: "Estructura", cls: "bg-white/15 text-white border-white/40" },
  fuerza: { label: "Fuerza", cls: "bg-volt text-ink-950 border-volt" },
  hipertrofia: { label: "Hipertrofia", cls: "bg-volt/20 text-volt border-volt/40" },
  potencia: { label: "Explosivo / potencia", cls: "border-volt text-volt" },
  velocidad: { label: "Velocidad", cls: "bg-white text-ink-950 border-white" },
  resistencia: { label: "Resistencia", cls: "border-white text-white" },
  accesorio: { label: "Accesorio", cls: "bg-neutral-700 text-neutral-100 border-neutral-700" },
  core: { label: "Core", cls: "bg-neutral-500 text-white border-neutral-500" },
  estabilidad: { label: "Estabilidad", cls: "border-neutral-400 text-neutral-200" },
  movilidad: { label: "Movilidad", cls: "border-neutral-500 text-neutral-300" },
  tecnica: { label: "Técnica", cls: "border-dotted border-volt/70 text-volt" },
  prevencion: { label: "Prevención", cls: "border-dotted border-white/70 text-white" },
  enfriamiento: { label: "Enfriamiento", cls: "border-neutral-600 text-neutral-400" },
};

export type FocusMap = Record<string, { label: string; cls: string }>;
const CUSTOM_CLS = ["border-volt text-volt", "bg-white/15 text-white border-white/40", "bg-volt/20 text-volt border-volt/40", "border-white text-white", "bg-neutral-700 text-neutral-100 border-neutral-700"];
/** Roles del preparador (los puede agregar o borrar en Ajustes). Si nunca los tocó, son los de siempre. */
export function focusRoles(raw: unknown): FocusMap {
  if (!Array.isArray(raw)) return FOCUS;
  const out: FocusMap = {};
  raw.forEach((x, i) => {
    const r = x as { key?: unknown; label?: unknown };
    if (typeof r?.key !== "string" || typeof r?.label !== "string") return;
    out[r.key] = { label: r.label.slice(0, 40), cls: FOCUS[r.key]?.cls ?? CUSTOM_CLS[i % CUSTOM_CLS.length] };
  });
  return out;
}
export const focusList = (m: FocusMap) => Object.entries(m).map(([key, v]) => ({ key, label: v.label }));

export type RoutineDay = { id: string; name: string; weekday?: string; blocks: RoutineBlock[] };
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export type WarmupItem = { id: string; exerciseId?: string | null; name: string; video?: string | null; detail?: string };
export type RoutineMeta = { objective?: string; start?: string; notes?: string; rest?: string; notice?: string };
export type RoutineData = { meta: RoutineMeta; weeks: number; warmup: WarmupItem[]; days: RoutineDay[] };

export const MAX_WEEKS = 12;
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const emptyRow = (weeks: number, init?: Partial<RoutineRow>): RoutineRow => ({ id: newId(), name: "", note: "", cells: Array(weeks).fill(""), rm: Array(weeks).fill(""), rest: "90", mode: "normal", link: "", ...init });
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
    meta: { objective: str(m.objective, 200), start: /^\d{4}-\d{2}-\d{2}$/.test(str(m.start)) ? str(m.start) : "", notes: str(m.notes, 1000), rest: str(m.rest, 100), notice: str(m.notice, 600) },
    warmup: arr<Record<string, unknown>>(r.warmup).slice(0, 40).map((w) => ({ id: id(w.id), exerciseId: typeof w.exerciseId === "string" ? w.exerciseId : null, name: str(w.name, 120), video: url(w.video), detail: str(w.detail, 120) })),
    days: arr<Record<string, unknown>>(r.days).slice(0, 14).map((d) => ({
      id: id(d.id), name: str(d.name, 60) || "DÍA", weekday: WEEKDAYS.includes(str(d.weekday)) ? str(d.weekday) : "",
      blocks: arr<Record<string, unknown>>(d.blocks).slice(0, 12).map((b) => ({
        id: id(b.id), name: str(b.name, 60),
        kind: (Object.keys(BLOCK_KINDS).includes(str(b.kind)) ? str(b.kind) : "normal") as BlockKind,
        rounds: str(b.rounds, 10), work: str(b.work, 10), rest: str(b.rest, 20), minutes: str(b.minutes, 10),
        rows: arr<Record<string, unknown>>(b.rows).slice(0, 40).map((x) => {
          const cells = arr<unknown>(x.cells).map((c) => str(c, 40));
          const rm = arr<unknown>(x.rm).map((c) => str(c, 20));
          const t = (x.tabata ?? {}) as Record<string, unknown>;
          return {
            id: id(x.id), exerciseId: typeof x.exerciseId === "string" ? x.exerciseId : null, name: str(x.name, 120), video: url(x.video), note: str(x.note, 200),
            focus: /^[a-z0-9_]{1,40}$/.test(str(x.focus)) ? str(x.focus) : "",
            cells: Array.from({ length: weeks }, (_, i) => cells[i] ?? ""), rm: Array.from({ length: weeks }, (_, i) => rm[i] ?? ""),
            rmBase: str(x.rmBase, 20), rest: str(x.rest, 10), mode: x.mode === "tabata" ? "tabata" as const : "normal" as const,
            tabata: { work: str(t.work, 6) || "20", rest: str(t.rest, 6) || "10", rounds: str(t.rounds, 6) || "8" },
            link: (x.link === "superserie" || x.link === "circuito" ? x.link : "") as RowLink,
          };
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
  return { ...day, id: newId(), blocks: day.blocks.map((b) => ({ ...b, id: newId(), rows: b.rows.map((r) => ({ ...r, id: newId(), cells: [...r.cells], rm: [...(r.rm ?? [])], tabata: r.tabata ? { ...r.tabata } : undefined })) })) };
}

/** Ajusta un día a otra cantidad de semanas (corta o completa columnas). */
export function fitDay(day: RoutineDay, weeks: number): RoutineDay {
  const fit = (a: string[] = []) => Array.from({ length: weeks }, (_, i) => a[i] ?? a[a.length - 1] ?? "");
  return { ...day, blocks: day.blocks.map((b) => ({ ...b, rows: b.rows.map((r) => ({ ...r, cells: fit(r.cells), rm: fit(r.rm) })) })) };
}

/** Semana en curso (0 = primera) según la fecha de inicio. null si no hay fecha o ya terminó. */
export function currentWeek(d: RoutineData, now = new Date()) {
  if (!d.meta.start) return null;
  const start = new Date(`${d.meta.start}T00:00:00-03:00`);
  const w = Math.floor((+now - +start) / (7 * 86400000));
  return w >= 0 && w < d.weeks ? w : null;
}

export const countExercises = (d: RoutineData) => d.days.reduce((n, day) => n + day.blocks.reduce((m, b) => m + b.rows.filter((r) => r.name).length, 0), 0);

/** Qué semana va el alumno y qué día de la rutina le toca hoy (según el día de la semana que puso el entrenador). */
/** Qué le toca hoy al alumno. Si los días no tienen día de la semana, sigue el orden: el día después del último que entrenó. */
export function todayPlan(d: RoutineData, fallbackStart: Date, now = new Date(), last?: { dayId: string; today: boolean } | null) {
  let week = currentWeek(d, now);
  if (week == null) week = Math.min(d.weeks - 1, Math.max(0, Math.floor((+now - +fallbackStart) / (7 * 86400000))));
  const wd = (now.getDay() + 6) % 7; // 0 = lunes
  const withDay = d.days.filter((x) => x.weekday && WEEKDAYS.includes(x.weekday));
  const today = withDay.find((x) => x.weekday === WEEKDAYS[wd]) ?? null;
  let next: RoutineDay | null = null;
  for (let k = 1; k <= 7 && !next; k++) next = withDay.find((x) => x.weekday === WEEKDAYS[(wd + k) % 7]) ?? null;
  let byOrder: RoutineDay | null = null;
  if (!today && withDay.length === 0) {
    const real = d.days.filter((x) => x.blocks.some((b) => b.rows.some((r) => r.name)));
    const list = real.length ? real : d.days;
    const i = last ? list.findIndex((x) => x.id === last.dayId) : -1;
    byOrder = i < 0 ? list[0] ?? null : last!.today ? list[i] : list[(i + 1) % list.length];
  }
  return { week, weeks: d.weeks, today: today ?? byOrder, next, hasWeekdays: withDay.length > 0 };
}

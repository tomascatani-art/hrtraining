// Asistente de rutinas basado en reglas de prescripción (sin IA generativa).
// Propone; el entrenador valida y ajusta antes de asignar.

export type GenExercise = { id: string; name: string; pattern: string; capacities: string[]; equipment: string[]; difficulty: number; primaryMuscle: string };

export const PRESCRIPTION: Record<string, { sets: number; reps: string; pct: number | null; rir: number | null; rest: number; note: string }> = {
  FUERZA_MAXIMA: { sets: 4, reps: "4", pct: 85, rir: 2, rest: 180, note: "Cargas altas (80-90% 1RM), pocas repeticiones, pausas completas." },
  HIPERTROFIA: { sets: 4, reps: "10", pct: 70, rir: 2, rest: 90, note: "Volumen moderado-alto, 6-12 repeticiones cerca del fallo (RIR 1-3)." },
  POTENCIA: { sets: 4, reps: "3", pct: 50, rir: 4, rest: 150, note: "Cargas ligeras-moderadas a máxima velocidad intencional; cortar la serie si cae la velocidad." },
  FUERZA_EXPLOSIVA: { sets: 4, reps: "4", pct: null, rir: null, rest: 120, note: "Pliometría y lanzamientos con calidad máxima en cada repetición." },
  FUERZA_VELOCIDAD: { sets: 4, reps: "5", pct: 40, rir: 4, rest: 120, note: "Cargas ligeras movidas rápido, enfoque en velocidad de ejecución." },
  FUERZA_RESISTENCIA: { sets: 3, reps: "15", pct: 55, rir: 2, rest: 60, note: "Repeticiones altas con pausas cortas." },
  ESTABILIDAD: { sets: 3, reps: "10", pct: null, rir: null, rest: 60, note: "Control motor y antirrotación." },
  MOVILIDAD: { sets: 2, reps: "8", pct: null, rir: null, rest: 30, note: "Rango activo controlado." },
  VELOCIDAD: { sets: 6, reps: "1", pct: null, rir: null, rest: 180, note: "Esfuerzos cortos máximos con recuperación completa." },
  AGILIDAD: { sets: 5, reps: "1", pct: null, rir: null, rest: 90, note: "Cambios de dirección de alta calidad." },
  RESISTENCIA_AEROBICA: { sets: 4, reps: "4 min", pct: null, rir: null, rest: 120, note: "Intervalos aeróbicos o trabajo continuo." },
  RESISTENCIA_ANAEROBICA: { sets: 6, reps: "30 s", pct: null, rir: null, rest: 90, note: "Esfuerzos intensos con recuperación incompleta." },
  COORDINACION: { sets: 3, reps: "2", pct: null, rir: null, rest: 45, note: "Patrones técnicos variados." },
};

const SPLITS: Record<number, string[][]> = {
  2: [["SENTADILLA", "EMPUJE_H", "TRACCION_V", "CORE"], ["BISAGRA", "EMPUJE_V", "TRACCION_H", "ZANCADA"]],
  3: [["SENTADILLA", "EMPUJE_H", "TRACCION_H", "CORE"], ["BISAGRA", "EMPUJE_V", "TRACCION_V", "ROTACION"], ["ZANCADA", "CARGADA", "EMPUJE_H", "CORE"]],
  4: [["SENTADILLA", "ZANCADA", "CORE"], ["EMPUJE_H", "TRACCION_H", "EMPUJE_V"], ["BISAGRA", "CARGADA", "ROTACION"], ["TRACCION_V", "EMPUJE_V", "CORE"]],
  5: [["SENTADILLA", "ZANCADA", "CORE"], ["EMPUJE_H", "TRACCION_H"], ["BISAGRA", "CARGADA", "ROTACION"], ["EMPUJE_V", "TRACCION_V", "CORE"], ["SALTO", "CARRERA", "MOVILIDAD"]],
};
const EXPLOSIVE_EXTRA: Record<string, string[]> = { POTENCIA: ["SALTO", "CARGADA"], FUERZA_EXPLOSIVA: ["SALTO"], VELOCIDAD: ["CARRERA", "SALTO"], AGILIDAD: ["CARRERA"] };

export function generateWeek(opts: { objective: string; days: number; level: number; equipment: string[]; library: GenExercise[] }) {
  const days = Math.max(2, Math.min(5, opts.days));
  const rx = PRESCRIPTION[opts.objective] ?? PRESCRIPTION.HIPERTROFIA;
  const lib = opts.library.filter((e) => e.difficulty <= opts.level && (opts.equipment.length === 0 || e.equipment.some((q) => opts.equipment.includes(q)) || e.equipment.includes("Peso corporal")));
  const used = new Set<string>();
  const pick = (pattern: string) => {
    const pool = lib.filter((e) => e.pattern === pattern && !used.has(e.id));
    const pref = pool.filter((e) => e.capacities.includes(opts.objective));
    const ch = (pref.length ? pref : pool)[0];
    if (ch) used.add(ch.id);
    return ch;
  };
  return SPLITS[days].map((patterns, i) => {
    const extra = EXPLOSIVE_EXTRA[opts.objective] ?? [];
    const order = [...extra.filter((p) => !patterns.includes(p)).slice(0, 1), ...patterns];
    const items = order.map(pick).filter(Boolean).map((e, j) => {
      const isMain = j < 2 && ["SENTADILLA", "BISAGRA", "EMPUJE_H", "EMPUJE_V", "TRACCION_V", "TRACCION_H", "ZANCADA", "CARGADA"].includes(e!.pattern);
      const r = isMain ? rx : e!.pattern === "SALTO" || e!.pattern === "CARRERA" ? PRESCRIPTION.FUERZA_EXPLOSIVA : PRESCRIPTION.ESTABILIDAD;
      return { exerciseId: e!.id, name: e!.name, sets: Math.max(2, r.sets - (opts.level === 1 ? 1 : 0)), reps: r.reps, percent1RM: isMain ? r.pct : null, targetRir: r.rir != null ? r.rir + (opts.level === 1 ? 1 : 0) : null, restSec: r.rest };
    });
    return { title: `Día ${i + 1}`, items };
  });
}

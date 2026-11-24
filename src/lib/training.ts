import "server-only";
import { db } from "@/lib/db";

export { roundToPlates, plateBreakdown, classifyNote, NOTE_KINDS } from "@/lib/plates";

/** Último RM cargado por ejercicio para un deportista. Si no hay RM cargado, usa el 1RM de las evaluaciones para los tres básicos. */
export async function latestRMs(athleteId: string, exerciseIds?: string[]) {
  const rows = await db.exerciseRM.findMany({
    where: { athleteId, ...(exerciseIds ? { exerciseId: { in: exerciseIds } } : {}) },
    orderBy: { date: "desc" },
    include: { exercise: { select: { name: true } } },
  });
  const out = new Map<string, { kg: number; date: Date; source: string }>();
  for (const r of rows) if (!out.has(r.exerciseId)) out.set(r.exerciseId, { kg: r.kg, date: r.date, source: r.source });

  // Respaldo: 1RM evaluados (sentadilla, banca, peso muerto)
  const evals = await db.evaluation.findMany({ where: { athleteId, testKey: { in: ["RM1_SQ", "RM1_BP", "RM1_DL"] } }, orderBy: { date: "desc" } });
  if (evals.length) {
    const exs = await db.exercise.findMany({ where: { ...(exerciseIds ? { id: { in: exerciseIds } } : {}) }, select: { id: true, name: true } });
    for (const e of exs) {
      if (out.has(e.id)) continue;
      const key = EVAL_FOR.find(([re]) => re.test(e.name))?.[1];
      const ev = key ? evals.find((x) => x.testKey === key) : undefined;
      if (ev) out.set(e.id, { kg: ev.value, date: ev.date, source: "EVALUACION" });
    }
  }
  return out;
}
const EVAL_FOR: [RegExp, string][] = [[/^Sentadilla (trasera|frontal)/, "RM1_SQ"], [/^Press de banca/, "RM1_BP"], [/^Peso muerto convencional/, "RM1_DL"]];

/** Sesiones asignadas a un deportista (individuales o de sus grupos). */
export async function athleteSessionWhere(athleteId: string) {
  const groups = await db.groupMember.findMany({ where: { athleteId }, select: { groupId: true } });
  return { OR: [{ athleteId }, { groupId: { in: groups.map((g) => g.groupId) } }] };
}

/**
 * Racha de constancia: cuántas sesiones programadas seguidas (de la más reciente hacia atrás) registró
 * como completas o parciales. Una sesión de hoy todavía sin registrar no corta la racha.
 */
export async function streakFor(athleteId: string) {
  const now = new Date();
  const sessions = await db.session.findMany({
    where: { ...(await athleteSessionWhere(athleteId)), date: { lte: now }, type: { not: "COMPETENCIA" } },
    orderBy: { date: "desc" }, take: 120, select: { id: true, date: true, logs: { where: { athleteId }, select: { status: true } } },
  });
  let n = 0;
  for (const s of sessions) {
    const st = s.logs[0]?.status;
    if (st === "COMPLETADO" || st === "PARCIAL") n++;
    else if (st === "JUSTIFICADO") continue;
    else if (!st && now.getTime() - s.date.getTime() < 18 * 3600 * 1000 && n === 0) continue;
    else break;
  }
  return n;
}

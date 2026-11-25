import "server-only";
import { db } from "./db";
import { exerciseVideos } from "./exercise-video";
import { sanitizeRoutine, type RoutineData } from "./routine";
import { visibleAthleteIds } from "./access";
import type { SessionUser } from "./auth";

/** Completa el video de cada fila con el link que el club tiene para ese ejercicio (si la fila no trae uno propio). */
export async function withVideos(orgId: string, raw: unknown): Promise<RoutineData> {
  const d = sanitizeRoutine(raw);
  const rows = [...d.warmup, ...d.days.flatMap((x) => x.blocks.flatMap((b) => b.rows))];
  const vids = await exerciseVideos(orgId, rows.map((r) => r.exerciseId ?? "").filter(Boolean));
  for (const r of rows) if (!r.video && r.exerciseId) r.video = vids.get(r.exerciseId) ?? null;
  return d;
}

export async function athleteOptions(u: SessionUser) {
  const ids = await visibleAthleteIds(u);
  return db.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

/** Ejercicios para el buscador de la planilla: [id, nombre, video]. */
export async function libraryPicker(orgId: string) {
  const exs = await db.exercise.findMany({ where: { OR: [{ orgId: null }, { orgId }] }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const vids = await exerciseVideos(orgId, exs.map((e) => e.id));
  return exs.map((e) => [e.id, e.name, vids.get(e.id) ?? null] as [string, string, string | null]);
}

/** Plan actual del deportista. Si había un "próximo plan" con fecha ya cumplida, pasa a ser el actual (el anterior queda en versiones). */
export async function currentRoutine(athleteId: string) {
  const now = new Date();
  const due = await db.routine.findFirst({ where: { athleteId, extra: false, active: false, startsOn: { lte: now } }, orderBy: { startsOn: "desc" } });
  if (due) {
    await db.routine.updateMany({ where: { athleteId, extra: false, active: true }, data: { active: false } });
    await db.routine.update({ where: { id: due.id }, data: { active: true, startsOn: null } });
  }
  return db.routine.findFirst({ where: { athleteId, extra: false, active: true }, orderBy: { updatedAt: "desc" }, include: { coach: { select: { name: true } } } });
}

export async function extraRoutines(athleteId: string) {
  return db.routine.findMany({ where: { athleteId, extra: true, active: true }, orderBy: { createdAt: "asc" } });
}

import "server-only";
import { db } from "./db";
import { addDays, computeAlerts, loadIndicators, startOfDay, type Alert } from "./metrics";

export async function athleteLoadPoints(athleteIds: string[], since: Date) {
  const [logs, days] = await Promise.all([
    db.workoutLog.findMany({
      where: { athleteId: { in: athleteIds }, completedAt: { gte: since }, load: { not: null } },
      select: { athleteId: true, completedAt: true, load: true, rpe: true, durationMin: true },
    }),
    // Días de rutina que el alumno dio por terminados (esfuerzo × minutos)
    db.routineSession.findMany({
      where: { athleteId: { in: athleteIds }, createdAt: { gte: since } },
      select: { athleteId: true, createdAt: true, load: true, rpe: true, durationMin: true },
    }),
  ]);
  return [...logs, ...days.map((d) => ({ athleteId: d.athleteId, completedAt: d.createdAt, load: d.load as number | null, rpe: d.rpe as number | null, durationMin: d.durationMin as number | null }))];
}

/** Estado de monitoreo por alumno: alertas, indicadores de carga y último bienestar. */
export async function monitoringFor(athleteIds: string[]) {
  const since = addDays(startOfDay(new Date()), -42);
  const [users, logs, wellness] = await Promise.all([
    db.user.findMany({ where: { id: { in: athleteIds } }, include: { athleteProfile: true }, orderBy: { name: "asc" } }),
    athleteLoadPoints(athleteIds, since),
    db.wellness.findMany({ where: { athleteId: { in: athleteIds }, date: { gte: since } }, orderBy: { date: "asc" } }),
  ]);
  return users.map((u) => {
    const pts = logs.filter((l) => l.athleteId === u.id).map((l) => ({ date: l.completedAt, load: l.load ?? 0 }));
    const w = wellness.filter((x) => x.athleteId === u.id);
    const alerts: Alert[] = computeAlerts(w, pts);
    return { user: u, indicators: loadIndicators(pts), alerts, lastWellness: w.at(-1) ?? null, wellness: w, points: pts };
  });
}

export type Monitoring = Awaited<ReturnType<typeof monitoringFor>>[number];

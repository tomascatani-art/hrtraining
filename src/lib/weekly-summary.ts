import "server-only";
import { db } from "@/lib/db";
import { monthKey } from "@/lib/fees";
import { sanitizeRoutine, planEnd } from "@/lib/routine";

/** Resumen de los últimos 7 días para el preparador: quién entrenó, quién no, molestias, cuotas y planes por terminar. */
export async function weeklySummary(orgId: string, now = new Date()) {
  const from = new Date(+now - 7 * 86400000);
  const fromDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const athletes = await db.user.findMany({
    where: { orgId, role: "ATHLETE", active: true, athleteProfile: { paused: false } },
    select: { id: true, name: true, athleteProfile: { select: { phone: true } } }, orderBy: { name: "asc" },
  });
  const ids = athletes.map((a) => a.id);
  const [sessions, logs, molestias, fees, routines, upcoming] = await Promise.all([
    db.routineSession.findMany({ where: { athleteId: { in: ids }, date: { gte: fromDay } }, select: { athleteId: true, date: true, dayId: true } }),
    db.workoutLog.findMany({ where: { athleteId: { in: ids }, completedAt: { gte: from } }, select: { athleteId: true } }),
    db.routineCheck.findMany({ where: { athleteId: { in: ids }, molestia: true, date: { gte: fromDay } }, select: { athleteId: true, note: true, date: true, athlete: { select: { name: true } } }, orderBy: { date: "desc" }, take: 20 }),
    db.fee.findMany({ where: { orgId, period: monthKey(now), athleteId: { in: ids } }, select: { athleteId: true, status: true } }),
    db.routine.findMany({ where: { athleteId: { in: ids }, active: true, extra: false, template: false }, select: { id: true, athleteId: true, name: true, data: true, createdAt: true } }),
    db.routine.findMany({ where: { athleteId: { in: ids }, active: false, extra: false, startsOn: { not: null } }, select: { athleteId: true } }),
  ]);
  // Días entrenados: cada día con ejercicios marcados o con el entrenamiento finalizado cuenta una vez
  const daysBy = new Map<string, Set<string>>();
  const add = (id: string, k: string) => { if (!daysBy.has(id)) daysBy.set(id, new Set()); daysBy.get(id)!.add(k); };
  for (const s of sessions) add(s.athleteId, s.date.toISOString().slice(0, 10) + s.dayId);
  const checkDays = await db.routineCheck.findMany({ where: { athleteId: { in: ids }, date: { gte: fromDay } }, select: { athleteId: true, date: true, dayId: true }, distinct: ["athleteId", "date", "dayId"] });
  for (const c of checkDays) add(c.athleteId, c.date.toISOString().slice(0, 10) + c.dayId);
  logs.forEach((l, i) => add(l.athleteId, `log${i}`));

  const trained = athletes.filter((a) => daysBy.has(a.id)).map((a) => ({ ...a, days: daysBy.get(a.id)!.size })).sort((x, y) => y.days - x.days);
  const idle = athletes.filter((a) => !daysBy.has(a.id));
  const paid = new Set(fees.filter((f) => f.status !== "PENDIENTE").map((f) => f.athleteId));
  const unpaid = athletes.filter((a) => !paid.has(a.id));
  const hasNext = new Set(upcoming.map((u) => u.athleteId));
  const ending = routines
    .map((r) => ({ r, ...planEnd(sanitizeRoutine(r.data), r.createdAt, now) }))
    .filter((x) => x.daysLeft <= 7 && !hasNext.has(x.r.athleteId!))
    .map((x) => ({ routineId: x.r.id, athleteId: x.r.athleteId!, name: athletes.find((a) => a.id === x.r.athleteId)?.name ?? "", plan: x.r.name, daysLeft: x.daysLeft }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return { from, athletes: athletes.length, trained, idle, molestias, unpaid, ending };
}

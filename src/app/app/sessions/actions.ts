"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertAthlete, audit, notify, sessionWhere, visibleGroups } from "@/lib/access";
import { BLOCKS } from "@/lib/catalog";
import { classifyNote } from "@/lib/plates";
import { latestRMs } from "@/lib/training";

const itemSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.coerce.number().int().min(1).max(20),
  reps: z.string().min(1).max(20),
  loadKg: z.coerce.number().nullable().optional(),
  percent1RM: z.coerce.number().nullable().optional(),
  targetRir: z.coerce.number().int().nullable().optional(),
  restSec: z.coerce.number().int().nullable().optional(),
  tempo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  block: z.string().nullable().optional().transform((v) => (v && BLOCKS[v] ? v : null)),
});
const sessionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Título requerido"),
  date: z.string().min(10),
  type: z.string(),
  durationMin: z.coerce.number().int().min(5).max(600),
  targetRpe: z.coerce.number().int().min(1).max(10).nullable().optional(),
  capacities: z.array(z.string()).default([]),
  target: z.string().min(3, "Elegí un alumno o grupo"),
  planId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  repeatWeeks: z.coerce.number().int().min(0).max(26).default(0),
  items: z.array(itemSchema).default([]),
});

async function ownSession(u: SessionUser, id: string) {
  const s = await db.session.findFirst({ where: { id, ...(await sessionWhere(u)) } });
  if (!s) throw new Error("Sesión no encontrada");
  return s;
}

async function recipients(athleteId: string | null, groupId: string | null) {
  if (athleteId) return [athleteId];
  if (groupId) return (await db.groupMember.findMany({ where: { groupId } })).map((m) => m.athleteId);
  return [];
}

export async function saveSession(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const data = sessionSchema.parse(JSON.parse(String(fd.get("payload"))));
  const [kind, targetId] = data.target.split(":");
  if (kind === "a") await assertAthlete(u, targetId);
  else {
    const g = await db.group.findUnique({ where: { id: targetId } });
    if (!g || g.orgId !== u.orgId) throw new Error("Grupo inválido");
  }
  const exIds = [...new Set(data.items.map((i) => i.exerciseId))];
  const okEx = await db.exercise.count({ where: { id: { in: exIds }, OR: [{ orgId: null }, { orgId: u.orgId }] } });
  if (okEx !== exIds.length) throw new Error("Hay ejercicios inválidos");
  const base = {
    title: data.title, type: data.type, durationMin: data.durationMin, targetRpe: data.targetRpe ?? null, capacities: data.capacities,
    athleteId: kind === "a" ? targetId : null, groupId: kind === "g" ? targetId : null, planId: data.planId || null, notes: data.notes || null,
  };
  const items = data.items.map((it, order) => ({ ...it, order, loadKg: it.loadKg ?? null, percent1RM: it.percent1RM != null ? it.percent1RM / 100 : null, targetRir: it.targetRir ?? null, restSec: it.restSec ?? null, tempo: it.tempo || null, notes: it.notes || null, block: it.block ?? null }));
  const date = new Date(data.date);
  let id: string;
  if (data.id) {
    const s = await ownSession(u, data.id);
    await db.$transaction([
      db.sessionExercise.deleteMany({ where: { sessionId: s.id, setLogs: { none: {} }, notesLog: { none: {} } } }),
      db.session.update({ where: { id: s.id }, data: { ...base, date } }),
    ]);
    const kept = await db.sessionExercise.count({ where: { sessionId: s.id } });
    await db.sessionExercise.createMany({ data: items.map((i) => ({ ...i, order: i.order + kept, sessionId: s.id })) });
    id = s.id;
    await audit(u, "EDITAR", "Sesión", data.title, id);
  } else {
    const created = await db.session.create({ data: { ...base, orgId: u.orgId, coachId: u.id, date, items: { create: items } } });
    id = created.id;
    for (let w = 1; w <= data.repeatWeeks; w++) {
      await db.session.create({ data: { ...base, orgId: u.orgId, coachId: u.id, date: new Date(+date + w * 7 * 86400000), items: { create: items } } });
    }
    await audit(u, "CREAR", "Sesión", `${data.title}${data.repeatWeeks ? ` (+${data.repeatWeeks} repeticiones semanales)` : ""}`, id);
    await notify(await recipients(base.athleteId, base.groupId), { kind: "SESION", title: `Nueva sesión: ${data.title}`, body: date.toLocaleString("es-AR"), link: `/app/sessions/${id}` });
  }
  revalidatePath("/app/calendar");
  redirect(`/app/sessions/${id}`);
}

export async function duplicateSession(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const s = await ownSession(u, String(fd.get("id")));
  const items = await db.sessionExercise.findMany({ where: { sessionId: s.id } });
  const days = Number(fd.get("days") ?? 7);
  const copy = await db.session.create({
    data: {
      orgId: s.orgId, coachId: u.id, title: s.title, date: new Date(+s.date + days * 86400000), type: s.type, capacities: s.capacities, durationMin: s.durationMin,
      targetRpe: s.targetRpe, notes: s.notes, athleteId: s.athleteId, groupId: s.groupId, planId: s.planId,
      items: { create: items.map(({ id: _i, sessionId: _s, ...rest }) => rest) },
    },
  });
  await audit(u, "CREAR", "Sesión", `Copia de ${s.title}`, copy.id);
  redirect(`/app/sessions/${copy.id}`);
}

/** Copia un día (sesión con todos sus ejercicios) a otro alumno y/o a otra fecha. Mantiene la hora. */
export async function copySession(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const s = await ownSession(u, String(fd.get("id")));
  const athleteId = String(fd.get("athleteId") ?? "") || null;
  if (athleteId) await assertAthlete(u, athleteId);
  const day = String(fd.get("date") ?? "");
  // Corre la sesión a ese día manteniendo la hora (días calculados en hora de Argentina, UTC-3)
  const srcDay = new Date(s.date.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(s.date.getTime() + (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${srcDay}T00:00:00Z`))) : s.date;
  const title = String(fd.get("title") ?? "").trim() || s.title;
  const items = await db.sessionExercise.findMany({ where: { sessionId: s.id } });
  const copy = await db.session.create({
    data: {
      orgId: s.orgId, coachId: u.id, title, date, type: s.type, capacities: s.capacities, durationMin: s.durationMin, targetRpe: s.targetRpe, notes: s.notes,
      athleteId: athleteId ?? s.athleteId, groupId: athleteId ? null : s.groupId, planId: athleteId && athleteId !== s.athleteId ? null : s.planId,
      items: { create: items.map(({ id: _i, sessionId: _s, ...rest }) => rest) },
    },
  });
  await audit(u, "CREAR", "Sesión", `Copia de ${s.title}`, copy.id);
  await notify(await recipients(copy.athleteId, copy.groupId), { kind: "SESION", title: `Nueva sesión: ${copy.title}`, body: copy.date.toLocaleString("es-AR"), link: `/app/sessions/${copy.id}` });
  revalidatePath("/app/calendar");
  redirect(`/app/sessions/${copy.id}?copiada=1`);
}

export async function deleteSession(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const s = await ownSession(u, String(fd.get("id")));
  await db.session.delete({ where: { id: s.id } });
  await audit(u, "ELIMINAR", "Sesión", s.title, s.id);
  redirect("/app/calendar");
}

const logSchema = z.object({
  sessionId: z.string(),
  athleteId: z.string().optional(),
  status: z.enum(["COMPLETADO", "PARCIAL", "AUSENTE", "JUSTIFICADO"]),
  durationMin: z.coerce.number().int().min(0).max(600).nullable(),
  rpe: z.coerce.number().int().min(0).max(10).nullable(),
  feeling: z.string().nullable().optional(),
  sets: z.array(z.object({
    itemId: z.string(), setNumber: z.number().int(), reps: z.coerce.number().int().nullable(), loadKg: z.coerce.number().nullable(),
    rir: z.coerce.number().int().nullable(), rpe: z.coerce.number().nullable(), velocity: z.coerce.number().nullable(), timeSec: z.coerce.number().nullable(),
  })).default([]),
  notes: z.array(z.object({ itemId: z.string(), note: z.string().max(500) })).default([]),
});

/** Registro de la sesión por el alumno (o por el entrenador en su nombre). */
export async function saveLog(fd: FormData) {
  const u = await requireUser();
  const data = logSchema.parse(JSON.parse(String(fd.get("payload"))));
  const athleteId = u.role === "ATHLETE" ? u.id : data.athleteId!;
  await assertAthlete(u, athleteId);
  const s = await db.session.findFirst({ where: { id: data.sessionId, ...(await sessionWhere(u.role === "ATHLETE" ? u : u)) }, include: { items: true, group: { include: { members: true } } } });
  if (!s) throw new Error("Sesión no encontrada");
  const assigned = s.athleteId === athleteId || s.group?.members.some((m) => m.athleteId === athleteId);
  if (!assigned) throw new Error("Este alumno no está asignado a la sesión");
  const itemIds = new Set(s.items.map((i) => i.id));
  const sets = data.sets.filter((x) => itemIds.has(x.itemId) && (x.reps != null || x.loadKg != null || x.timeSec != null));
  const load = data.rpe != null && data.durationMin != null ? data.rpe * data.durationMin : null;
  const done = data.status === "COMPLETADO" || data.status === "PARCIAL";
  const log = await db.workoutLog.upsert({
    where: { sessionId_athleteId: { sessionId: s.id, athleteId } },
    create: { sessionId: s.id, athleteId, status: data.status, durationMin: done ? data.durationMin : null, rpe: done ? data.rpe : null, load: done ? load : null, feeling: data.feeling || null, completedAt: s.date < new Date() ? s.date : new Date() },
    update: { status: data.status, durationMin: done ? data.durationMin : null, rpe: done ? data.rpe : null, load: done ? load : null, feeling: data.feeling || null },
  });
  await db.setLog.deleteMany({ where: { logId: log.id } });
  if (done && sets.length) await db.setLog.createMany({ data: sets.map((x) => ({ ...x, logId: log.id })) });
  // Notas por ejercicio
  const notes = data.notes.filter((n) => itemIds.has(n.itemId) && n.note.trim());
  await db.itemNote.deleteMany({ where: { logId: log.id } });
  if (notes.length) await db.itemNote.createMany({ data: notes.map((n) => ({ logId: log.id, itemId: n.itemId, note: n.note.trim() })) });
  if (u.role === "ATHLETE") {
    await notify([s.coachId], { kind: "SESION", title: `${u.name} registró "${s.title}"`, body: done ? `RPE ${data.rpe} · ${load ?? "—"} UA` : data.status, link: `/app/sessions/${s.id}` });
    const pain = [data.feeling, ...notes.map((n) => n.note)].some((t) => classifyNote(t) === "MOLESTIA");
    if (pain) await notify([s.coachId], { kind: "ALERTA", title: `${u.name} marcó dolor o molestia`, body: s.title, link: `/app/sessions/${s.id}` });
  }
  revalidatePath(`/app/sessions/${s.id}`);
  revalidatePath("/app");
  redirect(`/app/sessions/${s.id}?ok=1`);
}

export async function quickAttendance(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const s = await ownSession(u, String(fd.get("sessionId")));
  const athleteId = String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const status = String(fd.get("status"));
  await db.workoutLog.upsert({
    where: { sessionId_athleteId: { sessionId: s.id, athleteId } },
    create: { sessionId: s.id, athleteId, status, completedAt: s.date, durationMin: status === "COMPLETADO" ? s.durationMin : null },
    update: { status },
  });
  revalidatePath(`/app/sessions/${s.id}`);
}

export async function commentLog(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const log = await db.workoutLog.findUnique({ where: { id: String(fd.get("logId")) }, include: { session: true } });
  if (!log) throw new Error("Registro no encontrado");
  await assertAthlete(u, log.athleteId);
  const comment = String(fd.get("comment") ?? "").trim();
  await db.workoutLog.update({ where: { id: log.id }, data: { coachComment: comment || null } });
  if (comment) await notify([log.athleteId], { kind: "SESION", title: `Comentario de ${u.name} en "${log.session.title}"`, body: comment, link: `/app/sessions/${log.sessionId}` });
  revalidatePath(`/app/sessions/${log.sessionId}`);
}

export type RecentUse = { date: string; title: string; who: string; times: number };

/**
 * Ejercicios que el destinatario de la sesión (alumno o grupo) ya tuvo
 * en los 30 días anteriores a la fecha de la sesión. Incluye sesiones
 * individuales y sesiones de los grupos a los que pertenece.
 */
export async function recentExerciseUse(target: string, dateIso: string, excludeId?: string): Promise<Record<string, RecentUse>> {
  const u = await requireUser(["COACH", "ADMIN"]);
  const date = new Date(dateIso);
  if (!target || isNaN(date.getTime())) return {};
  const [kind, id] = target.split(":");
  let athleteIds: string[] = [];
  if (kind === "a") {
    await assertAthlete(u, id);
    athleteIds = [id];
  } else if (kind === "g") {
    if (!(await visibleGroups(u)).some((g) => g.id === id)) return {};
    athleteIds = (await db.groupMember.findMany({ where: { groupId: id }, select: { athleteId: true } })).map((m) => m.athleteId);
  } else return {};
  const groupIds = [...new Set((await db.groupMember.findMany({ where: { athleteId: { in: athleteIds } }, select: { groupId: true } })).map((g) => g.groupId))];
  if (kind === "g" && !groupIds.includes(id)) groupIds.push(id);

  const sessions = await db.session.findMany({
    where: {
      orgId: u.orgId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      date: { gte: new Date(date.getTime() - 30 * 86400000), lt: date },
      OR: [{ athleteId: { in: athleteIds } }, { groupId: { in: groupIds } }],
    },
    select: { title: true, date: true, athlete: { select: { name: true } }, group: { select: { name: true } }, items: { select: { exerciseId: true } } },
    orderBy: { date: "desc" },
  });
  const out: Record<string, RecentUse> = {};
  for (const s of sessions) {
    for (const exId of new Set(s.items.map((i) => i.exerciseId))) {
      if (out[exId]) out[exId].times++;
      else out[exId] = { date: s.date.toISOString(), title: s.title, who: s.group?.name ?? s.athlete?.name ?? "", times: 1 };
    }
  }
  return out;
}

export type ExerciseHistory = { date: string; kg: number | null; reps: number | null; note: string | null };

/**
 * Datos del alumno para armar la sesión: su RM por ejercicio y lo que fue anotando
 * (kilos usados y notas) en las últimas semanas. Solo aplica a sesiones individuales.
 */
export async function athleteExerciseContext(target: string): Promise<{ rms: Record<string, number>; history: Record<string, ExerciseHistory[]> }> {
  const u = await requireUser(["COACH", "ADMIN"]);
  const [kind, athleteId] = (target || "").split(":");
  if (kind !== "a" || !athleteId) return { rms: {}, history: {} };
  await assertAthlete(u, athleteId);
  const rms = Object.fromEntries([...(await latestRMs(athleteId)).entries()].map(([k, v]) => [k, v.kg]));
  const logs = await db.workoutLog.findMany({
    where: { athleteId, completedAt: { gte: new Date(Date.now() - 60 * 86400000) } },
    orderBy: { completedAt: "desc" }, take: 40,
    select: { completedAt: true, sets: { select: { reps: true, loadKg: true, item: { select: { exerciseId: true } } } }, itemNotes: { select: { note: true, item: { select: { exerciseId: true } } } } },
  });
  const history: Record<string, ExerciseHistory[]> = {};
  for (const l of logs) {
    const ex = new Set([...l.sets.map((x) => x.item.exerciseId), ...l.itemNotes.map((x) => x.item.exerciseId)]);
    for (const id of ex) {
      const sets = l.sets.filter((x) => x.item.exerciseId === id && x.loadKg);
      const top = sets.sort((a, b) => (b.loadKg ?? 0) - (a.loadKg ?? 0))[0];
      (history[id] ??= []).length < 4 && history[id].push({ date: l.completedAt.toISOString(), kg: top?.loadKg ?? null, reps: top?.reps ?? null, note: l.itemNotes.find((x) => x.item.exerciseId === id)?.note ?? null });
    }
  }
  return { rms, history };
}

"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { sanitizeRoutine, cloneRoutine, cloneDay, fitDay, emptyRoutine, type RoutineData } from "@/lib/routine";

const json = (d: RoutineData) => d as unknown as Prisma.InputJsonValue;

/** La rutina tiene que ser del club y, si es de un alumno, de uno que el entrenador ve. */
async function ownRoutine(u: SessionUser, id: string) {
  const r = await db.routine.findUnique({ where: { id } });
  if (!r || r.orgId !== u.orgId) throw new Error("Rutina no encontrada");
  if (r.athleteId) await assertAthlete(u, r.athleteId);
  return r;
}

async function snapshot(routineId: string, name: string, data: unknown, byId: string, label?: string) {
  await db.routineSnapshot.create({ data: { routineId, name, data: data as Prisma.InputJsonValue, byId, label: label || null } });
  const old = await db.routineSnapshot.findMany({ where: { routineId }, orderBy: { createdAt: "desc" }, skip: 60, select: { id: true } });
  if (old.length) await db.routineSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

/** Guardar una versión a mano, con un nombre (ej: "antes del torneo"). */
async function _saveSnapshot(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  await snapshot(r.id, r.name, r.data, u.id, String(fd.get("label") ?? "").trim().slice(0, 60));
  revalidatePath(`/app/routines/${r.id}/historial`);
}

/** Vuelve el plan a como estaba en esa versión. Antes guarda cómo está ahora, así nada se pierde. */
async function _restoreSnapshot(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const snap = await db.routineSnapshot.findUnique({ where: { id: String(fd.get("snapshotId")) } });
  if (!snap) throw new Error("Versión no encontrada");
  const r = await ownRoutine(u, snap.routineId);
  await snapshot(r.id, r.name, r.data, u.id, "Antes de volver a una versión anterior");
  await db.routine.update({ where: { id: r.id }, data: { name: snap.name, data: snap.data as Prisma.InputJsonValue } });
  await audit(u, "RESTAURAR", "Rutina", `${r.name} → versión del ${snap.createdAt.toISOString().slice(0, 10)}`, r.id);
  revalidatePath("/app/routine");
  redirect(`/app/routines/${r.id}?restaurada=1`);
}

/** Deja la rutina activa del alumno como versión guardada (no se borra nada). */
async function archiveActive(athleteId: string) {
  await db.routine.updateMany({ where: { athleteId, active: true, extra: false }, data: { active: false } });
}

async function tellAthlete(athleteId: string, title: string) {
  await notify([athleteId], { kind: "SESION", title, body: "Entrá a Mi rutina para verla.", link: "/app/routine" });
}

async function _createRoutine(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId") ?? "") || null;
  const templateId = String(fd.get("templateId") ?? "") || null;
  let data = emptyRoutine();
  let name = String(fd.get("name") ?? "").trim();
  if (templateId) {
    const t = await ownRoutine(u, templateId);
    data = cloneRoutine(sanitizeRoutine(t.data));
    data.meta.start = "";
    name ||= t.name;
  }
  if (athleteId) {
    await assertAthlete(u, athleteId);
    const a = await db.user.findUnique({ where: { id: athleteId }, select: { name: true } });
    name ||= `Rutina de ${a?.name.split(" ")[0] ?? "alumno"}`;
    await archiveActive(athleteId);
  }
  const r = await db.routine.create({ data: { orgId: u.orgId, athleteId, coachId: u.id, name: name || "Plantilla nueva", template: !athleteId, data: json(data) } });
  await audit(u, "CREAR", "Rutina", r.name, r.id);
  redirect(`/app/routines/${r.id}`);
}

/** Guarda lo que se editó en la planilla. Recuerda el link de video de cada ejercicio para todo el club. */
export async function saveRoutine(id: string, name: string, raw: unknown) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, id);
  const data = sanitizeRoutine(raw);
  const clean = name.trim().slice(0, 80) || r.name;
  // Historial: guarda cómo estaba antes, como mucho una foto cada 30 minutos de edición.
  if (JSON.stringify(sanitizeRoutine(r.data)) !== JSON.stringify(data) || clean !== r.name) {
    const last = await db.routineSnapshot.findFirst({ where: { routineId: id }, orderBy: { createdAt: "desc" } });
    if (!last || Date.now() - +last.createdAt > 30 * 60_000) await snapshot(r.id, r.name, r.data, u.id);
  }
  await db.routine.update({ where: { id }, data: { name: clean, data: json(data) } });
  // Videos: si una fila es de la biblioteca y le pegaron un link, queda guardado para ese ejercicio.
  const pairs = new Map<string, string>();
  for (const row of [...data.warmup, ...data.days.flatMap((d) => d.blocks.flatMap((b) => b.rows))]) if (row.exerciseId && row.video) pairs.set(row.exerciseId, row.video);
  if (pairs.size) {
    const exs = await db.exercise.findMany({ where: { id: { in: [...pairs.keys()] }, OR: [{ orgId: null }, { orgId: u.orgId }] }, select: { id: true } });
    for (const { id: exerciseId } of exs) {
      const url = pairs.get(exerciseId)!;
      await db.exerciseLink.upsert({ where: { orgId_exerciseId: { orgId: u.orgId, exerciseId } }, create: { orgId: u.orgId, exerciseId, url }, update: { url } });
    }
  }
  if (r.athleteId && r.active && Date.now() - +r.updatedAt > 6 * 3600_000) await tellAthlete(r.athleteId, "Tu entrenador actualizó tu rutina");
  revalidatePath(`/app/routines/${id}`);
  revalidatePath("/app/routine");
  revalidatePath("/app");
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Pasa la rutina entera a otro alumno. La que tenía queda en "Versiones guardadas". */
async function _copyRoutine(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  const to = String(fd.get("athleteId") ?? "");
  await assertAthlete(u, to);
  const data = cloneRoutine(sanitizeRoutine(r.data));
  const start = String(fd.get("start") ?? "");
  data.meta.start = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : data.meta.start;
  const a = await db.user.findUnique({ where: { id: to }, select: { name: true } });
  await archiveActive(to);
  const copy = await db.routine.create({ data: { orgId: u.orgId, athleteId: to, coachId: u.id, name: String(fd.get("name") ?? "").trim() || r.name, data: json(data) } });
  await tellAthlete(to, "Tenés una rutina nueva");
  await audit(u, "COPIAR", "Rutina", `${r.name} → ${a?.name}`, copy.id);
  redirect(`/app/routines/${copy.id}?copiada=1`);
}

/** Pasa un día (con sus bloques y ejercicios) a la rutina activa de otro alumno, al final. */
export async function copyDay(fromId: string, dayId: string, toAthleteId: string) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, fromId);
  await assertAthlete(u, toAthleteId);
  const day = sanitizeRoutine(r.data).days.find((d) => d.id === dayId);
  if (!day) throw new Error("Guardá los cambios antes de copiar el día");
  let target = await db.routine.findFirst({ where: { athleteId: toAthleteId, active: true, extra: false }, orderBy: { updatedAt: "desc" } });
  const a = await db.user.findUnique({ where: { id: toAthleteId }, select: { name: true } });
  if (!target) target = await db.routine.create({ data: { orgId: u.orgId, athleteId: toAthleteId, coachId: u.id, name: `Rutina de ${a?.name.split(" ")[0] ?? "alumno"}`, data: json({ ...emptyRoutine(), days: [], weeks: sanitizeRoutine(r.data).weeks }) } });
  const data = sanitizeRoutine(target.data);
  data.days.push(fitDay(cloneDay(day), data.weeks));
  await db.routine.update({ where: { id: target.id }, data: { data: json(data) } });
  await tellAthlete(toAthleteId, `Se agregó “${day.name}” a tu rutina`);
  await audit(u, "COPIAR", "Rutina", `${day.name} → ${a?.name}`, target.id);
  revalidatePath(`/app/routines/${target.id}`);
  return { ok: true, name: a?.name ?? "", targetId: target.id };
}

async function _saveAsTemplate(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  const data = cloneRoutine(sanitizeRoutine(r.data));
  data.meta.start = "";
  const t = await db.routine.create({ data: { orgId: u.orgId, coachId: u.id, template: true, name: String(fd.get("name") ?? "").trim() || `${r.name} (plantilla)`, data: json(data) } });
  await audit(u, "CREAR", "Plantilla de rutina", t.name, t.id);
  redirect(`/app/routines/${t.id}`);
}

/** Vuelve a poner una versión guardada como la rutina actual (la actual pasa a versiones). */
async function _restoreVersion(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  if (!r.athleteId) throw new Error("Solo las rutinas de un alumno tienen versiones");
  await archiveActive(r.athleteId);
  await db.routine.update({ where: { id: r.id }, data: { active: true, startsOn: null } });
  await audit(u, "RESTAURAR", "Rutina", r.name, r.id);
  redirect(`/app/routines/${r.id}`);
}

/** Reemplaza todo el plan del alumno por una plantilla. Lo que tenía queda en versiones. */
async function _replaceWithTemplate(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  const t = await ownRoutine(u, String(fd.get("templateId")));
  if (!r.athleteId || !t.template) throw new Error("Elegí una plantilla");
  const data = cloneRoutine(sanitizeRoutine(t.data));
  data.meta.start = sanitizeRoutine(r.data).meta.start;
  data.meta.notice = sanitizeRoutine(r.data).meta.notice;
  await archiveActive(r.athleteId);
  const n = await db.routine.create({ data: { orgId: u.orgId, athleteId: r.athleteId, coachId: u.id, name: t.name, data: json(data) } });
  await tellAthlete(r.athleteId, "Tenés una rutina nueva");
  await audit(u, "REEMPLAZAR", "Rutina", `${r.name} → ${t.name}`, n.id);
  redirect(`/app/routines/${n.id}`);
}

/** Empieza un plan en blanco. El actual queda en versiones. */
async function _newPlan(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  if (!r.athleteId) throw new Error("Sin alumno");
  const data = emptyRoutine();
  data.meta.notice = sanitizeRoutine(r.data).meta.notice;
  await archiveActive(r.athleteId);
  const n = await db.routine.create({ data: { orgId: u.orgId, athleteId: r.athleteId, coachId: u.id, name: String(fd.get("name") ?? "").trim() || "Plan nuevo", data: json(data) } });
  redirect(`/app/routines/${n.id}`);
}

/** Rutina extra (además del plan principal): por ejemplo, una de vacaciones o de prevención. */
async function _addExtra(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const templateId = String(fd.get("templateId") ?? "");
  let data = emptyRoutine();
  let name = String(fd.get("name") ?? "").trim();
  if (templateId) { const t = await ownRoutine(u, templateId); data = cloneRoutine(sanitizeRoutine(t.data)); data.meta.start = ""; name ||= t.name; }
  const n = await db.routine.create({ data: { orgId: u.orgId, athleteId, coachId: u.id, extra: true, name: name || "Rutina extra", data: json(data) } });
  await tellAthlete(athleteId, `Tenés una rutina extra: ${n.name}`);
  redirect(`/app/routines/${n.id}`);
}

/** Próximo plan: queda guardado y pasa a ser el actual en la fecha elegida. */
async function _scheduleNext(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const start = String(fd.get("start") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("Elegí la fecha en que empieza");
  const templateId = String(fd.get("templateId") ?? "");
  let data = emptyRoutine();
  let name = String(fd.get("name") ?? "").trim();
  if (templateId) { const t = await ownRoutine(u, templateId); data = cloneRoutine(sanitizeRoutine(t.data)); name ||= t.name; }
  data.meta.start = start;
  const n = await db.routine.create({ data: { orgId: u.orgId, athleteId, coachId: u.id, active: false, startsOn: new Date(`${start}T00:00:00-03:00`), name: name || `Plan desde ${start.split("-").reverse().join("/")}`, data: json(data) } });
  redirect(`/app/routines/${n.id}`);
}

async function _deleteRoutine(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  if (r.athleteId && r.active && !r.extra) throw new Error("La rutina actual no se borra; pasale otra o restaurá una versión");
  await db.routine.delete({ where: { id: r.id } });
  await audit(u, "ELIMINAR", "Rutina", r.name, r.id);
  redirect(r.athleteId ? `/app/athletes/${r.athleteId}?tab=rutina` : "/app/routines");
}

export async function saveSnapshot(fd: FormData) { return runAction("saveSnapshot", _saveSnapshot, fd); }
export async function restoreSnapshot(fd: FormData) { return runAction("restoreSnapshot", _restoreSnapshot, fd); }
export async function createRoutine(fd: FormData) { return runAction("createRoutine", _createRoutine, fd); }
export async function copyRoutine(fd: FormData) { return runAction("copyRoutine", _copyRoutine, fd); }
export async function saveAsTemplate(fd: FormData) { return runAction("saveAsTemplate", _saveAsTemplate, fd); }
export async function restoreVersion(fd: FormData) { return runAction("restoreVersion", _restoreVersion, fd); }
export async function replaceWithTemplate(fd: FormData) { return runAction("replaceWithTemplate", _replaceWithTemplate, fd); }
export async function newPlan(fd: FormData) { return runAction("newPlan", _newPlan, fd); }
export async function addExtra(fd: FormData) { return runAction("addExtra", _addExtra, fd); }
export async function scheduleNext(fd: FormData) { return runAction("scheduleNext", _scheduleNext, fd); }
export async function deleteRoutine(fd: FormData) { return runAction("deleteRoutine", _deleteRoutine, fd); }

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { sanitizeRoutine, cloneRoutine, cloneDay, fitDay, emptyRoutine, type RoutineData } from "@/lib/routine";

const json = (d: RoutineData) => d as unknown as Prisma.InputJsonValue;

/** La rutina tiene que ser del club y, si es de un deportista, de uno que el entrenador ve. */
async function ownRoutine(u: SessionUser, id: string) {
  const r = await db.routine.findUnique({ where: { id } });
  if (!r || r.orgId !== u.orgId) throw new Error("Rutina no encontrada");
  if (r.athleteId) await assertAthlete(u, r.athleteId);
  return r;
}

/** Deja la rutina activa del deportista como versión guardada (no se borra nada). */
async function archiveActive(athleteId: string) {
  await db.routine.updateMany({ where: { athleteId, active: true }, data: { active: false } });
}

async function tellAthlete(athleteId: string, title: string) {
  await notify([athleteId], { kind: "SESION", title, body: "Entrá a Mi rutina para verla.", link: "/app/routine" });
}

export async function createRoutine(fd: FormData) {
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
    name ||= `Rutina de ${a?.name.split(" ")[0] ?? "deportista"}`;
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
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Pasa la rutina entera a otro deportista. La que tenía queda en "Versiones guardadas". */
export async function copyRoutine(fd: FormData) {
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

/** Pasa un día (con sus bloques y ejercicios) a la rutina activa de otro deportista, al final. */
export async function copyDay(fromId: string, dayId: string, toAthleteId: string) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, fromId);
  await assertAthlete(u, toAthleteId);
  const day = sanitizeRoutine(r.data).days.find((d) => d.id === dayId);
  if (!day) throw new Error("Guardá los cambios antes de copiar el día");
  let target = await db.routine.findFirst({ where: { athleteId: toAthleteId, active: true }, orderBy: { updatedAt: "desc" } });
  const a = await db.user.findUnique({ where: { id: toAthleteId }, select: { name: true } });
  if (!target) target = await db.routine.create({ data: { orgId: u.orgId, athleteId: toAthleteId, coachId: u.id, name: `Rutina de ${a?.name.split(" ")[0] ?? "deportista"}`, data: json({ ...emptyRoutine(), days: [], weeks: sanitizeRoutine(r.data).weeks }) } });
  const data = sanitizeRoutine(target.data);
  data.days.push(fitDay(cloneDay(day), data.weeks));
  await db.routine.update({ where: { id: target.id }, data: { data: json(data) } });
  await tellAthlete(toAthleteId, `Se agregó “${day.name}” a tu rutina`);
  await audit(u, "COPIAR", "Rutina", `${day.name} → ${a?.name}`, target.id);
  revalidatePath(`/app/routines/${target.id}`);
  return { ok: true, name: a?.name ?? "", targetId: target.id };
}

export async function saveAsTemplate(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  const data = cloneRoutine(sanitizeRoutine(r.data));
  data.meta.start = "";
  const t = await db.routine.create({ data: { orgId: u.orgId, coachId: u.id, template: true, name: String(fd.get("name") ?? "").trim() || `${r.name} (plantilla)`, data: json(data) } });
  await audit(u, "CREAR", "Plantilla de rutina", t.name, t.id);
  redirect(`/app/routines/${t.id}`);
}

/** Vuelve a poner una versión guardada como la rutina actual (la actual pasa a versiones). */
export async function restoreVersion(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  if (!r.athleteId) throw new Error("Solo las rutinas de un deportista tienen versiones");
  await archiveActive(r.athleteId);
  await db.routine.update({ where: { id: r.id }, data: { active: true } });
  await audit(u, "RESTAURAR", "Rutina", r.name, r.id);
  redirect(`/app/routines/${r.id}`);
}

export async function deleteRoutine(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const r = await ownRoutine(u, String(fd.get("id")));
  if (r.athleteId && r.active) throw new Error("La rutina actual no se borra; pasale otra o restaurá una versión");
  await db.routine.delete({ where: { id: r.id } });
  await audit(u, "ELIMINAR", "Rutina", r.name, r.id);
  redirect(r.athleteId ? `/app/athletes/${r.athleteId}?tab=rutina` : "/app/routines");
}

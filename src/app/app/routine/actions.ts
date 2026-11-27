"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateOnly } from "@/lib/metrics";
import { notify } from "@/lib/access";

/** El alumno marca (o desmarca) que ya hizo un ejercicio de su rutina, hoy. */
export async function toggleCheck(routineId: string, dayId: string, rowId: string, done: boolean) {
  const u = await requireUser(["ATHLETE"]);
  const r = await db.routine.findUnique({ where: { id: routineId }, select: { athleteId: true } });
  if (!r || r.athleteId !== u.id) throw new Error("Rutina no encontrada");
  const date = dateOnly(new Date());
  if (done) {
    await db.routineCheck.upsert({
      where: { routineId_date_rowId: { routineId, date, rowId: rowId.slice(0, 40) } },
      create: { routineId, athleteId: u.id, date, dayId: dayId.slice(0, 40), rowId: rowId.slice(0, 40) },
      update: {},
    });
  } else {
    await db.routineCheck.deleteMany({ where: { routineId, date, rowId } });
  }
  return { ok: true };
}

/** El alumno anota cuánto levantó, una nota y si algo le molestó. También marca el ejercicio como hecho. */
export async function saveCheckNote(routineId: string, dayId: string, rowId: string, input: { kg: string; note: string; molestia: boolean; exercise: string }) {
  const u = await requireUser(["ATHLETE"]);
  const r = await db.routine.findUnique({ where: { id: routineId }, select: { athleteId: true, orgId: true } });
  if (!r || r.athleteId !== u.id) throw new Error("Rutina no encontrada");
  const date = dateOnly(new Date());
  const kg = String(input.kg ?? "").trim().slice(0, 60) || null;
  const note = String(input.note ?? "").trim().slice(0, 300) || null;
  const molestia = !!input.molestia;
  const key = { routineId_date_rowId: { routineId, date, rowId: rowId.slice(0, 40) } };
  const prev = await db.routineCheck.findUnique({ where: key, select: { molestia: true } });
  await db.routineCheck.upsert({
    where: key,
    create: { routineId, athleteId: u.id, date, dayId: dayId.slice(0, 40), rowId: rowId.slice(0, 40), kg, note, molestia },
    update: { kg, note, molestia },
  });
  // Si avisó una molestia nueva, le llega al preparador.
  if (molestia && !prev?.molestia) {
    const staff = await db.user.findMany({ where: { orgId: r.orgId, role: { in: ["ADMIN", "COACH"] } }, select: { id: true } });
    const ex = String(input.exercise ?? "").slice(0, 80);
    if (staff.length) await notify(staff.map((s) => s.id), { kind: "MOLESTIA", title: `${u.name} avisó una molestia${ex ? ` en ${ex}` : ""}`, body: note ?? undefined, link: `/app/athletes/${u.id}?tab=rutina` });
  }
  return { ok: true };
}

/** El alumno da por terminado el día: cuánto le costó (1-10) y cuántos minutos duró. */
export async function finishDay(routineId: string, dayId: string, rpe: number, minutes: number) {
  const u = await requireUser(["ATHLETE"]);
  const r = await db.routine.findUnique({ where: { id: routineId }, select: { athleteId: true } });
  if (!r || r.athleteId !== u.id) throw new Error("Rutina no encontrada");
  const e = Math.min(10, Math.max(1, Math.round(Number(rpe) || 0)));
  const m = Math.min(300, Math.max(5, Math.round(Number(minutes) || 0)));
  const date = dateOnly(new Date());
  const data = { rpe: e, durationMin: m, load: e * m };
  await db.routineSession.upsert({
    where: { routineId_date_dayId: { routineId, date, dayId: dayId.slice(0, 40) } },
    create: { routineId, athleteId: u.id, date, dayId: dayId.slice(0, 40), ...data },
    update: data,
  });
  return { ok: true };
}

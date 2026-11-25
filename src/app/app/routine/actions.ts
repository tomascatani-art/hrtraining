"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateOnly } from "@/lib/metrics";

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

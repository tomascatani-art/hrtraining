"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { parseDay } from "@/lib/metrics";

/** Carga un RM nuevo. Queda en el historial y le avisa a la otra parte (entrenador o alumno). */
async function _saveRM(fd: FormData) {
  const u = await requireUser();
  const athleteId = u.role === "ATHLETE" ? u.id : String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const exerciseId = String(fd.get("exerciseId") ?? "");
  const kg = Number(String(fd.get("kg") ?? "").replace(",", "."));
  if (!exerciseId || !(kg > 0 && kg < 1000)) throw new Error("Elegí un ejercicio y un peso válido");
  const ex = await db.exercise.findFirst({ where: { id: exerciseId, OR: [{ orgId: null }, { orgId: u.orgId }] } });
  if (!ex) throw new Error("Ejercicio no encontrado");
  const dateStr = String(fd.get("date") ?? "");
  const prev = await db.exerciseRM.findFirst({ where: { athleteId, exerciseId }, orderBy: { date: "desc" } });
  await db.exerciseRM.create({
    data: { athleteId, exerciseId, kg, date: dateStr ? parseDay(dateStr, 12) : new Date(), setById: u.id, source: u.role === "ATHLETE" ? "DEPORTISTA" : "ENTRENADOR" },
  });
  const change = prev ? `${fmt(prev.kg)} → ${fmt(kg)} kg` : `${fmt(kg)} kg`;
  if (u.role === "ATHLETE") {
    const coachId = (await db.athleteProfile.findUnique({ where: { userId: u.id } }))?.coachId;
    if (coachId) await notify([coachId], { kind: "RM", title: `${u.name} cargó su RM de ${ex.name}`, body: change, link: `/app/athletes/${u.id}?tab=rm` });
  } else {
    await notify([athleteId], { kind: "RM", title: `Tu RM de ${ex.name} se actualizó`, body: change, link: "/app/rm" });
    await audit(u, "EDITAR", "RM", `${ex.name}: ${change}`, athleteId);
  }
  revalidatePath("/app/rm");
  revalidatePath(`/app/athletes/${athleteId}`);
  revalidatePath("/app");
}

/** Marca como vistos los RM que cargó la otra parte. */
async function _markRMSeen(fd: FormData) {
  const u = await requireUser();
  const ids = fd.getAll("id").map(String);
  const rows = await db.exerciseRM.findMany({ where: { id: { in: ids } } });
  for (const r of rows) await assertAthlete(u, r.athleteId);
  await db.exerciseRM.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { seen: true } });
  revalidatePath("/app");
  revalidatePath("/app/rm");
}

async function _deleteRM(fd: FormData) {
  const u = await requireUser();
  const r = await db.exerciseRM.findUnique({ where: { id: String(fd.get("id")) } });
  if (!r) return;
  await assertAthlete(u, r.athleteId);
  if (u.role === "ATHLETE" && r.setById !== u.id) throw new Error("Solo podés borrar los RM que cargaste vos");
  await db.exerciseRM.delete({ where: { id: r.id } });
  revalidatePath("/app/rm");
  revalidatePath(`/app/athletes/${r.athleteId}`);
}

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

export async function saveRM(fd: FormData) { return runAction("saveRM", _saveRM, fd); }
export async function markRMSeen(fd: FormData) { return runAction("markRMSeen", _markRMSeen, fd); }
export async function deleteRM(fd: FormData) { return runAction("deleteRM", _deleteRM, fd); }

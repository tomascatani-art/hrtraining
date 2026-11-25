"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { parseDay } from "@/lib/metrics";
import { ANTHRO_FIELDS } from "@/lib/anthropometry";

function refresh(athleteId: string) {
  revalidatePath(`/app/athletes/${athleteId}`);
  revalidatePath("/app/folder");
}

/** Guarda una medición. La carga el entrenador; el alumno la ve en su carpeta. */
export async function saveAnthropometry(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const data: Record<string, number | null> = {};
  let filled = 0;
  for (const f of ANTHRO_FIELDS) {
    const raw = String(fd.get(f.key) ?? "").trim().replace(",", ".");
    if (!raw) { data[f.key] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < f.min || n > f.max) throw new Error(`${f.label}: valor fuera de rango (${f.min}–${f.max} ${f.unit})`);
    data[f.key] = n; filled++;
  }
  if (!filled) throw new Error("Cargá al menos un valor");
  const dateStr = String(fd.get("date") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  const row = await db.anthropometry.create({ data: { athleteId, measuredById: u.id, date: dateStr ? parseDay(dateStr, 12) : new Date(), note, ...data } });
  if (data.weightKg || data.heightCm) {
    await db.athleteProfile.update({ where: { userId: athleteId }, data: { ...(data.weightKg ? { weightKg: data.weightKg } : {}), ...(data.heightCm ? { heightCm: data.heightCm } : {}) } }).catch(() => undefined);
  }
  await notify([athleteId], { kind: "MENSAJE", title: "Nueva medición antropométrica", body: "Tu entrenador cargó una medición. Mirá tu evolución en Mi carpeta.", link: "/app/folder" });
  await audit(u, "CREAR", "Antropometría", `Medición del ${row.date.toLocaleDateString("es-AR")}`, athleteId);
  refresh(athleteId);
}

export async function deleteAnthropometry(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const row = await db.anthropometry.findUnique({ where: { id: String(fd.get("id")) } });
  if (!row) return;
  await assertAthlete(u, row.athleteId);
  await db.anthropometry.delete({ where: { id: row.id } });
  await audit(u, "ELIMINAR", "Antropometría", `Medición del ${row.date.toLocaleDateString("es-AR")}`, row.athleteId);
  refresh(row.athleteId);
}

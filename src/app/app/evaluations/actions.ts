"use server";
import { parseDay } from "@/lib/metrics";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { TEST_MAP, FMS_COMPONENTS } from "@/lib/catalog";

/** Guarda una batería de tests para uno o varios alumnos. Campos: v__<athleteId>__<testKey> */
export async function saveBattery(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const date = parseDay(String(fd.get("date")), 12);
  const notes = String(fd.get("notes") ?? "") || null;
  const videoId = String(fd.get("videoId") ?? "") || null;
  const rows = new Map<string, Map<string, number>>();
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("v__") || String(v).trim() === "") continue;
    const [, athleteId, testKey] = k.split("__");
    const n = Number(String(v).replace(",", "."));
    if (!isFinite(n) || !TEST_MAP[testKey]) continue;
    if (!rows.has(athleteId)) rows.set(athleteId, new Map());
    rows.get(athleteId)!.set(testKey, n);
  }
  let count = 0;
  for (const [athleteId, tests] of rows) {
    await assertAthlete(u, athleteId);
    const fmsParts = FMS_COMPONENTS.filter((c) => tests.has(c));
    if (fmsParts.length === FMS_COMPONENTS.length && !tests.has("FMS_TOTAL")) {
      tests.set("FMS_TOTAL", fmsParts.reduce((a, c) => a + tests.get(c)!, 0));
    }
    const data = [...tests.entries()].map(([testKey, value]) => ({
      athleteId, coachId: u.id, testKey, value, unit: TEST_MAP[testKey].unit, date, notes, videoId,
      details: testKey === "FMS_TOTAL" && fmsParts.length ? Object.fromEntries(fmsParts.map((c) => [c, tests.get(c)!])) : undefined,
    }));
    // Los componentes FMS se guardan dentro del total para no duplicar series
    const toSave = fmsParts.length === FMS_COMPONENTS.length ? data.filter((d) => !FMS_COMPONENTS.includes(d.testKey)) : data;
    await db.evaluation.createMany({ data: toSave });
    count += toSave.length;
    await notify([athleteId], { kind: "EVALUACION", title: "Nuevos resultados de evaluación", body: `${toSave.length} tests registrados`, link: "/app/evaluations" });
  }
  if (!count) throw new Error("No se cargó ningún resultado");
  await audit(u, "CREAR", "Evaluación", `${count} resultados (${rows.size} alumnos)`);
  revalidatePath("/app/evaluations");
  const single = rows.size === 1 ? [...rows.keys()][0] : null;
  redirect(single ? `/app/athletes/${single}?tab=evaluaciones` : "/app/evaluations?ok=1");
}

export async function deleteEvaluation(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const e = await db.evaluation.findUnique({ where: { id: String(fd.get("id")) } });
  if (!e) return;
  await assertAthlete(u, e.athleteId);
  await db.evaluation.delete({ where: { id: e.id } });
  await audit(u, "ELIMINAR", "Evaluación", `${TEST_MAP[e.testKey]?.name ?? e.testKey}: ${e.value} ${e.unit}`, e.id);
  revalidatePath("/app/evaluations");
}

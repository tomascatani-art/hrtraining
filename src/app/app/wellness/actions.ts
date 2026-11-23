"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/access";
import { computeAlerts, startOfDay, addDays, dateOnly } from "@/lib/metrics";

export async function saveWellness(fd: FormData) {
  const u = await requireUser(["ATHLETE"]);
  const clamp = (k: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(fd.get(k) ?? lo))));
  const date = dateOnly(new Date());
  const data = {
    sleepHours: fd.get("sleepHours") ? Number(fd.get("sleepHours")) : null,
    sleepQuality: clamp("sleepQuality", 1, 5), fatigue: clamp("fatigue", 1, 5), soreness: clamp("soreness", 1, 5),
    stress: clamp("stress", 1, 5), mood: clamp("mood", 1, 5), readiness: clamp("readiness", 1, 10),
    painArea: String(fd.get("painArea") ?? "").trim() || null, notes: String(fd.get("notes") ?? "").trim() || null,
  };
  await db.wellness.upsert({ where: { athleteId_date: { athleteId: u.id, date } }, create: { ...data, athleteId: u.id, date }, update: data });

  // Avisar al entrenador si aparece una alerta de nivel "Atención"
  const since = addDays(startOfDay(new Date()), -42);
  const [w, logs] = await Promise.all([
    db.wellness.findMany({ where: { athleteId: u.id, date: { gte: since } } }),
    db.workoutLog.findMany({ where: { athleteId: u.id, completedAt: { gte: since }, load: { not: null } } }),
  ]);
  const alerts = computeAlerts(w, logs.map((l) => ({ date: l.completedAt, load: l.load ?? 0 }))).filter((a) => a.level === "ATENCION" && a.kind !== "CARGA");
  const coachId = u.athleteProfile?.coachId;
  if (alerts.length && coachId) {
    await notify([coachId], { kind: "ALERTA", title: `${u.name}: ${alerts[0].title.toLowerCase()}`, body: alerts[0].detail, link: `/app/athletes/${u.id}?tab=carga` });
  }
  revalidatePath("/app");
  redirect("/app/wellness?ok=1");
}

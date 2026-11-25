"use server";
import { parseDay } from "@/lib/metrics";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";

export async function saveCompetition(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = String(fd.get("id") ?? "");
  const [kind, targetId] = String(fd.get("target") ?? "").split(":");
  if (kind === "a") await assertAthlete(u, targetId);
  else if (kind === "g") { const g = await db.group.findUnique({ where: { id: targetId } }); if (!g || g.orgId !== u.orgId) throw new Error("Grupo inválido"); }
  else throw new Error("Elegí alumno o grupo");
  const data = {
    name: String(fd.get("name") ?? "").trim(), date: parseDay(String(fd.get("date")), 12), location: String(fd.get("location") ?? "") || null,
    sport: String(fd.get("sport") ?? "GENERAL"), priority: String(fd.get("priority") ?? "B"),
    result: String(fd.get("result") ?? "") || null, mark: String(fd.get("mark") ?? "") || null,
    position: fd.get("position") ? Number(fd.get("position")) : null,
    athleteId: kind === "a" ? targetId : null, groupId: kind === "g" ? targetId : null,
  };
  if (!data.name) throw new Error("Nombre requerido");
  if (id) {
    const c = await db.competition.findUnique({ where: { id } });
    if (!c || c.orgId !== u.orgId) throw new Error("Competencia no encontrada");
    await db.competition.update({ where: { id }, data });
  } else {
    await db.competition.create({ data: { ...data, orgId: u.orgId } });
    const ids = data.athleteId ? [data.athleteId] : (await db.groupMember.findMany({ where: { groupId: data.groupId! } })).map((m) => m.athleteId);
    await notify(ids, { kind: "COMPETENCIA", title: `Competencia: ${data.name}`, body: `${data.date.toLocaleDateString("es-AR")}${data.location ? ` · ${data.location}` : ""} · faltan ${Math.max(0, Math.round((+new Date(data.date.toDateString()) - +new Date(new Date().toDateString())) / 86400000))} días`, link: "/app" });
  }
  await audit(u, id ? "EDITAR" : "CREAR", "Competencia", data.name);
  revalidatePath("/app/competitions");
}

export async function deleteCompetition(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const c = await db.competition.findUnique({ where: { id: String(fd.get("id")) } });
  if (!c || c.orgId !== u.orgId) return;
  await db.competition.delete({ where: { id: c.id } });
  await audit(u, "ELIMINAR", "Competencia", c.name);
  revalidatePath("/app/competitions");
}

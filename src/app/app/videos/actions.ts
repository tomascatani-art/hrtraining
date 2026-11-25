"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { canAccessFile } from "@/lib/storage";

async function ownAnalysis(u: SessionUser, id: string) {
  const a = await db.videoAnalysis.findUnique({ where: { id } });
  if (!a) throw new Error("Análisis no encontrado");
  await assertAthlete(u, a.athleteId);
  return a;
}

export async function createAnalysis(fd: FormData) {
  const u = await requireUser();
  const video = await db.fileAsset.findUnique({ where: { id: String(fd.get("videoId")) } });
  if (!video || video.kind !== "VIDEO" || !(await canAccessFile(u, video))) throw new Error("Video inválido");
  const athleteId = u.role === "ATHLETE" ? u.id : String(fd.get("athleteId") || video.athleteId || "");
  if (!athleteId) throw new Error("Elegí el alumno");
  await assertAthlete(u, athleteId);
  const compareId = String(fd.get("compareId") ?? "") || null;
  if (compareId) {
    const c = await db.fileAsset.findUnique({ where: { id: compareId } });
    if (!c || !(await canAccessFile(u, c))) throw new Error("Video de comparación inválido");
  }
  const a = await db.videoAnalysis.create({ data: { athleteId, videoId: video.id, compareId, title: String(fd.get("title") || video.name), movement: String(fd.get("movement") ?? "") || null } });
  await audit(u, "CREAR", "Análisis de video", a.title, a.id);
  redirect(`/app/videos/${a.id}`);
}

export async function saveDrawings(id: string, drawings: unknown) {
  const u = await requireUser();
  const a = await ownAnalysis(u, id);
  if (!Array.isArray(drawings) || JSON.stringify(drawings).length > 200_000) throw new Error("Dibujo inválido");
  await db.videoAnalysis.update({ where: { id: a.id }, data: { drawings: drawings as object[] } });
  return { ok: true };
}

export async function addVideoComment(fd: FormData) {
  const u = await requireUser();
  const a = await ownAnalysis(u, String(fd.get("analysisId")));
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return;
  const at = fd.get("atSecond") ? Number(fd.get("atSecond")) : null;
  await db.videoComment.create({ data: { analysisId: a.id, authorId: u.id, body, atSecond: at } });
  const target = u.role === "ATHLETE" ? (u.athleteProfile?.coachId ? [u.athleteProfile.coachId] : []) : [a.athleteId];
  await notify(target, { kind: "VIDEO", title: `Nuevo comentario en "${a.title}"`, body, link: `/app/videos/${a.id}` });
  revalidatePath(`/app/videos/${a.id}`);
}

export async function setAnalysisStatus(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const a = await ownAnalysis(u, String(fd.get("id")));
  await db.videoAnalysis.update({ where: { id: a.id }, data: { status: String(fd.get("status")) === "REVISADO" ? "REVISADO" : "PENDIENTE" } });
  revalidatePath(`/app/videos/${a.id}`);
}

export async function deleteAnalysis(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const a = await ownAnalysis(u, String(fd.get("id")));
  await db.videoAnalysis.delete({ where: { id: a.id } });
  redirect("/app/videos");
}

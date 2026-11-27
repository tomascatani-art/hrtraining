"use server";
import { runAction } from "@/lib/action-error";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeLink } from "@/lib/video";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";

const list = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean);
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;

async function _saveExercise(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = s(fd, "id");
  const muscles = list(fd, "muscles");
  const data = {
    name: String(fd.get("name") ?? "").trim(), primaryMuscle: muscles[0] ?? "Cuerpo completo", muscles,
    kineticChain: String(fd.get("kineticChain") ?? "CERRADA"), pattern: String(fd.get("pattern") ?? "SENTADILLA"), category: s(fd, "category"),
    capacities: list(fd, "capacities"), sports: list(fd, "sports"), equipment: list(fd, "equipment"),
    difficulty: Number(fd.get("difficulty") ?? 2), objective: s(fd, "objective"), description: s(fd, "description"), cues: s(fd, "cues"),
    commonErrors: s(fd, "commonErrors"), variants: s(fd, "variants"), videoUrl: normalizeLink(s(fd, "videoUrl")), imageUrl: s(fd, "imageUrl"),
    suggestedSets: s(fd, "suggestedSets"), suggestedReps: s(fd, "suggestedReps"),
  };
  if (!data.name) throw new Error("El ejercicio necesita un nombre");
  if (s(fd, "videoUrl") && !data.videoUrl) throw new Error("Ese link de video no parece válido. Copialo de nuevo desde YouTube o Drive.");
  let exId = id;
  if (id) {
    const ex = await db.exercise.findUnique({ where: { id } });
    if (!ex || ex.orgId !== u.orgId) throw new Error("Solo podés editar ejercicios de tu organización");
    await db.exercise.update({ where: { id }, data });
  } else {
    exId = (await db.exercise.create({ data: { ...data, orgId: u.orgId, createdById: u.id } })).id;
  }
  await audit(u, id ? "EDITAR" : "CREAR", "Ejercicio", data.name, exId!);
  revalidatePath("/app/library");
  redirect(`/app/library/${exId}`);
}

async function _cloneExercise(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const ex = await db.exercise.findUnique({ where: { id: String(fd.get("id")) } });
  if (!ex || (ex.orgId && ex.orgId !== u.orgId)) throw new Error("Ejercicio no encontrado");
  const { id: _id, createdAt: _c, orgId: _o, createdById: _b, isDemo: _d, ...rest } = ex;
  const copy = await db.exercise.create({ data: { ...rest, name: `${ex.name} (personalizado)`, orgId: u.orgId, createdById: u.id } });
  redirect(`/app/library/${copy.id}/edit`);
}

async function _deleteExercise(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const ex = await db.exercise.findUnique({ where: { id: String(fd.get("id")) }, include: { _count: { select: { sessionItems: true } } } });
  if (!ex || ex.orgId !== u.orgId) throw new Error("Solo podés eliminar ejercicios de tu organización");
  if (ex._count.sessionItems > 0) throw new Error("El ejercicio está usado en sesiones; no se puede eliminar");
  await db.exercise.delete({ where: { id: ex.id } });
  await audit(u, "ELIMINAR", "Ejercicio", ex.name, ex.id);
  redirect("/app/library");
}

/** El club le pone (o cambia) el link de video a cualquier ejercicio, también a los de la biblioteca base. */
async function _setExerciseLink(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const exerciseId = String(fd.get("exerciseId") ?? "");
  const raw = String(fd.get("url") ?? "").trim();
  const url = normalizeLink(raw);
  const ex = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!ex || (ex.orgId && ex.orgId !== u.orgId)) throw new Error("Ejercicio no encontrado");
  if (!raw) await db.exerciseLink.deleteMany({ where: { orgId: u.orgId, exerciseId } });
  else {
    if (!url) throw new Error("Ese link no parece válido. Copialo de nuevo desde YouTube o Drive.");
    await db.exerciseLink.upsert({ where: { orgId_exerciseId: { orgId: u.orgId, exerciseId } }, create: { orgId: u.orgId, exerciseId, url }, update: { url } });
  }
  await audit(u, "EDITAR", "Ejercicio", `Video de ${ex.name}`, ex.id);
  revalidatePath("/app/library");
  revalidatePath(`/app/library/${ex.id}`);
}

export async function saveExercise(fd: FormData) { return runAction("saveExercise", _saveExercise, fd); }
export async function cloneExercise(fd: FormData) { return runAction("cloneExercise", _cloneExercise, fd); }
export async function deleteExercise(fd: FormData) { return runAction("deleteExercise", _deleteExercise, fd); }
export async function setExerciseLink(fd: FormData) { return runAction("setExerciseLink", _setExerciseLink, fd); }

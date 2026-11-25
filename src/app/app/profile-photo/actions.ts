"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeAthlete } from "@/lib/access";
import { putFile, removeFile } from "@/lib/storage";

async function canEditPhoto(u: Awaited<ReturnType<typeof requireUser>>, targetId: string) {
  if (targetId === u.id) return true;
  const t = await db.user.findUnique({ where: { id: targetId }, select: { orgId: true, role: true } });
  if (!t || t.orgId !== u.orgId) return false;
  if (u.role === "ADMIN") return true;
  return u.role === "COACH" && t.role === "ATHLETE" && (await canSeeAthlete(u, targetId));
}

/** Guarda la foto de perfil (ya recortada y achicada en el navegador). */
async function _setAvatar(fd: FormData) {
  const u = await requireUser();
  const userId = String(fd.get("userId") || u.id);
  if (!(await canEditPhoto(u, userId))) throw new Error("Sin permiso");
  const file = fd.get("photo");
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("Elegí una imagen");
  if (file.size > 1_500_000) throw new Error("La foto es muy pesada");
  const prev = await db.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  const key = await putFile(Buffer.from(await file.arrayBuffer()), "foto.jpg", "image/jpeg");
  await db.user.update({ where: { id: userId }, data: { avatarKey: key, avatarAt: new Date() } });
  if (prev?.avatarKey) await removeFile(prev.avatarKey);
  revalidatePath("/app", "layout");
}

async function _removeAvatar(fd: FormData) {
  const u = await requireUser();
  const userId = String(fd.get("userId") || u.id);
  if (!(await canEditPhoto(u, userId))) throw new Error("Sin permiso");
  const prev = await db.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  await db.user.update({ where: { id: userId }, data: { avatarKey: null, avatarAt: new Date() } });
  if (prev?.avatarKey) await removeFile(prev.avatarKey);
  revalidatePath("/app", "layout");
}

export async function setAvatar(fd: FormData) { return runAction("setAvatar", _setAvatar, fd); }
export async function removeAvatar(fd: FormData) { return runAction("removeAvatar", _removeAvatar, fd); }

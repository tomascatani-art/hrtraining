"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";
import { canAccessFile, removeFile } from "@/lib/storage";
import { PROFILE_FOLDERS } from "@/lib/catalog";

async function _deleteFile(fd: FormData) {
  const u = await requireUser();
  const f = await db.fileAsset.findUnique({ where: { id: String(fd.get("id")) } });
  if (!f || !(await canAccessFile(u, f))) throw new Error("Archivo no encontrado");
  if (f.ownerId !== u.id && u.role === "ATHLETE") throw new Error("Solo podés eliminar tus archivos");
  await db.fileAsset.delete({ where: { id: f.id } });
  await removeFile(f.storageKey);
  await audit(u, "ELIMINAR", "Archivo", f.name, f.id);
  revalidatePath("/app/files");
  revalidatePath("/app/videos");
  revalidatePath("/app/folder");
  if (f.athleteId) revalidatePath(`/app/athletes/${f.athleteId}`);
}

async function _toggleShare(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const f = await db.fileAsset.findUnique({ where: { id: String(fd.get("id")) } });
  if (!f || f.orgId !== u.orgId) return;
  await db.fileAsset.update({ where: { id: f.id }, data: { shared: !f.shared } });
  revalidatePath("/app/files");
}

async function _moveFile(fd: FormData) {
  const u = await requireUser();
  const f = await db.fileAsset.findUnique({ where: { id: String(fd.get("id")) } });
  if (!f || !f.athleteId || !(await canAccessFile(u, f))) throw new Error("Archivo no encontrado");
  if (u.role === "ATHLETE" && f.ownerId !== u.id) throw new Error("Solo podés mover tus archivos");
  const folder = String(fd.get("folder"));
  if (!PROFILE_FOLDERS.some((x) => x.key === folder)) return;
  await db.fileAsset.update({ where: { id: f.id }, data: { folder, shared: false } });
  revalidatePath(`/app/athletes/${f.athleteId}`);
  revalidatePath("/app/folder");
}

export async function deleteFile(fd: FormData) { return runAction("deleteFile", _deleteFile, fd); }
export async function toggleShare(fd: FormData) { return runAction("toggleShare", _toggleShare, fd); }
export async function moveFile(fd: FormData) { return runAction("moveFile", _moveFile, fd); }

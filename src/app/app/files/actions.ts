"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";
import { canAccessFile, removeFile } from "@/lib/storage";

export async function deleteFile(fd: FormData) {
  const u = await requireUser();
  const f = await db.fileAsset.findUnique({ where: { id: String(fd.get("id")) } });
  if (!f || !(await canAccessFile(u, f))) throw new Error("Archivo no encontrado");
  if (f.ownerId !== u.id && u.role === "ATHLETE") throw new Error("Solo podés eliminar tus archivos");
  await db.fileAsset.delete({ where: { id: f.id } });
  await removeFile(f.storageKey);
  await audit(u, "ELIMINAR", "Archivo", f.name, f.id);
  revalidatePath("/app/files");
  revalidatePath("/app/videos");
}

export async function toggleShare(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const f = await db.fileAsset.findUnique({ where: { id: String(fd.get("id")) } });
  if (!f || f.orgId !== u.orgId) return;
  await db.fileAsset.update({ where: { id: f.id }, data: { shared: !f.shared } });
  revalidatePath("/app/files");
}

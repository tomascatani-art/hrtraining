import "server-only";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { canSeeAthlete } from "./access";
import { putBuffer, removeKey, sizeOf, localStream, remoteStorage, signedReadUrl, signedUploadUrl } from "./blob";

// Archivos: en Supabase Storage si está configurado (recomendado en Vercel) o en disco local (UPLOAD_DIR).
export const MAX_UPLOAD = 300 * 1024 * 1024;
export { remoteStorage, signedReadUrl, signedUploadUrl };

export function kindOf(mime: string) {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("image/")) return "IMAGEN";
  return "DOCUMENTO";
}

export function newKey(originalName: string) {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}${ext}`;
}

export async function putFile(buf: Buffer, originalName: string, mime?: string) {
  const key = newKey(originalName);
  await putBuffer(key, buf, mime);
  return key;
}

export async function fileSize(key: string) {
  return sizeOf(key);
}
export function fileStream(key: string, opts?: { start: number; end: number }) {
  return localStream(key, opts);
}
export async function removeFile(key: string) {
  await removeKey(key);
}

export async function canAccessFile(u: SessionUser, f: { id: string; orgId: string; ownerId: string; athleteId: string | null; shared: boolean }) {
  if (f.orgId !== u.orgId) return false;
  if (f.ownerId === u.id || f.shared) return true;
  if (u.role !== "ATHLETE") return f.athleteId ? canSeeAthlete(u, f.athleteId) : true;
  if (f.athleteId === u.id) return true;
  const inChat = await db.message.count({ where: { fileId: f.id, conversation: { members: { some: { userId: u.id } } } } });
  return inChat > 0;
}

import "server-only";
import { mkdir, writeFile, stat, unlink } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { canSeeAthlete } from "./access";

// Almacenamiento en disco local. Interfaz pensada para reemplazar por S3/R2/Supabase Storage.
const ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
export const MAX_UPLOAD = 300 * 1024 * 1024;

export function kindOf(mime: string) {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("image/")) return "IMAGEN";
  return "DOCUMENTO";
}

export async function putFile(buf: Buffer, originalName: string) {
  await mkdir(ROOT, { recursive: true });
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
  const key = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}${ext}`;
  await writeFile(path.join(ROOT, key), buf);
  return key;
}

export async function fileStat(key: string) {
  return stat(path.join(ROOT, path.basename(key)));
}
export function fileStream(key: string, opts?: { start: number; end: number }) {
  return createReadStream(path.join(ROOT, path.basename(key)), opts);
}
export async function removeFile(key: string) {
  await unlink(path.join(ROOT, path.basename(key))).catch(() => undefined);
}

export async function canAccessFile(u: SessionUser, f: { id: string; orgId: string; ownerId: string; athleteId: string | null; shared: boolean }) {
  if (f.orgId !== u.orgId) return false;
  if (f.ownerId === u.id || f.shared) return true;
  if (u.role !== "ATHLETE") return f.athleteId ? canSeeAthlete(u, f.athleteId) : true;
  if (f.athleteId === u.id) return true;
  const inChat = await db.message.count({ where: { fileId: f.id, conversation: { members: { some: { userId: u.id } } } } });
  return inChat > 0;
}

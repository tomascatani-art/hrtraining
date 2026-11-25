import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { canSeeAthlete, audit, notify } from "./access";
import { kindOf, MAX_UPLOAD } from "./storage";
import { PROFILE_FOLDERS } from "./catalog";

const ALLOWED = /^(video\/|image\/|application\/pdf|application\/vnd\.|application\/msword|text\/plain|text\/csv)/;

export type UploadMeta = { name: string; type: string; size: number; athleteId: string | null; folder: string | null; note: string | null; shared: boolean };

/** Valida tipo, tamaño y permisos. Devuelve los datos limpios o un error para mostrar. */
export async function checkUpload(u: SessionUser, raw: { name?: unknown; type?: unknown; size?: unknown; athleteId?: unknown; folder?: unknown; note?: unknown; shared?: unknown }): Promise<{ ok: true; meta: UploadMeta } | { ok: false; error: string; status: number }> {
  const name = String(raw.name ?? "").slice(0, 200);
  const type = String(raw.type ?? "");
  const size = Number(raw.size ?? 0);
  if (!name || !size) return { ok: false, error: "Archivo faltante", status: 400 };
  if (size > MAX_UPLOAD) return { ok: false, error: "El archivo supera los 300 MB", status: 413 };
  if (!ALLOWED.test(type)) return { ok: false, error: "Tipo de archivo no permitido", status: 415 };
  let athleteId = raw.athleteId ? String(raw.athleteId) : null;
  if (u.role === "ATHLETE") athleteId = u.id;
  else if (athleteId && !(await canSeeAthlete(u, athleteId))) return { ok: false, error: "Sin permiso", status: 403 };
  const rawFolder = String(raw.folder ?? "");
  const folder = athleteId && PROFILE_FOLDERS.some((f) => f.key === rawFolder) ? rawFolder : null;
  const note = String(raw.note ?? "").trim().slice(0, 300) || null;
  const shared = !folder && u.role !== "ATHLETE" && (raw.shared === true || raw.shared === "true");
  return { ok: true, meta: { name, type, size, athleteId, folder, note, shared } };
}

/** Registra el archivo ya guardado y avisa al entrenador si lo subió un alumno. */
export async function registerUpload(u: SessionUser, meta: UploadMeta, key: string, size: number) {
  const asset = await db.fileAsset.create({
    data: { orgId: u.orgId, ownerId: u.id, athleteId: meta.athleteId, name: meta.name, mime: meta.type, size, storageKey: key, kind: kindOf(meta.type), folder: meta.folder, note: meta.note, shared: meta.shared },
  });
  await audit(u, "CREAR", "Archivo", meta.name, asset.id);
  if (u.role === "ATHLETE" && u.athleteProfile?.coachId) {
    await notify([u.athleteProfile.coachId], { kind: asset.kind === "VIDEO" ? "VIDEO" : "MENSAJE", title: `${u.name} subió ${asset.kind === "VIDEO" ? "un video" : "un archivo"}`, body: meta.name, link: meta.folder ? `/app/athletes/${u.id}?tab=carpeta` : asset.kind === "VIDEO" ? `/app/videos?file=${asset.id}` : "/app/files" });
  }
  return { id: asset.id, name: asset.name, kind: asset.kind };
}

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

/** Comprobante firmado de una subida directa: evita que se registre un archivo con datos cambiados. */
export async function uploadTicket(u: SessionUser, meta: UploadMeta, key: string) {
  return new SignJWT({ meta, key, uid: u.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("3h").sign(secret());
}
export async function readTicket(u: SessionUser, ticket: string) {
  const { payload } = await jwtVerify(ticket, secret());
  if (payload.uid !== u.id) throw new Error("Comprobante inválido");
  return { meta: payload.meta as UploadMeta, key: String(payload.key) };
}

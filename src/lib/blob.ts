// Capa de bajo nivel para guardar archivos. Sin dependencias de Next, así también la usa el seed.
// Con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY usa Supabase Storage (bucket privado);
// si no, guarda en disco local (UPLOAD_DIR).
import { mkdir, writeFile, stat, unlink } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";

const SB_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const BUCKET = process.env.SUPABASE_BUCKET || "hrtraining";
export const remoteStorage = () => !!SB_URL && !!SB_KEY;
const ROOT = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const safe = (key: string) => path.basename(key);

async function sb(pathname: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/storage/v1${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  return r;
}

let bucketReady = false;
/** Crea el bucket privado si todavía no existe (una vez por proceso). */
export async function ensureBucket() {
  if (!remoteStorage() || bucketReady) return;
  const r = await sb(`/bucket/${BUCKET}`);
  if (r.status !== 200) {
    const c = await sb(`/bucket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
    if (!c.ok && c.status !== 409) {
      const t = await c.text();
      if (!/already exists/i.test(t)) throw new Error(`No se pudo crear el bucket de Supabase: ${t}`);
    }
  }
  bucketReady = true;
}

export async function putBuffer(key: string, buf: Buffer, mime = "application/octet-stream") {
  if (remoteStorage()) {
    await ensureBucket();
    const r = await sb(`/object/${BUCKET}/${encodeURIComponent(safe(key))}`, { method: "POST", headers: { "Content-Type": mime, "x-upsert": "true" }, body: new Uint8Array(buf) });
    if (!r.ok) throw new Error(`No se pudo guardar el archivo: ${await r.text()}`);
    return;
  }
  await mkdir(ROOT(), { recursive: true });
  await writeFile(path.join(ROOT(), safe(key)), buf);
}

export async function removeKey(key: string) {
  if (remoteStorage()) {
    await sb(`/object/${BUCKET}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [safe(key)] }) }).catch(() => undefined);
    return;
  }
  await unlink(path.join(ROOT(), safe(key))).catch(() => undefined);
}

/** Tamaño del archivo guardado, o null si no existe. */
export async function sizeOf(key: string): Promise<number | null> {
  if (remoteStorage()) {
    const r = await sb(`/object/list/${BUCKET}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", search: safe(key), limit: 5 }) });
    if (!r.ok) return null;
    const rows = (await r.json()) as { name: string; metadata?: { size?: number } }[];
    const row = rows.find((x) => x.name === safe(key));
    return row ? Number(row.metadata?.size ?? 0) : null;
  }
  const st = await stat(path.join(ROOT(), safe(key))).catch(() => null);
  return st ? st.size : null;
}

export function localStream(key: string, opts?: { start: number; end: number }) {
  return createReadStream(path.join(ROOT(), safe(key)), opts);
}

/** Enlace temporal de lectura (solo Supabase). */
export async function signedReadUrl(key: string, opts: { expiresIn?: number; downloadName?: string } = {}) {
  const r = await sb(`/object/sign/${BUCKET}/${encodeURIComponent(safe(key))}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: opts.expiresIn ?? 3600 }) });
  if (!r.ok) return null;
  const { signedURL } = (await r.json()) as { signedURL: string };
  const url = `${SB_URL}/storage/v1${signedURL}`;
  return opts.downloadName ? `${url}&download=${encodeURIComponent(opts.downloadName)}` : url;
}

/** Enlace temporal para que el navegador suba el archivo directo a Supabase (sin pasar por el servidor). */
export async function signedUploadUrl(key: string) {
  await ensureBucket();
  const r = await sb(`/object/upload/sign/${BUCKET}/${encodeURIComponent(safe(key))}`, { method: "POST" });
  if (!r.ok) throw new Error(`No se pudo preparar la subida: ${await r.text()}`);
  const { url } = (await r.json()) as { url: string };
  return `${SB_URL}/storage/v1${url}`;
}

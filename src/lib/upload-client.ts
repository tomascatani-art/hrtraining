// Sube un archivo desde el navegador. Con Supabase va directo al almacenamiento (sirve para videos grandes en Vercel);
// sin Supabase pasa por el servidor como antes.
export type UploadFields = { athleteId?: string; folder?: string; note?: string; shared?: boolean };
export type Uploaded = { id: string; name: string; kind: string };

function xhrSend(method: string, url: string, body: XMLHttpRequestBodyInit, onProgress?: (p: number) => void, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("Error de red al subir"));
    xhr.send(body);
  });
}

export async function uploadFile(file: File, fields: UploadFields = {}, onProgress?: (p: number) => void): Promise<Uploaded> {
  const prep = await fetch("/api/files/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size, ...fields }),
  });
  const p = await prep.json().catch(() => ({}));
  if (!prep.ok) throw new Error(p.error ?? "No se pudo subir el archivo");

  if (p.direct) {
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    const up = await xhrSend("PUT", p.uploadUrl, fd, onProgress, { "x-upsert": "false" });
    if (up.status >= 300) throw new Error("No se pudo subir el archivo al almacenamiento");
    const done = await fetch("/api/files/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: p.ticket }) });
    const d = await done.json().catch(() => ({}));
    if (!done.ok) throw new Error(d.error ?? "No se pudo registrar el archivo");
    return d;
  }

  const fd = new FormData();
  fd.append("file", file);
  if (fields.athleteId) fd.append("athleteId", fields.athleteId);
  if (fields.folder) fd.append("folder", fields.folder);
  if (fields.note) fd.append("note", fields.note);
  fd.append("shared", String(!!fields.shared));
  const r = await xhrSend("POST", "/api/files/upload", fd, onProgress);
  const res = JSON.parse(r.text || "{}");
  if (r.status >= 300) throw new Error(res.error ?? "No se pudo subir el archivo");
  return res;
}

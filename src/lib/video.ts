// Utilidades de video (sirven en servidor y en el navegador).

/** ID de YouTube desde cualquier formato de link: watch, youtu.be, shorts, embed, live. */
export function youtubeId(url?: string | null) {
  if (!url) return null;
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}

/** Arregla links pegados sin "https://" (youtu.be/…, www.youtube.com/…, http://…) para que no se pierdan al guardar. */
export function normalizeLink(raw?: string | null): string | null {
  let s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return null;
  if (s.startsWith("/api/files/")) return s;
  s = s.replace(/^http:\/\//i, "https://");
  if (!/^https:\/\//i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s.replace(/^\/\//, ""))) s = "https://" + s.replace(/^\/\//, "");
    else return null;
  }
  return /^https:\/\/\S+\.\S{2,}/.test(s) ? s.slice(0, 500) : null;
}

/** true si es un link a una búsqueda (no a un video puntual). */
export const isSearchUrl = (url?: string | null) => !!url && /youtube\.com\/results/.test(url);

/** Video real (no búsqueda) o null. */
export function realVideo(url?: string | null) {
  if (!url || isSearchUrl(url)) return null;
  return /^(https:\/\/|\/api\/files\/)/.test(url) ? url : null;
}

export const youtubeSearch = (name: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " técnica")}`;

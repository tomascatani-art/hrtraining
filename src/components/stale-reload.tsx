"use client";
import { useEffect } from "react";

/**
 * Después de una actualización, una pantalla que quedó abierta en el celu puede pedir archivos o acciones que ya no existen
 * ("Application error: a client-side exception…"). En ese caso recargamos la página una vez y listo.
 */
const STALE = /Failed to find Server Action|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|older or newer deployment/i;
export function StaleReload() {
  useEffect(() => {
    const reload = (msg: string) => {
      if (!STALE.test(msg)) return;
      try { const k = "hr-reload-at"; if (Date.now() - Number(sessionStorage.getItem(k) || 0) < 30000) return; sessionStorage.setItem(k, String(Date.now())); } catch {}
      window.location.reload();
    };
    const onErr = (e: ErrorEvent) => reload(`${e.message} ${e.error?.name ?? ""}`);
    const onRej = (e: PromiseRejectionEvent) => reload(`${(e.reason as Error)?.message ?? e.reason} ${(e.reason as Error)?.name ?? ""}`);
    window.addEventListener("error", onErr); window.addEventListener("unhandledrejection", onRej);
    // Al volver a la app después de un rato (PWA en segundo plano), traer la versión nueva.
    let hidden = 0;
    const onVis = () => { if (document.hidden) hidden = Date.now(); else if (hidden && Date.now() - hidden > 30 * 60000 && !document.querySelector("form [data-dirty]")) window.location.reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return null;
}

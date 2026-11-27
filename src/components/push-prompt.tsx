"use client";
import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const KEY = "hr-push-oculto";

/** Activa las notificaciones del celular (rutina nueva, cuota, molestias…). */
export async function enablePush(): Promise<"ok" | "denied" | "unsupported" | "error"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const { key } = await (await fetch("/api/push")).json();
    if (!key) return "error";
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }));
    const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    return r.ok ? "ok" : "error";
  } catch { return "error"; }
}

export function PushPrompt() {
  const [state, setState] = useState<"hidden" | "ask" | "ios" | "done" | "denied" | "error">("hidden");
  useEffect(() => {
    try { if (localStorage.getItem(KEY)) return; } catch {}
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (ios && !standalone) { setState("ios"); return; }
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") {
      // Ya dio permiso: se re-suscribe en silencio (por si cambió de celular o se borró)
      enablePush().catch(() => {});
      return;
    }
    if (Notification.permission === "default") setState("ask");
  }, []);
  const hide = () => { try { localStorage.setItem(KEY, "1"); } catch {} setState("hidden"); };
  if (state === "hidden") return null;
  return (
    <div className="card card-pad mb-6 flex items-start gap-3 border-volt/50">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-volt text-black"><BellRing size={20} /></div>
      <div className="min-w-0 flex-1 text-sm">
        {state === "ios" ? (<>
          <div className="font-semibold text-white">Recibí los avisos en tu iPhone</div>
          <div className="mt-0.5 muted">Tocá <b className="text-white">Compartir</b> → <b className="text-white">Agregar a inicio</b>, y abrí la app desde ese ícono. Ahí te va a aparecer el botón para activar las notificaciones.</div>
        </>) : state === "done" ? (
          <div className="font-semibold text-white">¡Listo! Te van a llegar los avisos a este celular.</div>
        ) : state === "denied" ? (
          <div className="muted">El celular bloqueó las notificaciones. Podés habilitarlas desde la configuración del navegador.</div>
        ) : (<>
          <div className="font-semibold text-white">Activá las notificaciones</div>
          <div className="mt-0.5 muted">Te avisamos al celular cuando hay rutina nueva, cuotas por vencer y otras novedades, aunque la app esté cerrada.</div>
          {state === "error" && <div className="mt-1 text-volt">No se pudo activar. Probá de nuevo.</div>}
          <button type="button" className="btn-primary btn-sm mt-2" onClick={async () => { const r = await enablePush(); setState(r === "ok" ? "done" : r === "denied" ? "denied" : "error"); if (r === "ok") try { localStorage.setItem(KEY, "1"); } catch {} }}>Activar</button>
        </>)}
      </div>
      <button type="button" onClick={hide} className="p-1 text-neutral-500 hover:text-white" aria-label="Cerrar"><X size={16} /></button>
    </div>
  );
}

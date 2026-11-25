"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Respuesta inmediata al tocar algo:
 * - Barra amarilla arriba apenas tocás un link o mandás un formulario, hasta que el servidor contesta.
 * - El botón que tocaste queda marcado (data-pending) con un circulito girando mientras se guarda.
 * Escucha los pedidos que hace Next (navegación y acciones) para saber cuándo terminó.
 */
let inflight = 0;
const subs = new Set<(n: number) => void>();
const emit = () => subs.forEach((f) => f(inflight));

function isAppRequest(input: RequestInfo | URL, init?: RequestInit) {
  const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (h.has("Next-Router-Prefetch")) return false;
  return h.has("Next-Action") || h.has("RSC");
}

if (typeof window !== "undefined" && !(window as unknown as { __hrFetch?: boolean }).__hrFetch) {
  (window as unknown as { __hrFetch?: boolean }).__hrFetch = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isAppRequest(input, init)) return orig(input, init);
    inflight++; emit();
    return orig(input, init).finally(() => { inflight = Math.max(0, inflight - 1); emit(); });
  };
}

function clearPending() {
  document.querySelectorAll("[data-pending]").forEach((el) => el.removeAttribute("data-pending"));
}

export function NavProgress() {
  const path = usePathname();
  const sp = useSearchParams();
  const [clicked, setClicked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setClicked(false); clearPending(); }, [path, sp]);

  useEffect(() => {
    const onBusy = (n: number) => { setBusy(n > 0); if (n === 0) { setClicked(false); setTimeout(() => { if (inflight === 0) clearPending(); }, 150); } };
    subs.add(onBusy);
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/app") || href.startsWith("/api")) return;
      const url = new URL(href, location.href);
      if (url.pathname === location.pathname && url.search === location.search) return;
      a.setAttribute("data-pending", "");
      setClicked(true);
    };
    const submit = (e: SubmitEvent) => {
      // Si otro manejador canceló el envío (por ejemplo un "¿Seguro?"), no marcamos nada.
      setTimeout(() => {
        if (e.defaultPrevented) return;
        const form = e.target as HTMLFormElement;
        const btn = (e.submitter as HTMLElement | null) ?? form.querySelector<HTMLElement>("button:not([type=button]), input[type=submit]");
        btn?.setAttribute("data-pending", "");
        setClicked(true);
      }, 0);
    };
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => { subs.delete(onBusy); document.removeEventListener("click", click, true); document.removeEventListener("submit", submit, true); };
  }, []);

  const on = clicked || busy;
  useEffect(() => { if (!on) return; const t = setTimeout(() => { setClicked(false); clearPending(); }, 15000); return () => clearTimeout(t); }, [on]);
  if (!on) return null;
  return <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-volt/20"><div className="h-full w-1/3 bg-volt" style={{ animation: "loadbar 0.9s ease-in-out infinite" }} /></div>;
}

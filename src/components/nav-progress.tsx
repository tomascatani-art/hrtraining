"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Barra amarilla arriba apenas tocás un link, hasta que llega la pantalla nueva. Así se nota que la app reaccionó. */
export function NavProgress() {
  const path = usePathname();
  const sp = useSearchParams();
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); }, [path, sp]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/app") || href.startsWith("/api")) return;
      const url = new URL(href, location.href);
      if (url.pathname === location.pathname && url.search === location.search) return;
      setOn(true);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  useEffect(() => { if (!on) return; const t = setTimeout(() => setOn(false), 12000); return () => clearTimeout(t); }, [on]);
  if (!on) return null;
  return <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-volt/20"><div className="h-full w-1/3 bg-volt" style={{ animation: "loadbar 0.9s ease-in-out infinite" }} /></div>;
}

"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

/** Muestra el motivo cuando una acción no se pudo hacer (viene en ?error=…). */
export function ActionErrorBanner() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const msg = sp.get("error");
  const [shown, setShown] = useState<string | null>(msg);
  useEffect(() => { setShown(msg); }, [msg]);
  if (!shown) return null;
  const close = () => { setShown(null); const q = new URLSearchParams(sp.toString()); q.delete("error"); router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false }); };
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-volt/60 bg-volt/10 p-3 text-sm text-white">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-volt" />
      <div className="flex-1"><b className="block text-volt">No se pudo completar</b>{shown}</div>
      <button onClick={close} className="rounded-lg p-1 text-neutral-400 hover:text-white" aria-label="Cerrar"><X size={16} /></button>
    </div>
  );
}

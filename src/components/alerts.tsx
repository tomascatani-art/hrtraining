import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { AlertTriangle, Info } from "lucide-react";
import type { Alert } from "@/lib/metrics";
import { MONITORING_DISCLAIMER } from "@/lib/metrics";
import { Avatar } from "./ui";

export function AlertList({ items, showDisclaimer = true }: { items: (Alert & { athlete?: { id: string; name: string } })[]; showDisclaimer?: boolean }) {
  return (
    <div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-5 text-center text-sm text-emerald-300">Sin cambios relevantes en los indicadores.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((a, i) => (
            <li key={i} className={`flex gap-3 rounded-xl border px-3 py-2.5 ${a.level === "ATENCION" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/25 bg-amber-500/5"}`}>
              {a.athlete ? <Avatar name={a.athlete.name} src={avatarSrc(a.athlete)} size={28} /> : <AlertTriangle size={18} className={a.level === "ATENCION" ? "text-red-400" : "text-amber-300"} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.athlete && <Link href={`/app/athletes/${a.athlete.id}?tab=carga`} className="text-sm font-semibold text-white hover:text-volt">{a.athlete.name}</Link>}
                  <span className={a.level === "ATENCION" ? "chip-red" : "chip-amber"}>{a.level === "ATENCION" ? "Atención" : "Revisar"}</span>
                </div>
                <div className="text-sm text-neutral-200">{a.title}</div>
                <div className="text-xs muted">{a.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {showDisclaimer && (
        <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-neutral-600"><Info size={13} className="mt-0.5 shrink-0" />{MONITORING_DISCLAIMER}</p>
      )}
    </div>
  );
}

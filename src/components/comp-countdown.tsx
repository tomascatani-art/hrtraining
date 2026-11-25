import { Trophy } from "lucide-react";
import { fmtDate } from "@/components/ui";
import { startOfDay } from "@/lib/metrics";

type Comp = { id: string; name: string; date: Date; location: string | null };

/** Cuenta regresiva bien visible para la próxima competencia del alumno. */
export function CompCountdown({ comps }: { comps: Comp[] }) {
  if (!comps.length) return null;
  const today = startOfDay(new Date());
  const days = (d: Date) => Math.round((+startOfDay(d) - +today) / 86400000);
  const [next, ...rest] = comps;
  const n = days(next.date);
  return (
    <div className="card mb-6 overflow-hidden border-volt/60">
      <div className="flex items-center gap-4 bg-volt/[.07] p-4 sm:p-5">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-volt text-black">
          {n <= 0 ? <Trophy size={34} /> : <div className="text-center leading-none"><div className="num text-4xl font-bold">{n}</div><div className="mt-1 text-[11px] font-bold uppercase">{n === 1 ? "día" : "días"}</div></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="label text-volt">{n <= 0 ? "¡Hoy competís!" : n === 1 ? "Mañana competís" : "Faltan para tu competencia"}</div>
          <div className="mt-0.5 font-display text-xl font-bold leading-tight text-white">{next.name}</div>
          <div className="text-sm muted">{fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" })}{next.location ? ` · ${next.location}` : ""}</div>
        </div>
      </div>
      {rest.length > 0 && (
        <ul className="divide-y divide-ink-800 border-t border-ink-800 px-4 sm:px-5">
          {rest.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-neutral-200">{c.name} <span className="muted">· {fmtDate(c.date, { day: "numeric", month: "short" })}</span></span>
              <span className="num shrink-0 font-semibold text-volt">{days(c.date)} días</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

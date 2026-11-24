import { db } from "@/lib/db";
import { fmtKg } from "@/lib/plates";
import { Card, fmtDate } from "./ui";
import { Sparkline } from "./charts";
import { SensationsCard } from "./today-panel";

/** Kilos que el deportista fue usando en cada ejercicio (la serie más pesada de cada sesión). */
export async function KgUsedCard({ athleteId }: { athleteId: string }) {
  const sets = await db.setLog.findMany({
    where: { log: { athleteId }, loadKg: { gt: 0 } },
    select: { loadKg: true, reps: true, logId: true, log: { select: { completedAt: true } }, item: { select: { exercise: { select: { id: true, name: true } } } } },
    orderBy: { log: { completedAt: "asc" } }, take: 3000,
  });
  const byEx = new Map<string, { name: string; points: Map<string, { kg: number; reps: number | null; date: Date }> }>();
  for (const s of sets) {
    const e = s.item.exercise;
    const entry = byEx.get(e.id) ?? { name: e.name, points: new Map() };
    const cur = entry.points.get(s.logId);
    if (!cur || s.loadKg! > cur.kg) entry.points.set(s.logId, { kg: s.loadKg!, reps: s.reps, date: s.log.completedAt });
    byEx.set(e.id, entry);
  }
  const rows = [...byEx.values()].map((e) => ({ name: e.name, pts: [...e.points.values()] })).filter((e) => e.pts.length).sort((a, b) => +b.pts.at(-1)!.date - +a.pts.at(-1)!.date).slice(0, 10);
  return (
    <Card title="Kilos usados" action={<span className="text-xs muted">serie más pesada de cada sesión</span>} pad={false}>
      {rows.length ? (
        <ul className="divide-y divide-ink-800">
          {rows.map((r) => {
            const last = r.pts.at(-1)!, first = r.pts[0];
            return (
              <li key={r.name} className="grid grid-cols-[1fr_90px_auto] items-center gap-3 px-5 py-2.5">
                <div className="min-w-0"><div className="truncate text-sm text-white">{r.name}</div><div className="text-xs muted">{r.pts.length} sesiones · última {fmtDate(last.date)}</div></div>
                <div>{r.pts.length > 1 ? <Sparkline values={r.pts.map((p) => p.kg)} height={30} /> : null}</div>
                <div className="text-right"><div className="num text-sm font-semibold text-white">{fmtKg(last.kg)} kg{last.reps ? <span className="text-xs text-neutral-500"> × {last.reps}</span> : null}</div>{r.pts.length > 1 && <div className="num text-[11px] muted">desde {fmtKg(first.kg)} kg</div>}</div>
              </li>
            );
          })}
        </ul>
      ) : <p className="p-5 text-sm muted">Todavía no hay kilos registrados.</p>}
    </Card>
  );
}

export function TrainingInsights({ athleteId }: { athleteId: string }) {
  return (
    <div className="mb-6 grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2"><KgUsedCard athleteId={athleteId} /></div>
      <SensationsCard athleteId={athleteId} />
    </div>
  );
}

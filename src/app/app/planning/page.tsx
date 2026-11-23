import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PHASES, sportLabel } from "@/lib/catalog";
import { PageHeader, Empty, DemoBadge, fmtDate } from "@/components/ui";

export const metadata = { title: "Planificación" };

export default async function PlanningPage() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const plans = await db.plan.findMany({
    where: { orgId: u.orgId, ...(u.role === "COACH" ? { coachId: u.id } : {}) },
    include: { blocks: { where: { level: "MESO" }, orderBy: { startDate: "asc" } }, athlete: true, group: true, coach: true },
    orderBy: { startDate: "desc" },
  });
  const now = Date.now();
  return (
    <>
      <PageHeader title="Planificación deportiva" subtitle="Temporadas anuales con macrociclos, mesociclos y microciclos. Distribución de cargas por capacidad y comparación plan vs. ejecutado."
        actions={<Link href="/app/planning/new" className="btn-primary">Nueva planificación</Link>} />
      {plans.length === 0 ? <Empty title="Sin planificaciones" action={<Link href="/app/planning/new" className="btn-primary">Crear la primera</Link>}>Podés generar la estructura automáticamente a partir del deporte y las fechas.</Empty> : (
        <div className="space-y-4">
          {plans.map((p) => {
            const span = +p.endDate - +p.startDate;
            const todayPct = Math.min(100, Math.max(0, ((now - +p.startDate) / span) * 100));
            const current = p.blocks.find((b) => +b.startDate <= now && +b.endDate > now);
            return (
              <Link key={p.id} href={`/app/planning/${p.id}`} className="card card-pad card-hover block">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="h2">{p.name}</span>{p.isDemo && <DemoBadge />}</div>
                    <div className="mt-0.5 text-sm muted">{sportLabel(p.sport)} · {p.group?.name ?? p.athlete?.name ?? "Sin asignar"} · {fmtDate(p.startDate, { day: "2-digit", month: "short", year: "numeric" })} → {fmtDate(p.endDate, { day: "2-digit", month: "short", year: "numeric" })}</div>
                  </div>
                  {current && <span className="chip-volt">Ahora: {current.name}</span>}
                </div>
                <div className="relative mt-4 flex h-7 overflow-hidden rounded-lg bg-ink-900">
                  {p.blocks.map((b) => (
                    <div key={b.id} title={`${b.name} · ${PHASES[b.phase]?.label}`} className="h-full border-r border-ink-950" style={{ width: `${((+b.endDate - +b.startDate) / span) * 100}%`, background: PHASES[b.phase]?.color, opacity: 0.75 }} />
                  ))}
                  {now > +p.startDate && now < +p.endDate && <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_#fff]" style={{ left: `${todayPct}%` }} />}
                </div>
                {p.goal && <div className="mt-2 text-xs muted">Objetivo: {p.goal}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

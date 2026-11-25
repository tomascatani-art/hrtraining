import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SPORTS, SPORT_TEMPLATES, CAPACITIES, TEST_MAP, SESSION_TYPES } from "@/lib/catalog";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Deportes" };

export default async function SportsPage() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const [athletes, exercises] = await Promise.all([
    db.athleteProfile.groupBy({ by: ["sport"], where: { user: { orgId: u.orgId } }, _count: true }),
    db.exercise.findMany({ where: { OR: [{ orgId: null }, { orgId: u.orgId }] }, select: { sports: true } }),
  ]);
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  return (
    <>
      <PageHeader title="Deportes y plantillas" subtitle="Cada disciplina tiene capacidades prioritarias y una estructura semanal de referencia. Usalas como punto de partida para armar rutinas." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(SPORT_TEMPLATES).map(([k, t]) => {
          const n = athletes.find((a) => a.sport === k)?._count ?? 0;
          const ex = exercises.filter((e) => e.sports.includes(k)).length;
          return (
            <section key={k} className="card card-pad relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: SPORTS[k].color }} />
              <div className="flex items-start justify-between gap-2"><h2 className="h2">{SPORTS[k].label}</h2><span className="text-xs muted">{n} alumnos · {ex} ejercicios</span></div>
              <p className="mt-1 text-sm muted">{t.note}</p>
              <div className="mt-4 label">Capacidades prioritarias</div>
              <div className="mt-1.5 flex flex-wrap gap-1">{t.focus.map((c, i) => <span key={c} className={i === 0 ? "chip-volt" : "chip-mute"}>{CAPACITIES[c].label}</span>)}</div>
              <div className="mt-4 label">Semana tipo</div>
              <div className="mt-1.5 grid grid-cols-7 gap-1">
                {days.map((d, i) => <div key={d} className="text-center"><div className="text-[10px] text-neutral-600">{d}</div><div className={`mt-0.5 h-7 rounded text-[9px] leading-7 ${t.weekly[i] ? "bg-ink-700 text-neutral-300" : "bg-ink-900 text-neutral-700"}`} title={t.weekly[i] ? SESSION_TYPES[t.weekly[i]] : "Descanso"}>{t.weekly[i]?.slice(0, 3) ?? "—"}</div></div>)}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/app/library?sport=${k}`} className="btn-ghost btn-sm">Ejercicios</Link>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

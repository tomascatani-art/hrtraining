import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { UserPlus, FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { monitoringFor } from "@/lib/queries";
import { wellnessScore } from "@/lib/metrics";
import { SPORTS, sportLabel } from "@/lib/catalog";
import { PageHeader, Avatar, DemoBadge, Empty, fmtNum } from "@/components/ui";

export const metadata = { title: "Alumnos" };

export default async function AthletesPage({ searchParams }: { searchParams: Promise<{ q?: string; sport?: string; group?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  let ids = await visibleAthleteIds(u);
  if (sp.group) {
    const m = await db.groupMember.findMany({ where: { groupId: sp.group }, select: { athleteId: true } });
    const set = new Set(m.map((x) => x.athleteId));
    ids = ids.filter((i) => set.has(i));
  }
  let rows = await monitoringFor(ids);
  if (sp.sport) rows = rows.filter((r) => r.user.athleteProfile?.sport === sp.sport);
  if (sp.q) rows = rows.filter((r) => r.user.name.toLowerCase().includes(sp.q!.toLowerCase()));
  const groups = await db.group.findMany({ where: { orgId: u.orgId }, orderBy: { name: "asc" }, include: { members: true } });
  const groupOf = (id: string) => groups.filter((g) => g.members.some((m) => m.athleteId === id)).map((g) => g.name).join(", ");

  return (
    <>
      <PageHeader title="Alumnos" subtitle="Seguimiento individual: bienestar, disponibilidad, carga reciente y alertas." actions={<><Link href="/app/athletes/import" className="btn-ghost"><FileSpreadsheet size={16} />Cargar desde Excel</Link><Link href="/app/athletes/new" className="btn-primary"><UserPlus size={16} />Nuevo alumno</Link></>} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nombre…" className="input" />
        <select name="sport" defaultValue={sp.sport ?? ""} className="input"><option value="">Todos los deportes</option>{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <button className="btn-ghost">Filtrar</button>
      </form>
      {rows.length === 0 ? <Empty title="No hay alumnos" action={<div className="flex flex-wrap justify-center gap-2"><Link href="/app/athletes/new" className="btn-primary">Sumar el primero</Link><Link href="/app/athletes/import" className="btn-ghost">Cargar desde Excel</Link></div>}>Sumá alumnos y recibirán una invitación para activar su cuenta.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead><tr><th>Alumno</th><th>Deporte</th><th>Bienestar</th><th>Disponib.</th><th>Carga 7d</th><th>Ag:Cr</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map(({ user: a, lastWellness: w, indicators: ind, alerts }) => {
                const att = alerts.filter((x) => x.level === "ATENCION").length;
                const rev = alerts.filter((x) => x.level === "REVISAR").length;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/app/athletes/${a.id}`} className="flex items-center gap-3 group">
                        <Avatar name={a.name} src={avatarSrc(a)} size={32} />
                        <div><div className="font-semibold text-white group-hover:text-volt">{a.name} {a.isDemo && <DemoBadge />}</div><div className="text-xs muted">{a.athleteProfile?.position ?? "—"}{a.inviteToken && " · invitación pendiente"}</div></div>
                      </Link>
                    </td>
                    <td className="text-neutral-300">{sportLabel(a.athleteProfile?.sport)}</td>
                    <td className="num">{w ? <span className={wellnessScore(w) < 13 ? "text-red-300" : "text-white"}>{wellnessScore(w)}/25</span> : "—"}</td>
                    <td className="num">{w ? `${w.readiness}/10` : "—"}</td>
                    <td className="num">{fmtNum(ind.acute)} <span className="text-neutral-600">UA</span></td>
                    <td className="num">{ind.acwr != null ? ind.acwr.toFixed(2) : "—"}</td>
                    <td>{att ? <span className="chip-red">{att} atención</span> : rev ? <span className="chip-amber">{rev} revisar</span> : <span className="chip-green">Estable</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

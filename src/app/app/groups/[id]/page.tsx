import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { monitoringFor } from "@/lib/queries";
import { SPORTS, sportLabel, SESSION_TYPES } from "@/lib/catalog";
import { weeklySeries, wellnessScore } from "@/lib/metrics";
import { PageHeader, Card, Field, Avatar, Empty, fmtDate, fmtNum } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { LoadBars } from "@/components/charts";
import { AlertList } from "@/components/alerts";
import { addMembers, removeMember, updateGroup, deleteGroup } from "../actions";

export default async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const g = await db.group.findUnique({ where: { id }, include: { members: { include: { athlete: true } }, sessions: { orderBy: { date: "desc" }, take: 8 }, conversations: true } });
  if (!g || g.orgId !== u.orgId || (u.role === "COACH" && g.coachId !== u.id)) notFound();
  const memberIds = g.members.map((m) => m.athleteId);
  const mon = await monitoringFor(memberIds);
  const visible = await visibleAthleteIds(u);
  const candidates = await db.user.findMany({ where: { orgId: u.orgId, role: "ATHLETE", id: { notIn: memberIds } }, orderBy: { name: "asc" } });
  const weekly = weeklySeries(mon.flatMap((m) => m.points), 8).map((w) => ({ x: w.week, load: Math.round(w.load / Math.max(1, memberIds.length)) }));
  const alerts = mon.flatMap((m) => m.alerts.filter((a) => a.kind !== "SIN_REGISTRO").map((a) => ({ ...a, athlete: m.user })));

  return (
    <>
      <PageHeader eyebrow={sportLabel(g.sport)} title={g.name} subtitle={g.description ?? undefined}
        actions={<>
          <Link href={`/app/calendar?new=1&group=${g.id}`} className="btn-primary">Asignar sesión grupal</Link>
          {g.conversations[0] && <Link href={`/app/messages?c=${g.conversations[0].id}`} className="btn-ghost">Chat del grupo</Link>}
        </>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={`Integrantes (${g.members.length})`} className="xl:col-span-2" pad={false}>
          {mon.length ? (
            <div className="overflow-x-auto">
              <table className="table min-w-[640px]">
                <thead><tr><th>Deportista</th><th>Bienestar</th><th>Disponib.</th><th>Carga 7d</th><th>Alertas</th><th></th></tr></thead>
                <tbody>
                  {mon.map((m) => (
                    <tr key={m.user.id}>
                      <td>{visible.includes(m.user.id) ? <Link href={`/app/athletes/${m.user.id}`} className="flex items-center gap-2 hover:text-volt"><Avatar name={m.user.name} size={28} /><span className="font-medium text-white">{m.user.name}</span></Link> : m.user.name}</td>
                      <td className="num">{m.lastWellness ? `${wellnessScore(m.lastWellness)}/25` : "—"}</td>
                      <td className="num">{m.lastWellness ? `${m.lastWellness.readiness}/10` : "—"}</td>
                      <td className="num">{fmtNum(m.indicators.acute)} UA</td>
                      <td>{m.alerts.filter((a) => a.kind !== "SIN_REGISTRO").length || "—"}</td>
                      <td className="text-right"><form action={removeMember}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="athleteId" value={m.user.id} /><ConfirmSubmit message={`¿Quitar a ${m.user.name} del grupo?`} className="btn-ghost btn-sm">Quitar</ConfirmSubmit></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-5"><Empty title="Grupo vacío">Sumá deportistas desde el panel lateral.</Empty></div>}
        </Card>
        <div className="space-y-6">
          <Card title="Sumar deportistas">
            {candidates.length ? (
              <form action={addMembers} className="space-y-3">
                <input type="hidden" name="id" value={g.id} />
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-ink-700 p-2">
                  {candidates.map((c) => <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800"><input type="checkbox" name="athleteId" value={c.id} />{c.name}</label>)}
                </div>
                <Submit className="btn-primary w-full">Agregar seleccionados</Submit>
              </form>
            ) : <p className="text-sm muted">Todos los deportistas ya están en el grupo. <Link href="/app/athletes/new" className="text-volt">Crear uno nuevo</Link></p>}
          </Card>
          <Card title="Alertas del grupo"><AlertList items={alerts} showDisclaimer={false} /></Card>
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Carga semanal promedio" className="xl:col-span-2"><LoadBars data={weekly} /></Card>
        <Card title="Últimas sesiones">
          {g.sessions.length ? <ul className="space-y-1.5">{g.sessions.map((s) => <li key={s.id}><Link href={`/app/sessions/${s.id}`} className="flex justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800"><span className="text-white">{s.title}</span><span className="muted">{fmtDate(s.date)} · {SESSION_TYPES[s.type]}</span></Link></li>)}</ul> : <Empty title="Sin sesiones" />}
        </Card>
      </div>
      <Card title="Configuración del grupo" className="mt-6">
        <form action={updateGroup} className="grid gap-4 sm:grid-cols-4">
          <input type="hidden" name="id" value={g.id} />
          <Field label="Nombre"><input name="name" defaultValue={g.name} className="input" /></Field>
          <Field label="Deporte"><select name="sport" defaultValue={g.sport} className="input">{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Color"><input name="color" type="color" defaultValue={g.color} className="h-10 w-full rounded-xl border border-ink-600 bg-ink-900" /></Field>
          <Field label="Descripción"><input name="description" defaultValue={g.description ?? ""} className="input" /></Field>
          <div className="flex gap-2 sm:col-span-4 justify-end"><Submit>Guardar</Submit></div>
        </form>
        <form action={deleteGroup} className="mt-2 flex justify-end"><input type="hidden" name="id" value={g.id} /><ConfirmSubmit message="¿Eliminar el grupo y sus sesiones grupales? Esta acción no se puede deshacer.">Eliminar grupo</ConfirmSubmit></form>
      </Card>
    </>
  );
}

import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleGroups } from "@/lib/access";
import { SPORTS, sportLabel } from "@/lib/catalog";
import { PageHeader, Card, Field, Empty, Avatar, DemoBadge } from "@/components/ui";
import { Submit } from "@/components/forms";
import { createGroup } from "./actions";

export const metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const groups = await visibleGroups(u);
  const full = await db.group.findMany({ where: { id: { in: groups.map((g) => g.id) } }, include: { members: { include: { athlete: true } }, coach: true, _count: { select: { sessions: true } } }, orderBy: { name: "asc" } });
  const coaches = await db.user.findMany({ where: { orgId: u.orgId, role: { in: ["COACH", "ADMIN"] } } });
  return (
    <>
      <PageHeader title="Grupos de entrenamiento" subtitle="Equipos, categorías o turnos. Asigná sesiones y planificaciones a todo el grupo a la vez." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 content-start">
          {full.length === 0 && <div className="sm:col-span-2"><Empty title="Todavía no hay grupos" /></div>}
          {full.map((g) => (
            <Link key={g.id} href={`/app/groups/${g.id}`} className="card card-pad card-hover relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1" style={{ background: g.color }} />
              <div className="flex items-center justify-between gap-2"><div className="h2">{g.name}</div>{g.isDemo && <DemoBadge />}</div>
              <div className="mt-1 text-sm muted">{sportLabel(g.sport)} · {g.coach.name}</div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">{g.members.slice(0, 6).map((m) => <span key={m.athleteId} className="rounded-full ring-2 ring-ink-850"><Avatar name={m.athlete.name} src={avatarSrc(m.athlete)} size={28} /></span>)}</div>
                <div className="text-right text-xs muted"><span className="num text-white">{g.members.length}</span> deportistas · <span className="num text-white">{g._count.sessions}</span> sesiones</div>
              </div>
            </Link>
          ))}
        </div>
        <Card title="Nuevo grupo">
          <form action={createGroup} className="space-y-3">
            <Field label="Nombre"><input name="name" className="input" required placeholder="Ej: Sub-17 femenino" /></Field>
            <Field label="Deporte"><select name="sport" className="input">{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="Entrenador a cargo"><select name="coachId" className="input" defaultValue={u.id}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Color"><input name="color" type="color" defaultValue="#ffd60a" className="h-10 w-full rounded-xl border border-ink-600 bg-ink-900" /></Field>
            <Field label="Descripción"><textarea name="description" className="input" /></Field>
            <Submit className="btn-primary w-full">Crear grupo</Submit>
          </form>
        </Card>
      </div>
    </>
  );
}

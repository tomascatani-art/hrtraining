import { Trophy, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import { SPORTS, sportLabel } from "@/lib/catalog";
import { startOfDay } from "@/lib/metrics";
import { PageHeader, Card, Field, Empty, DemoBadge, fmtDate } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { saveCompetition, deleteCompetition } from "./actions";

export const metadata = { title: "Competencias" };

export default async function CompetitionsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const staff = u.role !== "ATHLETE";
  const comps = await db.competition.findMany({
    where: { orgId: u.orgId, OR: [{ athleteId: { in: ids } }, { group: { members: { some: { athleteId: { in: ids } } } } }, ...(staff ? [{ group: { coachId: u.id } }] : [])] },
    include: { athlete: true, group: true }, orderBy: { date: "asc" },
  });
  const today = startOfDay(new Date());
  const upcoming = comps.filter((c) => c.date >= today), past = comps.filter((c) => c.date < today).reverse();
  const [groups, athletes] = staff ? await Promise.all([visibleGroups(u), db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } })]) : [[], []];
  const edit = sp.edit ? comps.find((c) => c.id === sp.edit) : undefined;

  const Row = ({ c }: { c: (typeof comps)[number] }) => {
    const days = Math.ceil((+c.date - +today) / 86400000);
    return (
      <li className="card flex flex-wrap items-center gap-4 p-4">
        <div className={`grid h-12 w-12 place-items-center rounded-xl font-display text-lg font-bold ${c.priority === "A" ? "bg-volt text-black" : c.priority === "B" ? "bg-ink-600 text-white" : "bg-ink-800 text-neutral-400"}`} title="Prioridad">{c.priority}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="font-semibold text-white">{c.name}</span>{c.isDemo && <DemoBadge />}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs muted"><span>{fmtDate(c.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</span>{c.location && <span className="flex items-center gap-1"><MapPin size={11} />{c.location}</span>}<span>{sportLabel(c.sport)}</span><span>{c.group?.name ?? c.athlete?.name}</span></div>
          {c.result && <div className="mt-1.5 text-sm text-volt"><Trophy size={13} className="mr-1 inline" />{c.result}{c.position ? ` · Puesto ${c.position}` : ""}</div>}
        </div>
        {days >= 0 && <div className="text-right"><div className="num text-2xl font-bold text-volt">{days}</div><div className="label">días</div></div>}
        {staff && <div className="flex gap-1"><a href={`/app/competitions?edit=${c.id}`} className="btn-ghost btn-sm">{c.date < today && !c.result ? "Cargar resultado" : "Editar"}</a><form action={deleteCompetition}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit message="¿Eliminar la competencia?">✕</ConfirmSubmit></form></div>}
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Competencias" subtitle="Calendario competitivo con prioridades A/B/C para orientar la planificación, y registro de resultados." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section><h2 className="h2 mb-3">Próximas</h2>{upcoming.length ? <ul className="space-y-2">{upcoming.map((c) => <Row key={c.id} c={c} />)}</ul> : <Empty title="Sin competencias próximas" />}</section>
          <section><h2 className="h2 mb-3">Resultados</h2>{past.length ? <ul className="space-y-2">{past.map((c) => <Row key={c.id} c={c} />)}</ul> : <Empty title="Sin resultados registrados" />}</section>
        </div>
        {staff && (
          <Card title={edit ? "Editar competencia" : "Nueva competencia"} className={edit ? "border-volt/50 h-fit" : "h-fit"}>
            <form action={saveCompetition} className="space-y-3" key={edit?.id ?? "new"}>
              {edit && <input type="hidden" name="id" value={edit.id} />}
              <Field label="Nombre"><input name="name" defaultValue={edit?.name} className="input" required /></Field>
              <Field label="Para"><select name="target" defaultValue={edit ? (edit.groupId ? `g:${edit.groupId}` : `a:${edit.athleteId}`) : ""} className="input" required>
                <option value="">Elegir…</option>
                <optgroup label="Grupos">{groups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
                <optgroup label="Deportistas">{athletes.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}</optgroup>
              </select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Fecha"><input type="date" name="date" defaultValue={edit?.date.toISOString().slice(0, 10)} className="input" required /></Field>
                <Field label="Prioridad"><select name="priority" defaultValue={edit?.priority ?? "B"} className="input"><option value="A">A · objetivo</option><option value="B">B · importante</option><option value="C">C · preparatoria</option></select></Field>
              </div>
              <Field label="Lugar"><input name="location" defaultValue={edit?.location ?? ""} className="input" /></Field>
              <Field label="Deporte"><select name="sport" defaultValue={edit?.sport} className="input">{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
              <div className="rounded-xl border border-ink-700 p-3">
                <div className="label mb-2">Resultado (después de competir)</div>
                <div className="space-y-2">
                  <input name="result" defaultValue={edit?.result ?? ""} className="input" placeholder="Ej: 100 m — 12.18 s (+0.5)" />
                  <div className="grid grid-cols-2 gap-2"><input name="mark" defaultValue={edit?.mark ?? ""} className="input" placeholder="Marca" /><input name="position" type="number" defaultValue={edit?.position ?? ""} className="input" placeholder="Puesto" /></div>
                </div>
              </div>
              <Submit className="btn-primary w-full">{edit ? "Guardar" : "Agregar"}</Submit>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}

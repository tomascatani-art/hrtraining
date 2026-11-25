import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionWhere, visibleAthleteIds, visibleGroups } from "@/lib/access";
import { PHASES, MICRO_TYPES, SESSION_TYPES } from "@/lib/catalog";
import { addDays, isoDay, startOfWeek } from "@/lib/metrics";
import { PageHeader, fmtTime } from "@/components/ui";

export const metadata = { title: "Calendario" };

const TYPE_COLOR: Record<string, string> = { FUERZA: "#ffd60a", PISTA: "#fb923c", TECNICO: "#3a8fd6", RESISTENCIA: "#22d3ee", RECUPERACION: "#4ade80", EVALUACION: "#8f78e0", COMPETENCIA: "#d9566f" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  if (sp.new === "1" && u.role !== "ATHLETE") {
    const q = new URLSearchParams();
    for (const k of ["group", "athlete", "plan", "date"]) if (sp[k]) q.set(k, sp[k]!);
    redirect(`/app/sessions/new?${q}`);
  }
  const now = new Date();
  const [y, m] = (sp.m ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(gridStart, 42);
  const prev = `${m === 1 ? y - 1 : y}-${m === 1 ? 12 : m - 1}`;
  const next = `${m === 12 ? y + 1 : y}-${m === 12 ? 1 : m + 1}`;

  const sw = await sessionWhere(u);
  const filter = sp.group ? { groupId: sp.group } : sp.athlete ? { OR: [{ athleteId: sp.athlete }, { group: { members: { some: { athleteId: sp.athlete } } } }] } : {};
  const ids = await visibleAthleteIds(u);
  const athleteFocus = u.role === "ATHLETE" ? u.id : sp.athlete;
  const [sessions, comps, evals, groups, athletes, micros] = await Promise.all([
    db.session.findMany({ where: { AND: [sw, filter], date: { gte: gridStart, lt: gridEnd } }, include: { group: true, athlete: true, logs: u.role === "ATHLETE" ? { where: { athleteId: u.id } } : true }, orderBy: { date: "asc" } }),
    db.competition.findMany({ where: { orgId: u.orgId, date: { gte: gridStart, lt: gridEnd }, OR: [{ athleteId: { in: ids } }, { group: { members: { some: { athleteId: { in: ids } } } } }] } }),
    db.evaluation.groupBy({ by: ["date"], where: { athleteId: { in: athleteFocus ? [athleteFocus] : ids }, date: { gte: gridStart, lt: gridEnd } }, _count: true }),
    u.role !== "ATHLETE" ? visibleGroups(u) : Promise.resolve([]),
    u.role !== "ATHLETE" ? db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    // Microciclos de la planificación del alumno o grupo seleccionado
    (async () => {
      const groupIds = sp.group ? [sp.group] : athleteFocus ? (await db.groupMember.findMany({ where: { athleteId: athleteFocus } })).map((g) => g.groupId) : [];
      if (!groupIds.length && !athleteFocus) return [];
      return db.planBlock.findMany({ where: { level: "MICRO", startDate: { lt: gridEnd }, endDate: { gt: gridStart }, plan: { OR: [{ groupId: { in: groupIds } }, ...(athleteFocus ? [{ athleteId: athleteFocus }] : [])] } }, include: { parent: true } });
    })(),
  ]);

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = isoDay(now);
  const monthLabel = first.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const qs = (extra: Record<string, string>) => { const q = new URLSearchParams(); if (sp.group) q.set("group", sp.group); if (sp.athlete) q.set("athlete", sp.athlete); for (const [k, v] of Object.entries(extra)) q.set(k, v); return `?${q}`; };

  return (
    <>
      <PageHeader title="Calendario" subtitle="Sesiones y competencias. Las franjas superiores de cada semana muestran el microciclo planificado."
        actions={u.role !== "ATHLETE" ? <Link href={`/app/sessions/new${sp.group ? `?group=${sp.group}` : sp.athlete ? `?athlete=${sp.athlete}` : ""}`} className="btn-primary">Nueva sesión</Link> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/app/calendar${qs({ m: prev })}`} className="btn-ghost btn-sm" aria-label="Mes anterior"><ChevronLeft size={16} /></Link>
        <div className="min-w-[150px] text-center font-display text-lg font-semibold text-white first-letter:uppercase">{monthLabel}</div>
        <Link href={`/app/calendar${qs({ m: next })}`} className="btn-ghost btn-sm" aria-label="Mes siguiente"><ChevronRight size={16} /></Link>
        <Link href={`/app/calendar${qs({})}`} className="btn-ghost btn-sm">Hoy</Link>
        {u.role !== "ATHLETE" && (
          <form className="ml-auto flex gap-2">
            <input type="hidden" name="m" value={`${y}-${m}`} />
            <select name="group" defaultValue={sp.group ?? ""} className="input py-1.5 text-xs"><option value="">Todos los grupos</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <select name="athlete" defaultValue={sp.athlete ?? ""} className="input py-1.5 text-xs"><option value="">Todos los alumnos</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <button className="btn-ghost btn-sm">Ver</button>
          </form>
        )}
      </div>

      {/* Vista mensual (tablet/escritorio) */}
      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-ink-700">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="label px-3 py-2">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = isoDay(d);
            const ds = sessions.filter((s) => isoDay(s.date) === key);
            const dc = comps.filter((c) => isoDay(c.date) === key);
            const de = evals.filter((e) => isoDay(e.date) === key);
            const micro = i % 7 === 0 ? micros.find((mc) => mc.startDate <= addDays(d, 1) && mc.endDate > d) : null;
            return (
              <div key={key} className={clsx("relative min-h-[118px] border-b border-r border-ink-800 p-1.5", d.getMonth() !== m - 1 && "bg-ink-950/60 opacity-50")}>
                {micro && (
                  <div className="absolute left-0 right-[-600%] top-0 z-[1] h-1" style={{ background: PHASES[micro.phase]?.color }} title={`${micro.parent?.name} · ${micro.name}`} />
                )}
                <div className="mb-1 flex items-center justify-between">
                  <Link href={u.role !== "ATHLETE" ? `/app/sessions/new?date=${key}${sp.group ? `&group=${sp.group}` : ""}` : "#"} className={clsx("num grid h-6 w-6 place-items-center rounded-full text-xs", key === today ? "bg-volt font-bold text-black" : "text-neutral-400 hover:bg-ink-700")}>{d.getDate()}</Link>
                  {micro && <span className="truncate text-[9px] uppercase tracking-wider text-neutral-500">{MICRO_TYPES[micro.microType ?? "CARGA"]?.label}</span>}
                </div>
                <div className="space-y-1">
                  {dc.map((c) => <Link key={c.id} href="/app/competitions" className="flex items-center gap-1 truncate rounded bg-[#d9566f] px-1.5 py-0.5 text-[11px] font-semibold text-white"><Trophy size={11} />{c.name}</Link>)}
                  {ds.map((s) => {
                    const done = s.logs.some((l) => l.status === "COMPLETADO" || l.status === "PARCIAL");
                    return (
                      <Link key={s.id} href={`/app/sessions/${s.id}`} className="block truncate rounded border-l-2 bg-ink-800 px-1.5 py-0.5 text-[11px] text-neutral-200 transition hover:bg-ink-700" style={{ borderColor: TYPE_COLOR[s.type] }}>
                        <span className="num text-neutral-500">{fmtTime(s.date)}</span> {done && u.role === "ATHLETE" ? "✓ " : ""}{s.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vista de agenda (móvil) */}
      <div className="space-y-2 md:hidden">
        {days.filter((d) => d.getMonth() === m - 1).map((d) => {
          const key = isoDay(d);
          const ds = sessions.filter((s) => isoDay(s.date) === key);
          const dc = comps.filter((c) => isoDay(c.date) === key);
          if (!ds.length && !dc.length && key !== today) return null;
          return (
            <div key={key} className={clsx("card flex gap-3 p-3", key === today && "border-volt/50")}>
              <div className="w-11 text-center"><div className="label">{d.toLocaleDateString("es-AR", { weekday: "short" })}</div><div className={clsx("num text-xl font-semibold", key === today ? "text-volt" : "text-white")}>{d.getDate()}</div></div>
              <div className="flex-1 space-y-1.5">
                {dc.map((c) => <div key={c.id} className="flex items-center gap-1.5 text-sm font-semibold text-[#f9a8b8]"><Trophy size={13} />{c.name}</div>)}
                {ds.map((s) => (
                  <Link key={s.id} href={`/app/sessions/${s.id}`} className="block rounded-lg border-l-2 bg-ink-800 px-2.5 py-1.5" style={{ borderColor: TYPE_COLOR[s.type] }}>
                    <div className="text-sm font-medium text-white">{s.title}</div>
                    <div className="text-xs muted">{fmtTime(s.date)} · {SESSION_TYPES[s.type]} · {s.group?.name ?? s.athlete?.name}</div>
                  </Link>
                ))}
                {!ds.length && !dc.length && <div className="text-sm muted">Sin actividades</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">{Object.entries(TYPE_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{SESSION_TYPES[k]}</span>)}</div>
    </>
  );
}

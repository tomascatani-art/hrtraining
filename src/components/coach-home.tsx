import Link from "next/link";
import { ChevronDown, Trophy, Wallet, CalendarDays, AlertTriangle, Clock, ClipboardList, Activity, HeartPulse } from "lucide-react";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { avatarSrc } from "@/lib/avatar";
import { sessionWhere, visibleAthleteIds } from "@/lib/access";
import { monitoringFor } from "@/lib/queries";
import { addDays, startOfDay, startOfWeek } from "@/lib/metrics";
import { SESSION_TYPES } from "@/lib/catalog";
import { monthKey, monthLabel } from "@/lib/fees";
import { PageHeader, Avatar, fmtDate, fmtDateLong, fmtTime, fmtNum } from "@/components/ui";
import { AlertList } from "@/components/alerts";
import { SetupGuide } from "@/components/setup-guide";
import type { RoutineData } from "@/lib/routine";

const DAY = 86400000;

/** "Entró hoy 13:14", "ayer 22:22", "lun 18:05", "12 nov" */
function seenLabel(d: Date, now: Date) {
  const today = startOfDay(now);
  if (d >= today) return { main: `Entró hoy ${fmtTime(d)}`, today: true };
  if (d >= addDays(today, -1)) return { main: `ayer ${fmtTime(d)}`, today: false };
  if (d >= addDays(today, -6)) return { main: `${fmtDate(d, { weekday: "short" })} ${fmtTime(d)}`, today: false };
  return { main: fmtDate(d), today: false };
}
function ago(d: Date, now: Date) {
  const m = Math.max(0, Math.round((+now - +d) / 60000));
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** Tarjeta que se abre y se cierra (sin JavaScript, reacciona al instante). */
function Fold({ icon, title, right, rightClass, children, open }: { icon: React.ReactNode; title: string; right?: React.ReactNode; rightClass?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group card overflow-hidden" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-800 text-volt">{icon}</span>
        <span className="min-w-0 flex-1 font-display text-[15px] font-semibold leading-tight text-white">{title}</span>
        {right != null && <span className={clsx("shrink-0 text-right text-sm font-semibold", rightClass ?? "text-neutral-400")}>{right}</span>}
        <ChevronDown size={18} className="shrink-0 text-neutral-500 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-ink-800 px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}

const Nada = ({ children }: { children: React.ReactNode }) => <p className="text-sm muted">{children}</p>;

export async function CoachHome() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const ids = await visibleAthleteIds(u);
  const sw = await sessionWhere(u);
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = startOfWeek(now);
  const period = monthKey(now);

  const [athletes, monthSessions, weekSessions, comps, fees, routines, plans, mon, logs, wellness, org] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, avatarKey: true, avatarAt: true, isDemo: true, lastSeenAt: true, firstSeenAt: true, athleteProfile: { select: { paused: true, feeAmount: true } } },
      orderBy: { name: "asc" },
    }),
    db.session.findMany({ where: { ...sw, date: { gte: monthStart, lte: now } }, select: { id: true, athleteId: true, groupId: true, group: { select: { members: { select: { athleteId: true } } } }, logs: { select: { athleteId: true, status: true } } } }),
    db.session.findMany({ where: { ...sw, date: { gte: weekStart, lt: addDays(weekStart, 7) } }, include: { group: true, athlete: true }, orderBy: { date: "asc" } }),
    db.competition.findMany({ where: { orgId: u.orgId, date: { gte: today }, OR: [{ athleteId: { in: ids } }, { group: { members: { some: { athleteId: { in: ids } } } } }] }, orderBy: { date: "asc" }, take: 6, include: { group: true, athlete: true } }),
    db.fee.findMany({ where: { orgId: u.orgId, period, athleteId: { in: ids } } }),
    db.routine.findMany({ where: { orgId: u.orgId, active: true, template: false, athleteId: { in: ids } }, select: { id: true, name: true, data: true, createdAt: true, athlete: { select: { id: true, name: true, avatarKey: true, avatarAt: true } } } }),
    db.plan.findMany({ where: { orgId: u.orgId, endDate: { gte: addDays(today, -7), lte: addDays(today, 21) }, OR: [{ athleteId: { in: ids } }, { group: { members: { some: { athleteId: { in: ids } } } } }] }, include: { athlete: true, group: true }, orderBy: { endDate: "asc" } }),
    monitoringFor(ids),
    db.workoutLog.findMany({ where: { athleteId: { in: ids } }, orderBy: { completedAt: "desc" }, take: 30, include: { athlete: { select: { id: true, name: true, avatarKey: true, avatarAt: true, isDemo: true } }, session: { select: { id: true, title: true } } } }),
    db.wellness.findMany({ where: { athleteId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 20, include: { athlete: { select: { id: true, name: true, avatarKey: true, avatarAt: true, isDemo: true } } } }),
    db.organization.findUnique({ where: { id: u.orgId }, select: { feeAmount: true } }),
  ]);

  // ---- Últimas conexiones
  const seen = athletes.filter((a) => a.lastSeenAt).sort((a, b) => +b.lastSeenAt! - +a.lastSeenAt!);
  const never = athletes.filter((a) => !a.lastSeenAt);
  const todayCount = seen.filter((a) => a.lastSeenAt! >= today).length;
  const ConnRow = ({ a }: { a: (typeof athletes)[number] }) => {
    const s = seenLabel(a.lastSeenAt!, now);
    const first = a.firstSeenAt && startOfDay(a.firstSeenAt).getTime() === startOfDay(a.lastSeenAt!).getTime() && +a.lastSeenAt! - +a.firstSeenAt > 5 * 60000 ? a.firstSeenAt : null;
    return (
      <li>
        <Link href={`/app/athletes/${a.id}`} className={clsx("flex items-center gap-3 rounded-2xl border px-3 py-3 transition hover:border-volt/50", s.today ? "border-volt/60 bg-volt/[.06]" : "border-ink-700 bg-ink-900")}>
          <Avatar name={a.name} src={avatarSrc(a)} size={42} />
          <span className="min-w-0 flex-1 font-semibold leading-tight text-white [overflow-wrap:anywhere]">{a.name}</span>
          <span className="shrink-0 text-right">
            <span className={clsx("block text-sm font-bold", s.today ? "text-volt" : "text-white")}>{s.today && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-volt align-middle" />}{s.main}</span>
            <span className="block text-xs muted">{first ? `1.º ingreso ${fmtTime(first)}` : ""}{first && !s.today ? " · " : ""}{!s.today ? ago(a.lastSeenAt!, now) : ""}</span>
          </span>
        </Link>
      </li>
    );
  };

  // ---- Cumplimiento del mes (sesiones hechas / sesiones que le tocaban)
  const expected = new Map<string, number>(), done = new Map<string, number>();
  for (const s of monthSessions) {
    const who = s.groupId ? s.group!.members.map((m) => m.athleteId) : s.athleteId ? [s.athleteId] : [];
    for (const id of who) if (ids.includes(id)) expected.set(id, (expected.get(id) ?? 0) + 1);
    for (const l of s.logs) if ((l.status === "COMPLETADO" || l.status === "PARCIAL") && ids.includes(l.athleteId)) done.set(l.athleteId, (done.get(l.athleteId) ?? 0) + 1);
  }
  const ranking = athletes.filter((a) => expected.get(a.id)).map((a) => ({ a, exp: expected.get(a.id)!, done: Math.min(done.get(a.id) ?? 0, expected.get(a.id)!) }))
    .map((r) => ({ ...r, pct: Math.round((r.done / r.exp) * 100) })).sort((x, y) => y.pct - x.pct || y.done - x.done);
  const avgPct = ranking.length ? Math.round(ranking.reduce((s, r) => s + r.pct, 0) / ranking.length) : null;

  // ---- Cuotas del mes (sin registro = pendiente; pausados no cuentan)
  const feeBy = new Map(fees.map((f) => [f.athleteId, f]));
  const billable = athletes.filter((a) => !a.athleteProfile?.paused);
  const paid = billable.filter((a) => ["PAGADO", "BONIFICADO"].includes(feeBy.get(a.id)?.status ?? ""));
  const pending = billable.filter((a) => !["PAGADO", "BONIFICADO"].includes(feeBy.get(a.id)?.status ?? ""));
  const collected = fees.filter((f) => f.status === "PAGADO").reduce((s, f) => s + (f.amount ?? 0), 0);
  const pendingAmount = pending.reduce((s, a) => s + (feeBy.get(a.id)?.amount ?? a.athleteProfile?.feeAmount ?? org?.feeAmount ?? 0), 0);

  // ---- Planes por vencer: rutinas con fecha de inicio + semanas, y planificaciones con fecha de fin
  type Exp = { key: string; name: string; who: string; href: string; end: Date };
  const expiring: Exp[] = [];
  for (const r of routines) {
    const d = r.data as unknown as RoutineData;
    const start = d?.meta?.start ? new Date(`${d.meta.start}T00:00:00-03:00`) : r.createdAt;
    const end = addDays(start, (d?.weeks ?? 4) * 7);
    if (end <= addDays(today, 10) && end >= addDays(today, -14)) expiring.push({ key: r.id, name: r.name, who: r.athlete?.name ?? "", href: `/app/routines/${r.id}`, end });
  }
  for (const p of plans) expiring.push({ key: p.id, name: p.name, who: p.athlete?.name ?? p.group?.name ?? "", href: `/app/planning/${p.id}`, end: p.endDate });
  expiring.sort((a, b) => +a.end - +b.end);

  // ---- Alertas y actividad reciente
  const alerts = mon.flatMap((m) => m.alerts.filter((a) => a.kind !== "SIN_REGISTRO").map((a) => ({ ...a, athlete: m.user })));
  type Act = { key: string; at: Date; who: { id: string; name: string; avatarKey: string | null; avatarAt: Date | null; isDemo: boolean }; text: React.ReactNode; extra?: string };
  const acts: Act[] = [
    ...logs.map((l) => ({ key: "l" + l.id, at: l.completedAt, who: l.athlete, text: <>{l.status === "COMPLETADO" ? "completó" : l.status === "PARCIAL" ? "completó una parte de" : "no hizo"} <Link href={`/app/sessions/${l.session.id}`} className="text-neutral-200 hover:text-volt">{l.session.title}</Link></>, extra: l.load != null ? `RPE ${l.rpe} · ${l.load} UA` : undefined })),
    ...wellness.map((w) => ({ key: "w" + w.id, at: w.createdAt, who: w.athlete, text: <>cargó cómo se siente <HeartPulse size={13} className="inline text-volt" /></> })),
  ].sort((a, b) => +b.at - +a.at).slice(0, 25);

  const daysTo = (d: Date) => Math.ceil((+startOfDay(d) - +today) / DAY);

  return (
    <>
      <PageHeader
        eyebrow={fmtDateLong(now)}
        title={`Hola, ${u.name.split(" ")[0]}`}
        subtitle={`${ids.length} ${ids.length === 1 ? "deportista" : "deportistas"} · ${todayCount} ${todayCount === 1 ? "entró" : "entraron"} hoy`}
        actions={<><Link href="/app/routines" className="btn-primary">Rutinas</Link><Link href="/app/calendar?new=1" className="btn-ghost">Nueva sesión</Link></>}
      />
      <SetupGuide u={u} />

      <div className="mx-auto max-w-3xl space-y-3">
        {/* Últimas conexiones */}
        <section className="card card-pad">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={17} className="text-volt" />
            <h2 className="h2 flex-1">Últimas conexiones</h2>
            {todayCount > 0 && <span className="chip border-volt/40 bg-volt/10 text-volt">{todayCount} hoy</span>}
          </div>
          {seen.length ? (
            <>
              <ul className="space-y-2">{seen.slice(0, 5).map((a) => <ConnRow key={a.id} a={a} />)}</ul>
              {seen.length > 5 && (
                <details className="group mt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-600 py-3 text-sm font-semibold text-neutral-300 hover:border-volt/50 hover:text-white [&::-webkit-details-marker]:hidden">
                    <ChevronDown size={16} className="transition group-open:rotate-180" />
                    <span className="group-open:hidden">Ver todos ({seen.length})</span><span className="hidden group-open:inline">Ver menos</span>
                  </summary>
                  <ul className="mt-2 space-y-2">{seen.slice(5).map((a) => <ConnRow key={a.id} a={a} />)}</ul>
                </details>
              )}
            </>
          ) : <Nada>Todavía nadie abrió la app. Cuando tus deportistas entren, vas a ver acá quién entró y a qué hora.</Nada>}
          {never.length > 0 && (
            <p className="mt-3 text-sm muted">
              <span className="text-neutral-300">Todavía no entraron:</span> {never.map((a, i) => <span key={a.id}><Link href={`/app/athletes/${a.id}`} className="hover:text-volt">{a.name}</Link>{i < never.length - 1 ? ", " : ""}</span>)}
            </p>
          )}
        </section>

        {/* Ranking de cumplimiento */}
        <Fold icon={<Trophy size={17} />} title="Ranking de cumplimiento" right={avgPct != null ? `${avgPct}% prom.` : "—"} rightClass={avgPct != null && avgPct < 50 ? "text-white" : "text-volt"}>
          {ranking.length ? (
            <ol className="space-y-2.5">
              {ranking.map((r, i) => (
                <li key={r.a.id} className="flex items-center gap-3">
                  <span className={clsx("num w-6 text-center text-sm font-bold", i < 3 ? "text-volt" : "text-neutral-500")}>{i + 1}</span>
                  <Avatar name={r.a.name} src={avatarSrc(r.a)} size={28} />
                  <Link href={`/app/athletes/${r.a.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-white hover:text-volt">{r.a.name}</Link>
                  <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-ink-700 sm:block"><span className="block h-full rounded-full bg-volt" style={{ width: `${r.pct}%` }} /></span>
                  <span className="num w-20 text-right text-xs text-neutral-400">{r.done}/{r.exp} · <span className="font-semibold text-white">{r.pct}%</span></span>
                </li>
              ))}
            </ol>
          ) : <Nada>Este mes todavía no hay sesiones asignadas para medir el cumplimiento.</Nada>}
          <p className="mt-3 text-xs text-neutral-600">Sesiones hechas sobre las que le tocaban en {monthLabel(period).toLowerCase()}.</p>
        </Fold>

        {/* Cuotas */}
        <Fold icon={<Wallet size={17} />} title={`Cuotas de ${monthLabel(period).split(" ")[0].toLowerCase()}`} right={pending.length ? `${pending.length} sin pagar` : "al día"} rightClass={pending.length ? "text-white" : "text-volt"}>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink-900 p-2.5"><div className="num text-xl font-bold text-volt">{paid.length}</div><div className="text-[11px] muted">pagaron</div></div>
            <div className="rounded-xl bg-ink-900 p-2.5"><div className="num text-xl font-bold text-white">{pending.length}</div><div className="text-[11px] muted">pendientes</div></div>
            <div className="rounded-xl bg-ink-900 p-2.5"><div className="num text-xl font-bold text-white">${fmtNum(collected)}</div><div className="text-[11px] muted">cobrado</div></div>
          </div>
          {pending.length > 0 && (
            <ul className="divide-y divide-ink-800">
              {pending.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <Avatar name={a.name} src={avatarSrc(a)} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{a.name}</span>
                  <span className="num text-xs text-neutral-400">{(() => { const v = feeBy.get(a.id)?.amount ?? a.athleteProfile?.feeAmount ?? org?.feeAmount; return v != null ? `$${fmtNum(v)}` : "sin monto"; })()}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-between text-xs">
            {pendingAmount > 0 ? <span className="muted">Falta cobrar ${fmtNum(pendingAmount)}</span> : <span />}
            <Link href="/app/fees" className="font-semibold text-volt hover:underline">Ir a cuotas</Link>
          </div>
        </Fold>

        {/* Próximas competencias */}
        <Fold icon={<Trophy size={17} />} title="Próximas competencias" right={comps.length || undefined}>
          {comps.length ? (
            <ul className="space-y-2">
              {comps.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5">
                  <div className={`grid h-9 w-9 place-items-center rounded-lg font-display font-bold ${c.priority === "A" ? "bg-volt text-black" : "bg-ink-700 text-white"}`}>{c.priority}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{c.name}</div><div className="truncate text-xs muted">{fmtDate(c.date)} · {c.group?.name ?? c.athlete?.name}</div></div>
                  <div className="text-right"><div className="num text-lg font-semibold text-volt">{daysTo(c.date)}</div><div className="text-[10px] muted">días</div></div>
                </li>
              ))}
            </ul>
          ) : <Nada>No hay competencias cargadas. <Link href="/app/competitions" className="text-volt hover:underline">Agregar</Link></Nada>}
        </Fold>

        {/* Agenda de la semana */}
        <Fold icon={<CalendarDays size={17} />} title="Esta semana" right={weekSessions.length || undefined}>
          {weekSessions.length ? (
            <ul className="space-y-1.5">
              {weekSessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/sessions/${s.id}`} className={clsx("flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-800", s.date < today && "opacity-50")}>
                    <span className="w-12 text-center"><span className="label block">{fmtDate(s.date, { weekday: "short" })}</span><span className="num text-base font-semibold text-white">{new Date(s.date).getDate()}</span></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{s.title}</span><span className="block truncate text-xs muted">{SESSION_TYPES[s.type]} · {s.group?.name ?? s.athlete?.name} · {fmtTime(s.date)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Nada>No hay sesiones esta semana. <Link href="/app/calendar?new=1" className="text-volt hover:underline">Crear una</Link></Nada>}
        </Fold>

        {/* Planes por vencer */}
        <Fold icon={<AlertTriangle size={17} />} title="Planes por vencer" right={expiring.length || undefined} rightClass="text-volt">
          {expiring.length ? (
            <ul className="divide-y divide-ink-800">
              {expiring.map((e) => {
                const d = daysTo(e.end);
                return (
                  <li key={e.key}>
                    <Link href={e.href} className="flex items-center gap-3 py-2.5 hover:text-volt">
                      <ClipboardList size={16} className="shrink-0 text-neutral-500" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{e.who}</span><span className="block truncate text-xs muted">{e.name}</span></span>
                      <span className={clsx("shrink-0 text-xs font-semibold", d <= 0 ? "text-volt" : "text-neutral-300")}>{d < 0 ? `venció hace ${-d} ${d === -1 ? "día" : "días"}` : d === 0 ? "vence hoy" : `vence en ${d} ${d === 1 ? "día" : "días"}`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <Nada>Ningún plan vence en los próximos 10 días.</Nada>}
        </Fold>

        {/* Alertas */}
        <Fold icon={<Activity size={17} />} title="Alertas de seguimiento" right={alerts.length || undefined} rightClass="text-volt">
          <AlertList items={alerts.slice(0, 8)} />
          <Link href="/app/load" className="mt-3 inline-block text-xs font-semibold text-volt hover:underline">Ver cargas y bienestar</Link>
        </Fold>

        {/* Actividad reciente */}
        <Fold icon={<Clock size={17} />} title="Actividad reciente (tu grupo)" right={acts.length || undefined}>
          {acts.length ? (
            <ul className="divide-y divide-ink-800">
              {acts.map((x) => (
                <li key={x.key} className="flex items-center gap-3 py-2.5">
                  <Avatar name={x.who.name} src={avatarSrc(x.who)} size={28} />
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/app/athletes/${x.who.id}`} className="font-semibold text-white hover:text-volt">{x.who.name}</Link> <span className="muted">{x.text}</span>
                    {x.extra && <span className="ml-2 num text-xs text-neutral-500">{x.extra}</span>}
                  </div>
                  <span className="shrink-0 text-xs text-neutral-600">{ago(x.at, now)}</span>
                </li>
              ))}
            </ul>
          ) : <Nada>Sin actividad todavía.</Nada>}
        </Fold>
      </div>
    </>
  );
}

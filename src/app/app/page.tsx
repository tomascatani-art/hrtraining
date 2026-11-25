import Link from "next/link";
import { Notice } from "@/components/routine-notice";
import { currentRoutine } from "@/lib/routine-server";
import { sanitizeRoutine } from "@/lib/routine";
import { avatarSrc } from "@/lib/avatar";
import { Users, CalendarCheck, Percent, AlertTriangle, ClipboardList, Trophy, ArrowRight, Flame, HeartPulse } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionWhere, visibleAthleteIds } from "@/lib/access";
import { monitoringFor } from "@/lib/queries";
import { addDays, startOfDay, startOfWeek, weeklySeries, improvement, dateOnly } from "@/lib/metrics";
import { TEST_MAP, SESSION_TYPES, isBasicTest } from "@/lib/catalog";
import { Card, Stat, PageHeader, Empty, Avatar, DemoBadge, fmtDate, fmtDateLong, fmtTime, Delta, fmtNum } from "@/components/ui";
import { LoadBars, TrendChart } from "@/components/charts";
import { AlertList } from "@/components/alerts";
import { TodayPanel } from "@/components/today-panel";
import { SetupGuide } from "@/components/setup-guide";
import { streakFor } from "@/lib/training";
import { feeStatusFor, monthKey, monthLabel } from "@/lib/fees";
import { fmtKg } from "@/lib/plates";
import { markRMSeen } from "./rm/actions";
import { Submit } from "@/components/forms";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  return u.role === "ATHLETE" ? <AthleteHome userId={u.id} name={u.name} /> : <CoachHome welcome={sp.bienvenida === "1"} />;
}

async function CoachHome({ welcome: _welcome }: { welcome: boolean }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const ids = await visibleAthleteIds(u);
  const sw = await sessionWhere(u);
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const [mon, weekSessions, upcoming, comps, recentLogs, evalRecent, groups] = await Promise.all([
    monitoringFor(ids),
    db.session.findMany({ where: { ...sw, date: { gte: weekStart, lt: weekEnd } }, include: { logs: true, group: { include: { members: true } } } }),
    db.session.findMany({ where: { ...sw, date: { gte: startOfDay(now), lt: addDays(now, 7) } }, include: { group: true, athlete: true }, orderBy: { date: "asc" }, take: 6 }),
    db.competition.findMany({ where: { orgId: u.orgId, date: { gte: startOfDay(now) }, OR: [{ athleteId: { in: ids } }, { group: { members: { some: { athleteId: { in: ids } } } } }] }, orderBy: { date: "asc" }, take: 4, include: { group: true, athlete: true } }),
    db.workoutLog.findMany({ where: { athleteId: { in: ids } }, orderBy: { completedAt: "desc" }, take: 7, include: { athlete: true, session: true } }),
    db.evaluation.findMany({ where: { athleteId: { in: ids }, date: { gte: addDays(now, -60) } }, select: { athleteId: true } }),
    db.group.count({ where: { orgId: u.orgId, ...(u.role === "COACH" ? { coachId: u.id } : {}) } }),
  ]);

  // Asistencia: registros completados / esperados (sesiones pasadas de la semana)
  let expected = 0, present = 0;
  for (const s of weekSessions.filter((s) => s.date <= now)) {
    const n = s.groupId ? s.group!.members.length : 1;
    expected += n;
    present += s.logs.filter((l) => l.status === "COMPLETADO" || l.status === "PARCIAL").length;
  }
  const attendance = expected ? Math.round((present / expected) * 100) : null;
  const alerts = mon.flatMap((m) => m.alerts.filter((a) => a.kind !== "SIN_REGISTRO").map((a) => ({ ...a, athlete: m.user })));
  const evaluated = new Set(evalRecent.map((e) => e.athleteId));
  const pendingEval = mon.filter((m) => !evaluated.has(m.user.id));
  const teamWeekly = weeklySeries(mon.flatMap((m) => m.points), 8).map((w) => ({ x: w.week, load: Math.round(w.load / Math.max(1, ids.length)) }));

  // Evolución del CMJ promedio del equipo por mes
  const cmj = await db.evaluation.findMany({ where: { athleteId: { in: ids }, testKey: "CMJ" }, orderBy: { date: "asc" } });
  const byMonth = new Map<string, number[]>();
  for (const e of cmj) {
    const k = fmtDate(e.date, { month: "short", year: "2-digit" });
    byMonth.set(k, [...(byMonth.get(k) ?? []), e.value]);
  }
  const cmjTrend = [...byMonth.entries()].map(([x, v]) => ({ x, cmj: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }));

  return (
    <>
      <PageHeader
        eyebrow={fmtDateLong(now)}
        title={`Hola, ${u.name.split(" ")[0]}`}
        subtitle="Estado del equipo, alertas de seguimiento y lo que viene esta semana."
        actions={<><Link href="/app/calendar?new=1" className="btn-primary">Nueva sesión</Link><Link href="/app/evaluations/new" className="btn-ghost">Cargar evaluación</Link></>}
      />
      <SetupGuide u={u} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Deportistas activos" value={ids.length} hint={`${groups} grupos`} icon={<Users size={16} />} href="/app/athletes" />
        <Stat label="Sesiones semana" value={weekSessions.length} hint="programadas" icon={<CalendarCheck size={16} />} href="/app/calendar" />
        <Stat label="Asistencia" value={attendance ?? "—"} unit={attendance != null ? "%" : undefined} hint="semana en curso" icon={<Percent size={16} />} />
        <Stat label="Alertas" value={alerts.length} hint="para revisar" accent={alerts.length > 0} icon={<AlertTriangle size={16} />} href="/app/load" />
        <Stat label="Evaluaciones pendientes" value={pendingEval.length} hint="sin test en 60 días" icon={<ClipboardList size={16} />} href="/app/evaluations" />
        <Stat label="Competencias" value={comps.length} hint="próximas" icon={<Trophy size={16} />} href="/app/competitions" />
      </div>

      <TodayPanel ids={ids} />

      <div className="mt-6 grid gap-6 xl:grid-cols-3 xl:items-start">
        <Card title="Carga semanal promedio" action={<span className="label">sRPE · UA por deportista</span>} className="xl:col-span-2">
          {teamWeekly.some((w) => w.load > 0) ? <LoadBars data={teamWeekly} height={300} /> : <Empty title="Sin cargas registradas">Cuando los deportistas registren sus sesiones vas a ver la evolución acá.</Empty>}
        </Card>
        <Card title="Alertas de seguimiento" action={<Link href="/app/load" className="text-xs text-volt hover:underline">Ver todo</Link>}>
          <AlertList items={alerts.slice(0, 5)} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Próximas sesiones">
          {upcoming.length ? (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/sessions/${s.id}`} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 transition hover:border-volt/40">
                    <div className="w-12 text-center">
                      <div className="label">{fmtDate(s.date, { weekday: "short" })}</div>
                      <div className="num text-lg font-semibold text-white">{new Date(s.date).getDate()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{s.title}</div>
                      <div className="truncate text-xs muted">{SESSION_TYPES[s.type]} · {s.group?.name ?? s.athlete?.name} · {fmtTime(s.date)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="Nada programado">Creá sesiones desde el calendario.</Empty>}
        </Card>
        <Card title="Evolución de rendimiento" action={<span className="label">CMJ promedio (cm)</span>}>
          {cmjTrend.length > 1 ? <TrendChart data={cmjTrend} series={[{ key: "cmj", name: "CMJ" }]} unit="cm" height={220} /> : <Empty title="Sin datos suficientes">Cargá al menos dos evaluaciones de CMJ.</Empty>}
        </Card>
        <Card title="Próximas competencias">
          {comps.length ? (
            <ul className="space-y-2">
              {comps.map((c) => {
                const days = Math.ceil((+c.date - +startOfDay(now)) / 86400000);
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5">
                    <div className={`grid h-10 w-10 place-items-center rounded-lg font-display font-bold ${c.priority === "A" ? "bg-volt text-black" : "bg-ink-700 text-white"}`}>{c.priority}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                      <div className="truncate text-xs muted">{fmtDate(c.date)} · {c.group?.name ?? c.athlete?.name}</div>
                    </div>
                    <div className="text-right"><div className="num text-lg font-semibold text-volt">{days}</div><div className="text-[10px] muted">días</div></div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Sin competencias">Registralas en Competencias.</Empty>}
        </Card>
      </div>

      <Card title="Actividad reciente" className="mt-6">
        {recentLogs.length ? (
          <ul className="divide-y divide-ink-800">
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={l.athlete.name} src={avatarSrc(l.athlete)} size={30} />
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={`/app/athletes/${l.athleteId}`} className="font-semibold text-white hover:text-volt">{l.athlete.name}</Link>{" "}
                  <span className="muted">{l.status === "COMPLETADO" ? "completó" : l.status === "PARCIAL" ? "completó parcialmente" : "no asistió a"}</span>{" "}
                  <Link href={`/app/sessions/${l.sessionId}`} className="text-neutral-200 hover:text-volt">{l.session.title}</Link>
                  {l.athlete.isDemo && <span className="ml-2"><DemoBadge /></span>}
                </div>
                {l.load != null && <span className="num text-xs text-neutral-400">RPE {l.rpe} · {l.load} UA</span>}
                <span className="hidden text-xs text-neutral-600 sm:block">{fmtDate(l.completedAt)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="Sin actividad todavía" />}
      </Card>
    </>
  );
}

async function AthleteHome({ userId, name }: { userId: string; name: string }) {
  const u = await requireUser();
  const sw = await sessionWhere(u);
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const [todaySessions, weekSessions, goals, comp, evals, wellToday, mon] = await Promise.all([
    db.session.findMany({ where: { ...sw, date: { gte: today, lt: addDays(today, 1) } }, include: { items: { include: { exercise: true }, orderBy: { order: "asc" } }, logs: { where: { athleteId: userId } } } }),
    db.session.findMany({ where: { ...sw, date: { gte: weekStart, lt: addDays(weekStart, 7) } }, include: { logs: { where: { athleteId: userId } } } }),
    db.goal.findMany({ where: { athleteId: userId, done: false }, orderBy: [{ weekly: "desc" }, { createdAt: "asc" }] }),
    db.competition.findFirst({ where: { date: { gte: today }, OR: [{ athleteId: userId }, { group: { members: { some: { athleteId: userId } } } }] }, orderBy: { date: "asc" } }),
    db.evaluation.findMany({ where: { athleteId: userId }, orderBy: { date: "asc" } }),
    db.wellness.findUnique({ where: { athleteId_date: { athleteId: userId, date: dateOnly(now) } } }),
    monitoringFor([userId]),
  ]);
  const [streak, rmNews, fee] = await Promise.all([
    streakFor(userId),
    db.exerciseRM.findMany({ where: { athleteId: userId, seen: false, source: { not: "DEPORTISTA" } }, include: { exercise: { select: { name: true } } }, orderBy: { date: "desc" } }),
    feeStatusFor(userId),
  ]);
  const mainRoutine = await currentRoutine(userId);
  const notice = mainRoutine ? sanitizeRoutine(mainRoutine.data).meta.notice?.trim() : "";
  const feeDue = fee.status === "PENDIENTE" && fee.amount != null && fee.org && now.getDate() >= fee.org.feeDueDay - 3;
  const prevRM = rmNews.length ? await db.exerciseRM.findMany({ where: { athleteId: userId, exerciseId: { in: rmNews.map((r) => r.exerciseId) } }, orderBy: { date: "desc" } }) : [];
  const done = weekSessions.filter((s) => s.logs.some((l) => l.status === "COMPLETADO" || l.status === "PARCIAL")).length;
  const compliance = weekSessions.length ? Math.round((done / weekSessions.length) * 100) : 0;

  const byTest = new Map<string, typeof evals>();
  for (const e of evals) byTest.set(e.testKey, [...(byTest.get(e.testKey) ?? []), e]);
  const latest = [...byTest.entries()].filter(([k]) => isBasicTest(k)).map(([k, list]) => ({ key: k, last: list.at(-1)!, prev: list.at(-2) })).sort((a, b) => +b.last.date - +a.last.date).slice(0, 6);
  const sq = byTest.get("RM1_SQ") ?? [];
  const cm = byTest.get("CMJ") ?? [];
  const progress = sq.map((e, i) => ({ x: fmtDate(e.date, { month: "short", year: "2-digit" }), sq: e.value, cmj: cm[i]?.value ?? null }));
  const m = mon[0];

  return (
    <>
      <PageHeader eyebrow={fmtDateLong(now)} title={`¡Vamos, ${name.split(" ")[0]}!`} subtitle="Tu entrenamiento de hoy, objetivos y progreso."
        actions={streak > 0 ? <div className="flex items-center gap-2 rounded-xl border border-volt/40 bg-volt/10 px-4 py-2"><Flame size={18} className="text-volt" /><span className="num text-2xl font-bold text-white">{streak}</span><span className="text-xs leading-tight text-neutral-300">{streak === 1 ? "sesión" : "sesiones"}<br />seguidas</span></div> : undefined} />
      {notice && <Notice text={notice} />}
      {mainRoutine && <Link href="/app/routine" className="card card-pad card-hover mb-6 flex items-center justify-between gap-3 border-volt/40"><span><span className="label block">Tu plan</span><b className="text-white">{mainRoutine.name}</b></span><span className="btn-primary whitespace-nowrap">Ver mi rutina</span></Link>}
      {feeDue && (
        <Link href="/app/paused" className="card card-pad mb-6 flex items-center gap-3 border-red-500/40 card-hover">
          <div className="flex-1 text-sm"><b className="text-white">Cuota de {monthLabel(monthKey()).toLowerCase()} pendiente</b><div className="muted">Vence el día {fee.org!.feeDueDay}. Tocá para pagarla o ver cómo regularizarla.</div></div>
          <span className="num font-semibold text-white">$ {fee.amount!.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
        </Link>
      )}
      {rmNews.length > 0 && (
        <div className="card card-pad mb-6 flex flex-wrap items-center gap-3 border-volt/50">
          <div className="flex-1 text-sm">
            <b className="text-volt">Tu entrenador actualizó tus RM</b>
            <ul className="mt-1 space-y-0.5">{rmNews.map((r) => { const p = prevRM.find((x) => x.exerciseId === r.exerciseId && x.date < r.date); return <li key={r.id} className="text-neutral-200">{r.exercise.name}: <span className="num">{p ? `${fmtKg(p.kg)} → ` : ""}<b className="text-white">{fmtKg(r.kg)} kg</b></span></li>; })}</ul>
          </div>
          <form action={markRMSeen}>{rmNews.map((r) => <input key={r.id} type="hidden" name="id" value={r.id} />)}<Submit className="btn-ghost btn-sm">Entendido</Submit></form>
        </div>
      )}
      {!wellToday && (
        <Link href="/app/wellness" className="card card-pad mb-6 flex items-center gap-4 border-volt/50 card-hover">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-volt text-black"><HeartPulse size={22} /></div>
          <div className="flex-1"><div className="font-semibold text-white">¿Cómo llegás hoy?</div><div className="text-sm muted">Completá tu bienestar en 30 segundos. Ayuda a tu entrenador a ajustar la carga.</div></div>
          <ArrowRight className="text-volt" />
        </Link>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Entrenamiento de hoy" className="xl:col-span-2">
          {todaySessions.length ? todaySessions.map((s) => (
            <div key={s.id} className="mb-3 last:mb-0 rounded-xl border border-ink-700 bg-ink-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="label text-volt/80">{SESSION_TYPES[s.type]} · {s.durationMin} min · {fmtTime(s.date)}</div>
                  <div className="font-display text-xl font-semibold text-white">{s.title}</div>
                </div>
                {s.logs[0] ? <span className="chip-green">Registrado · RPE {s.logs[0].rpe ?? "—"}</span> : <Link href={`/app/sessions/${s.id}`} className="btn-primary"><Flame size={16} />Empezar y registrar</Link>}
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {s.items.map((it, i) => (
                  <li key={it.id} className="flex items-center gap-3 rounded-lg bg-ink-850 px-3 py-2">
                    <span className="num grid h-6 w-6 place-items-center rounded-md bg-ink-700 text-xs text-volt">{i + 1}</span>
                    <span className="flex-1 truncate text-sm text-white">{it.exercise.name}</span>
                    <span className="num text-xs muted">{it.sets}×{it.reps}{it.percent1RM ? ` · ${Math.round(it.percent1RM * 100)}%` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )) : <Empty title="Hoy es día de descanso">Aprovechá para recuperar. Revisá el calendario para ver lo que viene.</Empty>}
        </Card>
        <div className="grid gap-6">
          <Card title="Semana">
            <div className="flex items-center gap-5">
              <Ring pct={compliance} />
              <div>
                <div className="num text-2xl font-semibold text-white">{done}/{weekSessions.length}</div>
                <div className="text-sm muted">sesiones completadas</div>
                {m?.indicators && <div className="mt-1 text-xs text-neutral-500">Carga 7 días: <span className="num text-neutral-300">{fmtNum(m.indicators.acute)} UA</span></div>}
              </div>
            </div>
          </Card>
          <Card title="Próxima competencia">
            {comp ? (
              <div className="flex items-center gap-4">
                <div className="text-center"><div className="num text-4xl font-bold text-volt">{Math.ceil((+comp.date - +today) / 86400000)}</div><div className="label">días</div></div>
                <div><div className="font-semibold text-white">{comp.name}</div><div className="text-sm muted">{fmtDate(comp.date, { day: "numeric", month: "long" })} · {comp.location}</div></div>
              </div>
            ) : <p className="text-sm muted">Sin competencias programadas.</p>}
          </Card>
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Objetivos" action={<Link href="/app/goals" className="text-xs text-volt hover:underline">Ver todos</Link>}>
          {goals.length ? (
            <ul className="space-y-3">
              {goals.slice(0, 4).map((g) => {
                const pct = g.target ? Math.min(100, Math.round(((g.current ?? 0) / g.target) * 100)) : 0;
                return (
                  <li key={g.id}>
                    <div className="flex justify-between text-sm"><span className="text-white">{g.title}</span><span className="num muted">{pct}%</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-ink-700"><div className="h-full rounded-full bg-volt transition-all" style={{ width: `${pct}%` }} /></div>
                    {g.weekly && <div className="mt-1 text-[11px] text-neutral-600">Semanal</div>}
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Sin objetivos" />}
        </Card>
        <Card title="Progreso de fuerza y salto" className="xl:col-span-2">
          {progress.length > 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="label mb-1">1RM Sentadilla · kg</div><TrendChart data={progress} series={[{ key: "sq", name: "1RM Sentadilla" }]} unit="kg" height={200} /></div>
              <div><div className="label mb-1">CMJ · cm</div><TrendChart data={progress} series={[{ key: "cmj", name: "CMJ" }]} unit="cm" height={200} /></div>
            </div>
          ) : <Empty title="Todavía no hay evaluaciones suficientes" />}
        </Card>
      </div>
      <Card title="Últimas evaluaciones" className="mt-6" action={<Link href="/app/evaluations" className="text-xs text-volt hover:underline">Ver todas</Link>}>
        {latest.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {latest.map(({ key, last, prev }) => {
              const t = TEST_MAP[key];
              return (
                <div key={key} className="rounded-xl border border-ink-700 bg-ink-900 p-3">
                  <div className="truncate text-xs muted">{t?.name ?? key}</div>
                  <div className="mt-1 flex items-baseline gap-1"><span className="num text-xl font-semibold text-white">{last.value}</span><span className="text-xs text-neutral-500">{last.unit}</span></div>
                  <div className="mt-1 flex items-center justify-between"><Delta value={prev ? improvement(prev.value, last.value, t?.higherIsBetter ?? true) : null} /><span className="text-[10px] text-neutral-600">{fmtDate(last.date)}</span></div>
                </div>
              );
            })}
          </div>
        ) : <Empty title="Sin evaluaciones" />}
      </Card>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
      <circle cx="38" cy="38" r={r} stroke="#222" strokeWidth="8" fill="none" />
      <circle cx="38" cy="38" r={r} stroke="#ffd60a" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} style={{ transition: "stroke-dashoffset .8s" }} />
      <text x="38" y="43" textAnchor="middle" className="rotate-90 origin-center fill-white font-mono text-[15px] font-semibold">{pct}%</text>
    </svg>
  );
}

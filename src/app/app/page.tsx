import Link from "next/link";
import { Notice } from "@/components/routine-notice";
import { currentRoutine } from "@/lib/routine-server";
import { todayPlan, sanitizeRoutine } from "@/lib/routine";
import { avatarSrc } from "@/lib/avatar";
import { Users, CalendarCheck, Percent, AlertTriangle, ClipboardList, Trophy, ArrowRight, Flame, HeartPulse, CreditCard, MessageCircle } from "lucide-react";
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
import { CoachHome } from "@/components/coach-home";
import { CompCountdown } from "@/components/comp-countdown";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  return u.role === "ATHLETE" ? <AthleteHome userId={u.id} name={u.name} /> : <CoachHome />;
}

async function AthleteHome({ userId, name }: { userId: string; name: string }) {
  const u = await requireUser();
  const sw = await sessionWhere(u);
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const [todaySessions, weekSessions, goals, comps, evals, wellToday, mon] = await Promise.all([
    db.session.findMany({ where: { ...sw, date: { gte: today, lt: addDays(today, 1) } }, include: { items: { include: { exercise: true }, orderBy: { order: "asc" } }, logs: { where: { athleteId: userId } } } }),
    db.session.findMany({ where: { ...sw, date: { gte: weekStart, lt: addDays(weekStart, 7) } }, include: { logs: { where: { athleteId: userId } } } }),
    db.goal.findMany({ where: { athleteId: userId, done: false }, orderBy: [{ weekly: "desc" }, { createdAt: "asc" }] }),
    db.competition.findMany({ where: { date: { gte: today }, OR: [{ athleteId: userId }, { group: { members: { some: { athleteId: userId } } } }] }, orderBy: { date: "asc" }, take: 3 }),
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
  const plan = mainRoutine ? todayPlan(sanitizeRoutine(mainRoutine.data), mainRoutine.createdAt) : null;
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
  const comp = comps[0] ?? null;

  return (
    <>
      <PageHeader eyebrow={fmtDateLong(now)} title={`¡Vamos, ${name.split(" ")[0]}!`} subtitle="Tu entrenamiento de hoy, objetivos y progreso."
        actions={streak > 0 ? <div className="flex items-center gap-2 rounded-xl border border-volt/40 bg-volt/10 px-4 py-2"><Flame size={18} className="text-volt" /><span className="num text-2xl font-bold text-white">{streak}</span><span className="text-xs leading-tight text-neutral-300">{streak === 1 ? "sesión" : "sesiones"}<br />seguidas</span></div> : undefined} />
      {feeDue && (() => {
        const org = fee.org!;
        const late = now.getDate() > org.feeDueDay;
        const mes = monthLabel(monthKey()).toLowerCase();
        const pay = org.payLink || (org.mpToken ? "/app/paused" : null);
        const wa = org.whatsapp ? `https://wa.me/${org.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${u.name}. Te escribo por la cuota de ${mes}.`)}` : null;
        return (
          <div className={`card card-pad mb-6 ${late ? "border-volt/70 bg-volt/[.06]" : "border-volt/40"}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm">
                <b className={late ? "text-volt" : "text-white"}>{late ? `Tu cuota de ${mes} está vencida` : `Cuota de ${mes} pendiente`}</b>
                <div className="muted">{late ? `Venció el día ${org.feeDueDay}.` : `Vence el día ${org.feeDueDay}.`} {pay ? "Podés pagarla desde acá." : "Escribile a tu preparador para regularizarla."}</div>
              </div>
              <span className="num text-lg font-bold text-white">$ {fee.amount!.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
            </div>
            {(pay || wa) && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {pay && <a href={pay} {...(org.payLink ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="btn-primary flex-1 justify-center"><CreditCard size={16} />Pagar cuota</a>}
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={pay ? "btn-ghost flex-1 justify-center" : "btn-primary flex-1 justify-center"}><MessageCircle size={16} />Hablar con mi preparador</a>}
              </div>
            )}
          </div>
        );
      })()}
      <CompCountdown comps={comps} />
      {notice && <Notice text={notice} />}
      {mainRoutine && plan && (
        <Link href="/app/routine" className="card card-hover mb-6 block overflow-hidden border-volt/50">
          <div className="flex items-center gap-4 p-4 sm:p-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-volt text-center leading-none"><div><div className="text-[10px] font-bold uppercase text-volt">Semana</div><div className="num mt-1 text-2xl font-bold text-white">{plan.week + 1}<span className="text-sm text-neutral-500">/{plan.weeks}</span></div></div></div>
            <div className="min-w-0 flex-1">
              <div className="label text-volt">Hoy te toca</div>
              {plan.today ? <div className="font-display text-xl font-bold leading-tight text-white">{plan.today.name}</div>
                : plan.hasWeekdays ? <div className="font-display text-lg font-bold leading-tight text-white">Día libre{plan.next ? <span className="block text-sm font-normal muted">Próximo: {plan.next.name} · {plan.next.weekday}</span> : null}</div>
                : <div className="font-display text-lg font-bold leading-tight text-white">Elegí el día de tu rutina</div>}
              <div className="truncate text-xs muted">{mainRoutine.name}</div>
            </div>
            <span className="btn-primary hidden whitespace-nowrap sm:inline-flex">Ver mi rutina</span>
          </div>
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
      </div>
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

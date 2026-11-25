import Link from "next/link";
import { db } from "@/lib/db";
import { monitoringFor } from "@/lib/queries";
import { dailySeries, weeklySeries, wellnessScore, improvement, best, dbDay } from "@/lib/metrics";
import { TEST_MAP, TEST_CATEGORIES, SESSION_TYPES, isBasicTest } from "@/lib/catalog";
import { Card, Empty, Stat, fmtDate, fmtNum, Delta } from "./ui";
import { LoadBars, WellnessArea, TrendChart, ProfileRadar, Sparkline } from "./charts";
import { AlertList } from "./alerts";
import { saveGoal, toggleGoal, deleteGoal } from "@/app/app/athletes/actions";
import { Submit } from "./forms";

export async function LoadPanel({ athleteId }: { athleteId: string }) {
  const [m] = await monitoringFor([athleteId]);
  if (!m) return null;
  const weekly = weeklySeries(m.points, 10).map((w) => ({ x: w.week, load: w.load }));
  const daily = dailySeries(m.points, 28).map((d) => ({ x: d.day.slice(8) + "/" + d.day.slice(5, 7), load: d.load }));
  const well = dailySeries([], 28).map((d) => {
    const w = m.wellness.find((x) => dbDay(x.date) === d.day);
    return { x: d.day.slice(8) + "/" + d.day.slice(5, 7), score: w ? wellnessScore(w) : null };
  });
  const ind = m.indicators;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Carga aguda (7d)" value={fmtNum(ind.acute)} unit="UA" />
        <Stat label="Crónica (prom. 4 sem)" value={fmtNum(ind.chronic)} unit="UA" />
        <Stat label="Relación ag:cr" value={ind.acwr != null ? ind.acwr.toFixed(2) : "—"} hint="Descriptivo, no predictivo" accent={(ind.acwr ?? 0) >= 1.3} />
        <Stat label="Monotonía" value={ind.monotony != null ? ind.monotony.toFixed(2) : "—"} hint="Media / DE diaria (Foster)" />
        <Stat label="Strain" value={ind.strain != null ? fmtNum(ind.strain) : "—"} hint="Carga × monotonía" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Carga semanal (sRPE)"><LoadBars data={weekly} /></Card>
        <Card title="Carga diaria · 28 días"><LoadBars data={daily} highlightLast={false} /></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Bienestar · 28 días" className="xl:col-span-2"><WellnessArea data={well} /></Card>
        <Card title="Alertas"><AlertList items={m.alerts} /></Card>
      </div>
      <Card title="Registros de bienestar recientes" pad={false}>
        <div className="overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead><tr><th>Fecha</th><th>Sueño (h)</th><th>Calidad sueño</th><th>Frescura</th><th>Dolor musc.</th><th>Estrés</th><th>Ánimo</th><th>Disponib.</th><th>Total</th><th>Molestia</th></tr></thead>
            <tbody>
              {[...m.wellness].reverse().slice(0, 14).map((w) => (
                <tr key={w.id}>
                  <td>{fmtDate(dbDay(w.date), { weekday: "short", day: "2-digit", month: "short" })}</td>
                  <td className="num">{w.sleepHours ?? "—"}</td>
                  {[w.sleepQuality, w.fatigue, w.soreness, w.stress, w.mood].map((v, i) => <td key={i}><Dot v={v} /></td>)}
                  <td className="num">{w.readiness}/10</td>
                  <td className="num font-semibold text-white">{wellnessScore(w)}</td>
                  <td className="text-xs text-red-300">{w.painArea ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 pt-2 text-[11px] text-neutral-600">Escala 1-5 donde 5 es el mejor estado (más descanso, menos dolor, menos estrés).</p>
      </Card>
    </div>
  );
}

function Dot({ v }: { v: number }) {
  const c = v >= 4 ? "bg-emerald-400" : v === 3 ? "bg-volt" : v === 2 ? "bg-orange-400" : "bg-red-500";
  return <span className="inline-flex items-center gap-1.5 num"><span className={`h-2 w-2 rounded-full ${c}`} />{v}</span>;
}

export async function EvalPanel({ athleteId, canEdit }: { athleteId: string; canEdit: boolean }) {
  const evals = await db.evaluation.findMany({ where: { athleteId }, orderBy: { date: "asc" }, include: { video: true } });
  if (!evals.length) return <Empty title="Sin evaluaciones" action={canEdit ? <Link className="btn-primary" href={`/app/evaluations/new?athlete=${athleteId}`}>Cargar evaluación</Link> : undefined} />;
  const byTest = new Map<string, typeof evals>();
  for (const e of evals) byTest.set(e.testKey, [...(byTest.get(e.testKey) ?? []), e]);
  const cats = Object.keys(TEST_CATEGORIES) as (keyof typeof TEST_CATEGORIES)[];
  return (
    <div className="space-y-6">
      {canEdit && <div className="flex justify-end gap-2"><Link className="btn-ghost" href={`/app/evaluations/compare?athlete=${athleteId}`}>Comparar evaluaciones</Link><Link className="btn-primary" href={`/app/evaluations/new?athlete=${athleteId}`}>Cargar evaluación</Link></div>}
      {cats.map((cat) => {
        const keys = [...byTest.keys()].filter((k) => TEST_MAP[k]?.category === cat && isBasicTest(k));
        if (!keys.length) return null;
        return (
          <section key={cat}>
            <div className="label mb-2">{TEST_CATEGORIES[cat]}</div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {keys.map((k) => {
                const list = byTest.get(k)!;
                const t = TEST_MAP[k];
                const last = list.at(-1)!, prev = list.at(-2);
                const pb = best(list, t.higherIsBetter);
                return (
                  <Link key={k} href={`/app/evaluations?athlete=${athleteId}&test=${k}`} className="card card-pad card-hover block">
                    <div className="flex items-start justify-between gap-2"><div className="text-sm font-semibold text-white">{t.name}</div>{pb && pb.id === last.id && list.length > 1 && <span className="chip-volt">PB</span>}</div>
                    <div className="mt-2 flex items-baseline gap-1"><span className="num text-2xl font-semibold text-white">{last.value}</span><span className="text-xs text-neutral-500">{last.unit}</span></div>
                    <div className="flex items-center justify-between"><Delta value={prev ? improvement(prev.value, last.value, t.higherIsBetter) : null} /><span className="text-[11px] text-neutral-600">{fmtDate(last.date)} · {list.length} reg.</span></div>
                    {list.length > 1 && <div className="mt-2"><Sparkline values={list.map((e) => e.value)} /></div>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export async function HistoryPanel({ athleteId }: { athleteId: string }) {
  const logs = await db.workoutLog.findMany({
    where: { athleteId }, orderBy: { completedAt: "desc" }, take: 40,
    include: { session: true, sets: { include: { item: { include: { exercise: true } } }, orderBy: [{ itemId: "asc" }, { setNumber: "asc" }] } },
  });
  if (!logs.length) return <Empty title="Sin historial">Las sesiones registradas aparecerán acá.</Empty>;
  return (
    <div className="space-y-3">
      {logs.map((l) => {
        const byEx = new Map<string, typeof l.sets>();
        for (const s of l.sets) byEx.set(s.item.exercise.name, [...(byEx.get(s.item.exercise.name) ?? []), s]);
        const vol = l.sets.reduce((a, s) => a + (s.reps ?? 0) * (s.loadKg ?? 0), 0);
        return (
          <details key={l.id} className="card group">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <div className="w-14 text-center"><div className="label">{fmtDate(l.completedAt, { month: "short" })}</div><div className="num text-xl font-semibold text-white">{new Date(l.completedAt).getDate()}</div></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{l.session.title}</div>
                <div className="text-xs muted">{SESSION_TYPES[l.session.type]} · {l.durationMin ?? "—"} min{vol ? ` · volumen ${fmtNum(vol)} kg` : ""}</div>
              </div>
              {l.status === "COMPLETADO" || l.status === "PARCIAL" ? <span className="num chip-volt">RPE {l.rpe ?? "—"} · {l.load ?? "—"} UA</span> : <span className="chip-mute">{l.status === "AUSENTE" ? "Ausente" : "Justificado"}</span>}
            </summary>
            <div className="border-t border-ink-700 p-4 text-sm">
              {l.feeling && <p className="mb-3 text-neutral-300">“{l.feeling}”</p>}
              {l.coachComment && <p className="mb-3 rounded-lg border border-volt/30 bg-volt/5 p-2 text-volt">Entrenador: {l.coachComment}</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {[...byEx.entries()].map(([name, sets]) => (
                  <div key={name} className="rounded-lg bg-ink-900 p-3">
                    <div className="mb-1 font-semibold text-white">{name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sets.map((s) => <span key={s.id} className="num rounded-md bg-ink-700 px-2 py-0.5 text-xs text-neutral-300">{s.reps ?? "–"}{s.loadKg ? `×${s.loadKg}kg` : ""}{s.rir != null ? ` RIR${s.rir}` : ""}{s.velocity ? ` ${s.velocity}m/s` : ""}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <Link href={`/app/sessions/${l.sessionId}`} className="mt-3 inline-block text-xs text-volt hover:underline">Ver sesión</Link>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export async function GoalsPanel({ athleteId, canEdit }: { athleteId: string; canEdit: boolean }) {
  const goals = await db.goal.findMany({ where: { athleteId }, orderBy: [{ done: "asc" }, { weekly: "desc" }, { createdAt: "asc" }] });
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        {goals.length === 0 && <Empty title="Sin objetivos todavía" />}
        {goals.map((g) => {
          const pct = g.target ? Math.min(100, Math.round(((g.current ?? 0) / g.target) * 100)) : g.done ? 100 : 0;
          return (
            <div key={g.id} className={`card card-pad ${g.done ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 font-semibold text-white">{g.title}</div>
                {g.weekly && <span className="chip-mute">Semanal</span>}
                {g.done && <span className="chip-green">Cumplido</span>}
                {g.dueDate && <span className="text-xs muted">Vence {fmtDate(g.dueDate)}</span>}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-ink-700"><div className="h-full rounded-full bg-volt" style={{ width: `${pct}%` }} /></div>
                <span className="num text-sm text-neutral-300">{g.current ?? 0}/{g.target ?? "—"} {g.metric}</span>
              </div>
              {canEdit && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={saveGoal} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={g.id} /><input type="hidden" name="athleteId" value={athleteId} />
                    <input type="hidden" name="title" value={g.title} /><input type="hidden" name="metric" value={g.metric ?? ""} />
                    <input type="hidden" name="target" value={g.target ?? ""} /><input type="hidden" name="weekly" value={g.weekly ? "on" : ""} />
                    <input type="hidden" name="dueDate" value={g.dueDate ? g.dueDate.toISOString().slice(0, 10) : ""} />
                    <input name="current" type="number" step="any" defaultValue={g.current ?? ""} className="input w-28 py-1.5" aria-label="Valor actual" />
                    <Submit className="btn-ghost btn-sm">Actualizar</Submit>
                  </form>
                  <form action={toggleGoal}><input type="hidden" name="id" value={g.id} /><Submit className="btn-ghost btn-sm">{g.done ? "Reabrir" : "Marcar cumplido"}</Submit></form>
                  <form action={deleteGoal}><input type="hidden" name="id" value={g.id} /><Submit className="btn-danger btn-sm">Eliminar</Submit></form>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <Card title="Nuevo objetivo">
          <form action={saveGoal} className="space-y-3">
            <input type="hidden" name="athleteId" value={athleteId} />
            <input name="title" placeholder="Ej: Sentadilla 1RM a 120 kg" className="input" required />
            <div className="grid grid-cols-3 gap-2">
              <input name="current" type="number" step="any" placeholder="Actual" className="input" />
              <input name="target" type="number" step="any" placeholder="Meta" className="input" />
              <input name="metric" placeholder="Unidad" className="input" />
            </div>
            <input name="dueDate" type="date" className="input" />
            <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="weekly" className="accent-[#ffd60a]" /> Objetivo semanal</label>
            <Submit className="btn-primary w-full">Agregar</Submit>
          </form>
        </Card>
      )}
    </div>
  );
}

export function EvolutionChart({ data, unit, name }: { data: { x: string; v: number }[]; unit: string; name: string }) {
  return <TrendChart data={data} series={[{ key: "v", name }]} unit={unit} />;
}

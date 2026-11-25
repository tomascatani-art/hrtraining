import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { TEST_MAP, isBasicTest } from "@/lib/catalog";
import { addDays, best, startOfDay, weeklySeries, wellnessScore, improvement } from "@/lib/metrics";
import { PageHeader, Card, Empty, Field, fmtDate, fmtNum, Delta } from "@/components/ui";
import { TrendChart, LoadBars } from "@/components/charts";

export const metadata = { title: "Estadísticas" };

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Fuerza", keys: ["RM1_SQ", "RM1_BP", "RM1_DL", "RM3_SQ"] },
  { title: "Potencia y saltos", keys: ["CMJ", "SJ", "ABK", "RSI", "POT_PICO"] },
  { title: "Velocidad", keys: ["SPR10", "SPR20", "SPR30", "T_TEST", "PRO_AGI"] },
  { title: "Resistencia y específicos", keys: ["COOPER", "NAVETTE", "YOYO_IR1", "SWIM_100", "SWIM_CSS", "FTP", "RUN_5K"] },
];

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ athlete?: string; weeks?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const athletes = u.role === "ATHLETE" ? [] : await db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } });
  const focus = u.role === "ATHLETE" ? u.id : sp.athlete && ids.includes(sp.athlete) ? sp.athlete : null;
  const scope = focus ? [focus] : ids;
  const weeks = Math.min(26, Math.max(2, Number(sp.weeks ?? 6)));
  const today = startOfDay(new Date());
  const bStart = addDays(today, -7 * weeks + 1), aStart = addDays(bStart, -7 * weeks);

  const [evals, logs, wellness, goals] = await Promise.all([
    db.evaluation.findMany({ where: { athleteId: { in: scope } }, orderBy: { date: "asc" } }),
    db.workoutLog.findMany({ where: { athleteId: { in: scope }, completedAt: { gte: addDays(aStart, -7 * 8) } }, include: { sets: true } }),
    db.wellness.findMany({ where: { athleteId: { in: scope }, date: { gte: aStart } } }),
    db.goal.findMany({ where: { athleteId: { in: scope } } }),
  ]);

  // Evolución: promedio por fecha (equipo) o valor individual
  const series = (key: string) => {
    const byDate = new Map<string, number[]>();
    for (const e of evals.filter((x) => x.testKey === key)) {
      const k = e.date.toISOString().slice(0, 10);
      byDate.set(k, [...(byDate.get(k) ?? []), e.value]);
    }
    return [...byDate.entries()].sort().map(([d, v]) => ({ x: fmtDate(d, { day: "2-digit", month: "short", year: "2-digit" }), v: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) }));
  };
  const pbs = [...new Set(evals.map((e) => e.testKey))].filter((k) => TEST_MAP[k] && isBasicTest(k)).map((k) => {
    const l = evals.filter((e) => e.testKey === k);
    return { k, pb: best(l, TEST_MAP[k].higherIsBetter)!, n: l.length };
  });

  const done = (l: (typeof logs)[number]) => l.status === "COMPLETADO" || l.status === "PARCIAL";
  const period = (from: Date, to: Date) => {
    const L = logs.filter((l) => l.completedAt >= from && l.completedAt < to);
    const D = L.filter(done);
    const W = wellness.filter((w) => w.date >= from && w.date < to);
    return {
      sesiones: D.length,
      asistencia: L.length ? (D.length / L.length) * 100 : null,
      carga: D.reduce((a, l) => a + (l.load ?? 0), 0),
      volumen: D.reduce((a, l) => a + l.sets.reduce((s, x) => s + (x.reps ?? 0) * (x.loadKg ?? 0), 0), 0),
      rpe: D.length ? D.reduce((a, l) => a + (l.rpe ?? 0), 0) / D.length : null,
      bienestar: W.length ? W.reduce((a, w) => a + wellnessScore(w), 0) / W.length : null,
    };
  };
  const A = period(aStart, bStart), B = period(bStart, addDays(today, 1));
  const cmpRows: { label: string; a: number | null; b: number | null; unit: string; dec: number; better: boolean | null }[] = [
    { label: "Sesiones completadas", a: A.sesiones, b: B.sesiones, unit: "", dec: 0, better: true },
    { label: "Asistencia", a: A.asistencia, b: B.asistencia, unit: "%", dec: 0, better: true },
    { label: "Carga total (sRPE)", a: A.carga, b: B.carga, unit: "UA", dec: 0, better: null },
    { label: "Volumen levantado", a: A.volumen, b: B.volumen, unit: "kg", dec: 0, better: null },
    { label: "RPE medio de sesión", a: A.rpe, b: B.rpe, unit: "", dec: 1, better: null },
    { label: "Bienestar medio", a: A.bienestar, b: B.bienestar, unit: "/25", dec: 1, better: true },
  ];

  const pts = logs.filter(done).map((l) => ({ date: l.completedAt, load: l.sets.reduce((s, x) => s + (x.reps ?? 0) * (x.loadKg ?? 0), 0) }));
  const vol = weeklySeries(pts, 12).map((w) => ({ x: w.week, load: Math.round(w.load / scope.length) }));
  const att = weeklySeries([], 12).map((w) => {
    const L = logs.filter((l) => l.completedAt >= w.start && l.completedAt < addDays(w.start, 7));
    return { x: w.week, load: L.length ? Math.round((L.filter(done).length / L.length) * 100) : 0 };
  });
  const goalsDone = goals.filter((g) => g.done || (g.target && (g.current ?? 0) >= g.target)).length;

  return (
    <>
      <PageHeader title={u.role === "ATHLETE" ? "Mi progreso" : "Estadísticas y evolución"} subtitle="Evolución de fuerza, potencia, saltos y velocidad; marcas personales; volumen, asistencia y comparación de períodos." />
      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-4">
          {u.role !== "ATHLETE" && <Field label="Ver"><select name="athlete" defaultValue={focus ?? ""} className="input"><option value="">Todo el equipo (promedios)</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
          <Field label="Comparar períodos de"><select name="weeks" defaultValue={weeks} className="input">{[2, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} semanas</option>)}</select></Field>
          <div className="flex items-end"><button className="btn-primary w-full">Aplicar</button></div>
        </form>
      </Card>

      {GROUPS.map((g) => {
        const keys = g.keys.filter((k) => evals.some((e) => e.testKey === k));
        if (!keys.length) return null;
        return (
          <section key={g.title} className="mb-6">
            <h2 className="h2 mb-3">{g.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {keys.map((k) => {
                const s = series(k);
                const t = TEST_MAP[k];
                return (
                  <Card key={k} title={<span className="text-base">{t.name}</span>} action={<Delta value={s.length > 1 ? improvement(s[0].v, s.at(-1)!.v, t.higherIsBetter) : null} />}>
                    {s.length > 1 ? <TrendChart data={s} series={[{ key: "v", name: t.name }]} unit={t.unit} height={180} /> : <p className="text-sm muted">Un solo registro: {s[0]?.v} {t.unit}</p>}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Comparación de períodos · últimas ${weeks} semanas vs. ${weeks} anteriores`} pad={false}>
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Indicador</th><th>Período A</th><th>Período B</th><th>Cambio</th></tr></thead>
            <tbody>
              {cmpRows.map((r) => (
                <tr key={r.label}>
                  <td className="text-white">{r.label}</td>
                  <td className="num">{fmtNum(r.a, r.dec)} {r.unit}</td>
                  <td className="num font-semibold text-white">{fmtNum(r.b, r.dec)} {r.unit}</td>
                  <td>{r.a && r.b != null ? (r.better === null ? <span className="num text-xs text-neutral-400">{r.b >= r.a ? "+" : ""}{(((r.b - r.a) / r.a) * 100).toFixed(1)}%</span> : <Delta value={((r.b - r.a) / r.a) * 100} />) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="px-5 py-3 text-[11px] text-neutral-600">A: {fmtDate(aStart)} – {fmtDate(addDays(bStart, -1))} · B: {fmtDate(bStart)} – {fmtDate(today)}. Carga, volumen y RPE se muestran sin valoración: más no es necesariamente mejor.</p>
        </Card>
        <Card title="Marcas personales" pad={false}>
          {pbs.length ? (
            <ul className="divide-y divide-ink-800">
              {pbs.map(({ k, pb, n }) => (
                <li key={k} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex-1 text-sm text-neutral-200">{TEST_MAP[k].name}</span>
                  <span className="num text-sm font-semibold text-volt">{pb.value} {pb.unit}</span>
                  <span className="w-20 text-right text-xs text-neutral-600">{fmtDate(pb.date, { day: "2-digit", month: "short", year: "2-digit" })}</span>
                  {focus ? <Link href={`/app/evaluations?athlete=${focus}&test=${k}`} className="text-xs text-neutral-500 hover:text-volt">{n} reg.</Link> : <span className="text-xs text-neutral-600">{n} reg.</span>}
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><Empty title="Sin evaluaciones" /></div>}
          {!focus && pbs.length > 0 && <p className="px-5 py-3 text-[11px] text-neutral-600">Mejor marca del equipo en cada test.</p>}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Volumen semanal" action={<span className="label">kg{focus ? "" : " / alumno"}</span>}><LoadBars data={vol} unit="kg" name="Volumen" /></Card>
        <Card title="Asistencia semanal" action={<span className="label">%</span>}><LoadBars data={att} unit="%" name="Asistencia" /></Card>
        <Card title="Cumplimiento de objetivos">
          <div className="flex items-baseline gap-2"><span className="num text-5xl font-bold text-volt">{goals.length ? Math.round((goalsDone / goals.length) * 100) : 0}%</span><span className="text-sm muted">{goalsDone} de {goals.length} objetivos</span></div>
          <div className="mt-4 h-2 rounded-full bg-ink-700"><div className="h-full rounded-full bg-volt" style={{ width: `${goals.length ? (goalsDone / goals.length) * 100 : 0}%` }} /></div>
        </Card>
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { monitoringFor } from "@/lib/queries";
import { TEST_MAP, sportLabel } from "@/lib/catalog";
import { improvement, weeklySeries, wellnessScore, MONITORING_DISCLAIMER } from "@/lib/metrics";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Informe de evolución" };

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  if (!(await canSeeAthlete(u, id))) notFound();
  const a = await db.user.findUnique({ where: { id }, include: { athleteProfile: true, org: true } });
  if (!a) notFound();
  const [evals, goals, logs] = await Promise.all([
    db.evaluation.findMany({ where: { athleteId: id }, orderBy: { date: "asc" } }),
    db.goal.findMany({ where: { athleteId: id } }),
    db.workoutLog.findMany({ where: { athleteId: id, completedAt: { gte: new Date(Date.now() - 28 * 86400000) } } }),
  ]);
  const [m] = await monitoringFor([id]);
  const byTest = new Map<string, typeof evals>();
  for (const e of evals) if (!e.testKey.startsWith("FMS_") || e.testKey === "FMS_TOTAL") byTest.set(e.testKey, [...(byTest.get(e.testKey) ?? []), e]);
  const weeks = weeklySeries(m.points, 4);
  const att = logs.length ? Math.round((logs.filter((l) => l.status === "COMPLETADO" || l.status === "PARCIAL").length / logs.length) * 100) : null;
  const wAvg = m.wellness.slice(-14);
  const avgW = wAvg.length ? (wAvg.reduce((s, w) => s + wellnessScore(w), 0) / wAvg.length).toFixed(1) : "—";
  const d = (x: Date) => x.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="min-h-dvh bg-white text-neutral-900 print:bg-white">
      <div className="mx-auto max-w-[820px] p-8 print:p-0">
        <div className="mb-6 flex items-center justify-between print:hidden"><span className="text-sm text-neutral-500">Vista previa del informe</span><PrintButton /></div>
        <header className="flex items-start justify-between border-b-4 border-black pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Informe de evolución</div>
            <h1 className="mt-1 font-display text-3xl font-bold">{a.name}</h1>
            <div className="mt-1 text-sm text-neutral-600">{sportLabel(a.athleteProfile?.sport)}{a.athleteProfile?.position ? ` · ${a.athleteProfile.position}` : ""} · {a.org.name}</div>
            {a.isDemo && <div className="mt-2 inline-block bg-[#ffd60a] px-2 py-0.5 text-xs font-bold">DATOS DE DEMOSTRACIÓN</div>}
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded bg-black px-3 py-1.5 font-display font-bold text-white">hrtraining</div>
            <div className="mt-2 text-xs text-neutral-500">Generado el {d(new Date())}</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-4 gap-3">
          {[["Carga 7 días", `${m.indicators.acute} UA`], ["Prom. 4 semanas", `${m.indicators.chronic} UA`], ["Asistencia 28 d", att != null ? `${att}%` : "—"], ["Bienestar (14 d)", `${avgW}/25`]].map(([k, v]) => (
            <div key={k} className="border border-neutral-300 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{k}</div><div className="mt-1 font-mono text-xl font-semibold">{v}</div></div>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 border-l-4 border-[#ffd60a] pl-2 font-display text-lg font-bold">Evaluaciones físicas</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b-2 border-black text-left text-[11px] uppercase tracking-wider"><th className="py-1.5">Test</th><th>Primera</th><th>Anterior</th><th>Última</th><th>Cambio</th><th>Total</th></tr></thead>
            <tbody>
              {[...byTest.entries()].map(([k, list]) => {
                const t = TEST_MAP[k];
                const first = list[0], prev = list.at(-2), last = list.at(-1)!;
                const ch = improvement(first.value, last.value, t?.higherIsBetter ?? true);
                return (
                  <tr key={k} className="border-b border-neutral-200">
                    <td className="py-1.5 font-medium">{t?.name ?? k}</td>
                    <td className="font-mono">{first.value} <span className="text-[10px] text-neutral-500">{d(first.date)}</span></td>
                    <td className="font-mono">{prev ? prev.value : "—"}</td>
                    <td className="font-mono font-semibold">{last.value} {last.unit}</td>
                    <td className={`font-mono ${ch > 0.05 ? "text-emerald-700" : ch < -0.05 ? "text-red-700" : ""}`}>{list.length > 1 ? `${ch > 0 ? "+" : ""}${ch.toFixed(1)}%` : "—"}</td>
                    <td className="font-mono">{list.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-neutral-500">Cambio orientado al rendimiento: positivo indica mejora (en tests de tiempo, menor tiempo).</p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <h2 className="mb-2 border-l-4 border-[#ffd60a] pl-2 font-display text-lg font-bold">Carga por semana</h2>
            {weeks.map((w) => {
              const max = Math.max(...weeks.map((x) => x.load), 1);
              return (
                <div key={w.week} className="mb-1.5 flex items-center gap-2 text-xs">
                  <span className="w-14 text-neutral-500">{w.week}</span>
                  <div className="h-3 flex-1 bg-neutral-100"><div className="h-full bg-black" style={{ width: `${(w.load / max) * 100}%` }} /></div>
                  <span className="w-16 text-right font-mono">{w.load} UA</span>
                </div>
              );
            })}
          </div>
          <div>
            <h2 className="mb-2 border-l-4 border-[#ffd60a] pl-2 font-display text-lg font-bold">Objetivos</h2>
            <ul className="space-y-1 text-sm">
              {goals.map((g) => <li key={g.id} className="flex justify-between border-b border-neutral-200 py-1"><span>{g.done ? "✓ " : ""}{g.title}</span><span className="font-mono text-neutral-600">{g.current ?? "—"}/{g.target ?? "—"}</span></li>)}
              {!goals.length && <li className="text-neutral-500">Sin objetivos registrados.</li>}
            </ul>
          </div>
        </section>

        {m.alerts.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 border-l-4 border-[#ffd60a] pl-2 font-display text-lg font-bold">Indicadores a revisar</h2>
            <ul className="list-disc pl-5 text-sm">{m.alerts.map((x, i) => <li key={i}><b>{x.title}.</b> {x.detail}</li>)}</ul>
          </section>
        )}
        <footer className="mt-8 border-t border-neutral-300 pt-3 text-[10px] leading-relaxed text-neutral-500">{MONITORING_DISCLAIMER}</footer>
      </div>
    </div>
  );
}

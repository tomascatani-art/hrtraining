import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { TEST_MAP, TESTS, TEST_CATEGORIES } from "@/lib/catalog";
import { improvement, best } from "@/lib/metrics";
import { PageHeader, Card, Empty, Avatar, Delta, DemoBadge, fmtDate } from "@/components/ui";
import { TrendChart, LoadBars } from "@/components/charts";
import { EvalPanel } from "@/components/athlete-panels";
import { ConfirmSubmit } from "@/components/forms";
import { deleteEvaluation } from "./actions";

export const metadata = { title: "Evaluaciones" };

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ athlete?: string; test?: string; ok?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const staff = u.role !== "ATHLETE";
  const ids = await visibleAthleteIds(u);
  const athleteId = u.role === "ATHLETE" ? u.id : sp.athlete && ids.includes(sp.athlete) ? sp.athlete : undefined;
  const test = sp.test && TEST_MAP[sp.test] ? TEST_MAP[sp.test] : undefined;

  const header = (
    <PageHeader title="Evaluaciones físicas" subtitle="Tests de fuerza, potencia, movilidad, velocidad y resistencia. Registrá, compará y seguí la evolución."
      actions={staff ? <>
        <Link href="/app/evaluations/new" className="btn-primary">Nueva evaluación</Link>
        <Link href="/app/evaluations/compare" className="btn-ghost">Comparar</Link>
        <a href={`/api/export/evaluations${athleteId ? `?athlete=${athleteId}` : ""}`} className="btn-ghost"><Download size={15} />Excel</a>
      </> : <a href={`/api/export/evaluations`} className="btn-ghost"><Download size={15} />Descargar mis datos</a>} />
  );

  // Evolución de un test para un deportista
  if (athleteId && test) {
    const [a, list] = await Promise.all([
      db.user.findUnique({ where: { id: athleteId } }),
      db.evaluation.findMany({ where: { athleteId, testKey: test.key }, orderBy: { date: "asc" }, include: { coach: true, video: true } }),
    ]);
    const pb = best(list, test.higherIsBetter);
    return (
      <>
        {header}
        <div className="mb-4 text-sm"><Link href={staff ? `/app/athletes/${athleteId}?tab=evaluaciones` : "/app/evaluations"} className="text-volt hover:underline">← {a?.name}</Link></div>
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title={`${test.name} · ${a?.name}`} className="xl:col-span-2" action={<span className="label">{test.higherIsBetter ? "Mayor es mejor" : "Menor es mejor"}</span>}>
            {list.length > 1 ? <TrendChart data={list.map((e) => ({ x: fmtDate(e.date, { day: "2-digit", month: "short", year: "2-digit" }), v: e.value }))} series={[{ key: "v", name: test.name }]} unit={test.unit} height={280} reference={pb ? { y: pb.value, label: `Mejor marca ${pb.value}` } : undefined} /> : <Empty title="Se necesitan al menos dos registros para graficar" />}
            <p className="mt-3 text-xs muted">Protocolo: {test.protocol}</p>
          </Card>
          <Card title="Registros" pad={false}>
            <ul className="divide-y divide-ink-800">
              {[...list].reverse().map((e, i, arr) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <div className="num text-lg font-semibold text-white">{e.value} <span className="text-xs text-neutral-500">{e.unit}</span> {pb?.id === e.id && <span className="chip-volt ml-1">PB</span>}</div>
                    <div className="text-xs muted">{fmtDate(e.date, { day: "2-digit", month: "short", year: "numeric" })}{e.notes ? ` · ${e.notes}` : ""}</div>
                    {e.video && <Link href={`/app/videos?file=${e.video.id}`} className="text-xs text-volt">Ver video</Link>}
                  </div>
                  <Delta value={arr[i + 1] ? improvement(arr[i + 1].value, e.value, test.higherIsBetter) : null} />
                  {staff && <form action={deleteEvaluation}><input type="hidden" name="id" value={e.id} /><ConfirmSubmit message="¿Eliminar este resultado?" className="text-xs text-neutral-600 hover:text-red-400">✕</ConfirmSubmit></form>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </>
    );
  }

  if (u.role === "ATHLETE") return <>{header}<EvalPanel athleteId={u.id} canEdit={false} /></>;

  const evals = await db.evaluation.findMany({ where: { athleteId: { in: ids } }, orderBy: { date: "asc" }, include: { athlete: true } });
  const athletes = [...new Map(evals.map((e) => [e.athleteId, e.athlete])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const usedTests = TESTS.filter((t) => evals.some((e) => e.testKey === t.key));

  // Ranking de un test en el equipo
  if (test) {
    const rows = athletes.map((a) => {
      const l = evals.filter((e) => e.athleteId === a.id && e.testKey === test.key);
      return { a, last: l.at(-1), prev: l.at(-2) };
    }).filter((r) => r.last).sort((x, y) => (test.higherIsBetter ? y.last!.value - x.last!.value : x.last!.value - y.last!.value));
    const avg = rows.reduce((s, r) => s + r.last!.value, 0) / Math.max(1, rows.length);
    return (
      <>
        {header}
        <TestPicker tests={usedTests} active={test.key} />
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title={`Ranking · ${test.name}`} className="xl:col-span-2" action={<span className="label">Promedio {avg.toFixed(2)} {test.unit}</span>}>
            <LoadBars data={rows.map((r) => ({ x: r.a.name.split(" ")[0], v: r.last!.value }))} dataKey="v" name={test.name} unit={test.unit} highlightLast={false} height={260} />
          </Card>
          <Card title="Detalle" pad={false}>
            <ol className="divide-y divide-ink-800">
              {rows.map((r, i) => (
                <li key={r.a.id}><Link href={`/app/evaluations?athlete=${r.a.id}&test=${test.key}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-800">
                  <span className={`num w-5 text-sm ${i < 3 ? "text-volt" : "text-neutral-500"}`}>{i + 1}</span>
                  <span className="flex-1 text-sm text-white">{r.a.name}</span>
                  <span className="num text-sm font-semibold text-white">{r.last!.value}</span>
                  <Delta value={r.prev ? improvement(r.prev.value, r.last!.value, test.higherIsBetter) : null} />
                </Link></li>
              ))}
            </ol>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      {sp.ok && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Evaluaciones guardadas.</div>}
      <TestPicker tests={usedTests} />
      {athletes.length === 0 ? <Empty title="Sin evaluaciones registradas" action={<Link href="/app/evaluations/new" className="btn-primary">Cargar la primera</Link>} /> : (
        <Card title="Matriz del equipo · último resultado" pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th className="sticky left-0 bg-ink-850">Deportista</th>{usedTests.map((t) => <th key={t.key}><Link href={`/app/evaluations?test=${t.key}`} className="hover:text-volt">{t.key.replace("_", " ")}</Link><div className="text-[9px] normal-case tracking-normal text-neutral-600">{t.unit}</div></th>)}</tr></thead>
              <tbody>
                {athletes.map((a) => (
                  <tr key={a.id}>
                    <td className="sticky left-0 bg-ink-850"><Link href={`/app/athletes/${a.id}?tab=evaluaciones`} className="flex items-center gap-2 whitespace-nowrap hover:text-volt"><Avatar name={a.name} src={avatarSrc(a)} size={26} /><span className="text-white">{a.name}</span>{a.isDemo && <DemoBadge />}</Link></td>
                    {usedTests.map((t) => {
                      const l = evals.filter((e) => e.athleteId === a.id && e.testKey === t.key);
                      const last = l.at(-1), prev = l.at(-2);
                      // Posición relativa dentro del equipo (para el color de la celda)
                      const all = athletes.map((x) => evals.filter((e) => e.athleteId === x.id && e.testKey === t.key).at(-1)?.value).filter((v): v is number => v != null);
                      const rank = last ? all.filter((v) => (t.higherIsBetter ? v > last.value : v < last.value)).length / Math.max(1, all.length - 1) : 1;
                      return (
                        <td key={t.key} className="whitespace-nowrap">
                          {last ? (
                            <Link href={`/app/evaluations?athlete=${a.id}&test=${t.key}`} className="block">
                              <span className="num font-semibold" style={{ color: rank <= 0.25 ? "#ffd60a" : rank >= 0.75 ? "#a3a3a3" : "#f5f5f4" }}>{last.value}</span>
                              <div><Delta value={prev ? improvement(prev.value, last.value, t.higherIsBetter) : null} /></div>
                            </Link>
                          ) : <span className="text-neutral-700">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-neutral-600">Valores en amarillo: cuartil superior del equipo. Variación respecto de la evaluación anterior del mismo deportista (positivo = mejora).</p>
        </Card>
      )}
      <Card title="Catálogo de tests disponibles" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(TEST_CATEGORIES) as (keyof typeof TEST_CATEGORIES)[]).map((c) => (
            <div key={c}>
              <div className="label mb-1.5 text-volt/80">{TEST_CATEGORIES[c]}</div>
              <ul className="space-y-0.5 text-sm">{TESTS.filter((t) => t.category === c).map((t) => <li key={t.key} className="flex justify-between gap-2 text-neutral-300"><span title={t.protocol}>{t.name}</span><span className="text-xs text-neutral-600">{t.unit}</span></li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function TestPicker({ tests, active }: { tests: { key: string; name: string }[]; active?: string }) {
  return (
    <div className="mb-4 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      <Link href="/app/evaluations" className={`tab ${!active ? "tab-active" : ""}`}>Matriz</Link>
      {tests.map((t) => <Link key={t.key} href={`/app/evaluations?test=${t.key}`} className={`tab ${active === t.key ? "tab-active" : ""}`}>{t.name.replace(/\s*\(.*\)/, "")}</Link>)}
    </div>
  );
}

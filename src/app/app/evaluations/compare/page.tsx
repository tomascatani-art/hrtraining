import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { TEST_MAP } from "@/lib/catalog";
import { improvement } from "@/lib/metrics";
import { PageHeader, Card, Field, Empty, fmtDate } from "@/components/ui";

export const metadata = { title: "Comparar evaluaciones" };

export default async function Compare({ searchParams }: { searchParams: Promise<{ athlete?: string; a?: string; b?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const athletes = await db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } });
  const athleteId = u.role === "ATHLETE" ? u.id : sp.athlete && ids.includes(sp.athlete) ? sp.athlete : athletes[0]?.id;
  const evals = athleteId ? await db.evaluation.findMany({ where: { athleteId }, orderBy: { date: "asc" } }) : [];
  const dates = [...new Set(evals.map((e) => e.date.toISOString().slice(0, 10)))];
  const a = sp.a && dates.includes(sp.a) ? sp.a : dates.at(-2);
  const b = sp.b && dates.includes(sp.b) ? sp.b : dates.at(-1);
  const keys = [...new Set(evals.map((e) => e.testKey))].filter((k) => !k.startsWith("FMS_") || k === "FMS_TOTAL");
  // Para cada test, el último valor registrado hasta cada fecha de corte
  const at = (k: string, d?: string) => (d ? evals.filter((e) => e.testKey === k && e.date.toISOString().slice(0, 10) <= d).at(-1) : undefined);
  const rows = keys.map((k) => {
    const va = at(k, a), vb = at(k, b);
    const t = TEST_MAP[k];
    return { k, t, va, vb, ch: va && vb ? improvement(va.value, vb.value, t?.higherIsBetter ?? true) : null };
  }).filter((r) => r.va || r.vb);
  const max = Math.max(5, ...rows.map((r) => Math.abs(r.ch ?? 0)));

  return (
    <>
      <PageHeader title="Comparar evaluaciones" subtitle="Elegí dos momentos y compará todos los tests. El cambio está orientado al rendimiento: positivo siempre indica mejora." />
      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-4">
          {u.role !== "ATHLETE" && <Field label="Alumno"><select name="athlete" defaultValue={athleteId} className="input">{athletes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
          <Field label="Momento A"><select name="a" defaultValue={a} className="input">{dates.map((d) => <option key={d} value={d}>{fmtDate(d, { day: "2-digit", month: "short", year: "numeric" })}</option>)}</select></Field>
          <Field label="Momento B"><select name="b" defaultValue={b} className="input">{dates.map((d) => <option key={d} value={d}>{fmtDate(d, { day: "2-digit", month: "short", year: "numeric" })}</option>)}</select></Field>
          <div className="flex items-end"><button className="btn-primary w-full">Comparar</button></div>
        </form>
      </Card>
      {rows.length === 0 ? <Empty title="Sin evaluaciones para comparar" /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Resultados" pad={false}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Test</th><th>A</th><th>B</th><th>Cambio</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.k}>
                      <td className="text-white">{r.t?.name ?? r.k}</td>
                      <td className="num">{r.va ? `${r.va.value} ${r.va.unit}` : "—"}</td>
                      <td className="num font-semibold text-white">{r.vb ? `${r.vb.value} ${r.vb.unit}` : "—"}</td>
                      <td className={`num font-semibold ${r.ch == null ? "text-neutral-600" : r.ch > 0.05 ? "text-emerald-400" : r.ch < -0.05 ? "text-red-400" : "text-neutral-400"}`}>{r.ch == null ? "—" : `${r.ch > 0 ? "+" : ""}${r.ch.toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Cambio porcentual por test">
            <div className="space-y-2.5">
              {rows.filter((r) => r.ch != null).map((r) => {
                const w = (Math.abs(r.ch!) / max) * 50;
                const pos = r.ch! >= 0;
                return (
                  <div key={r.k} className="grid grid-cols-[110px_1fr_56px] items-center gap-2 text-xs">
                    <span className="truncate text-neutral-300" title={r.t?.name}>{r.t?.name.replace(/\s*\(.*\)/, "") ?? r.k}</span>
                    <div className="relative h-4 rounded bg-ink-900">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-ink-500" />
                      <div className={`absolute inset-y-0.5 rounded-sm ${pos ? "bg-emerald-400" : "bg-red-400"}`} style={pos ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                    </div>
                    <span className={`num text-right font-semibold ${pos ? "text-emerald-400" : "text-red-400"}`}>{r.ch! > 0 ? "+" : ""}{r.ch!.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-neutral-600">Izquierda: empeoró · Derecha: mejoró. En tests de tiempo, bajar el tiempo cuenta como mejora.</p>
          </Card>
        </div>
      )}
    </>
  );
}

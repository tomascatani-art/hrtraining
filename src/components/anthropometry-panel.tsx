import { db } from "@/lib/db";
import { ANTHRO_GROUPS, ANTHRO_FIELDS, sum6, fmtN, type AnthroKey } from "@/lib/anthropometry";
import { Card, Empty, fmtDate } from "./ui";
import { TrendChart } from "./charts";
import { Submit, ConfirmSubmit } from "./forms";
import { saveAnthropometry, deleteAnthropometry } from "@/app/app/anthropometry/actions";

type Row = Awaited<ReturnType<typeof load>>[number];
const load = (athleteId: string) => db.anthropometry.findMany({ where: { athleteId }, orderBy: { date: "asc" }, include: { measuredBy: { select: { name: true } } } });
const val = (r: Row, k: AnthroKey) => r[k] as number | null;
const short = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");

function Delta({ now, prev, unit }: { now: number | null; prev: number | null; unit: string }) {
  if (now == null || prev == null) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return <span className="text-xs muted">sin cambios</span>;
  return <span className="block text-xs"><span className="num text-neutral-300">{d > 0 ? "+" : "−"}{fmtN(Math.abs(d))} {unit}</span> <span className="muted">vs. anterior</span></span>;
}

/** Antropometría: última medición, evolución de peso y sumatoria de 6 pliegues, historial y carga. */
export async function AnthropometryPanel({ athleteId, canEdit }: { athleteId: string; canEdit: boolean }) {
  const rows = await load(athleteId);
  const last = rows.at(-1);
  const s6 = (r?: Row) => (r ? sum6(r) : null);
  const weightData = rows.filter((r) => r.weightKg != null).map((r) => ({ x: short(r.date), peso: r.weightKg }));
  const sumData = rows.map((r) => ({ x: short(r.date), suma: s6(r) })).filter((r) => r.suma != null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {!last ? (
        <Empty title="Todavía no hay mediciones">{canEdit ? "Cargá la primera medición con el formulario de abajo." : "Cuando tu entrenador cargue una medición, vas a ver acá tu evolución."}</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Peso", get: (r: Row) => r.weightKg, u: "kg" },
              { l: "Σ 6 pliegues", get: (r: Row) => s6(r), u: "mm" },
              { l: "Cintura", get: (r: Row) => r.waistCm, u: "cm" },
              { l: "Brazo flexionado", get: (r: Row) => r.armFlexedCm, u: "cm" },
            ].map(({ l, get, u }) => {
              // último valor cargado de cada medida (no todas las mediciones tienen todo)
              const withV = rows.filter((r) => get(r) != null);
              return { l, u, v: withV.at(-1) ? get(withV.at(-1)!) : null, p: withV.at(-2) ? get(withV.at(-2)!) : null };
            }).map((k) => (
              <div key={k.l} className="card p-4">
                <div className="label">{k.l}</div>
                <div className="num mt-1 text-2xl font-bold text-white">{fmtN(k.v)} <span className="text-sm font-normal muted">{k.u}</span></div>
                <Delta now={k.v ?? null} prev={k.p} unit={k.u} />
              </div>
            ))}
          </div>
          <p className="text-xs muted">Última medición: {fmtDate(last.date)}{last.measuredBy ? ` · ${last.measuredBy.name}` : ""}. La sumatoria de pliegues sirve para seguir la evolución de la misma persona; no es un diagnóstico.</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Peso (kg)">{weightData.length > 1 ? <TrendChart data={weightData} series={[{ key: "peso", name: "Peso" }]} unit="kg" height={220} /> : <p className="text-sm muted">Hace falta más de una medición para ver la evolución.</p>}</Card>
            <Card title="Σ 6 pliegues (mm)">{sumData.length > 1 ? <TrendChart data={sumData} series={[{ key: "suma", name: "Σ 6 pliegues" }]} unit="mm" height={220} /> : <p className="text-sm muted">Hace falta más de una medición con los 6 pliegues.</p>}</Card>
          </div>
          <Card title="Historial" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs muted">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  {ANTHRO_FIELDS.map((f) => <th key={f.key} className="px-2 py-2 font-medium">{f.label}</th>)}
                  <th className="px-2 py-2 font-medium">Σ 6</th>{canEdit && <th />}
                </tr></thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.id} className="border-t border-ink-700">
                      <td className="whitespace-nowrap px-4 py-2 text-white">{fmtDate(r.date)}{r.note && <div className="max-w-[180px] truncate text-xs muted" title={r.note}>{r.note}</div>}</td>
                      {ANTHRO_FIELDS.map((f) => <td key={f.key} className="num px-2 py-2 text-neutral-300">{fmtN(val(r, f.key))}</td>)}
                      <td className="num px-2 py-2 font-semibold text-white">{fmtN(s6(r))}</td>
                      {canEdit && <td className="px-2 py-2"><form action={deleteAnthropometry}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit message="¿Eliminar esta medición?">Eliminar</ConfirmSubmit></form></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {canEdit && (
        <Card title="Nueva medición">
          <form action={saveAnthropometry} className="space-y-5">
            <input type="hidden" name="athleteId" value={athleteId} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label><span className="label mb-1.5 block">Fecha</span><input type="date" name="date" defaultValue={today} className="input" /></label>
              <label className="sm:col-span-2"><span className="label mb-1.5 block">Nota</span><input name="note" maxLength={300} className="input" placeholder="Opcional: quién midió, condiciones…" /></label>
            </div>
            {ANTHRO_GROUPS.map((g) => (
              <fieldset key={g.title}>
                <legend className="label mb-2">{g.title}{g.unit ? ` (${g.unit})` : ""}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {(g.fields as readonly (typeof ANTHRO_FIELDS)[number][]).map((f) => (
                    <label key={f.key}><span className="mb-1 block text-xs text-neutral-400">{f.label} <span className="muted">{f.unit}</span></span>
                      <input name={f.key} inputMode="decimal" className="input" placeholder={last && val(last, f.key) != null ? fmtN(val(last, f.key)) : ""} /></label>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="text-xs muted">Completá solo lo que mediste. El peso y la talla también actualizan el perfil.</p>
            <div className="flex justify-end"><Submit>Guardar medición</Submit></div>
          </form>
        </Card>
      )}
    </div>
  );
}

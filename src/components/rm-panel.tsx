import { db } from "@/lib/db";
import { latestRMs } from "@/lib/training";
import { kgFromPercent, plateBreakdown, fmtKg } from "@/lib/plates";
import { epley1RM } from "@/lib/metrics";
import { Card, Empty, Field, fmtDate } from "./ui";
import { Submit, ConfirmSubmit } from "./forms";
import { saveRM, deleteRM, markRMSeen } from "@/app/app/rm/actions";


const PCTS = [50, 60, 65, 70, 75, 80, 85, 90, 95];

/** RM por ejercicio: valor actual, historial, tabla de porcentajes y estimación desde lo registrado. */
export async function RMPanel({ athleteId, viewer }: { athleteId: string; viewer: "COACH" | "ATHLETE" }) {
  const [rows, current, exercises, sets] = await Promise.all([
    db.exerciseRM.findMany({ where: { athleteId }, orderBy: { date: "desc" }, include: { exercise: { select: { name: true } }, setBy: { select: { name: true } } } }),
    latestRMs(athleteId),
    db.exercise.findMany({ where: { OR: [{ orgId: null }, { org: { users: { some: { id: athleteId } } } }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.setLog.findMany({ where: { log: { athleteId }, loadKg: { gt: 0 }, reps: { gt: 0, lte: 10 } }, include: { item: { select: { exerciseId: true } }, log: { select: { completedAt: true } } }, orderBy: { log: { completedAt: "desc" } }, take: 400 }),
  ]);
  const names = Object.fromEntries(exercises.map((e) => [e.id, e.name]));
  // Mejor RM estimado (Epley) desde las series registradas, por ejercicio
  const est = new Map<string, { kg: number; from: string; date: Date }>();
  for (const s of sets) {
    const v = epley1RM(s.loadKg!, s.reps!);
    const cur = est.get(s.item.exerciseId);
    if (!cur || v > cur.kg) est.set(s.item.exerciseId, { kg: Math.round(v * 2) / 2, from: `${fmtKg(s.loadKg!)} kg × ${s.reps}`, date: s.log.completedAt });
  }
  const unseen = rows.filter((r) => !r.seen && (viewer === "COACH" ? r.source === "DEPORTISTA" : r.source !== "DEPORTISTA"));
  const list = [...current.entries()].sort((a, b) => (names[a[0]] ?? "").localeCompare(names[b[0]] ?? ""));
  const suggestions = [...est.entries()].filter(([id, e]) => !current.has(id) || e.kg > current.get(id)!.kg * 1.02).slice(0, 6);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {unseen.length > 0 && (
          <div className="card card-pad flex flex-wrap items-center gap-3 border-volt/40 bg-volt/5">
            <div className="flex-1 text-sm">
              <b className="text-volt">RM actualizados</b>
              <ul className="mt-1 space-y-0.5 text-neutral-200">{unseen.map((r) => <li key={r.id}>{r.exercise.name}: <b className="num">{fmtKg(r.kg)} kg</b> <span className="muted">· {fmtDate(r.date)} · cargado por {r.setBy?.name ?? "—"}</span></li>)}</ul>
            </div>
            <form action={markRMSeen}>{unseen.map((r) => <input key={r.id} type="hidden" name="id" value={r.id} />)}<Submit className="btn-ghost btn-sm">Visto</Submit></form>
          </div>
        )}
        <Card title="RM actuales" pad={false}>
          {list.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Ejercicio</th><th>RM</th><th>Desde</th>{PCTS.map((p) => <th key={p} className="text-right">{p}%</th>)}</tr></thead>
                <tbody>
                  {list.map(([id, r]) => (
                    <tr key={id}>
                      <td className="whitespace-nowrap font-medium text-white">{names[id] ?? "—"}</td>
                      <td className="num whitespace-nowrap font-semibold text-volt">{fmtKg(r.kg)} kg</td>
                      <td className="whitespace-nowrap text-xs muted">{fmtDate(r.date)}{r.source === "EVALUACION" ? " · evaluación" : ""}</td>
                      {PCTS.map((p) => <td key={p} className="num text-right text-neutral-300" title={plateBreakdown(kgFromPercent(r.kg, p).rounded).join(" + ") || undefined}>{fmtKg(kgFromPercent(r.kg, p).rounded)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs muted">Los kilos de cada % se redondean a lo que se puede armar con barra de 20 kg y discos desde 1,25 kg. Pasá el mouse sobre un valor para ver los discos por lado.</p>
            </div>
          ) : <div className="p-5"><Empty title="Todavía no hay RM cargados">Cargá el primero con el formulario. Con el RM, las sesiones que usan % calculan los kilos solas.</Empty></div>}
        </Card>
        <Card title="Historial" pad={false}>
          {rows.length ? (
            <ul className="divide-y divide-ink-800">
              {rows.slice(0, 40).map((r, i) => {
                const prev = rows.slice(i + 1).find((x) => x.exerciseId === r.exerciseId);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-16 text-xs muted">{fmtDate(r.date)}</span>
                    <span className="flex-1 text-white">{r.exercise.name}</span>
                    <span className="num">{prev ? <span className="muted">{fmtKg(prev.kg)} → </span> : null}<b className="text-white">{fmtKg(r.kg)} kg</b></span>
                    <span className="chip-mute text-[10px]">{r.source === "DEPORTISTA" ? "Deportista" : "Entrenador"}</span>
                    {(viewer === "COACH" || r.source === "DEPORTISTA") && (
                      <form action={deleteRM}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit message="¿Borrar este RM del historial?" className="text-xs text-neutral-500 hover:text-red-400">Borrar</ConfirmSubmit></form>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <div className="p-5 text-sm muted">Sin registros.</div>}
        </Card>
      </div>
      <div className="space-y-6">
        <Card title={viewer === "ATHLETE" ? "Cargar mi RM" : "Cargar RM"}>
          <form action={saveRM} className="space-y-3">
            <input type="hidden" name="athleteId" value={athleteId} />
            <Field label="Ejercicio"><select name="exerciseId" className="input" required defaultValue=""><option value="" disabled>Elegir…</option>{exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kilos"><input name="kg" inputMode="decimal" className="input" required placeholder="100" /></Field>
              <Field label="Fecha"><input name="date" type="date" className="input" /></Field>
            </div>
            <Submit className="btn-primary w-full">Guardar RM</Submit>
            <p className="text-xs muted">{viewer === "ATHLETE" ? "Tu entrenador recibe un aviso con el cambio." : "El deportista recibe un aviso con el cambio."}</p>
          </form>
        </Card>
        {suggestions.length > 0 && (
          <Card title="Estimados desde los entrenamientos">
            <ul className="space-y-2 text-sm">
              {suggestions.map(([id, e]) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="flex-1"><span className="text-white">{names[id] ?? "—"}</span><span className="block text-xs muted">{e.from} el {fmtDate(e.date)}</span></span>
                  <form action={saveRM}><input type="hidden" name="athleteId" value={athleteId} /><input type="hidden" name="exerciseId" value={id} /><input type="hidden" name="kg" value={e.kg} /><Submit className="btn-ghost btn-sm" pendingText="…">Usar {fmtKg(e.kg)} kg</Submit></form>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs muted">Estimación con la fórmula de Epley sobre series de hasta 10 repeticiones. Es una referencia: confirmala antes de usarla.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

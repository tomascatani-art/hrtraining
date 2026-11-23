import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PHASES, MICRO_TYPES, CAPACITIES, sportLabel, SESSION_TYPES } from "@/lib/catalog";
import { PageHeader, Card, Field, DemoBadge, Empty, fmtDate } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { PlanDynamics, TrendChart } from "@/components/charts";
import { saveBlock, deleteBlock, updatePlan, deletePlan, sharePlan } from "../actions";

const DAY = 86_400_000;
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export default async function PlanDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ block?: string; add?: string; parent?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.plan.findUnique({ where: { id }, include: { blocks: { orderBy: { startDate: "asc" } }, athlete: true, group: { include: { members: true } }, sessions: { orderBy: { date: "desc" }, take: 10 } } });
  if (!p || p.orgId !== u.orgId || (u.role === "COACH" && p.coachId !== u.id)) notFound();

  const macros = p.blocks.filter((b) => b.level === "MACRO");
  const mesos = p.blocks.filter((b) => b.level === "MESO");
  const micros = p.blocks.filter((b) => b.level === "MICRO");
  const span = +p.endDate - +p.startDate;
  const pos = (d: Date) => Math.max(0, Math.min(100, ((+d - +p.startDate) / span) * 100));
  const width = (a: Date, b: Date) => Math.max(0.4, pos(b) - pos(a));
  const now = new Date();
  const months: Date[] = [];
  for (let d = new Date(p.startDate.getFullYear(), p.startDate.getMonth() + 1, 1); d < p.endDate; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);

  // Plan vs ejecutado: carga sRPE real promedio por deportista en cada microciclo
  const athleteIds = p.athleteId ? [p.athleteId] : p.group?.members.map((m) => m.athleteId) ?? [];
  const logs = athleteIds.length ? await db.workoutLog.findMany({ where: { athleteId: { in: athleteIds }, completedAt: { gte: p.startDate, lte: p.endDate }, load: { not: null } }, select: { completedAt: true, load: true } }) : [];
  const versus = micros.filter((m) => m.startDate <= now).slice(-16).map((m) => {
    const sum = logs.filter((l) => l.completedAt >= m.startDate && l.completedAt < m.endDate).reduce((a, l) => a + (l.load ?? 0), 0);
    return { x: fmtDate(m.startDate), plan: m.plannedLoad ?? null, real: Math.round(sum / Math.max(1, athleteIds.length)) };
  });
  const dyn = micros.map((m) => ({ x: fmtDate(m.startDate), volumen: m.plannedVolume, intensidad: m.plannedIntensity, fase: PHASES[m.phase]?.label, color: PHASES[m.phase]?.color ?? "#555" }));
  const editing = sp.block ? p.blocks.find((b) => b.id === sp.block) : null;
  const adding = sp.add;
  const parentForAdd = sp.parent ? p.blocks.find((b) => b.id === sp.parent) : null;

  return (
    <>
      <PageHeader eyebrow={`${sportLabel(p.sport)} · ${p.group?.name ?? p.athlete?.name ?? ""}`} title={p.name}
        subtitle={<>{fmtDate(p.startDate, { day: "numeric", month: "short", year: "numeric" })} → {fmtDate(p.endDate, { day: "numeric", month: "short", year: "numeric" })}{p.goal ? ` · ${p.goal}` : ""} {p.isDemo && <DemoBadge />}</>}
        actions={<>
          <Link href={`/app/planning/${p.id}?add=MESO`} className="btn-primary">+ Mesociclo</Link>
          <Link href={`/app/planning/${p.id}?add=MACRO`} className="btn-ghost">+ Macrociclo</Link>
          <Link href={`/app/calendar?new=1&plan=${p.id}${p.groupId ? `&group=${p.groupId}` : p.athleteId ? `&athlete=${p.athleteId}` : ""}`} className="btn-ghost">+ Sesión</Link>
        </>} />

      {/* Línea de tiempo */}
      <Card title="Estructura de la temporada" action={<div className="hidden flex-wrap gap-3 md:flex">{Object.entries(PHASES).map(([k, v]) => <span key={k} className="flex items-center gap-1.5 text-[11px] text-neutral-400"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: v.color }} />{v.label}</span>)}</div>}>
        <div className="overflow-x-auto">
          <div className="relative min-w-[880px] pb-2">
            <div className="relative ml-24 h-5 text-[10px] text-neutral-500">
              {months.map((m) => <span key={+m} className="absolute -translate-x-1/2" style={{ left: `${pos(m)}%` }}>{fmtDate(m, { month: "short" })}</span>)}
            </div>
            {[
              { label: "Macrociclos", items: macros, h: "h-9" },
              { label: "Mesociclos", items: mesos, h: "h-14" },
            ].map((lane) => (
              <div key={lane.label} className="flex items-center gap-0 border-t border-ink-800 py-1.5">
                <div className="w-24 shrink-0 label">{lane.label}</div>
                <div className={`relative flex-1 ${lane.h}`}>
                  {lane.items.map((b) => (
                    <Link key={b.id} href={`/app/planning/${p.id}?block=${b.id}`} title={`${b.name} · ${PHASES[b.phase]?.label}`}
                      className={`absolute inset-y-0 overflow-hidden rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition hover:z-10 hover:scale-[1.02] ${editing?.id === b.id ? "border-white" : "border-black/40"}`}
                      style={{ left: `${pos(b.startDate)}%`, width: `${width(b.startDate, b.endDate)}%`, background: lane.label === "Macrociclos" ? "#222" : PHASES[b.phase]?.color, color: lane.label === "Macrociclos" ? "#ffd60a" : "#000" }}>
                      <span className="line-clamp-2">{b.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-end gap-0 border-t border-ink-800 py-1.5">
              <div className="w-24 shrink-0 label">Microciclos</div>
              <div className="relative h-16 flex-1">
                {micros.map((m) => (
                  <Link key={m.id} href={`/app/planning/${p.id}?block=${m.id}`} title={`${m.name} · ${MICRO_TYPES[m.microType ?? "CARGA"]?.label} · Vol ${m.plannedVolume} · Int ${m.plannedIntensity}`}
                    className="group absolute bottom-0 flex flex-col justify-end px-[1px]" style={{ left: `${pos(m.startDate)}%`, width: `${width(m.startDate, m.endDate)}%`, height: "100%" }}>
                    <span className={`block w-full rounded-t-sm transition group-hover:brightness-125 ${editing?.id === m.id ? "ring-1 ring-white" : ""}`} style={{ height: `${m.plannedVolume * 10}%`, background: m.microType === "RECUPERACION" ? "#4ade80" : m.microType === "CHOQUE" ? "#ff6b3d" : m.microType === "COMPETENCIA" ? "#f43f5e" : PHASES[m.phase]?.color, opacity: 0.85 }} />
                  </Link>
                ))}
              </div>
            </div>
            {now > p.startDate && now < p.endDate && (
              <div className="pointer-events-none absolute bottom-0 top-5 w-0.5 bg-white/80" style={{ left: `calc(6rem + (100% - 6rem) * ${pos(now) / 100})` }}><span className="absolute -top-4 -translate-x-1/2 rounded bg-white px-1 text-[9px] font-bold text-black">HOY</span></div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
          <span>Altura de cada microciclo = volumen planificado.</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#ff6b3d]" />Choque</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#4ade80]" />Recuperación</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#f43f5e]" />Competencia</span>
        </div>
      </Card>

      {(editing || adding) && (
        <Card title={editing ? `Editar: ${editing.name}` : `Nuevo ${adding === "MACRO" ? "macrociclo" : adding === "MICRO" ? "microciclo" : "mesociclo"}`} className="mt-6 border-volt/40"
          action={<Link href={`/app/planning/${p.id}`} className="text-xs muted hover:text-white">Cerrar</Link>}>
          <BlockForm planId={p.id} block={editing ?? undefined} level={editing?.level ?? adding!} parents={(editing?.level ?? adding) === "MICRO" ? mesos : (editing?.level ?? adding) === "MESO" ? macros : []}
            defaults={{ start: parentForAdd?.startDate ?? (mesos.at(-1)?.endDate ?? p.startDate), parentId: parentForAdd?.id }} />
          {editing && (
            <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-ink-700 pt-4">
              {editing.level === "MESO" && <Link href={`/app/planning/${p.id}?add=MICRO&parent=${editing.id}`} className="btn-ghost btn-sm">+ Microciclo dentro de este mesociclo</Link>}
              <form action={deleteBlock}><input type="hidden" name="id" value={editing.id} /><ConfirmSubmit message="¿Eliminar el bloque y todo lo que contiene?">Eliminar bloque</ConfirmSubmit></form>
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Dinámica de volumen e intensidad" action={<span className="label">Escala 1-10</span>}>
          {dyn.length ? <PlanDynamics data={dyn} /> : <Empty title="Agregá microciclos para ver la dinámica" />}
        </Card>
        <Card title="Plan vs. ejecutado" action={<span className="label">UA por deportista / semana</span>}>
          {versus.length ? <TrendChart data={versus} series={[{ key: "plan", name: "Planificada" }, { key: "real", name: "Ejecutada (sRPE)" }]} unit="UA" /> : <Empty title="Sin semanas transcurridas todavía" />}
        </Card>
      </div>

      <Card title="Distribución de capacidades por mesociclo" className="mt-6" pad={false}>
        {mesos.length ? (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr><th className="py-2 text-left label">Capacidad</th>{mesos.map((m) => <th key={m.id} className="px-1 py-2 text-center font-medium text-neutral-400"><div className="mx-auto h-1 w-full rounded" style={{ background: PHASES[m.phase]?.color }} /><div className="mt-1 line-clamp-2">{m.name}</div></th>)}<th className="label">Semanas</th></tr></thead>
              <tbody>
                {Object.entries(CAPACITIES).map(([k, c]) => {
                  const weeks = micros.filter((m) => m.capacities.includes(k)).length;
                  return (
                    <tr key={k} className="border-t border-ink-800">
                      <td className="py-1.5 pr-3 text-neutral-300">{c.label}</td>
                      {mesos.map((m) => {
                        const on = m.capacities.includes(k);
                        const i = m.capacities.indexOf(k);
                        return <td key={m.id} className="px-1 py-1.5"><div className={`mx-auto h-5 rounded ${on ? "" : "bg-ink-800"}`} style={on ? { background: "#ffd60a", opacity: i === 0 ? 1 : i === 1 ? 0.7 : 0.45 } : undefined} title={on ? (i === 0 ? "Prioritaria" : "Secundaria") : ""} /></td>;
                      })}
                      <td className="num text-center text-neutral-400">{weeks || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-neutral-600">Intensidad del color = orden de prioridad dentro del mesociclo.</p>
          </div>
        ) : <div className="p-5"><Empty title="Sin mesociclos" /></div>}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Mesociclos" className="xl:col-span-2" pad={false}>
          <div className="overflow-x-auto">
            <table className="table min-w-[680px]">
              <thead><tr><th>Mesociclo</th><th>Fase</th><th>Fechas</th><th>Semanas</th><th>Vol/Int</th><th>Capacidades</th></tr></thead>
              <tbody>
                {mesos.map((m) => (
                  <tr key={m.id}>
                    <td><Link href={`/app/planning/${p.id}?block=${m.id}`} className="font-semibold text-white hover:text-volt">{m.name}</Link></td>
                    <td><span className="chip" style={{ borderColor: PHASES[m.phase]?.color, color: PHASES[m.phase]?.color }}>{PHASES[m.phase]?.label}</span></td>
                    <td className="whitespace-nowrap text-neutral-400">{fmtDate(m.startDate)} – {fmtDate(m.endDate)}</td>
                    <td className="num">{Math.round((+m.endDate - +m.startDate) / (7 * DAY))}</td>
                    <td className="num">{m.plannedVolume}/{m.plannedIntensity}</td>
                    <td className="text-xs text-neutral-400">{m.capacities.map((c) => CAPACITIES[c]?.short).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Sesiones vinculadas">
            {p.sessions.length ? <ul className="space-y-1">{p.sessions.map((s) => <li key={s.id}><Link href={`/app/sessions/${s.id}`} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800"><span className="truncate text-white">{s.title}</span><span className="shrink-0 muted">{fmtDate(s.date)} · {SESSION_TYPES[s.type]?.split(" ")[0]}</span></Link></li>)}</ul> : <Empty title="Sin sesiones" />}
          </Card>
          <Card title="Datos generales">
            <form action={updatePlan} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <input name="name" defaultValue={p.name} className="input" />
              <div className="grid grid-cols-2 gap-2"><input name="startDate" type="date" defaultValue={iso(p.startDate)} className="input" /><input name="endDate" type="date" defaultValue={iso(p.endDate)} className="input" /></div>
              <textarea name="goal" defaultValue={p.goal ?? ""} className="input" placeholder="Objetivo" />
              <Submit className="btn-ghost w-full">Guardar</Submit>
            </form>
            <form action={sharePlan} className="mt-2"><input type="hidden" name="id" value={p.id} /><Submit className="btn-ghost w-full" pendingText="Enviando…">Notificar a los deportistas</Submit></form>
            <form action={deletePlan} className="mt-2 text-right"><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="¿Eliminar la planificación completa?">Eliminar planificación</ConfirmSubmit></form>
          </Card>
        </div>
      </div>
    </>
  );
}

function BlockForm({ planId, block, level, parents, defaults }: {
  planId: string; level: string; parents: { id: string; name: string }[];
  block?: { id: string; name: string; phase: string; microType: string | null; startDate: Date; endDate: Date; capacities: string[]; plannedVolume: number; plannedIntensity: number; plannedLoad: number | null; notes: string | null; parentId: string | null };
  defaults: { start: Date; parentId?: string };
}) {
  const start = block?.startDate ?? defaults.start;
  const end = block?.endDate ?? new Date(+start + (level === "MICRO" ? 7 : level === "MESO" ? 28 : 120) * DAY);
  return (
    <form action={saveBlock} className="grid gap-4 md:grid-cols-4">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="level" value={level} />
      {block && <input type="hidden" name="id" value={block.id} />}
      <Field label="Nombre" className="md:col-span-2"><input name="name" defaultValue={block?.name} className="input" required /></Field>
      <Field label="Fase"><select name="phase" defaultValue={block?.phase ?? "PREP_GENERAL"} className="input">{Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      {parents.length > 0 ? (
        <Field label={level === "MICRO" ? "Mesociclo" : "Macrociclo"}><select name="parentId" defaultValue={block?.parentId ?? defaults.parentId ?? ""} className="input"><option value="">—</option>{parents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      ) : <div />}
      <Field label="Inicio"><input name="startDate" type="date" defaultValue={iso(start)} className="input" required /></Field>
      <Field label="Fin"><input name="endDate" type="date" defaultValue={iso(end)} className="input" required /></Field>
      {level !== "MACRO" && <>
        <Field label="Volumen (1-10)"><input name="plannedVolume" type="number" min={1} max={10} defaultValue={block?.plannedVolume ?? 6} className="input" /></Field>
        <Field label="Intensidad (1-10)"><input name="plannedIntensity" type="number" min={1} max={10} defaultValue={block?.plannedIntensity ?? 6} className="input" /></Field>
      </>}
      {level === "MICRO" && <>
        <Field label="Tipo de microciclo"><select name="microType" defaultValue={block?.microType ?? "CARGA"} className="input">{Object.entries(MICRO_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Carga objetivo (UA sRPE)"><input name="plannedLoad" type="number" defaultValue={block?.plannedLoad ?? ""} className="input" /></Field>
      </>}
      {level !== "MACRO" && (
        <div className="md:col-span-4">
          <span className="label mb-2 block">Capacidades a desarrollar (el orden de selección marca la prioridad)</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CAPACITIES).map(([k, c]) => (
              <label key={k} className="cursor-pointer">
                <input type="checkbox" name="capacities" value={k} defaultChecked={block?.capacities.includes(k)} className="peer sr-only" />
                <span className="chip-mute peer-checked:border-volt peer-checked:bg-volt peer-checked:text-black">{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <Field label="Notas" className="md:col-span-4"><textarea name="notes" defaultValue={block?.notes ?? ""} className="input" /></Field>
      <div className="flex items-center justify-between gap-3 md:col-span-4">
        {level === "MESO" && !block ? <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="autoMicros" defaultChecked /> Generar microciclos semanales automáticamente</label> : <span />}
        <Submit>{block ? "Guardar cambios" : "Crear bloque"}</Submit>
      </div>
    </form>
  );
}

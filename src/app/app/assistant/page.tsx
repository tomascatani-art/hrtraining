import { Sparkles, Lightbulb } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import { CAPACITIES, EQUIPMENT, TEST_MAP } from "@/lib/catalog";
import { generateWeek, PRESCRIPTION } from "@/lib/generator";
import { monitoringFor } from "@/lib/queries";
import { improvement, wellnessScore } from "@/lib/metrics";
import { PageHeader, Card, Field, fmtDate } from "@/components/ui";
import { Submit } from "@/components/forms";
import { createFromProposal } from "./actions";
import { recentExerciseUse, type RecentUse } from "../sessions/actions";

export const metadata = { title: "Asistente" };

const OBJECTIVES = ["FUERZA_MAXIMA", "HIPERTROFIA", "POTENCIA", "FUERZA_EXPLOSIVA", "FUERZA_VELOCIDAD", "FUERZA_RESISTENCIA"];

export default async function AssistantPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const ids = await visibleAthleteIds(u);
  const [athletes, groups] = await Promise.all([db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }), visibleGroups(u)]);
  const objective = one("objective") ?? "";
  const days = Number(one("days") ?? 3), level = Number(one("level") ?? 2);
  const eq = ([] as string[]).concat(sp.equipment ?? []);
  const athlete = one("athlete") && ids.includes(one("athlete")!) ? one("athlete")! : "";

  let proposal: ReturnType<typeof generateWeek> | null = null;
  if (objective) {
    const library = await db.exercise.findMany({ where: { OR: [{ orgId: null }, { orgId: u.orgId }] }, select: { id: true, name: true, pattern: true, capacities: true, equipment: true, difficulty: true, primaryMuscle: true } });
    proposal = generateWeek({ objective, days, level, equipment: eq, library });
  }

  // Recomendaciones basadas en el historial del alumno elegido
  const recs: string[] = [];
  let used: Record<string, RecentUse> = {};
  if (athlete) {
    used = await recentExerciseUse(`a:${athlete}`, new Date().toISOString());
    const [m] = await monitoringFor([athlete]);
    const evals = await db.evaluation.findMany({ where: { athleteId: athlete }, orderBy: { date: "asc" } });
    const keys = [...new Set(evals.map((e) => e.testKey))].filter((k) => TEST_MAP[k] && !k.startsWith("FMS_"));
    for (const k of keys) {
      const l = evals.filter((e) => e.testKey === k);
      if (l.length < 2) continue;
      const ch = improvement(l.at(-2)!.value, l.at(-1)!.value, TEST_MAP[k].higherIsBetter);
      if (ch < 0.5) recs.push(`${TEST_MAP[k].name}: sin mejora en la última evaluación (${ch.toFixed(1)}%). Considerá variar el estímulo o revisar la técnica.`);
    }
    const fms = evals.filter((e) => e.testKey === "FMS_TOTAL").at(-1);
    if (fms && fms.value <= 14) recs.push(`FMS total ${fms.value}/21: priorizá movilidad y estabilidad en la entrada en calor.`);
    if (m.indicators.acwr && m.indicators.acwr >= 1.3) recs.push(`La carga de los últimos 7 días es ${m.indicators.acwr.toFixed(2)}× su promedio mensual: conviene una progresión más gradual.`);
    if (m.lastWellness && wellnessScore(m.lastWellness) <= 13) recs.push("Bienestar bajo en el último registro: consultá con el alumno antes de una sesión exigente.");
    if (!recs.length) recs.push("Sin señales de estancamiento ni cambios bruscos de carga. Podés progresar según lo planificado.");
  }

  return (
    <>
      <PageHeader eyebrow="Basado en reglas de prescripción" title="Asistente de planificación" subtitle="Genera una propuesta semanal según objetivo, nivel, frecuencia y material disponible, y sugiere ajustes a partir del historial del alumno. Siempre la valida el entrenador antes de asignarla." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Parámetros" className="h-fit">
          <form className="space-y-3">
            <Field label="Alumno (para recomendaciones)"><select name="athlete" defaultValue={athlete} className="input"><option value="">—</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <Field label="Objetivo principal"><select name="objective" defaultValue={objective} className="input" required><option value="">Elegir…</option>{OBJECTIVES.map((o) => <option key={o} value={o}>{CAPACITIES[o].label}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Días / semana"><select name="days" defaultValue={days} className="input">{[2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</select></Field>
              <Field label="Nivel"><select name="level" defaultValue={level} className="input"><option value={1}>Básico</option><option value={2}>Intermedio</option><option value={3}>Avanzado</option></select></Field>
            </div>
            <div><span className="label mb-1.5 block">Material disponible</span>
              <div className="flex flex-wrap gap-1.5">{EQUIPMENT.map((q) => <label key={q} className="cursor-pointer"><input type="checkbox" name="equipment" value={q} defaultChecked={eq.includes(q)} className="peer sr-only" /><span className="chip-mute py-1 peer-checked:border-volt peer-checked:bg-volt peer-checked:text-black">{q}</span></label>)}</div>
              <p className="mt-1 text-[11px] text-neutral-600">Sin selección = gimnasio completo.</p>
            </div>
            <button className="btn-primary w-full"><Sparkles size={16} />Generar propuesta</button>
          </form>
        </Card>
        <div className="space-y-6 xl:col-span-2">
          {recs.length > 0 && (
            <Card title="Recomendaciones según el historial">
              <ul className="space-y-2">{recs.map((r, i) => <li key={i} className="flex gap-2 text-sm text-neutral-200"><Lightbulb size={16} className="mt-0.5 shrink-0 text-volt" />{r}</li>)}</ul>
            </Card>
          )}
          {proposal ? (
            <>
              <Card title={`Propuesta · ${CAPACITIES[objective].label}`} action={<span className="text-xs muted">{PRESCRIPTION[objective].note}</span>}>
                <div className="grid gap-4 md:grid-cols-2">
                  {proposal.map((d) => (
                    <div key={d.title} className="rounded-xl border border-ink-700 bg-ink-900 p-3">
                      <div className="mb-2 font-display font-semibold text-volt">{d.title}</div>
                      <ol className="space-y-1.5 text-sm">{d.items.map((it, i) => <li key={i} className="flex gap-2"><span className="num text-neutral-500">{i + 1}</span><span className="flex-1 text-white">{it.name}{used[it.exerciseId] && <span className="chip-volt ml-2 !px-1.5 !py-0.5 text-[10px]" title={`Ya lo hizo el ${fmtDate(used[it.exerciseId].date)} en “${used[it.exerciseId].title}”`}>Repite · último mes</span>}</span><span className="num text-xs text-neutral-400">{it.sets}×{it.reps}{it.percent1RM ? ` @${it.percent1RM}%` : ""}{it.targetRir != null ? ` RIR${it.targetRir}` : ""}</span></li>)}</ol>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Asignar como sesiones">
                <form action={createFromProposal} className="grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="plan" value={JSON.stringify(proposal)} />
                  <Field label="Nombre"><input name="name" defaultValue={`Bloque ${CAPACITIES[objective].label.toLowerCase()}`} className="input" /></Field>
                  <Field label="Para"><select name="target" defaultValue={athlete ? `a:${athlete}` : ""} className="input" required><option value="">Elegir…</option><optgroup label="Alumnos">{athletes.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}</optgroup></select></Field>
                  <Field label="Desde"><input type="date" name="start" defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} className="input" /></Field>
                  <Field label="Semanas"><select name="weeks" className="input">{[1, 2, 3, 4, 6, 8].map((w) => <option key={w}>{w}</option>)}</select></Field>
                  <div className="sm:col-span-4 flex items-center justify-between gap-3"><p className="text-xs muted">Las sesiones se crean editables: podés ajustar ejercicios, cargas y fechas después.</p><Submit>Validar y crear sesiones</Submit></div>
                </form>
              </Card>
            </>
          ) : !recs.length && <Card><p className="text-sm muted">Completá los parámetros para generar una propuesta.</p></Card>}
        </div>
      </div>
    </>
  );
}

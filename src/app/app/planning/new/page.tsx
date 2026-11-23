import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import { SPORTS } from "@/lib/catalog";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { createPlan } from "../actions";

export const metadata = { title: "Nueva planificación" };

export default async function NewPlan({ searchParams }: { searchParams: Promise<{ athlete?: string; group?: string; sport?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const [athletes, groups] = await Promise.all([db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }), visibleGroups(u)]);
  const today = new Date();
  const end = new Date(today.getTime() + 364 * 86400000);
  const def = sp.athlete ? `a:${sp.athlete}` : sp.group ? `g:${sp.group}` : "";
  return (
    <>
      <PageHeader title="Nueva planificación" subtitle="Definí el período y el destinatario. Si activás la estructura automática, se generan mesociclos y microciclos según el deporte (acumulación → transformación → realización → competencia → puesta a punto → transición). Después podés editar todo." />
      <Card className="max-w-3xl">
        <form action={createPlan} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2"><input name="name" className="input" required placeholder="Ej: Temporada 2027 — Primera división" /></Field>
          <Field label="Para"><select name="target" defaultValue={def} className="input" required>
            <option value="">Elegir…</option>
            <optgroup label="Grupos">{groups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}</optgroup>
            <optgroup label="Deportistas">{athletes.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}</optgroup>
          </select></Field>
          <Field label="Deporte"><select name="sport" defaultValue={sp.sport} className="input">{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Inicio"><input name="startDate" type="date" className="input" defaultValue={today.toISOString().slice(0, 10)} required /></Field>
          <Field label="Fin"><input name="endDate" type="date" className="input" defaultValue={end.toISOString().slice(0, 10)} required /></Field>
          <Field label="Objetivo de la temporada" className="sm:col-span-2"><textarea name="goal" className="input" placeholder="Ej: llegar en pico de forma al campeonato nacional" /></Field>
          <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-volt/30 bg-volt/5 p-3 text-sm">
            <input type="checkbox" name="auto" defaultChecked className="mt-1" />
            <span><b className="text-white">Generar estructura sugerida</b><br /><span className="muted">Crea macrociclo, mesociclos por fase y microciclos semanales con dinámica 3:1 (carga/recuperación). Es un punto de partida: el entrenador valida y ajusta.</span></span>
          </label>
          <div className="sm:col-span-2 flex justify-end"><Submit>Crear planificación</Submit></div>
        </form>
      </Card>
    </>
  );
}

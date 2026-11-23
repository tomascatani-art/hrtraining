import type { Exercise } from "@prisma/client";
import { CAPACITIES, CHAINS, DIFFICULTY, EQUIPMENT, MUSCLES, PATTERNS, SPORTS } from "@/lib/catalog";
import { Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { VideoField } from "@/components/video-field";
import { saveExercise } from "./actions";

function Checks({ name, opts, values }: { name: string; opts: [string, string][]; values?: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(([v, l]) => (
        <label key={v} className="cursor-pointer">
          <input type="checkbox" name={name} value={v} defaultChecked={values?.includes(v)} className="peer sr-only" />
          <span className="chip-mute py-1 peer-checked:border-volt peer-checked:bg-volt peer-checked:text-black">{l}</span>
        </label>
      ))}
    </div>
  );
}

export function ExerciseForm({ e }: { e?: Exercise }) {
  return (
    <form action={saveExercise} className="grid gap-6 xl:grid-cols-3">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2"><input name="name" defaultValue={e?.name} className="input" required /></Field>
            <Field label="Objetivo del ejercicio" className="sm:col-span-2"><input name="objective" defaultValue={e?.objective ?? ""} className="input" /></Field>
            <Field label="Descripción técnica" className="sm:col-span-2"><textarea name="description" defaultValue={e?.description ?? ""} className="input" /></Field>
            <Field label="Indicaciones de ejecución"><textarea name="cues" defaultValue={e?.cues ?? ""} className="input" /></Field>
            <Field label="Errores frecuentes"><textarea name="commonErrors" defaultValue={e?.commonErrors ?? ""} className="input" /></Field>
            <Field label="Variantes y progresiones" className="sm:col-span-2"><textarea name="variants" defaultValue={e?.variants ?? ""} className="input" /></Field>
            <Field label="Series sugeridas"><input name="suggestedSets" defaultValue={e?.suggestedSets ?? ""} className="input" placeholder="3-4" /></Field>
            <Field label="Repeticiones sugeridas"><input name="suggestedReps" defaultValue={e?.suggestedReps ?? ""} className="input" placeholder="6-10" /></Field>
          </div>
        </Card>
        <Card title="Clasificación">
          <div className="space-y-4">
            <div><span className="label mb-2 block">Músculos (el primero marcado es el principal)</span><Checks name="muscles" opts={MUSCLES.map((m) => [m, m])} values={e?.muscles} /></div>
            <div><span className="label mb-2 block">Capacidades</span><Checks name="capacities" opts={Object.entries(CAPACITIES).map(([k, v]) => [k, v.label])} values={e?.capacities} /></div>
            <div><span className="label mb-2 block">Deportes</span><Checks name="sports" opts={Object.entries(SPORTS).map(([k, v]) => [k, v.label])} values={e?.sports} /></div>
            <div><span className="label mb-2 block">Material</span><Checks name="equipment" opts={EQUIPMENT.map((m) => [m, m])} values={e?.equipment} /></div>
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="Multimedia">
          <div className="space-y-4">
            <Field label="Video demostrativo"><VideoField defaultValue={e?.videoUrl} /></Field>
            <Field label="Imagen (URL)"><input name="imageUrl" defaultValue={e?.imageUrl ?? ""} className="input" placeholder="https://…" /></Field>
          </div>
        </Card>
        <Card title="Tipo">
          <div className="space-y-3">
            <Field label="Patrón de movimiento"><select name="pattern" defaultValue={e?.pattern} className="input">{Object.entries(PATTERNS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Cadena cinética"><select name="kineticChain" defaultValue={e?.kineticChain} className="input">{Object.entries(CHAINS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Nivel"><select name="difficulty" defaultValue={e?.difficulty ?? 2} className="input">{Object.entries(DIFFICULTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
        </Card>
        <Submit className="btn-primary w-full">{e ? "Guardar cambios" : "Crear ejercicio"}</Submit>
      </div>
    </form>
  );
}

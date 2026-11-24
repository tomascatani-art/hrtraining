import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAPACITIES, CHAINS, DIFFICULTY, PATTERNS, sportLabel } from "@/lib/catalog";
import { PageHeader, Card } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { cloneExercise, deleteExercise, setExerciseLink } from "../actions";
import { VideoEmbed } from "@/components/video-player";
import { exerciseVideos } from "@/lib/exercise-video";
import { youtubeSearch } from "@/lib/video";
import { Search } from "lucide-react";

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const e = await db.exercise.findUnique({ where: { id }, include: { createdBy: true } });
  if (!e || (e.orgId && e.orgId !== u.orgId)) notFound();
  const staff = u.role !== "ATHLETE";
  const video = (await exerciseVideos(u.orgId, [e.id])).get(e.id) ?? null;
  const ownLink = staff ? await db.exerciseLink.findUnique({ where: { orgId_exerciseId: { orgId: u.orgId, exerciseId: e.id } } }) : null;
  const Block = ({ t, c }: { t: string; c: string | null }) => c ? <div><div className="label mb-1 text-volt/80">{t}</div><p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{c}</p></div> : null;
  return (
    <>
      <PageHeader eyebrow={`${PATTERNS[e.pattern] ?? e.pattern} · ${CHAINS[e.kineticChain] ?? e.kineticChain}`} title={e.name} subtitle={e.objective ?? undefined}
        actions={staff ? <>
          {e.orgId ? <Link href={`/app/library/${e.id}/edit`} className="btn-primary">Editar</Link> : <form action={cloneExercise}><input type="hidden" name="id" value={e.id} /><Submit className="btn-ghost">Duplicar y personalizar</Submit></form>}
          {e.orgId && <form action={deleteExercise}><input type="hidden" name="id" value={e.id} /><ConfirmSubmit message="¿Eliminar el ejercicio?" className="btn-danger">Eliminar</ConfirmSubmit></form>}
        </> : undefined} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card pad={!video} className="overflow-hidden">
            {video ? <div className="p-3"><VideoEmbed url={video} title={e.name} /></div>
              : <div className="grid aspect-video place-items-center rounded-xl bg-ink-900 text-center"><div><div className="font-display text-5xl font-bold text-ink-600">{e.pattern}</div><p className="mt-2 text-sm muted">Todavía no tiene video.</p></div></div>}
          </Card>
          {staff && (
            <Card title="Video del ejercicio">
              <form action={setExerciseLink} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="exerciseId" value={e.id} />
                <input name="url" defaultValue={ownLink?.url ?? (video ?? "")} placeholder="Pegá el link de YouTube (https://youtube.com/watch?v=…)" className="input flex-1" />
                <Submit pendingText="Guardando…">Guardar link</Submit>
              </form>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs muted">
                <span>Se usa en todas las rutinas y sesiones donde aparezca este ejercicio. Dejalo vacío para quitarlo.</span>
                <a href={youtubeSearch(e.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-volt"><Search size={12} />Buscar en YouTube</a>
              </div>
            </Card>
          )}
          <Card title="Técnica" className="space-y-5">
            <div className="space-y-5">
              <Block t="Descripción técnica" c={e.description} />
              <Block t="Indicaciones de ejecución" c={e.cues} />
              <Block t="Errores frecuentes" c={e.commonErrors} />
              <Block t="Variantes y progresiones" c={e.variants} />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Prescripción sugerida">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-ink-900 p-3"><div className="label">Series</div><div className="num text-2xl font-semibold text-white">{e.suggestedSets ?? "—"}</div></div>
              <div className="rounded-xl bg-ink-900 p-3"><div className="label">Repeticiones</div><div className="num text-2xl font-semibold text-white">{e.suggestedReps ?? "—"}</div></div>
            </div>
            <div className="mt-3 text-xs muted">Nivel: {DIFFICULTY[e.difficulty]}</div>
          </Card>
          <Card title="Clasificación">
            <dl className="space-y-3 text-sm">
              <div><dt className="label">Músculos involucrados</dt><dd className="mt-1 flex flex-wrap gap-1">{e.muscles.map((m, i) => <span key={m} className={i === 0 ? "chip-volt" : "chip-mute"}>{m}</span>)}</dd></div>
              <div><dt className="label">Capacidades</dt><dd className="mt-1 flex flex-wrap gap-1">{e.capacities.map((c) => <span key={c} className="chip-mute">{CAPACITIES[c]?.label}</span>)}</dd></div>
              <div><dt className="label">Material</dt><dd className="mt-1 text-neutral-200">{e.equipment.join(", ") || "—"}</dd></div>
              <div><dt className="label">Deportes</dt><dd className="mt-1 text-neutral-200">{e.sports.map(sportLabel).join(", ")}</dd></div>
              {e.createdBy && <div><dt className="label">Creado por</dt><dd className="mt-1 text-neutral-200">{e.createdBy.name}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

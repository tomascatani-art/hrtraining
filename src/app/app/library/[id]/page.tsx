import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAPACITIES, CHAINS, DIFFICULTY, PATTERNS, sportLabel } from "@/lib/catalog";
import { PageHeader, Card } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { cloneExercise, deleteExercise } from "../actions";

function embed(url: string) {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = /vimeo\.com\/(\d+)/.exec(url);
  if (vimeo) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (url.startsWith("/api/files/") || /\.(mp4|webm|mov)$/i.test(url)) return { type: "video", src: url };
  return { type: "link", src: url };
}

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const e = await db.exercise.findUnique({ where: { id }, include: { createdBy: true } });
  if (!e || (e.orgId && e.orgId !== u.orgId)) notFound();
  const staff = u.role !== "ATHLETE";
  const v = e.videoUrl ? embed(e.videoUrl) : null;
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
          <Card pad={false} className="overflow-hidden">
            {v?.type === "iframe" ? <iframe src={v.src} className="aspect-video w-full" allowFullScreen title={e.name} />
              : v?.type === "video" ? <video src={v.src} controls className="aspect-video w-full bg-black" />
              : e.imageUrl ? <img src={e.imageUrl} alt={e.name} className="w-full" />
              : <div className="grid aspect-video place-items-center bg-ink-900 text-center"><div><div className="font-display text-5xl font-bold text-ink-600">{e.pattern}</div>{v?.type === "link" && <a href={v.src} target="_blank" rel="noreferrer" className="btn-ghost mt-4">Ver videos de referencia</a>}</div></div>}
          </Card>
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

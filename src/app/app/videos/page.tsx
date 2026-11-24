import Link from "next/link";
import { Film } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { PageHeader, Card, Empty, Field, fmtDate } from "@/components/ui";
import { Uploader } from "@/components/uploader";
import { Submit } from "@/components/forms";
import { createAnalysis } from "./actions";

export const metadata = { title: "Video análisis" };

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ file?: string; athlete?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const staff = u.role !== "ATHLETE";
  const scope = sp.athlete && ids.includes(sp.athlete) ? [sp.athlete] : ids;
  const [analyses, videos, athletes] = await Promise.all([
    db.videoAnalysis.findMany({ where: { athleteId: { in: scope } }, include: { athlete: true, _count: { select: { comments: true } } }, orderBy: { updatedAt: "desc" } }),
    db.fileAsset.findMany({ where: { orgId: u.orgId, kind: "VIDEO", OR: staff ? [{ athleteId: { in: scope } }, { athleteId: null }, { shared: true }] : [{ athleteId: u.id }, { ownerId: u.id }, { shared: true }] }, orderBy: { createdAt: "desc" }, include: { athlete: true } }),
    staff ? db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const pre = sp.file ? videos.find((v) => v.id === sp.file) : undefined;
  return (
    <>
      <PageHeader title="Video análisis" subtitle="Cámara lenta, cuadro por cuadro, comparación lado a lado, líneas, ángulos articulares y comentarios con marca de tiempo." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Análisis">
            {analyses.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {analyses.map((a) => (
                  <Link key={a.id} href={`/app/videos/${a.id}`} className="card card-hover flex gap-3 p-3">
                    <span className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-ink-700 text-volt"><Film size={22} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{a.title}</div>
                      <div className="truncate text-xs muted">{a.athlete.name}{a.movement ? ` · ${a.movement}` : ""}</div>
                      <div className="mt-1 flex gap-2"><span className={a.status === "REVISADO" ? "chip-green" : "chip-amber"}>{a.status === "REVISADO" ? "Revisado" : "Pendiente"}</span><span className="text-[11px] text-neutral-600">{a._count.comments} comentarios · {fmtDate(a.updatedAt)}</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <Empty title="Sin análisis todavía">Subí un video y creá el primer análisis.</Empty>}
          </Card>
          <Card title="Videos disponibles" pad={false}>
            {videos.length ? <ul className="divide-y divide-ink-800">{videos.map((v) => <li key={v.id} className="flex items-center gap-3 px-5 py-2.5 text-sm"><Film size={16} className="text-neutral-500" /><span className="flex-1 truncate text-white">{v.name}</span><span className="text-xs muted">{v.athlete?.name ?? "—"} · {fmtDate(v.createdAt)}</span><Link href={`/app/videos?file=${v.id}`} className="text-xs text-volt">Analizar</Link></li>)}</ul> : <div className="p-5"><Empty title="Sin videos" /></div>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title={staff ? "1 · Subir video" : "Enviar video a mi entrenador"}><Uploader accept="video/*" athletes={staff ? athletes : undefined} defaultAthlete={sp.athlete} label="Subir video" compact /></Card>
          <Card title="2 · Crear análisis" className={pre ? "border-volt/50" : ""}>
            {videos.length ? (
              <form action={createAnalysis} className="space-y-3">
                <Field label="Video"><select name="videoId" defaultValue={pre?.id} className="input">{videos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
                <Field label="Comparar con (opcional)"><select name="compareId" className="input"><option value="">Sin comparación</option>{videos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
                {staff && <Field label="Deportista"><select name="athleteId" defaultValue={pre?.athleteId ?? sp.athlete ?? ""} className="input"><option value="">Elegir…</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
                <Field label="Título"><input name="title" className="input" placeholder="Ej: Salida de tacos — semana 8" /></Field>
                <Field label="Movimiento"><input name="movement" className="input" placeholder="Sentadilla, sprint, salto, brazada…" /></Field>
                <Submit className="btn-primary w-full">Abrir analizador</Submit>
              </form>
            ) : <p className="text-sm muted">Primero subí un video.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

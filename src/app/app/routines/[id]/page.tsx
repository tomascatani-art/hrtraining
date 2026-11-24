import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { PageHeader, Card, DemoBadge, fmtDate } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { RoutineEditor } from "@/components/routine-editor";
import { withVideos, athleteOptions, libraryPicker } from "@/lib/routine-server";
import { saveRoutine, copyDay, copyRoutine, saveAsTemplate, restoreVersion, deleteRoutine } from "../actions";

export const metadata = { title: "Rutina" };

export default async function RoutinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copiada?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const r = await db.routine.findUnique({ where: { id }, include: { athlete: { select: { id: true, name: true } } } });
  if (!r || r.orgId !== u.orgId || (r.athleteId && !(await canSeeAthlete(u, r.athleteId)))) notFound();
  const [data, exercises, athletes, versions] = await Promise.all([
    withVideos(u.orgId, r.data), libraryPicker(u.orgId), athleteOptions(u),
    r.athleteId ? db.routine.findMany({ where: { athleteId: r.athleteId, id: { not: r.id } }, orderBy: { updatedAt: "desc" }, take: 10 }) : Promise.resolve([]),
  ]);
  const others = athletes.filter((a) => a.id !== r.athleteId);
  const back = r.athleteId ? `/app/athletes/${r.athleteId}?tab=rutina` : "/app/routines";
  return (
    <>
      <Link href={r.athleteId ? "/app/routines" : "/app/routines"} className="mb-3 inline-flex items-center gap-1 text-sm muted hover:text-white"><ArrowLeft size={14} />Rutinas</Link>
      <PageHeader eyebrow={r.template ? "Plantilla" : r.athlete ? `Rutina de ${r.athlete.name}` : "Rutina"} title={r.name}
        subtitle={<>{!r.active && !r.template && <span className="chip-mute mr-2">Versión guardada (no es la actual)</span>}{r.isDemo && <DemoBadge />}Editada {fmtDate(r.updatedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
        actions={r.athleteId ? <Link href={back} className="btn-ghost">Ver como el deportista</Link> : undefined} />
      {sp.copiada && <div className="mb-4 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-volt">Rutina copiada. Esta es la copia; podés ajustarla para este deportista.</div>}
      <div className="grid gap-5 2xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <RoutineEditor id={r.id} initialName={r.name} initial={data} exercises={exercises} athletes={others} isTemplate={r.template} save={saveRoutine} copyDay={copyDay} />
        </div>
        <div className="space-y-5">
          <Card title="Pasar la rutina entera a otro deportista">
            <form action={copyRoutine} className="space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <select name="athleteId" className="input" required defaultValue=""><option value="" disabled>Elegí el deportista…</option>{others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <label className="block"><span className="label mb-1 block">Empieza el</span><input name="start" type="date" className="input" /></label>
              <label className="block"><span className="label mb-1 block">Título</span><input name="name" defaultValue={r.name} className="input" /></label>
              <Submit className="btn-primary w-full" pendingText="Copiando…">Copiar rutina</Submit>
            </form>
            <p className="mt-2 text-[11px] text-neutral-500">Si ese deportista ya tenía una rutina, no se borra: queda en sus versiones guardadas.</p>
          </Card>
          {!r.template && (
            <Card title="Guardar como plantilla">
              <form action={saveAsTemplate} className="flex gap-2"><input type="hidden" name="id" value={r.id} /><input name="name" placeholder={`${r.name} (plantilla)`} className="input flex-1" /><Submit className="btn-ghost" pendingText="…">Guardar</Submit></form>
            </Card>
          )}
          {versions.length > 0 && (
            <Card title="Versiones guardadas">
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/routines/${v.id}`} className="min-w-0 flex-1 truncate hover:text-volt">{v.name} <span className="text-xs muted">· {fmtDate(v.updatedAt)}</span>{v.active && <span className="chip-volt ml-1">Actual</span>}</Link>
                    {!v.active && <form action={restoreVersion}><input type="hidden" name="id" value={v.id} /><Submit className="btn-ghost px-2 py-1 text-xs" pendingText="…">Usar esta</Submit></form>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {!r.active || r.template ? (
            <div className="flex items-center justify-between gap-2">
              {!r.active && !r.template && <form action={restoreVersion}><input type="hidden" name="id" value={r.id} /><Submit className="btn-primary" pendingText="…">Volver a esta versión</Submit></form>}
              <form action={deleteRoutine} className="ml-auto"><input type="hidden" name="id" value={r.id} /><ConfirmSubmit message={r.template ? "¿Borrar la plantilla?" : "¿Borrar esta versión guardada?"}>{r.template ? "Borrar plantilla" : "Borrar versión"}</ConfirmSubmit></form>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

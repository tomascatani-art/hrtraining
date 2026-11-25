import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, CalendarClock, FolderOpen, History, Settings2, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { Avatar, DemoBadge, fmtDate } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { RoutineEditor } from "@/components/routine-editor";
import { RoutinePdfButtons } from "@/components/routine-pdf-buttons";
import { avatarSrc } from "@/lib/avatar";
import { sportLabel } from "@/lib/catalog";
import { withVideos, athleteOptions, libraryPicker, currentRoutine } from "@/lib/routine-server";
import { saveRoutine, copyDay, copyRoutine, saveAsTemplate, restoreVersion, deleteRoutine, replaceWithTemplate, newPlan, addExtra, scheduleNext } from "../actions";

export const metadata = { title: "Plan" };

const age = (d?: Date | null) => (d ? Math.floor((Date.now() - +d) / (365.25 * 86400000)) : null);

function Fold({ icon, title, count, children, open }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group card" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 font-semibold text-white">
        <span className="text-volt">{icon}</span><span className="flex-1">{title}{count != null ? ` (${count})` : ""}</span>
        <ChevronDown size={18} className="text-neutral-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-ink-700 p-4">{children}</div>
    </details>
  );
}

export default async function RoutinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copiada?: string; restaurada?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const r = await db.routine.findUnique({ where: { id }, include: { athlete: { select: { id: true, name: true, avatarKey: true, avatarAt: true, athleteProfile: true } } } });
  if (!r || r.orgId !== u.orgId || (r.athleteId && !(await canSeeAthlete(u, r.athleteId)))) notFound();
  if (r.athleteId) await currentRoutine(r.athleteId); // por si había un próximo plan con fecha cumplida
  const [data, exercises, athletes, templates, all] = await Promise.all([
    withVideos(u.orgId, r.data), libraryPicker(u.orgId), athleteOptions(u),
    db.routine.findMany({ where: { orgId: u.orgId, template: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    r.athleteId ? db.routine.findMany({ where: { athleteId: r.athleteId }, orderBy: { updatedAt: "desc" } }) : Promise.resolve([]),
  ]);
  const snapCount = await db.routineSnapshot.count({ where: { routineId: r.id } });
  const others = athletes.filter((a) => a.id !== r.athleteId);
  const versions = all.filter((v) => !v.extra && !v.active && !v.startsOn && v.id !== r.id);
  const extras = all.filter((v) => v.extra && v.id !== r.id);
  const upcoming = all.filter((v) => !v.extra && v.startsOn && !v.active);
  const main = all.find((v) => !v.extra && v.active);
  const a = r.athlete;
  const p = a?.athleteProfile;
  const kind = r.template ? "Plantilla" : r.extra ? "Rutina extra" : r.startsOn ? `Próximo plan · empieza ${fmtDate(r.startsOn, { day: "2-digit", month: "short" })}` : !r.active ? "Versión guardada (no es la actual)" : null;

  const appUrl = process.env.APP_URL || "";
  const actions = (
    <div className="space-y-3">
      <RoutinePdfButtons id={r.id} fileName={`${r.name}${a ? ` - ${a.name}` : ""}`.replace(/[^\p{L}\p{N} ._-]/gu, "")} phoneText={`${a ? `Hola ${a.name.split(" ")[0]}! ` : ""}Te paso tu rutina "${r.name}".${a && appUrl ? ` También la ves en la app: ${appUrl}/app/routine` : ""}`} />
      {a && !r.template && !r.extra && r.active && templates.length > 0 && (
        <form action={replaceWithTemplate} className="space-y-1.5">
          <input type="hidden" name="id" value={r.id} />
          <div className="flex gap-2">
            <select name="templateId" required defaultValue="" className="input flex-1"><option value="" disabled>Reemplazar todo por una plantilla…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <Submit className="btn-ghost" pendingText="…">Usar</Submit>
          </div>
          <p className="text-xs text-neutral-500">Si ya tenía algo cargado, se guarda solo antes de reemplazarlo; lo encontrás en Planes anteriores.</p>
        </form>
      )}
      {a && !r.template && !r.extra && r.active && (
        <form action={newPlan}><input type="hidden" name="id" value={r.id} />
          <Submit className="w-full rounded-2xl border-2 border-dashed border-volt/50 bg-volt/[0.04] px-4 py-3 font-semibold text-volt hover:bg-volt/10" pendingText="Creando…"><Sparkles size={16} className="mr-1.5 inline" />Empezar planificación nueva</Submit>
        </form>
      )}
      <Fold icon={<Settings2 size={18} />} title="Más opciones (copiar, plantilla)">
        <form action={copyRoutine} className="space-y-2">
          <div className="label">Pasar el plan entero a otro alumno</div>
          <input type="hidden" name="id" value={r.id} />
          <select name="athleteId" className="input" required defaultValue=""><option value="" disabled>Elegí el alumno…</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="start" type="date" className="input" aria-label="Empieza el" />
            <input name="name" defaultValue={r.name} className="input" aria-label="Título" />
          </div>
          <Submit className="btn-primary w-full" pendingText="Copiando…">Copiar plan</Submit>
          <p className="text-[11px] text-neutral-500">Si ese alumno ya tenía un plan, no se borra: queda en sus versiones guardadas.</p>
        </form>
        {!r.template && (
          <form action={saveAsTemplate} className="mt-4 flex gap-2"><input type="hidden" name="id" value={r.id} /><input name="name" placeholder={`${r.name} (plantilla)`} className="input flex-1" /><Submit className="btn-ghost" pendingText="…">Guardar como plantilla</Submit></form>
        )}
      </Fold>
      {a && (
        <>
          <Link href={`/app/routines/${r.id}/historial`} className="card flex items-center gap-2 px-4 py-3.5 font-semibold text-white hover:border-volt/50"><History size={18} className="text-volt" /><span className="flex-1">Historial de versiones del plan{snapCount ? ` (${snapCount})` : ""}</span><span className="text-sm text-volt">Ver</span></Link>
          <Fold icon={<History size={18} />} title="Planes anteriores" count={versions.length}>
            {versions.length === 0 ? <p className="text-sm muted">Todavía no hay versiones anteriores. Se guardan solas cuando reemplazás el plan.</p> : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/routines/${v.id}`} className="min-w-0 flex-1 truncate hover:text-volt">{v.name} <span className="text-xs muted">· {fmtDate(v.updatedAt)}</span></Link>
                    <form action={restoreVersion}><input type="hidden" name="id" value={v.id} /><Submit className="btn-ghost px-2 py-1 text-xs" pendingText="…">Volver a esta</Submit></form>
                  </div>
                ))}
              </div>
            )}
          </Fold>
          <Fold icon={<FolderOpen size={18} />} title="Rutinas extra" count={extras.length + (r.extra ? 1 : 0)}>
            <p className="mb-3 text-xs text-neutral-500">Además del plan: por ejemplo vacaciones, prevención o un día suelto. El alumno las ve en Mi rutina.</p>
            <div className="mb-3 space-y-1.5">
              {r.extra && main && <Link href={`/app/routines/${main.id}`} className="block text-sm text-volt hover:underline">← Volver al plan principal</Link>}
              {extras.map((x) => <Link key={x.id} href={`/app/routines/${x.id}`} className="block truncate text-sm hover:text-volt">{x.name}</Link>)}
            </div>
            <form action={addExtra} className="flex flex-wrap gap-2">
              <input type="hidden" name="athleteId" value={a.id} />
              <input name="name" placeholder="Nombre (ej: Vacaciones)" className="input min-w-0 flex-1 basis-40" />
              {templates.length > 0 && <select name="templateId" defaultValue="" className="input w-auto"><option value="">En blanco</option>{templates.map((t) => <option key={t.id} value={t.id}>Desde: {t.name}</option>)}</select>}
              <Submit className="btn-ghost" pendingText="…">Agregar</Submit>
            </form>
          </Fold>
          <Fold icon={<CalendarClock size={18} />} title="Cargar el próximo plan (empieza en una fecha)" count={upcoming.length || undefined}>
            {upcoming.map((x) => <Link key={x.id} href={`/app/routines/${x.id}`} className="mb-1.5 block text-sm hover:text-volt">{x.name} · empieza {fmtDate(x.startsOn!, { day: "2-digit", month: "short" })}</Link>)}
            <p className="mb-3 text-xs text-neutral-500">Lo armás ahora y ese día pasa solo a ser el plan actual. El de ahora queda en versiones guardadas.</p>
            <form action={scheduleNext} className="flex flex-wrap gap-2">
              <input type="hidden" name="athleteId" value={a.id} />
              <input name="start" type="date" required className="input w-auto" aria-label="Empieza el" />
              {templates.length > 0 && <select name="templateId" defaultValue="" className="input w-auto"><option value="">En blanco</option>{templates.map((t) => <option key={t.id} value={t.id}>Desde: {t.name}</option>)}</select>}
              <Submit className="btn-ghost" pendingText="…">Crear próximo plan</Submit>
            </form>
          </Fold>
        </>
      )}
      {(!r.active || r.template || r.extra) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!r.active && !r.template && !r.extra && <form action={restoreVersion}><input type="hidden" name="id" value={r.id} /><Submit className="btn-primary" pendingText="…">Que este sea el plan actual</Submit></form>}
          <form action={deleteRoutine} className="ml-auto"><input type="hidden" name="id" value={r.id} /><ConfirmSubmit message="¿Borrar esto?">{r.template ? "Borrar plantilla" : r.extra ? "Borrar rutina extra" : "Borrar"}</ConfirmSubmit></form>
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/routines" className="mb-3 inline-flex items-center gap-1 text-sm muted hover:text-white"><ArrowLeft size={14} />Rutinas</Link>
      {a ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={a.name} src={avatarSrc(a)} size={60} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold text-white">{a.name}</h1>
              <div className="text-sm muted">{[age(p?.birthDate) != null ? `${age(p?.birthDate)} años` : null, p?.level, p ? sportLabel(p.sport) : null].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className="mb-5 grid grid-cols-3 gap-2">
            <span className="rounded-2xl bg-volt py-2.5 text-center font-semibold text-ink-950">Plan</span>
            <Link href={`/app/athletes/${a.id}`} className="rounded-2xl border border-ink-600 py-2.5 text-center font-semibold text-neutral-300 hover:text-white">Perfil</Link>
            <Link href={`/app/messages?to=${a.id}`} className="rounded-2xl border border-ink-600 py-2.5 text-center font-semibold text-neutral-300 hover:text-white">Chat</Link>
          </div>
        </>
      ) : <h1 className="mb-4 font-display text-2xl font-bold text-white">{r.name}</h1>}
      {(kind || r.isDemo) && <div className="mb-4 flex flex-wrap items-center gap-2">{kind && <span className="chip-volt">{kind}</span>}{r.isDemo && <DemoBadge />}</div>}
      {sp.restaurada && <div className="mb-4 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-volt">Listo, el plan volvió a esa versión. La que había antes quedó guardada en el historial.</div>}
      {sp.copiada && <div className="mb-4 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-volt">Plan copiado. Esta es la copia; podés ajustarla para este alumno.</div>}
      <RoutineEditor id={r.id} initialName={r.name} initial={data} exercises={exercises} athletes={others} isTemplate={r.template} athleteName={r.extra ? null : a?.name}
        save={saveRoutine} copyDay={copyDay}>{actions}</RoutineEditor>
    </div>
  );
}

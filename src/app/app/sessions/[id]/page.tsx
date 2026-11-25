import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { notFound } from "next/navigation";
import { Pencil, Copy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionWhere, visibleAthleteIds } from "@/lib/access";
import { SESSION_TYPES, CAPACITIES, BLOCKS, QUICK_NOTES } from "@/lib/catalog";
import { latestRMs } from "@/lib/training";
import { kgFromPercent, classifyNote, NOTE_KINDS } from "@/lib/plates";
import { PageHeader, Card, Avatar, DemoBadge, fmtDateLong, fmtTime, Empty } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { WorkoutLogger } from "@/components/workout-logger";
import { exerciseVideos } from "@/lib/exercise-video";
import { saveLog, quickAttendance, commentLog, duplicateSession, copySession, deleteSession } from "../actions";


export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; as?: string; copiada?: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const s = await db.session.findFirst({
    where: { id, ...(await sessionWhere(u)) },
    include: {
      items: { orderBy: { order: "asc" }, include: { exercise: true } },
      group: { include: { members: { include: { athlete: true } } } }, athlete: true, coach: true, plan: true,
      logs: { include: { athlete: true, sets: true, itemNotes: true } },
    },
  });
  if (!s) notFound();
  const staff = u.role !== "ATHLETE";
  const assigned = s.group ? s.group.members.map((m) => m.athlete) : s.athlete ? [s.athlete] : [];
  const visible = staff ? await visibleAthleteIds(u) : [u.id];
  // Para quién se registra: el alumno mismo, o el entrenador en nombre de un alumno (?as=)
  const logFor = u.role === "ATHLETE" ? u.id : sp.as && visible.includes(sp.as) ? sp.as : null;
  const existing = logFor ? s.logs.find((l) => l.athleteId === logFor) : null;

  let items: Parameters<typeof WorkoutLogger>[0]["items"] = [];
  if (logFor) {
    const rms = await latestRMs(logFor, s.items.map((i) => i.exerciseId));
    const vids = await exerciseVideos(s.orgId, s.items.map((i) => i.exerciseId));
    items = s.items.map((it) => {
      const rm = rms.get(it.exerciseId)?.kg ?? null;
      const calc = it.percent1RM && rm ? kgFromPercent(rm, it.percent1RM * 100) : null;
      return {
        id: it.id, exerciseId: it.exerciseId, name: it.exercise.name, sets: it.sets, reps: it.reps, suggestedKg: it.loadKg ?? calc?.rounded ?? null, targetRir: it.targetRir, restSec: it.restSec, tempo: it.tempo,
        notes: it.notes, videoUrl: vids.get(it.exerciseId) ?? null, percent: it.percent1RM, rm, rounded: !it.loadKg && !!calc?.adjusted ? calc.exact : null,
        block: it.block && BLOCKS[it.block] ? { label: BLOCKS[it.block].label, color: BLOCKS[it.block].color } : null,
      };
    });
  }
  const copyTargets = staff ? await db.user.findMany({ where: { id: { in: visible } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const srcDay = new Date(s.date.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const forName = logFor ? assigned.find((a) => a.id === logFor)?.name ?? u.name : "";

  return (
    <>
      <PageHeader eyebrow={`${SESSION_TYPES[s.type]} · ${fmtDateLong(s.date)} · ${fmtTime(s.date)}`} title={s.title}
        subtitle={<>{s.group ? `Grupo ${s.group.name}` : s.athlete?.name} · {s.durationMin} min{s.targetRpe ? ` · RPE objetivo ${s.targetRpe}` : ""}{s.plan ? <> · <Link className="text-volt hover:underline" href={`/app/planning/${s.plan.id}`}>{s.plan.name}</Link></> : null} {s.isDemo && <DemoBadge />}</>}
        actions={staff ? <>
          <Link href={`/app/sessions/${s.id}/edit`} className="btn-ghost"><Pencil size={15} />Editar</Link>
          <form action={duplicateSession}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="days" value="7" /><Submit className="btn-ghost" pendingText="Copiando…"><Copy size={15} />Duplicar +7 días</Submit></form>
        </> : undefined} />

      {sp.copiada && <div className="mb-4 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-white">Sesión copiada con todos sus ejercicios. Podés editarla sin tocar la original.</div>}
      {staff && (
        <details className="card mb-6 group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-white"><Copy size={15} className="text-volt" />Copiar este día a otro alumno o a otra fecha</summary>
          <form action={copySession} className="grid gap-3 border-t border-ink-800 px-5 py-4 sm:grid-cols-4">
            <input type="hidden" name="id" value={s.id} />
            <label className="sm:col-span-2"><span className="label mb-1 block">Para</span>
              <select name="athleteId" className="input" defaultValue=""><option value="">{s.group ? `El mismo grupo (${s.group.name})` : `El mismo alumno (${s.athlete?.name ?? ""})`}</option>{copyTargets.filter((a) => a.id !== s.athleteId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label><span className="label mb-1 block">Día</span><input name="date" type="date" defaultValue={srcDay} className="input" /></label>
            <label><span className="label mb-1 block">Título</span><input name="title" defaultValue={s.title} className="input" /></label>
            <div className="sm:col-span-4 flex justify-end"><Submit pendingText="Copiando…">Copiar sesión</Submit></div>
          </form>
        </details>
      )}
      {sp.ok && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Registro guardado. ¡Buen trabajo!</div>}
      {s.capacities.length > 0 && <div className="mb-4 flex flex-wrap gap-1.5">{s.capacities.map((c) => <span key={c} className="chip-volt">{CAPACITIES[c]?.label}</span>)}</div>}
      {s.notes && <Card className="mb-6"><div className="label mb-1">Indicaciones</div><p className="whitespace-pre-wrap text-sm text-neutral-200">{s.notes}</p></Card>}

      {logFor ? (
        <>
          {staff && <div className="mb-3 flex items-center gap-2 text-sm"><span className="muted">Registrando en nombre de</span><b className="text-white">{forName}</b><Link href={`/app/sessions/${s.id}`} className="ml-auto text-xs text-volt">Volver al resumen</Link></div>}
          {existing?.coachComment && <div className="mb-4 rounded-xl border border-volt/30 bg-volt/5 p-3 text-sm"><span className="label text-volt">Comentario del entrenador</span><p className="mt-1 text-neutral-100">{existing.coachComment}</p></div>}
          <WorkoutLogger action={saveLog} sessionId={s.id} athleteId={logFor} items={items} defaultDuration={s.durationMin} quickNotes={QUICK_NOTES} isAthlete={!staff}
            existing={existing ? { status: existing.status, rpe: existing.rpe, durationMin: existing.durationMin, feeling: existing.feeling, sets: existing.sets, notes: existing.itemNotes.map((n) => ({ itemId: n.itemId, note: n.note })) } : null} />
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Ejercicios" className="xl:col-span-1">
            {s.items.length ? (
              <ol className="space-y-2">
                {s.items.map((it, i) => (
                  <li key={it.id} className="rounded-lg bg-ink-900 px-3 py-2" style={it.block && BLOCKS[it.block] ? { borderLeft: `3px solid ${BLOCKS[it.block].color}` } : undefined}>
                    {it.block && BLOCKS[it.block] && it.block !== s.items[i - 1]?.block && <div className="label mb-1" style={{ color: BLOCKS[it.block].color }}>{BLOCKS[it.block].label}</div>}
                    <div className="flex items-center gap-2"><span className="num text-xs text-volt">{i + 1}</span><Link href={`/app/library/${it.exerciseId}`} className="flex-1 text-sm font-medium text-white hover:text-volt">{it.exercise.name}</Link></div>
                    <div className="num mt-0.5 text-xs muted">{it.sets}×{it.reps}{it.percent1RM ? ` · ${Math.round(it.percent1RM * 100)}%` : ""}{it.loadKg ? ` · ${it.loadKg} kg` : ""}{it.targetRir != null ? ` · RIR ${it.targetRir}` : ""}{it.restSec ? ` · ${it.restSec}s` : ""}</div>
                  </li>
                ))}
              </ol>
            ) : <Empty title="Sin ejercicios cargados" />}
          </Card>
          <Card title={`Asistencia y registros (${s.logs.filter((l) => l.status === "COMPLETADO" || l.status === "PARCIAL").length}/${assigned.length})`} className="xl:col-span-2" pad={false}>
            <ul className="divide-y divide-ink-800">
              {assigned.map((a) => {
                const l = s.logs.find((x) => x.athleteId === a.id);
                const vol = l?.sets.reduce((acc, x) => acc + (x.reps ?? 0) * (x.loadKg ?? 0), 0) ?? 0;
                return (
                  <li key={a.id} className="px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={a.name} src={avatarSrc(a)} size={32} />
                      <Link href={`/app/athletes/${a.id}?tab=historial`} className="min-w-[140px] flex-1 font-semibold text-white hover:text-volt">{a.name}</Link>
                      {l ? (
                        l.status === "COMPLETADO" || l.status === "PARCIAL"
                          ? <span className="num chip-volt">RPE {l.rpe ?? "—"} · {l.load ?? "—"} UA{vol ? ` · ${vol.toLocaleString("es-AR")} kg` : ""}</span>
                          : <span className="chip-mute">{l.status === "AUSENTE" ? "Ausente" : "Justificado"}</span>
                      ) : <span className="chip-mute">Sin registro</span>}
                      <div className="flex gap-1">
                        {(["COMPLETADO", "AUSENTE", "JUSTIFICADO"] as const).map((st) => (
                          <form key={st} action={quickAttendance}><input type="hidden" name="sessionId" value={s.id} /><input type="hidden" name="athleteId" value={a.id} /><input type="hidden" name="status" value={st} />
                            <button className={`btn-sm rounded-lg border px-2 py-1 text-[11px] ${l?.status === st ? "border-volt bg-volt text-black" : "border-ink-600 text-neutral-400 hover:text-white"}`} title="Marcar asistencia">{st === "COMPLETADO" ? "Presente" : st === "AUSENTE" ? "Ausente" : "Just."}</button>
                          </form>
                        ))}
                        <Link href={`/app/sessions/${s.id}?as=${a.id}`} className="rounded-lg border border-ink-600 px-2 py-1 text-[11px] text-neutral-400 hover:text-white">Cargar</Link>
                      </div>
                    </div>
                    {l?.feeling && <p className="ml-11 mt-1 text-sm text-neutral-300">“{l.feeling}”</p>}
                    {l?.itemNotes.length ? (
                      <ul className="ml-11 mt-1 space-y-0.5 text-xs">
                        {l.itemNotes.map((n) => {
                          const k = classifyNote(n.note);
                          return <li key={n.id} className="text-neutral-300"><span className="muted">{s.items.find((x) => x.id === n.itemId)?.exercise.name}:</span> “{n.note}”{k && <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-black" style={{ background: NOTE_KINDS[k].color }}>{NOTE_KINDS[k].label}</span>}</li>;
                        })}
                      </ul>
                    ) : null}
                    {l && (
                      <form action={commentLog} className="ml-11 mt-2 flex gap-2">
                        <input type="hidden" name="logId" value={l.id} />
                        <input name="comment" defaultValue={l.coachComment ?? ""} placeholder="Comentario o corrección para el alumno…" className="input py-1.5 text-xs" />
                        <Submit className="btn-ghost btn-sm" pendingText="…">Enviar</Submit>
                      </form>
                    )}
                  </li>
                );
              })}
              {assigned.length === 0 && <li className="p-5"><Empty title="Nadie asignado" /></li>}
            </ul>
          </Card>
        </div>
      )}
      {staff && !logFor && (
        <form action={deleteSession} className="mt-6 text-right"><input type="hidden" name="id" value={s.id} /><ConfirmSubmit message="¿Eliminar la sesión y todos sus registros?">Eliminar sesión</ConfirmSubmit></form>
      )}
    </>
  );
}

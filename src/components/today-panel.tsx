import Link from "next/link";
import { db } from "@/lib/db";
import { startOfDay, addDays } from "@/lib/metrics";
import { classifyNote, fmtKg, NOTE_KINDS } from "@/lib/plates";
import { Card, fmtDate, fmtTime } from "./ui";
import { Submit } from "./forms";
import { markRMSeen } from "@/app/app/rm/actions";

/** «Hoy» del entrenador: quién entrenó, quién marcó dolor o molestia y los RM nuevos que cargaron los alumnos. */
export async function TodayPanel({ ids }: { ids: string[] }) {
  const today = startOfDay(new Date());
  const since = addDays(today, -1);
  const [trained, wellPain, logsWithText, rms] = await Promise.all([
    db.workoutLog.findMany({ where: { athleteId: { in: ids }, completedAt: { gte: today }, status: { in: ["COMPLETADO", "PARCIAL"] } }, include: { athlete: true, session: { select: { id: true, title: true } } }, orderBy: { completedAt: "desc" } }),
    db.wellness.findMany({ where: { athleteId: { in: ids }, date: { gte: addDays(today, -2) }, painArea: { not: null } }, include: { athlete: true }, orderBy: { date: "desc" } }),
    db.workoutLog.findMany({ where: { athleteId: { in: ids }, completedAt: { gte: since } }, include: { athlete: true, session: { select: { id: true, title: true } }, itemNotes: { include: { item: { include: { exercise: { select: { name: true } } } } } } } }),
    db.exerciseRM.findMany({ where: { athleteId: { in: ids }, source: "DEPORTISTA", seen: false }, include: { athlete: true, exercise: { select: { name: true } } }, orderBy: { date: "desc" } }),
  ]);
  type Pain = { key: string; athleteId: string; name: string; text: string; when: string; href: string };
  const pain: Pain[] = [
    ...wellPain.map((w) => ({ key: w.id, athleteId: w.athleteId, name: w.athlete.name, text: `Bienestar: ${w.painArea}`, when: fmtDate(w.date), href: `/app/athletes/${w.athleteId}?tab=carga` })),
    ...logsWithText.flatMap((l) => [
      ...(classifyNote(l.feeling) === "MOLESTIA" ? [{ key: l.id, athleteId: l.athleteId, name: l.athlete.name, text: `“${l.feeling}”`, when: fmtDate(l.completedAt), href: `/app/sessions/${l.session.id}` }] : []),
      ...l.itemNotes.filter((n) => classifyNote(n.note) === "MOLESTIA").map((n) => ({ key: n.id, athleteId: l.athleteId, name: l.athlete.name, text: `${n.item.exercise.name}: “${n.note}”`, when: fmtDate(l.completedAt), href: `/app/sessions/${l.session.id}` })),
    ]),
  ];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <Card title="Hoy entrenaron" action={<span className="num text-sm text-volt">{trained.length}</span>}>
        {trained.length ? (
          <ul className="space-y-1.5 text-sm">
            {trained.slice(0, 8).map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <Link href={`/app/athletes/${l.athleteId}?tab=historial`} className="font-medium text-white hover:text-volt">{l.athlete.name}</Link>
                <Link href={`/app/sessions/${l.session.id}`} className="min-w-0 flex-1 truncate text-xs muted hover:text-white">{l.session.title}</Link>
                <span className="num text-xs text-neutral-400">{fmtTime(l.completedAt)}{l.rpe != null ? ` · RPE ${l.rpe}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">Todavía nadie registró un entrenamiento hoy.</p>}
      </Card>
      <Card title="Dolor o molestia" action={<span className="text-xs muted">últimos 2 días</span>}>
        {pain.length ? (
          <ul className="space-y-2 text-sm">
            {pain.slice(0, 6).map((p) => (
              <li key={p.key} className="rounded-lg border-l-2 bg-ink-900 px-3 py-2" style={{ borderColor: NOTE_KINDS.MOLESTIA.color }}>
                <Link href={p.href} className="font-medium text-white hover:text-volt">{p.name}</Link> <span className="text-xs muted">· {p.when}</span>
                <div className="text-xs text-neutral-300">{p.text}</div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">Nadie marcó dolor ni molestias.</p>}
        <p className="mt-3 text-[11px] text-neutral-600">Se detecta por lo que escribe el alumno. Es un aviso para conversar, no un diagnóstico.</p>
      </Card>
      <Card title="RM nuevos" action={rms.length ? <form action={markRMSeen}>{rms.map((r) => <input key={r.id} type="hidden" name="id" value={r.id} />)}<Submit className="text-xs text-volt hover:underline" pendingText="…">Marcar todo visto</Submit></form> : undefined}>
        {rms.length ? (
          <ul className="space-y-1.5 text-sm">
            {rms.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link href={`/app/athletes/${r.athleteId}?tab=rm`} className="font-medium text-white hover:text-volt">{r.athlete.name}</Link>
                <span className="min-w-0 flex-1 truncate text-xs muted">{r.exercise.name}</span>
                <span className="num font-semibold text-volt">{fmtKg(r.kg)} kg</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">No hay RM nuevos para revisar.</p>}
      </Card>
    </div>
  );
}

/** Sensaciones del alumno según lo que escribió en las sesiones (orientativo). */
export async function SensationsCard({ athleteId, days = 60 }: { athleteId: string; days?: number }) {
  const logs = await db.workoutLog.findMany({ where: { athleteId, completedAt: { gte: addDays(new Date(), -days) } }, select: { feeling: true, itemNotes: { select: { note: true } } } });
  const counts: Record<string, number> = { BIEN: 0, ESFUERZO: 0, MOLESTIA: 0, NADA: 0 };
  for (const l of logs) for (const t of [l.feeling, ...l.itemNotes.map((n) => n.note)]) {
    if (!t) continue;
    counts[classifyNote(t) ?? "NADA"]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = [...(["BIEN", "ESFUERZO", "MOLESTIA"] as const).map((k) => ({ k, label: NOTE_KINDS[k].label, color: NOTE_KINDS[k].color, n: counts[k] })), { k: "NADA", label: "Sin indicar sensación", color: "#6b6b6b", n: counts.NADA }];
  return (
    <Card title="Sensaciones" action={<span className="text-xs muted">últimos {days} días</span>}>
      {total ? (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.k}>
              <div className="mb-1 flex justify-between text-xs"><span className="text-neutral-300">{r.label}</span><span className="num text-white">{r.n}</span></div>
              <div className="h-2 rounded-full bg-ink-800"><div className="h-2 rounded-full" style={{ width: `${(r.n / total) * 100}%`, background: r.color, minWidth: r.n ? 4 : 0 }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm muted">Sin comentarios en las sesiones todavía.</p>}
      <p className="mt-3 text-[11px] text-neutral-600">Clasificado por palabras clave de los comentarios. Es orientativo.</p>
    </Card>
  );
}

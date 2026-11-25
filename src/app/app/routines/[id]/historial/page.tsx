import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { Card } from "@/components/ui";
import { Submit } from "@/components/forms";
import { RoutineView } from "@/components/routine-view";
import { withVideos } from "@/lib/routine-server";
import { sanitizeRoutine, countExercises } from "@/lib/routine";
import { restoreSnapshot, saveSnapshot, restoreVersion } from "../../actions";

export const metadata = { title: "Historial del plan" };
const when = (d: Date) => d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: process.env.APP_TZ || "America/Argentina/Buenos_Aires" });

export default async function History_({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const r = await db.routine.findUnique({ where: { id }, include: { athlete: { select: { name: true } } } });
  if (!r || r.orgId !== u.orgId || (r.athleteId && !(await canSeeAthlete(u, r.athleteId)))) notFound();
  const snaps = await db.routineSnapshot.findMany({ where: { routineId: id }, orderBy: { createdAt: "desc" } });
  const people = new Map((await db.user.findMany({ where: { id: { in: [...new Set(snaps.map((s) => s.byId).filter(Boolean) as string[])] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const older = r.athleteId ? await db.routine.findMany({ where: { athleteId: r.athleteId, extra: false, active: false, startsOn: null, id: { not: r.id } }, orderBy: { updatedAt: "desc" }, take: 20 }) : [];
  const sel = snaps.find((s) => s.id === sp.v);
  const shown = await withVideos(u.orgId, sel ? sel.data : r.data);
  const sum = (d: unknown) => { const x = sanitizeRoutine(d); return `${x.days.length} días · ${countExercises(x)} ejercicios · ${x.weeks} semanas`; };
  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/app/routines/${r.id}`} className="mb-3 inline-flex items-center gap-1 text-sm muted hover:text-white"><ArrowLeft size={14} />Volver al plan</Link>
      <h1 className="font-display text-2xl font-bold text-white">Historial del plan</h1>
      <p className="mb-5 text-sm muted">{r.name}{r.athlete ? ` · ${r.athlete.name}` : ""}. Se guarda una versión sola cada vez que editás (como mucho una cada 30 minutos). Tocá una para verla y, si querés, volver a ella.</p>
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Versiones" action={<History size={16} className="text-volt" />}>
            <div className="space-y-1.5">
              <Link href={`/app/routines/${r.id}/historial`} className={`block rounded-xl border px-3 py-2 ${!sel ? "border-volt bg-volt/10" : "border-ink-700 hover:border-ink-500"}`}>
                <div className="text-sm font-semibold text-white">Ahora (como está)</div>
                <div className="text-xs muted">{when(r.updatedAt)} · {sum(r.data)}</div>
              </Link>
              {snaps.map((s) => (
                <Link key={s.id} href={`/app/routines/${r.id}/historial?v=${s.id}`} className={`block rounded-xl border px-3 py-2 ${sel?.id === s.id ? "border-volt bg-volt/10" : "border-ink-700 hover:border-ink-500"}`}>
                  <div className="text-sm font-semibold text-white">{s.label || when(s.createdAt)}</div>
                  <div className="text-xs muted">{s.label ? `${when(s.createdAt)} · ` : ""}{s.byId && people.get(s.byId) ? `${people.get(s.byId)} · ` : ""}{sum(s.data)}</div>
                </Link>
              ))}
              {snaps.length === 0 && <p className="text-sm muted">Todavía no hay versiones anteriores. Aparecen solas a medida que vas cambiando el plan.</p>}
            </div>
            <form action={saveSnapshot} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="label" placeholder="Guardar versión con nombre…" className="input flex-1 py-1.5 text-sm" />
              <Submit className="btn-ghost px-3 py-1.5 text-sm" pendingText="…">Guardar</Submit>
            </form>
          </Card>
          {older.length > 0 && (
            <Card title="Planes anteriores del alumno">
              <div className="space-y-2">
                {older.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/routines/${o.id}`} className="min-w-0 flex-1 truncate hover:text-volt">{o.name} <span className="text-xs muted">· {when(o.updatedAt)}</span></Link>
                    <form action={restoreVersion}><input type="hidden" name="id" value={o.id} /><Submit className="btn-ghost px-2 py-1 text-xs" pendingText="…">Usar</Submit></form>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3">
            <div><div className="label">{sel ? "Versión guardada" : "Versión actual"}</div><div className="font-semibold text-white">{sel ? (sel.label || when(sel.createdAt)) : "Como está ahora"} · {sel ? sel.name : r.name}</div></div>
            {sel && <form action={restoreSnapshot}><input type="hidden" name="snapshotId" value={sel.id} /><Submit className="btn-primary" pendingText="Volviendo…"><RotateCcw size={15} />Volver a esta versión</Submit></form>}
          </div>
          {sel && <p className="mb-3 text-xs muted">Si volvés a esta versión, la de ahora no se pierde: queda guardada arriba en la lista.</p>}
          <RoutineView data={shown} week={null} />
        </div>
      </div>
    </div>
  );
}

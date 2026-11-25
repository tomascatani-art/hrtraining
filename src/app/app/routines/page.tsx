import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Avatar, DemoBadge, fmtDate } from "@/components/ui";
import { Submit } from "@/components/forms";
import { avatarSrc } from "@/lib/avatar";
import { athleteOptions } from "@/lib/routine-server";
import { sanitizeRoutine, countExercises } from "@/lib/routine";
import { createRoutine } from "./actions";

export const metadata = { title: "Rutinas" };

export default async function RoutinesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  const opts = await athleteOptions(u);
  const athletes = await db.user.findMany({
    where: { id: { in: opts.map((a) => a.id) }, ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}) },
    select: { id: true, name: true, avatarKey: true, avatarAt: true, routines: { where: { active: true, extra: false }, orderBy: { updatedAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });
  const templates = await db.routine.findMany({ where: { orgId: u.orgId, template: true }, orderBy: { name: "asc" } });
  const withR = athletes.filter((a) => a.routines[0]).length;
  return (
    <>
      <PageHeader eyebrow="Planificación" title="Rutinas por alumno" subtitle={`La planilla de cada uno: días, bloques, ejercicios y semanas. ${withR} de ${athletes.length} alumnos ya tienen rutina.`} />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <form className="mb-3"><input name="q" defaultValue={sp.q} placeholder="Buscar alumno…" className="input" /></form>
          <div className="card divide-y divide-ink-700">
            {athletes.map((a) => {
              const r = a.routines[0];
              const d = r ? sanitizeRoutine(r.data) : null;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={a.name} src={avatarSrc(a)} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{a.name}</div>
                    <div className="truncate text-xs muted">{r && d ? <>{r.name} · {d.days.length} días · {countExercises(d)} ejercicios · {d.weeks} semanas · editada {fmtDate(r.updatedAt)}</> : "Sin rutina todavía"}</div>
                  </div>
                  {r ? <Link href={`/app/routines/${r.id}`} className="btn-primary px-3 py-1.5 text-sm">Abrir rutina</Link> : (
                    <form action={createRoutine} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="athleteId" value={a.id} />
                      {templates.length > 0 && <select name="templateId" defaultValue="" className="input w-auto py-1.5 text-sm"><option value="">En blanco</option>{templates.map((t) => <option key={t.id} value={t.id}>Desde: {t.name}</option>)}</select>}
                      <Submit className="btn-ghost px-3 py-1.5 text-sm" pendingText="Creando…"><Plus size={14} />Crear rutina</Submit>
                    </form>
                  )}
                </div>
              );
            })}
            {athletes.length === 0 && <div className="p-6 text-center text-sm muted">No hay alumnos {sp.q ? "con ese nombre" : "asignados todavía"}.</div>}
          </div>
        </div>
        <div className="space-y-5">
          <Card title="Plantillas" action={<ClipboardList size={16} className="text-volt" />}>
            <p className="mb-3 text-sm muted">Rutinas modelo para no empezar de cero. Al crear la rutina de un alumno elegís “Desde: …”. <Link href="/app/templates" className="text-volt hover:underline">Ver y asignar plantillas</Link></p>
            <div className="space-y-2">
              {templates.map((t) => {
                const d = sanitizeRoutine(t.data);
                return (
                  <Link key={t.id} href={`/app/routines/${t.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-ink-700 px-3 py-2 hover:border-volt/50">
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{t.name}{t.isDemo && <DemoBadge />}</span><span className="text-xs muted">{d.days.length} días · {countExercises(d)} ejercicios</span></span>
                  </Link>
                );
              })}
              {templates.length === 0 && <div className="text-sm muted">Todavía no hay plantillas.</div>}
            </div>
            <form action={createRoutine} className="mt-3 flex gap-2">
              <input name="name" placeholder="Nombre (ej: Fuerza 3 días)" className="input flex-1 py-1.5 text-sm" required />
              <Submit className="btn-ghost px-3 py-1.5 text-sm" pendingText="…"><Plus size={14} />Nueva</Submit>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { LayoutTemplate, Plus, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, fmtDate } from "@/components/ui";
import { Submit } from "@/components/forms";
import { athleteOptions } from "@/lib/routine-server";
import { sanitizeRoutine, countExercises } from "@/lib/routine";
import { createRoutine } from "../routines/actions";

export const metadata = { title: "Plantillas" };

/** Plantillas predeterminadas: se arman una vez y se le asignan a cualquier alumno (por ejemplo, alguien que recién empieza). */
export default async function TemplatesPage() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const [templates, opts] = await Promise.all([
    db.routine.findMany({ where: { orgId: u.orgId, template: true }, orderBy: { name: "asc" } }),
    athleteOptions(u),
  ]);
  const athletes = await db.user.findMany({
    where: { id: { in: opts.map((a) => a.id) } },
    select: { id: true, name: true, routines: { where: { active: true, extra: false }, select: { id: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader eyebrow="Entrenamiento" title="Plantillas"
        subtitle="Armá rutinas modelo (por ejemplo “Principiante 3 días”) y asignáselas a un alumno con un toque. Después la podés ajustar para esa persona." />

      <form action={createRoutine} className="card card-pad mb-6 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1"><span className="label mb-1 block">Nueva plantilla</span>
          <input name="name" placeholder="Nombre (ej: Principiante 3 días)" className="input" required /></label>
        <Submit className="btn-primary" pendingText="Creando…"><Plus size={16} />Crear plantilla</Submit>
      </form>

      {templates.length === 0 ? (
        <div className="card card-pad text-center muted">Todavía no tenés plantillas. Creá la primera arriba.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const d = sanitizeRoutine(t.data);
            return (
              <div key={t.id} className="card card-pad flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt"><LayoutTemplate size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{t.name}</div>
                    <div className="text-xs muted">{d.days.length} días · {countExercises(d)} ejercicios · {d.weeks} semanas · editada {fmtDate(t.updatedAt)}</div>
                  </div>
                  <Link href={`/app/routines/${t.id}`} className="btn-ghost btn-sm shrink-0"><Pencil size={14} />Editar</Link>
                </div>
                {athletes.length > 0 && (
                  <form action={createRoutine} className="mt-auto flex flex-wrap gap-2 border-t border-ink-700 pt-3">
                    <input type="hidden" name="templateId" value={t.id} />
                    <select name="athleteId" required defaultValue="" className="input min-w-0 flex-1 py-2 text-sm">
                      <option value="" disabled>Asignar a…</option>
                      {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}{a.routines.length ? " (reemplaza su rutina actual)" : ""}</option>)}
                    </select>
                    <Submit className="btn-primary px-4 py-2 text-sm" pendingText="Asignando…">Asignar</Submit>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

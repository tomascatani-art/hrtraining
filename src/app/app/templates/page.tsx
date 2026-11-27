import Link from "next/link";
import { LayoutTemplate, Plus, Pencil, Store, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, fmtDate, fmtNum } from "@/components/ui";
import { Submit, CopyField } from "@/components/forms";
import { appOrigin } from "@/lib/origin";
import { planesPath } from "@/lib/public-org";
import { saveSale, approveRequest, rejectRequest } from "./sale-actions";
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
  const [requests, origin] = await Promise.all([
    db.planRequest.findMany({ where: { orgId: u.orgId, status: { in: ["NUEVO", "PAGADO"] } }, orderBy: { createdAt: "desc" }, take: 50 }),
    appOrigin(),
  ]);
  const publicUrl = origin + planesPath(u.org);
  const selling = templates.some((t) => t.forSale);
  const athletes = await db.user.findMany({
    where: { id: { in: opts.map((a) => a.id) } },
    select: { id: true, name: true, routines: { where: { active: true, extra: false }, select: { id: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader eyebrow="Entrenamiento" title="Plantillas"
        subtitle="Armá rutinas modelo (por ejemplo “Principiante 3 días”) y asignáselas a un alumno con un toque. Después la podés ajustar para esa persona." />

      {requests.length > 0 && (
        <section id="pedidos" className="card card-pad mb-6 border-volt/50">
          <h2 className="font-display text-lg font-bold uppercase text-volt">Pedidos de planes ({requests.length})</h2>
          <p className="mb-3 text-sm muted">Gente que pidió un plan desde tu página. Al aprobar se crea su cuenta con el plan cargado y te queda el link para mandarle.</p>
          <div className="divide-y divide-ink-700">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{r.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.status === "PAGADO" ? "bg-volt text-black" : "border border-neutral-600 text-neutral-300"}`}>{r.status === "PAGADO" ? "Pagó" : "Sin pagar"}</span>
                  </div>
                  <div className="text-xs muted">{r.planName}{r.amount ? ` · $ ${fmtNum(r.amount)}` : ""} · {r.email} · {fmtDate(r.createdAt)}</div>
                  {r.note && <div className="mt-1 text-xs text-neutral-300">“{r.note}”</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.phone && <a href={`https://wa.me/${r.phone}?text=${encodeURIComponent(`Hola ${r.name.split(" ")[0]}! Recibí tu pedido del plan ${r.planName}.`)}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><MessageCircle size={14} />WhatsApp</a>}
                  <form action={rejectRequest}><input type="hidden" name="id" value={r.id} /><Submit className="btn-ghost btn-sm" pendingText="…">Rechazar</Submit></form>
                  <form action={approveRequest}><input type="hidden" name="id" value={r.id} /><Submit className="btn-primary btn-sm" pendingText="Creando cuenta…">Aprobar</Submit></form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card card-pad mb-6">
        <div className="flex items-center gap-2"><Store size={18} className="text-volt" /><h2 className="font-semibold text-white">Tu página de planes</h2></div>
        <p className="mt-1 text-sm muted">{selling ? "Pasá este link (por ejemplo en tu Instagram). Ahí se ven los planes que marcaste para vender, la gente los pide y vos aprobás cada pedido." : "Marcá abajo qué plantillas querés vender y con qué precio. Después pasás este link y la gente los pide desde ahí. Nadie entra a la app sin tu aprobación."}</p>
        <div className="mt-3"><CopyField value={publicUrl} /></div>
        {!u.org.mpToken && <p className="mt-2 text-xs muted">Sin Mercado Pago conectado, el pedido te llega sin pagar y coordinás el pago por WhatsApp. Podés conectarlo en Ajustes.</p>}
      </section>

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
                <details className="rounded-xl border border-ink-700 px-3 py-2" open={t.forSale}>
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-200">{t.forSale ? <span className="text-volt">A la venta{t.price ? ` · $ ${fmtNum(t.price)}` : ""}</span> : "Vender online"}</summary>
                  <form action={saveSale} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={t.id} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="forSale" defaultChecked={t.forSale} className="h-4 w-4 accent-[var(--volt,#ffd60a)]" />Mostrarla en mi página de planes</label>
                    <input name="price" inputMode="numeric" defaultValue={t.price ?? ""} placeholder="Precio en pesos (ej: 25000)" className="input py-2 text-sm" />
                    <textarea name="blurb" defaultValue={t.blurb ?? ""} maxLength={600} rows={2} placeholder="Para quién es y qué incluye" className="input py-2 text-sm" />
                    <Submit className="btn-ghost btn-sm" pendingText="Guardando…">Guardar</Submit>
                  </form>
                </details>
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

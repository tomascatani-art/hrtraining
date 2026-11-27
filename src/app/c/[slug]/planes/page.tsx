import { notFound } from "next/navigation";
import { CalendarDays, Dumbbell, Layers } from "lucide-react";
import { db } from "@/lib/db";
import { Logo, fmtNum } from "@/components/ui";
import { Submit } from "@/components/forms";
import { accentVars, logoUrl } from "@/lib/brand";
import { publicOrg } from "@/lib/public-org";
import { sanitizeRoutine, countExercises } from "@/lib/routine";
import { requestPlan } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const org = await publicOrg((await params).slug);
  return { title: org ? `Planes · ${org.brandName || org.name}` : "Página no encontrada" };
}

/** Página pública con los planes que vende el preparador. El pedido queda esperando su aprobación. */
export default async function PlanesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; plan?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const org = await publicOrg(slug);
  if (!org) notFound();
  const plans = await db.routine.findMany({ where: { orgId: org.id, template: true, forSale: true }, orderBy: [{ price: "asc" }, { name: "asc" }] });
  const name = org.brandName || org.name;
  const hasMp = !!org.mpToken;
  return (
    <div className="min-h-dvh bg-grid px-4 py-10" style={accentVars(org.brandColor) as React.CSSProperties | undefined}>
      <div className="mx-auto max-w-3xl animate-rise">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} withText={false} brand={org.logoKey ? { name, logo: logoUrl(org) } : null} />
          <h1 className="h1 mt-4">Planes de entrenamiento</h1>
          <p className="mt-1 max-w-md text-sm muted">Elegí tu plan y dejá tus datos. {name} revisa cada pedido y, cuando lo aprueba, te llega el acceso a la app con tu rutina cargada.</p>
        </div>
        {sp.error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{sp.error}</div>}
        {plans.length === 0 ? (
          <div className="card card-pad text-center muted">Por ahora no hay planes publicados.</div>
        ) : (
          <div className="grid gap-4">
            {plans.map((p) => {
              const d = sanitizeRoutine(p.data);
              const open = sp.plan === p.id || plans.length === 1;
              return (
                <details key={p.id} open={open} className="card card-pad group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-black uppercase tracking-wide text-white">{p.name}</h2>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                        <span className="flex items-center gap-1"><CalendarDays size={13} />{d.days.length} {d.days.length === 1 ? "día" : "días"} por semana</span>
                        <span className="flex items-center gap-1"><Layers size={13} />{d.weeks} semanas</span>
                        <span className="flex items-center gap-1"><Dumbbell size={13} />{countExercises(d)} ejercicios</span>
                      </div>
                      {p.blurb && <p className="mt-3 whitespace-pre-line text-sm text-neutral-300">{p.blurb}</p>}
                    </div>
                    <div className="text-right">
                      {p.price ? <div className="font-display text-2xl font-black text-volt">$ {fmtNum(p.price)}</div> : <div className="text-sm text-neutral-400">Consultá el precio</div>}
                      <span className="mt-2 inline-block rounded-full bg-volt px-3 py-1 text-xs font-bold text-black group-open:hidden">Lo quiero</span>
                    </div>
                  </summary>
                  <form action={requestPlan} className="mt-5 grid gap-3 border-t border-ink-700 pt-5 sm:grid-cols-2">
                    <input type="hidden" name="org" value={slug} />
                    <input type="hidden" name="planId" value={p.id} />
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                    <label><span className="label mb-1 block">Nombre y apellido</span><input name="name" required minLength={2} maxLength={80} className="input" autoComplete="name" /></label>
                    <label><span className="label mb-1 block">Email</span><input name="email" type="email" required maxLength={120} className="input" autoComplete="email" /></label>
                    <label><span className="label mb-1 block">Celular (WhatsApp)</span><input name="phone" type="tel" required minLength={8} maxLength={30} className="input" placeholder="11 2345 6789" autoComplete="tel" /></label>
                    <label><span className="label mb-1 block">Algo que quieras contar (opcional)</span><input name="note" maxLength={500} className="input" placeholder="Objetivo, deporte, días que podés" /></label>
                    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs muted">{p.price && hasMp ? "Vas a pagar con Mercado Pago. El acceso se activa cuando " + name + " aprueba el pedido." : name + " te va a escribir para coordinar el pago y activar tu acceso."}</p>
                      <Submit className="btn-primary" pendingText="Enviando…">{p.price && hasMp ? "Pedir y pagar" : "Pedir el plan"}</Submit>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
        <p className="mt-8 text-center text-sm"><a href={`/c/${slug}`} className="text-neutral-400 hover:text-volt">¿Ya tenés cuenta? Ingresá acá</a></p>
        <div className="mx-auto mt-6 h-1.5 w-24 rounded hazard" />
      </div>
    </div>
  );
}

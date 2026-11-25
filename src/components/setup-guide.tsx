import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { hideSetupGuide } from "@/app/app/settings/actions";

/** Guía de primeros pasos para un club nuevo. Se marca sola a medida que se completa. */
export async function SetupGuide({ u }: { u: SessionUser }) {
  const org = u.org;
  if (org.isDemo || org.setupHidden) return null;
  const [athletes, sessions, evals] = await Promise.all([
    db.user.count({ where: { orgId: org.id, role: "ATHLETE" } }),
    db.session.count({ where: { orgId: org.id } }),
    db.evaluation.count({ where: { athlete: { orgId: org.id } } }),
  ]);
  const admin = u.role === "ADMIN";
  const steps = [
    ...(admin ? [{ done: org.feeAmount != null || !!org.whatsapp, label: "Tus datos de cobro", hint: "Cuota mensual y tu WhatsApp de contacto", href: "/app/settings" }] : []),
    ...(admin ? [{ done: !!(org.brandName || org.logoKey), label: "Tu marca", hint: "Nombre, logo y enlace de ingreso propio", href: "/app/settings" }] : []),
    { done: athletes > 0, label: "Sumar alumnos", hint: "De a uno o toda la lista desde Excel", href: "/app/athletes/import" },
    { done: sessions > 0, label: "Primera sesión", hint: "Armala desde la biblioteca de ejercicios", href: "/app/sessions/new" },
    { done: evals > 0, label: "Primera evaluación", hint: "Saltos, velocidad, fuerza y más", href: "/app/evaluations/new" },
    ...(admin ? [{ done: !!org.mpToken, label: "Cobrar con Mercado Pago", hint: "Opcional: las cuotas se marcan solas", href: "/app/settings" }] : []),
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section className="card card-pad mb-6 border-volt/40 animate-rise">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="label text-volt">Primeros pasos · {done} de {steps.length}</div>
          <h2 className="h2 mt-1">Dejá todo listo para tu equipo</h2>
        </div>
        <form action={hideSetupGuide}><button className="rounded-lg p-2 text-neutral-500 hover:bg-ink-800 hover:text-white" title="Ocultar guía" aria-label="Ocultar guía"><X size={16} /></button></form>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-ink-700"><div className="h-full rounded-full bg-volt" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link href={s.href} className={`flex items-start gap-3 rounded-xl border p-3 transition ${s.done ? "border-ink-700 opacity-60" : "border-ink-600 hover:border-volt/50"}`}>
              {s.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-volt" /> : <Circle size={18} className="mt-0.5 shrink-0 text-neutral-500" />}
              <span><span className={`block text-sm font-semibold ${s.done ? "text-neutral-400 line-through" : "text-white"}`}>{i + 1}. {s.label}</span><span className="block text-xs muted">{s.hint}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

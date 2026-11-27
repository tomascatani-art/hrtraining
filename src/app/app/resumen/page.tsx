import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader, fmtDate } from "@/components/ui";
import { weeklySummary } from "@/lib/weekly-summary";

export const metadata = { title: "Resumen de la semana" };

const wa = (phone: string | null | undefined, text: string) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;

/** Resumen de los últimos 7 días (también llega como aviso cada lunes). */
export default async function ResumenPage() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const s = await weeklySummary(u.orgId);
  const Box = ({ title, n, children }: { title: string; n: number; children: React.ReactNode }) => (
    <section className="card card-pad">
      <h2 className="mb-3 flex items-baseline gap-2 font-display text-lg font-bold uppercase text-white">{title}<span className="num text-volt">{n}</span></h2>
      {children}
    </section>
  );
  const empty = (t: string) => <p className="text-sm muted">{t}</p>;
  return (
    <>
      <PageHeader eyebrow="Alumnos" title="Resumen de la semana" subtitle={`Del ${fmtDate(s.from, { day: "2-digit", month: "short" })} a hoy. Cada lunes te llega este resumen como aviso.`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Entrenaron" n={s.trained.length}>
          {s.trained.length ? <ul className="space-y-1.5 text-sm">{s.trained.map((a) => <li key={a.id} className="flex justify-between gap-3"><Link href={`/app/athletes/${a.id}`} className="text-white hover:text-volt">{a.name}</Link><span className="muted">{a.days} {a.days === 1 ? "día" : "días"}</span></li>)}</ul> : empty("Nadie marcó entrenamientos esta semana.")}
        </Box>
        <Box title="No entrenaron" n={s.idle.length}>
          {s.idle.length ? <ul className="space-y-1.5 text-sm">{s.idle.map((a) => <li key={a.id} className="flex items-center justify-between gap-3"><Link href={`/app/athletes/${a.id}`} className="text-white hover:text-volt">{a.name}</Link>
            <a href={wa(a.athleteProfile?.phone, `Hola ${a.name.split(" ")[0]}! ¿Cómo venís? Vi que esta semana no marcaste entrenamientos. Cualquier cosa avisame.`)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><MessageCircle size={13} />WhatsApp</a></li>)}</ul> : empty("Todos entrenaron al menos una vez.")}
        </Box>
        <Box title="Planes por terminar" n={s.ending.length}>
          {s.ending.length ? <ul className="space-y-1.5 text-sm">{s.ending.map((e) => <li key={e.routineId} className="flex justify-between gap-3"><Link href={`/app/routines/${e.routineId}`} className="text-white hover:text-volt">{e.name} · <span className="muted">{e.plan}</span></Link><span className="shrink-0 text-volt">{e.daysLeft > 0 ? `${e.daysLeft} ${e.daysLeft === 1 ? "día" : "días"}` : "Terminado"}</span></li>)}</ul> : empty("Ningún plan termina esta semana.")}
        </Box>
        <Box title="Molestias anotadas" n={s.molestias.length}>
          {s.molestias.length ? <ul className="space-y-1.5 text-sm">{s.molestias.map((m, i) => <li key={i}><Link href={`/app/athletes/${m.athleteId}?tab=rutina`} className="text-white hover:text-volt">{m.athlete.name}</Link>{m.note ? <span className="muted"> · “{m.note}”</span> : null}</li>)}</ul> : empty("Nadie anotó molestias.")}
        </Box>
        <Box title="Cuotas del mes sin pagar" n={s.unpaid.length}>
          {s.unpaid.length ? <><p className="text-sm text-neutral-300">{s.unpaid.slice(0, 12).map((a) => a.name).join(", ")}{s.unpaid.length > 12 ? "…" : ""}</p><Link href="/app/fees" className="btn-ghost btn-sm mt-3">Ir a cuotas</Link></> : empty("Todos al día.")}
        </Box>
      </div>
    </>
  );
}

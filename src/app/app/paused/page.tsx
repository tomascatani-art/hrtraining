import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, MessageSquare, Lock, CreditCard } from "lucide-react";
import { Submit } from "@/components/forms";
import { payFee } from "../pay/actions";
import { requireUser } from "@/lib/auth";
import { feeStatusFor, monthKey, monthLabel } from "@/lib/fees";
import { Card } from "@/components/ui";

export const metadata = { title: "Mi cuota" };

export default async function PausedPage({ searchParams }: { searchParams: Promise<{ mp?: string }> }) {
  const sp = await searchParams;
  const u = await requireUser();
  if (u.role !== "ATHLETE") redirect("/app");
  const period = monthKey();
  const f = await feeStatusFor(u.id, period);
  const canPay = f.status === "PENDIENTE" && f.amount != null && f.amount > 0 && !!f.org?.mpToken;
  const wa = f.org?.whatsapp ? `https://wa.me/${f.org.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${u.name}, quiero regularizar la cuota de ${monthLabel(period).toLowerCase()}.`)}` : null;
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-volt text-black"><Lock size={26} /></div>
        <h1 className="h1">{f.paused ? "Tu cuenta está pausada" : "Tu cuota"}</h1>
        <p className="mt-2 text-sm muted">
          {f.paused
            ? "Tu entrenador pausó el acceso hasta que se regularice la cuota. Mientras tanto podés usar el chat. Apenas se registre el pago, todo vuelve a estar disponible."
            : f.status === "PENDIENTE" ? `La cuota de ${monthLabel(period).toLowerCase()} figura como pendiente.` : `La cuota de ${monthLabel(period).toLowerCase()} está al día. ¡Gracias!`}
        </p>
        {f.amount != null && <div className="num my-5 text-4xl font-bold text-white">$ {f.amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>}
        {canPay && (
          <form action={payFee} className="mb-3">
            <Submit className="btn-primary w-full justify-center" pendingText="Abriendo Mercado Pago…"><CreditCard size={16} />Pagar con Mercado Pago</Submit>
          </form>
        )}
        {sp.mp === "error" && <p className="mb-3 text-sm text-red-300">No se pudo abrir Mercado Pago. Probá de nuevo en unos minutos o avisale a tu entrenador.</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {wa && <a href={wa} target="_blank" rel="noreferrer" className={canPay ? "btn-ghost" : "btn-primary"}><MessageCircle size={16} />Escribir por WhatsApp</a>}
          <Link href="/app/messages" className="btn-ghost"><MessageSquare size={16} />Ir al chat</Link>
          {!f.paused && <Link href="/app" className="btn-ghost">Volver al inicio</Link>}
        </div>
      </Card>
    </div>
  );
}

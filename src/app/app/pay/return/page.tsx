import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { applyMpPayment } from "@/lib/mercadopago";

export const metadata = { title: "Pago de cuota" };

/** Vuelta desde Mercado Pago: se verifica el pago con Mercado Pago antes de marcar la cuota. */
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ payment_id?: string; collection_id?: string; status?: string }> }) {
  const u = await requireUser(["ATHLETE"]);
  const sp = await searchParams;
  const id = sp.payment_id ?? sp.collection_id;
  const res = id && id !== "null" ? await applyMpPayment(u.orgId, id).catch(() => null) : null;
  const mine = res && "fee" in res && res.fee?.athleteId === u.id;
  const state = res?.ok && mine ? "ok" : sp.status === "pending" || sp.status === "in_process" || (res && (res.reason === "pending" || res.reason === "in_process")) ? "pending" : "fail";
  const Icon = state === "ok" ? CheckCircle2 : state === "pending" ? Clock : XCircle;
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="text-center">
        <Icon size={44} className={`mx-auto mb-3 ${state === "fail" ? "text-red-300" : "text-volt"}`} />
        <h1 className="h1">{state === "ok" ? "¡Pago recibido!" : state === "pending" ? "Pago en proceso" : "El pago no se completó"}</h1>
        <p className="mt-2 text-sm muted">
          {state === "ok" ? "Tu cuota quedó al día. Tu entrenador ya fue avisado." : state === "pending" ? "Mercado Pago todavía está procesando el pago. Cuando se acredite, la cuota se marca sola." : "No se registró ningún cobro. Podés intentarlo de nuevo o escribirle a tu entrenador."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/app" className="btn-primary">Ir al inicio</Link>
          {state === "fail" && <Link href="/app/paused" className="btn-ghost">Volver a intentar</Link>}
        </div>
      </Card>
    </div>
  );
}

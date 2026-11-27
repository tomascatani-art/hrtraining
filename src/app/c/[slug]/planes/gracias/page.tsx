import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Logo } from "@/components/ui";
import { accentVars, logoUrl } from "@/lib/brand";
import { publicOrg } from "@/lib/public-org";
import { applyMpPayment } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido recibido" };

/** Vuelta del pedido: si viene de Mercado Pago, se verifica el pago con Mercado Pago antes de mostrarlo como pagado. */
export default async function Gracias({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ payment_id?: string; collection_id?: string; status?: string; pedido?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const org = await publicOrg(slug);
  if (!org) notFound();
  const name = org.brandName || org.name;
  const id = sp.payment_id ?? sp.collection_id;
  const res = id && id !== "null" ? await applyMpPayment(org.id, id).catch(() => null) : null;
  const state = res?.ok ? "paid" : !id ? "sent" : sp.status === "pending" || sp.status === "in_process" || (res && (res.reason === "pending" || res.reason === "in_process")) ? "pending" : "fail";
  const Icon = state === "fail" ? XCircle : state === "pending" ? Clock : CheckCircle2;
  const wa = org.whatsapp ? `https://wa.me/${org.whatsapp}` : null;
  return (
    <div className="grid min-h-dvh place-items-center bg-grid p-5" style={accentVars(org.brandColor) as React.CSSProperties | undefined}>
      <div className="w-full max-w-md animate-rise text-center">
        <div className="mb-6 flex justify-center"><Logo size={64} withText={false} brand={org.logoKey ? { name, logo: logoUrl(org) } : null} /></div>
        <div className="card card-pad">
          <Icon size={44} className={`mx-auto mb-3 ${state === "fail" ? "text-red-300" : "text-volt"}`} />
          <h1 className="h1">{state === "paid" ? "¡Pago recibido!" : state === "pending" ? "Pago en proceso" : state === "fail" ? "El pago no se completó" : "¡Pedido enviado!"}</h1>
          <p className="mt-2 text-sm muted">
            {state === "paid" ? `${name} ya fue avisado. Cuando apruebe tu pedido te llega el acceso a la app con tu plan.`
              : state === "pending" ? "Mercado Pago todavía está procesando el pago. Cuando se acredite, tu pedido pasa a revisión solo."
              : state === "fail" ? "No se registró ningún cobro. Podés volver a intentarlo."
              : `${name} va a ver tu pedido y te va a escribir para coordinar el pago y darte el acceso.`}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {state === "fail" && <a href={`/c/${slug}/planes`} className="btn-primary">Volver a los planes</a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost">Escribir por WhatsApp</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

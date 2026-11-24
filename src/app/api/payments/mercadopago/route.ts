import { NextResponse } from "next/server";
import { applyMpPayment } from "@/lib/mercadopago";

// Aviso de Mercado Pago. No se confía en el cuerpo: el pago se consulta a Mercado Pago con el token del club.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("org") ?? "";
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (orgId && type === "payment" && id) await applyMpPayment(orgId, id).catch(() => null);
  return NextResponse.json({ received: true });
}

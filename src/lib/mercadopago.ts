import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret";
import { notify } from "@/lib/access";
import { monthLabel } from "@/lib/fees";

// Cobro de cuotas con Mercado Pago (Checkout Pro). Cada club usa su propia cuenta (Access Token).
const API = () => process.env.MP_API_BASE ?? "https://api.mercadopago.com";

export async function orgToken(orgId: string) {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { mpToken: true } });
  return decryptSecret(org?.mpToken);
}

async function mp<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API() + path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}`);
  return r.json() as Promise<T>;
}

/** Crea la preferencia de pago para una cuota y devuelve el link de pago. */
export async function createFeeCheckout(opts: { token: string; feeId: string; amount: number; period: string; orgName: string; payerEmail: string; origin: string; orgId: string }) {
  const back = `${opts.origin}/app/pay/return`;
  const pref = await mp<{ id: string; init_point: string }>(opts.token, "/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": `${opts.feeId}-${Date.now()}` },
    body: JSON.stringify({
      items: [{ id: opts.feeId, title: `Cuota ${monthLabel(opts.period)} · ${opts.orgName}`.slice(0, 250), quantity: 1, unit_price: opts.amount, currency_id: "ARS" }],
      payer: { email: opts.payerEmail },
      external_reference: opts.feeId,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: "approved",
      // Mercado Pago solo puede avisar a direcciones públicas con https
      ...(opts.origin.startsWith("https://") ? { notification_url: `${opts.origin}/api/payments/mercadopago?org=${opts.orgId}` } : {}),
    }),
  });
  return pref.init_point;
}

type Payment = { id: number | string; status: string; external_reference?: string | null; transaction_amount?: number };

/**
 * Verifica un pago consultándolo directamente a Mercado Pago con el token del club
 * y, si está aprobado y coincide con la cuota, la marca como pagada. Idempotente.
 */
export async function applyMpPayment(orgId: string, paymentId: string) {
  const token = await orgToken(orgId);
  if (!token || !/^\d{1,20}$/.test(paymentId)) return { ok: false as const, reason: "config" };
  const p = await mp<Payment>(token, `/v1/payments/${paymentId}`);
  const fee = p.external_reference ? await db.fee.findUnique({ where: { id: p.external_reference }, include: { athlete: { select: { name: true, athleteProfile: { select: { coachId: true } } } } } }) : null;
  if (!fee || fee.orgId !== orgId) return { ok: false as const, reason: "fee" };
  if (p.status !== "approved") return { ok: false as const, reason: p.status, fee };
  if (fee.amount != null && (p.transaction_amount ?? 0) + 0.01 < fee.amount) return { ok: false as const, reason: "amount", fee };
  if (fee.status === "PAGADO") return { ok: true as const, fee };
  const updated = await db.fee.update({ where: { id: fee.id }, data: { status: "PAGADO", paidAt: new Date(), paidVia: "MERCADOPAGO", mpPaymentId: String(p.id) } });
  await db.athleteProfile.update({ where: { userId: fee.athleteId }, data: { paused: false } }).catch(() => undefined);
  await notify([fee.athleteId], { kind: "CUOTA", title: "¡Pago recibido!", body: `Tu cuota de ${monthLabel(fee.period).toLowerCase()} quedó al día.`, link: "/app" });
  const coachId = fee.athlete.athleteProfile?.coachId;
  if (coachId) await notify([coachId], { kind: "CUOTA", title: `${fee.athlete.name} pagó la cuota`, body: `${monthLabel(fee.period)} · Mercado Pago`, link: `/app/fees?m=${fee.period}` });
  return { ok: true as const, fee: updated };
}

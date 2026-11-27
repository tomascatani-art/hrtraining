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

/** Cobro de un plan pedido desde la página pública. */
export async function createPlanCheckout(opts: { token: string; requestId: string; amount: number; planName: string; orgName: string; payerEmail: string; origin: string; orgId: string; back: string }) {
  const pref = await mp<{ id: string; init_point: string }>(opts.token, "/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": `plan-${opts.requestId}-${Date.now()}` },
    body: JSON.stringify({
      items: [{ id: opts.requestId, title: `${opts.planName} · ${opts.orgName}`.slice(0, 250), quantity: 1, unit_price: opts.amount, currency_id: "ARS" }],
      ...(opts.payerEmail.includes("@") ? { payer: { email: opts.payerEmail } } : {}),
      external_reference: `plan:${opts.requestId}`,
      back_urls: { success: opts.back, pending: opts.back, failure: opts.back },
      auto_return: "approved",
      ...(opts.origin.startsWith("https://") ? { notification_url: `${opts.origin}/api/payments/mercadopago?org=${opts.orgId}` } : {}),
    }),
  });
  return pref.init_point;
}

/** Marca un pedido de plan como pagado (verificado con Mercado Pago) y avisa al preparador. Idempotente. */
async function applyPlanPayment(orgId: string, p: Payment, requestId: string) {
  const req = await db.planRequest.findUnique({ where: { id: requestId } });
  if (!req || req.orgId !== orgId) return { ok: false as const, reason: "plan" };
  if (p.status !== "approved") return { ok: false as const, reason: p.status, plan: req };
  if (req.amount != null && (p.transaction_amount ?? 0) + 0.01 < req.amount) return { ok: false as const, reason: "amount", plan: req };
  if (req.status !== "NUEVO") return { ok: true as const, plan: req };
  const done = await db.planRequest.updateMany({ where: { id: req.id, status: "NUEVO" }, data: { status: "PAGADO", mpPaymentId: String(p.id) } });
  if (done.count) {
    const staff = await db.user.findMany({ where: { orgId, role: { in: ["ADMIN", "COACH"] }, active: true }, select: { id: true } });
    await notify(staff.map((s) => s.id), { kind: "PLAN", title: `${req.name} pagó el plan ${req.planName}`, body: "Aprobalo para crearle la cuenta.", link: "/app/templates#pedidos" });
  }
  return { ok: true as const, plan: req };
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
  if (p.external_reference?.startsWith("plan:")) return applyPlanPayment(orgId, p, p.external_reference.slice(5));
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

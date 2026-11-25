"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { feeStatusFor, monthKey } from "@/lib/fees";
import { orgToken, createFeeCheckout } from "@/lib/mercadopago";

/** El alumno paga su cuota del mes: crea el cobro en Mercado Pago y lo lleva a pagar. */
export async function payFee() {
  const u = await requireUser(["ATHLETE"]);
  const period = monthKey();
  const f = await feeStatusFor(u.id, period);
  if (f.status !== "PENDIENTE" || f.amount == null || !(f.amount > 0)) redirect("/app/paused");
  const token = await orgToken(u.orgId);
  if (!token) redirect("/app/paused?mp=off");
  const fee = await db.fee.upsert({
    where: { athleteId_period: { athleteId: u.id, period } },
    create: { orgId: u.orgId, athleteId: u.id, period, amount: f.amount, status: "PENDIENTE" },
    update: { amount: f.amount },
  });
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  let url: string;
  try {
    url = await createFeeCheckout({ token, feeId: fee.id, amount: f.amount, period, orgName: u.org.brandName || u.org.name, payerEmail: u.email, origin, orgId: u.orgId });
  } catch {
    redirect("/app/paused?mp=error");
  }
  redirect(url);
}

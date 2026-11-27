import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/access";
import { monthKey, monthLabel } from "@/lib/fees";
import { isoDay } from "@/lib/metrics";

/**
 * Recordatorios automáticos de cuota. Corre como mucho una vez por día y por organización
 * (lo dispara cualquiera que abra la app). Avisa a cada alumno una vez cuando faltan 3 días
 * y otra vez cuando venció; al preparador le llega una sola vez por mes la lista de vencidos.
 */
export async function runFeeReminders(orgId: string, now = new Date()) {
  const today = isoDay(now);
  // Se marca primero, así dos pedidos al mismo tiempo no mandan avisos repetidos.
  const claimed = await db.organization.updateMany({ where: { id: orgId, OR: [{ feeRunOn: null }, { feeRunOn: { not: today } }] }, data: { feeRunOn: today } });
  if (!claimed.count) return;
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) return;
  const period = monthKey(now);
  const day = now.getDate();
  const due = org.feeDueDay;
  const stage = day >= due ? 2 : day >= due - 3 ? 1 : 0;
  if (!stage) return;
  const athletes = await db.user.findMany({ where: { orgId, role: "ATHLETE", active: true }, select: { id: true, name: true, athleteProfile: { select: { feeAmount: true } } } });
  if (!athletes.length) return;
  const fees = await db.fee.findMany({ where: { orgId, period, athleteId: { in: athletes.map((a) => a.id) } } });
  const pending = athletes.filter((a) => { const f = fees.find((x) => x.athleteId === a.id); return !f || f.status === "PENDIENTE"; });
  const mes = monthLabel(period).toLowerCase();
  for (const a of pending) {
    const f = fees.find((x) => x.athleteId === a.id);
    if ((f?.autoNotice ?? 0) >= stage) continue;
    const amount = f?.amount ?? a.athleteProfile?.feeAmount ?? org.feeAmount ?? null;
    await db.fee.upsert({
      where: { athleteId_period: { athleteId: a.id, period } },
      create: { orgId, athleteId: a.id, period, amount, status: "PENDIENTE", autoNotice: stage },
      update: { autoNotice: stage },
    });
    await notify([a.id], stage === 1
      ? { kind: "CUOTA", title: `Tu cuota de ${mes} vence el día ${due}`, body: org.payLink ? "Podés pagarla desde el inicio de la app." : "Si ya pagaste, avisale a tu preparador.", link: "/app" }
      : { kind: "CUOTA", title: `Tu cuota de ${mes} está vencida`, body: org.payLink ? "Pagala desde el inicio de la app, con el botón «Pagar cuota»." : "Hablá con tu preparador para regularizarla.", link: "/app" });
  }
  if (stage === 2 && pending.length && org.feeCoachOn !== period) {
    await db.organization.update({ where: { id: orgId }, data: { feeCoachOn: period } });
    const staff = await db.user.findMany({ where: { orgId, role: { in: ["ADMIN", "COACH"] }, active: true }, select: { id: true } });
    await notify(staff.map((s) => s.id), { kind: "CUOTA", title: `${pending.length} ${pending.length === 1 ? "alumno tiene" : "alumnos tienen"} la cuota vencida`, body: "Tenés la lista con un botón de WhatsApp para escribirle a cada uno.", link: "/app/fees?f=pendientes" });
  }
}

/** Link de WhatsApp con el mensaje ya escrito. Sin número, WhatsApp deja elegir el contacto. */
export function feeWhatsApp(phone: string | null | undefined, name: string, mes: string, amount: number | null, payLink: string | null) {
  const first = name.split(" ")[0];
  const txt = `Hola ${first}! Te recuerdo que la cuota de ${mes}${amount ? ` ($ ${amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })})` : ""} figura pendiente.${payLink ? ` Podés pagarla acá: ${payLink}` : ""} Cualquier cosa avisame. ¡Gracias!`;
  const num = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(txt)}`;
}

"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { runAction } from "@/lib/action-error";
import { notify } from "@/lib/access";
import { orgToken, createPlanCheckout } from "@/lib/mercadopago";
import { publicOrg, planesPath } from "@/lib/public-org";
import { waPhone } from "@/lib/phone";

const schema = z.object({
  name: z.string().trim().min(2, "Poné tu nombre y apellido").max(80),
  email: z.string().trim().toLowerCase().email("Revisá el email").max(120),
  phone: z.string().trim().min(8, "Poné tu celular con código de área").max(30),
  note: z.string().trim().max(500).optional(),
});

/** Alguien pide un plan desde la página pública. Si hay Mercado Pago, va a pagar; si no, le avisa al preparador. */
async function _requestPlan(fd: FormData) {
  const org = await publicOrg(String(fd.get("org") ?? ""));
  if (!org) throw new Error("No encontramos esta página.");
  if (String(fd.get("website") ?? "")) redirect(`${planesPath(org)}/gracias`); // trampa para robots
  const plan = await db.routine.findFirst({ where: { id: String(fd.get("planId") ?? ""), orgId: org.id, template: true, forSale: true } });
  if (!plan) throw new Error("Ese plan ya no está disponible.");
  const f = schema.parse({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), note: String(fd.get("note") ?? "") || undefined });

  // Freno contra abusos: muchos pedidos sin pagar en el día
  const since = new Date(Date.now() - 24 * 3600_000);
  if ((await db.planRequest.count({ where: { orgId: org.id, status: "NUEVO", createdAt: { gte: since } } })) >= 40) throw new Error("Hay muchos pedidos en este momento. Probá más tarde o escribinos por WhatsApp.");

  // Si ya lo pidió hace un rato y no pagó, se reutiliza el mismo pedido
  const recent = await db.planRequest.findFirst({ where: { orgId: org.id, email: f.email, routineId: plan.id, status: "NUEVO", createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  const data = { name: f.name, phone: waPhone(f.phone), note: f.note ?? null, amount: plan.price, planName: plan.name };
  const req = recent
    ? await db.planRequest.update({ where: { id: recent.id }, data })
    : await db.planRequest.create({ data: { ...data, orgId: org.id, routineId: plan.id, email: f.email } });

  const token = plan.price && plan.price > 0 ? await orgToken(org.id) : null;
  if (token) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    let url: string | null = null;
    try {
      url = await createPlanCheckout({ token, requestId: req.id, amount: plan.price!, planName: plan.name, orgName: org.brandName || org.name, payerEmail: f.email, origin, orgId: org.id, back: `${origin}${planesPath(org)}/gracias` });
    } catch {
      url = null;
    }
    if (url) redirect(url);
  }
  // Sin cobro online: el preparador lo ve y le escribe
  if (!recent) {
    const staff = await db.user.findMany({ where: { orgId: org.id, role: { in: ["ADMIN", "COACH"] }, active: true }, select: { id: true } });
    await notify(staff.map((s) => s.id), { kind: "PLAN", title: `${f.name} pidió el plan ${plan.name}`, body: "Todavía no pagó. Escribile y aprobalo cuando esté listo.", link: "/app/templates#pedidos" });
  }
  redirect(`${planesPath(org)}/gracias?pedido=1`);
}

export async function requestPlan(fd: FormData) { return runAction("requestPlan", _requestPlan, fd); }

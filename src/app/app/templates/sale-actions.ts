"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { runAction } from "@/lib/action-error";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit, notify } from "@/lib/access";
import { sanitizeRoutine, cloneRoutine } from "@/lib/routine";
import { sendInviteMail } from "@/lib/account-mail";
import { appOrigin } from "@/lib/origin";

/** Publica (o saca) una plantilla en la página pública de planes, con su precio y descripción. */
async function _saveSale(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const t = await db.routine.findFirst({ where: { id: String(fd.get("id")), orgId: u.orgId, template: true } });
  if (!t) throw new Error("Plantilla no encontrada");
  const raw = String(fd.get("price") ?? "").replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const price = raw ? Math.round(Number(raw)) : null;
  if (price != null && (!Number.isFinite(price) || price < 0 || price > 100_000_000)) throw new Error("Revisá el precio");
  await db.routine.update({ where: { id: t.id }, data: { forSale: fd.get("forSale") === "on", price, blurb: String(fd.get("blurb") ?? "").trim().slice(0, 600) || null } });
  revalidatePath("/app/templates");
}

/** Aprueba un pedido: crea la cuenta del alumno (o usa la que ya tiene) y le asigna el plan. */
async function _approveRequest(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const req = await db.planRequest.findFirst({ where: { id: String(fd.get("id")), orgId: u.orgId, status: { in: ["NUEVO", "PAGADO"] } } });
  if (!req) throw new Error("Ese pedido ya fue resuelto");
  const existing = await db.user.findUnique({ where: { email: req.email } });
  if (existing && (existing.orgId !== u.orgId || existing.role !== "ATHLETE")) throw new Error("Ese email ya tiene una cuenta que no es de un alumno tuyo. Creale la cuenta a mano con otro usuario.");
  const athlete = existing ?? await db.user.create({
    data: {
      orgId: u.orgId, name: req.name, email: req.email, role: "ATHLETE", inviteToken: randomBytes(24).toString("base64url"),
      athleteProfile: { create: { coachId: u.id, sport: "GENERAL", phone: req.phone, objective: req.note?.slice(0, 200) ?? null } },
    },
  });
  if (existing) await db.athleteProfile.update({ where: { userId: existing.id }, data: { paused: false } }).catch(() => undefined);
  const t = req.routineId ? await db.routine.findFirst({ where: { id: req.routineId, orgId: u.orgId } }) : null;
  if (t) {
    const data = cloneRoutine(sanitizeRoutine(t.data));
    data.meta.start = "";
    await db.routine.updateMany({ where: { athleteId: athlete.id, active: true, extra: false }, data: { active: false } });
    await db.routine.create({ data: { orgId: u.orgId, athleteId: athlete.id, coachId: u.id, name: t.name, data: data as unknown as Prisma.InputJsonValue } });
  }
  await db.planRequest.update({ where: { id: req.id }, data: { status: "APROBADO", athleteId: athlete.id } });
  await audit(u, "APROBAR", "Pedido de plan", `${req.name} · ${req.planName}`, athlete.id);
  if (existing) {
    await notify([athlete.id], { kind: "SESION", title: "Tenés un plan nuevo", body: req.planName, link: "/app/routine" });
    redirect(`/app/athletes/${athlete.id}`);
  }
  const mail = await sendInviteMail({ ...athlete, org: u.org }, await appOrigin()).catch(() => ({ sent: false }));
  redirect(`/app/athletes/${athlete.id}?aprobado=1${mail.sent ? "&mail=1" : ""}`);
}

async function _rejectRequest(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  await db.planRequest.updateMany({ where: { id: String(fd.get("id")), orgId: u.orgId, status: { in: ["NUEVO", "PAGADO"] } }, data: { status: "RECHAZADO" } });
  revalidatePath("/app/templates");
}

export async function saveSale(fd: FormData) { return runAction("saveSale", _saveSale, fd); }
export async function approveRequest(fd: FormData) { return runAction("approveRequest", _approveRequest, fd); }
export async function rejectRequest(fd: FormData) { return runAction("rejectRequest", _rejectRequest, fd); }

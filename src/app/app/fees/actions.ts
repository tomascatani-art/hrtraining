"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { monthLabel } from "@/lib/fees";

const PERIOD = /^\d{4}-\d{2}$/;

async function _setFeeStatus(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  const period = String(fd.get("period"));
  const status = String(fd.get("status"));
  if (!PERIOD.test(period) || !["PENDIENTE", "PAGADO", "BONIFICADO"].includes(status)) throw new Error("Datos inválidos");
  await assertAthlete(u, athleteId);
  const amountRaw = String(fd.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw.replace(",", ".")) : undefined;
  await db.fee.upsert({
    where: { athleteId_period: { athleteId, period } },
    create: { orgId: u.orgId, athleteId, period, status, amount: amount ?? null, paidAt: status === "PAGADO" ? new Date() : null, paidVia: status === "PAGADO" ? "MANUAL" : null },
    update: { status, ...(amount !== undefined ? { amount } : {}), paidAt: status === "PAGADO" ? new Date() : null, paidVia: status === "PAGADO" ? "MANUAL" : null },
  });
  // Al marcar «Pagó», la cuenta pausada se reactiva sola
  if (status !== "PENDIENTE") await db.athleteProfile.update({ where: { userId: athleteId }, data: { paused: false } });
  await audit(u, "EDITAR", "Cuota", `${monthLabel(period)}: ${status}`, athleteId);
  revalidatePath("/app/fees");
}

async function _setPaused(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const paused = fd.get("paused") === "1";
  await db.athleteProfile.update({ where: { userId: athleteId }, data: { paused } });
  await audit(u, "EDITAR", "Cuenta", paused ? "Cuenta pausada por cuota" : "Cuenta reactivada", athleteId);
  if (paused) await notify([athleteId], { kind: "CUOTA", title: "Tu cuenta está pausada", body: "Regularizá la cuota para volver a ver tus entrenamientos.", link: "/app/paused" });
  revalidatePath("/app/fees");
}

async function _remindFee(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  const period = String(fd.get("period"));
  await assertAthlete(u, athleteId);
  await notify([athleteId], { kind: "CUOTA", title: `Recordatorio: cuota de ${monthLabel(period).toLowerCase()}`, body: "Figura como pendiente. Si ya pagaste, avisale a tu entrenador.", link: "/app" });
  revalidatePath("/app/fees");
}

async function _setAthleteFee(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const athleteId = String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const raw = String(fd.get("feeAmount") ?? "").trim();
  await db.athleteProfile.update({ where: { userId: athleteId }, data: { feeAmount: raw ? Number(raw.replace(",", ".")) : null } });
  revalidatePath("/app/fees");
}

export async function setFeeStatus(fd: FormData) { return runAction("setFeeStatus", _setFeeStatus, fd); }
export async function setPaused(fd: FormData) { return runAction("setPaused", _setPaused, fd); }
export async function remindFee(fd: FormData) { return runAction("remindFee", _remindFee, fd); }
export async function setAthleteFee(fd: FormData) { return runAction("setAthleteFee", _setAthleteFee, fd); }

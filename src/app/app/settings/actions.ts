"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/access";

export async function updateProfile(fd: FormData) {
  const u = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Nombre inválido");
  await db.user.update({ where: { id: u.id }, data: { name } });
  revalidatePath("/app", "layout");
}

export async function changePassword(fd: FormData) {
  const u = await requireUser();
  const cur = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? "");
  if (next.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres");
  if (!u.passwordHash || !(await verifyPassword(cur, u.passwordHash))) throw new Error("La contraseña actual no es correcta");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(u, "EDITAR", "Usuario", "Cambio de contraseña", u.id);
  revalidatePath("/app/settings");
}

export async function updateOrg(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const name = String(fd.get("org") ?? "").trim();
  if (name.length < 2) throw new Error("Nombre inválido");
  const whatsapp = String(fd.get("whatsapp") ?? "").replace(/\D/g, "") || null;
  const feeAmount = String(fd.get("feeAmount") ?? "").trim() ? Number(String(fd.get("feeAmount")).replace(",", ".")) : null;
  const feeDueDay = Math.min(28, Math.max(1, Number(fd.get("feeDueDay") ?? 10) || 10));
  await db.organization.update({ where: { id: u.orgId }, data: { name, whatsapp, feeAmount: feeAmount != null && feeAmount >= 0 ? feeAmount : null, feeDueDay } });
  await audit(u, "EDITAR", "Organización", `Nuevo nombre: ${name}`);
  revalidatePath("/app", "layout");
}

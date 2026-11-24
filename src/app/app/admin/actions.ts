"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";
import { sendInviteMail, createResetLink } from "@/lib/account-mail";
import { appOrigin } from "@/lib/origin";
import { createDemo } from "../../../../prisma/demo";

export async function inviteCoach(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const name = String(fd.get("name") ?? "").trim();
  if (!email || !name) throw new Error("Nombre y email requeridos");
  if (await db.user.findUnique({ where: { email } })) throw new Error("Ya existe un usuario con ese email");
  const role = fd.get("role") === "ADMIN" ? "ADMIN" : "COACH";
  const c = await db.user.create({ data: { orgId: u.orgId, email, name, role, inviteToken: randomBytes(24).toString("base64url") } });
  await audit(u, "CREAR", "Usuario", `Invitación a ${name} (${role === "ADMIN" ? "administrador" : "entrenador"})`, c.id);
  const mail = await sendInviteMail({ ...c, org: u.org }, await appOrigin());
  redirect(`/app/admin?invited=${c.id}${mail.sent ? "&mail=1" : ""}`);
}

export async function updateUser(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const id = String(fd.get("id"));
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.orgId !== u.orgId) throw new Error("Usuario no encontrado");
  if (id === u.id) throw new Error("No podés modificar tu propio rol o estado");
  const role = String(fd.get("role") ?? target.role) as "ADMIN" | "COACH" | "ATHLETE";
  if (target.role === "ATHLETE" && role !== "ATHLETE") throw new Error("Un deportista no puede convertirse en entrenador desde aquí");
  if (target.role !== "ATHLETE" && role === "ATHLETE") throw new Error("Un entrenador no puede convertirse en deportista");
  await db.user.update({ where: { id }, data: { role, active: fd.get("active") === "on" } });
  await audit(u, "EDITAR", "Usuario", `${target.name}: rol ${role}, ${fd.get("active") === "on" ? "activo" : "inactivo"}`, id);
  revalidatePath("/app/admin");
}

export async function resetDemo() {
  const u = await requireUser(["ADMIN"]);
  if (!u.org.isDemo) throw new Error("Solo disponible en la organización de demostración");
  await createDemo(db);
  redirect("/login?demo=reset");
}

/** El administrador genera el enlace para que un usuario del club elija una contraseña nueva (y se lo manda por WhatsApp). */
export async function resetLinkForUser(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const target = await db.user.findUnique({ where: { id: String(fd.get("id")) } });
  if (!target || target.orgId !== u.orgId) throw new Error("Usuario no encontrado");
  const url = await createResetLink(target.id, await appOrigin());
  await db.user.update({ where: { id: target.id }, data: { resetRequestedAt: null } });
  await audit(u, "EDITAR", "Usuario", `Enlace para cambiar contraseña de ${target.name}`, target.id);
  redirect(`/app/admin?para=${target.id}&clave=${encodeURIComponent(url.split("/reset/")[1])}#claves`);
}

export async function dismissResetRequest(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const target = await db.user.findUnique({ where: { id: String(fd.get("id")) } });
  if (!target || target.orgId !== u.orgId) return;
  await db.user.update({ where: { id: target.id }, data: { resetRequestedAt: null } });
  revalidatePath("/app/admin");
}

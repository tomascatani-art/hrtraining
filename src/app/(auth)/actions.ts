"use server";
import { runAction } from "@/lib/action-error";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { sendResetMail, hashToken } from "@/lib/account-mail";
import { appOrigin } from "@/lib/origin";
import { notify } from "@/lib/access";
import { mailConfigured } from "@/lib/mail";

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({ email: z.string().min(1, "Ingresá tu email o usuario"), password: z.string().min(1, "Ingresá tu contraseña") });

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: String(fd.get("email") ?? "").trim().toLowerCase(), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }
  if (!user.active) return { error: "La cuenta está desactivada. Contactá a tu entrenador." };
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  // Cuenta pausada por cuota: va directo al cartel, sin pasar por el inicio.
  if (user.role === "ATHLETE") {
    const prof = await db.athleteProfile.findUnique({ where: { userId: user.id }, select: { paused: true } });
    if (prof?.paused) redirect("/app/paused");
  }
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/app") ? next : "/app");
}

const registerSchema = z.object({
  name: z.string().min(2, "Ingresá tu nombre"),
  org: z.string(),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: String(fd.get("name") ?? "").trim(),
    org: String(fd.get("org") ?? "").trim() || String(fd.get("name") ?? "").trim(),
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    password: fd.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, org, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Ya existe una cuenta con ese email" };
  const user = await db.user.create({
    data: {
      name,
      email,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      org: { create: { name: org } },
    },
  });
  await db.auditLog.create({ data: { orgId: user.orgId, userId: user.id, action: "CREAR", entity: "Organización", summary: `Alta de la organización ${org}` } });
  await createSession(user.id);
  redirect("/app?bienvenida=1");
}

const inviteSchema = z.object({ token: z.string().min(10), password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres") });

export async function acceptInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse({ token: fd.get("token"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.findUnique({ where: { inviteToken: parsed.data.token } });
  if (!user) return { error: "La invitación no es válida o ya fue usada" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password), inviteToken: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect("/app");
}

async function _demoLoginAction(fd: FormData) {
  const as = fd.get("as") === "athlete" ? "alumna" : "hernan";
  const user = await db.user.findUnique({ where: { email: as } });
  if (!user) redirect("/login?demo=missing");
  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export type ForgotState = { error?: string; done?: boolean } | undefined;

/** Pide el enlace para cambiar la contraseña. Responde igual exista o no el email. */
export async function forgotPasswordAction(_: ForgotState, fd: FormData): Promise<ForgotState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Email inválido" };
  const user = await db.user.findUnique({ where: { email }, include: { org: true } });
  const recent = user?.resetRequestedAt && Date.now() - user.resetRequestedAt.getTime() < 60000; // máx. 1 pedido por minuto
  if (user && user.active && !user.isDemo && !recent) {
    await db.user.update({ where: { id: user.id }, data: { resetRequestedAt: new Date() } });
    // Aviso dentro de la app al administrador del club y al entrenador del alumno: le mandan el enlace por WhatsApp
    const admins = await db.user.findMany({ where: { orgId: user.orgId, role: "ADMIN", active: true, id: { not: user.id } }, select: { id: true } });
    const coach = user.role === "ATHLETE" ? (await db.athleteProfile.findUnique({ where: { userId: user.id }, select: { coachId: true } }))?.coachId : null;
    const title = `${user.name} pidió una contraseña nueva`;
    const body = "Generale el enlace y mandáselo por WhatsApp.";
    await notify(admins.map((a) => a.id).filter((id) => id !== coach), { kind: "MENSAJE", title, body, link: "/app/admin#claves" });
    if (coach && coach !== user.id) await notify([coach], { kind: "MENSAJE", title, body, link: `/app/athletes/${user.id}` });
    if (mailConfigured()) await sendResetMail(user, await appOrigin());
  }
  return { done: true };
}

const resetSchema = z.object({ token: z.string().min(20), password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres") });

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ token: fd.get("token"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.findUnique({ where: { resetTokenHash: hashToken(parsed.data.token) } });
  if (!user || !user.resetExpires || user.resetExpires < new Date()) return { error: "El enlace venció o ya se usó. Pedí uno nuevo." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password), resetTokenHash: null, resetExpires: null, inviteToken: null } });
  await db.auditLog.create({ data: { orgId: user.orgId, userId: user.id, action: "EDITAR", entity: "Usuario", summary: "Cambio de contraseña con enlace" } });
  redirect("/login?clave=1");
}

export async function demoLoginAction(fd: FormData) { return runAction("demoLoginAction", _demoLoginAction, fd); }

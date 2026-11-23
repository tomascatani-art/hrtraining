"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({ email: z.string().email("Email inválido"), password: z.string().min(1, "Ingresá tu contraseña") });

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
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/app") ? next : "/app");
}

const registerSchema = z.object({
  name: z.string().min(2, "Ingresá tu nombre"),
  org: z.string().min(2, "Ingresá el nombre de tu gimnasio, club o equipo"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: String(fd.get("name") ?? "").trim(),
    org: String(fd.get("org") ?? "").trim(),
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

export async function demoLoginAction(fd: FormData) {
  const as = fd.get("as") === "athlete" ? "deportista.demo@hrtraining.co" : "entrenador.demo@hrtraining.co";
  const user = await db.user.findUnique({ where: { email: as } });
  if (!user) redirect("/login?demo=missing");
  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

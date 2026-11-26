import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "./db";
import type { Role } from "@prisma/client";

const COOKIE = "kn_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function readSessionUserId(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const currentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  const id = await readSessionUserId(token);
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    include: { org: true, athleteProfile: true },
  });
  if (!user || !user.active) return null;
  return user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export async function requireUser(roles?: Role[]) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role)) redirect("/app");
  // Cuenta pausada por cuota: se chequea en cada pantalla (el layout no se vuelve a dibujar al navegar).
  if (u.role === "ATHLETE" && u.athleteProfile?.paused) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (path.startsWith("/app") && !/^\/app\/(paused|pay|notifications)/.test(path)) redirect("/app/paused");
  }
  return u;
}

export const isStaff = (u: { role: Role }) => u.role === "COACH" || u.role === "ADMIN";

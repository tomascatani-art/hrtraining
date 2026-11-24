import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendMail, mailLayout } from "@/lib/mail";

export const RESET_TTL_MIN = 60;
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const brandOf = (org: { name: string; brandName: string | null }) => org.brandName || org.name;

/** Crea (o renueva) el enlace para restablecer la contraseña. Solo se guarda el hash. */
export async function createResetLink(userId: string, origin: string) {
  const token = randomBytes(32).toString("base64url");
  await db.user.update({ where: { id: userId }, data: { resetTokenHash: hashToken(token), resetExpires: new Date(Date.now() + RESET_TTL_MIN * 60000) } });
  return `${origin}/reset/${token}`;
}

export async function sendResetMail(user: { id: string; email: string; name: string; org: { name: string; brandName: string | null } }, origin: string) {
  const url = await createResetLink(user.id, origin);
  const m = mailLayout({ brand: brandOf(user.org), title: "Cambiá tu contraseña", body: `Hola ${user.name.split(" ")[0]}, recibimos un pedido para cambiar tu contraseña. El enlace vale por ${RESET_TTL_MIN} minutos.`, cta: "Elegir contraseña nueva", url });
  return sendMail({ to: user.email, subject: "Cambiá tu contraseña", ...m });
}

export async function sendInviteMail(user: { email: string; name: string; role: string; inviteToken: string | null; org: { name: string; brandName: string | null } }, origin: string) {
  if (!user.inviteToken) return { sent: false as const };
  const brand = brandOf(user.org);
  const url = `${origin}/invite/${user.inviteToken}`;
  const m = mailLayout({ brand, title: `Te sumaron a ${brand}`, body: `Hola ${user.name.split(" ")[0]}, te invitaron como ${user.role === "ATHLETE" ? "deportista" : "entrenador"}. Elegí tu contraseña para entrar y ver tus entrenamientos.`, cta: "Activar mi cuenta", url });
  return sendMail({ to: user.email, subject: `Te sumaron a ${brand}`, ...m });
}

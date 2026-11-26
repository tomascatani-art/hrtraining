"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/access";
import { putFile, removeFile } from "@/lib/storage";
import { encryptSecret } from "@/lib/secret";
import { normalizeHex, contrastWithBlack, MIN_CONTRAST, DEFAULT_ACCENT, isAllowedAccent } from "@/lib/brand";

async function _updateProfile(fd: FormData) {
  const u = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Nombre inválido");
  await db.user.update({ where: { id: u.id }, data: { name } });
  revalidatePath("/app", "layout");
}

async function _changePassword(fd: FormData) {
  const u = await requireUser();
  const cur = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? "");
  if (next.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres");
  if (!u.passwordHash || !(await verifyPassword(cur, u.passwordHash))) throw new Error("La contraseña actual no es correcta");
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(u, "EDITAR", "Usuario", "Cambio de contraseña", u.id);
  revalidatePath("/app/settings");
}

async function _updateOrg(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const name = String(fd.get("org") ?? "").trim();
  if (name.length < 2) throw new Error("Nombre inválido");
  const whatsapp = String(fd.get("whatsapp") ?? "").replace(/\D/g, "") || null;
  let payLink: string | null = String(fd.get("payLink") ?? "").trim() || null;
  if (payLink && !/^https?:\/\//i.test(payLink)) payLink = `https://${payLink}`;
  if (payLink) { try { new URL(payLink); } catch { throw new Error("El link de pago no es válido"); } }
  const feeAmount = String(fd.get("feeAmount") ?? "").trim() ? Number(String(fd.get("feeAmount")).replace(",", ".")) : null;
  const feeDueDay = Math.min(28, Math.max(1, Number(fd.get("feeDueDay") ?? 10) || 10));
  const mpIn = String(fd.get("mpToken") ?? "").trim();
  if (mpIn && !/^(APP_USR|TEST)-[\w-]{20,}$/.test(mpIn)) throw new Error("El Access Token de Mercado Pago empieza con APP_USR- (o TEST- para pruebas)");
  const mp = fd.get("mpRemove") === "1" ? { mpToken: null } : mpIn ? { mpToken: encryptSecret(mpIn) } : {};
  await db.organization.update({ where: { id: u.orgId }, data: { name, whatsapp, payLink, feeAmount: feeAmount != null && feeAmount >= 0 ? feeAmount : null, feeDueDay, ...mp } });
  await audit(u, "EDITAR", "Organización", `Nuevo nombre: ${name}`);
  revalidatePath("/app", "layout");
}

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Marca propia: nombre visible, enlace de ingreso, color de acento y logo. */
async function _updateBrand(fd: FormData) {
  const u = await requireUser(["ADMIN"]);
  const org = await db.organization.findUniqueOrThrow({ where: { id: u.orgId } });
  const brandName = String(fd.get("brandName") ?? "").trim().slice(0, 60) || null;
  const rawSlug = String(fd.get("slug") ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const slug = rawSlug.length >= 3 ? rawSlug : null;
  if (slug && (await db.organization.count({ where: { slug, id: { not: org.id } } }))) throw new Error("Ese enlace ya lo usa otra cuenta. Probá con otro.");
  const colorIn = String(fd.get("brandColor") ?? "").trim();
  let brandColor: string | null = null;
  if (colorIn) {
    const hex = normalizeHex(colorIn);
    if (!hex) throw new Error("Color inválido");
    if (!isAllowedAccent(hex) || contrastWithBlack(hex) < MIN_CONTRAST) throw new Error("El acento puede ser amarillo o blanco.");
    brandColor = hex.toLowerCase() === DEFAULT_ACCENT ? null : hex;
  }
  const data: Record<string, unknown> = { brandName, slug, brandColor };
  const file = fd.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!LOGO_TYPES.includes(file.type)) throw new Error("El logo tiene que ser PNG, JPG o WebP");
    if (file.size > 2 * 1024 * 1024) throw new Error("El logo supera los 2 MB");
    data.logoKey = await putFile(Buffer.from(await file.arrayBuffer()), file.name);
    data.logoMime = file.type;
  }
  if (fd.get("removeLogo") === "1") { data.logoKey = null; data.logoMime = null; }
  await db.organization.update({ where: { id: org.id }, data });
  if (org.logoKey && "logoKey" in data) await removeFile(org.logoKey);
  await audit(u, "EDITAR", "Organización", "Marca actualizada");
  revalidatePath("/app", "layout");
  if (slug) revalidatePath(`/c/${slug}`);
}

export async function hideSetupGuide() {
  const u = await requireUser(["COACH", "ADMIN"]);
  await db.organization.update({ where: { id: u.orgId }, data: { setupHidden: true } });
  revalidatePath("/app");
}

export async function updateProfile(fd: FormData) { return runAction("updateProfile", _updateProfile, fd); }
export async function changePassword(fd: FormData) { return runAction("changePassword", _changePassword, fd); }
export async function updateOrg(fd: FormData) { return runAction("updateOrg", _updateOrg, fd); }
export async function updateBrand(fd: FormData) { return runAction("updateBrand", _updateBrand, fd); }

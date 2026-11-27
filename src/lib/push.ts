import "server-only";
import { createECDH, createHmac } from "crypto";
import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Claves VAPID para las notificaciones del celular. Se derivan de AUTH_SECRET (que ya está en Vercel),
 * así no hace falta cargar otra clave secreta en ningún lado.
 */
let keys: { publicKey: string; privateKey: string } | null = null;
export function vapidKeys() {
  if (keys) return keys;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  for (let i = 0; i < 16; i++) {
    const priv = createHmac("sha256", secret).update(`hrtraining-vapid-${i}`).digest();
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(priv);
      keys = { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: priv.toString("base64url") };
      return keys;
    } catch { /* clave fuera de rango: probar la siguiente */ }
  }
  return null;
}

/** Manda una notificación al celular de cada usuario que la activó. Nunca rompe la acción que la dispara. */
export async function pushTo(userIds: string[], n: { title: string; body?: string; link?: string }) {
  const k = vapidKeys();
  if (!k || !userIds.length) return;
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (!subs.length) return;
  const origin = process.env.APP_URL || "https://hrtraining.app";
  webpush.setVapidDetails(origin.startsWith("http") ? origin : `https://${origin}`, k.publicKey, k.privateKey);
  const payload = JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/app/notifications" });
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // El celular dio de baja el permiso: se borra la suscripción
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    }
  }));
}

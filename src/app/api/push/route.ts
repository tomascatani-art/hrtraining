import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { vapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Clave pública para que el navegador pueda suscribirse. */
export async function GET() {
  const k = vapidKeys();
  return Response.json({ key: k?.publicKey ?? null });
}

/** Guarda (o borra, con DELETE) la suscripción del celular del usuario. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return new Response("No autorizado", { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = String(b?.endpoint ?? ""), p256dh = String(b?.keys?.p256dh ?? ""), auth = String(b?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth || endpoint.length > 1000) return new Response("Suscripción inválida", { status: 400 });
  await db.pushSubscription.upsert({ where: { endpoint }, create: { userId: u.id, endpoint, p256dh, auth }, update: { userId: u.id, p256dh, auth } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const u = await currentUser();
  if (!u) return new Response("No autorizado", { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (b?.endpoint) await db.pushSubscription.deleteMany({ where: { endpoint: String(b.endpoint), userId: u.id } });
  return Response.json({ ok: true });
}

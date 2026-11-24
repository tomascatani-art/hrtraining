import "server-only";
import { headers } from "next/headers";

/** URL pública de la app: APP_URL si está configurada, si no la del pedido actual. */
export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

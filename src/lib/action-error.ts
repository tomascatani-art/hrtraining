import "server-only";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

/**
 * En producción Next esconde el texto de los errores ("An error occurred in the Server Components render…").
 * Esto convierte el error en un aviso claro: vuelve a la misma pantalla con ?error=… y la app lo muestra arriba.
 */
export function friendlyMessage(e: unknown): string {
  const err = e as { name?: string; code?: string; message?: string; issues?: { message: string }[] };
  if (err?.issues?.length) return err.issues[0].message;
  if (err?.code === "P2002") return "Ya existe un registro con ese dato (por ejemplo, ese email ya está en uso).";
  if (err?.name?.startsWith("Prisma") || /prisma|invocation/i.test(err?.message ?? "")) return "No se pudo guardar. Probá de nuevo en unos segundos.";
  return err?.message?.slice(0, 200) || "No se pudo completar la acción.";
}

export async function runAction<A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>, ...args: A): Promise<R> {
  try {
    return await fn(...args);
  } catch (e) {
    unstable_rethrow(e);
    console.error(`[accion ${name}]`, e);
    const msg = friendlyMessage(e);
    const ref = (await headers()).get("referer");
    let back = "/app";
    try { if (ref) { const u = new URL(ref); u.searchParams.delete("error"); u.searchParams.set("error", msg); back = u.pathname + u.search; } } catch {}
    if (back === "/app") back = `/app?error=${encodeURIComponent(msg)}`;
    redirect(back);
  }
}

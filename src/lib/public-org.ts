import "server-only";
import { db } from "@/lib/db";

/** El club de una página pública: por su enlace propio (/c/<slug>) o, si no lo cargó, por su id. */
export async function publicOrg(ref: string) {
  if (!/^[a-z0-9-]{2,40}$/i.test(ref)) return null;
  return (await db.organization.findUnique({ where: { slug: ref } })) ?? (await db.organization.findUnique({ where: { id: ref } }));
}

export const planesPath = (org: { id: string; slug: string | null }) => `/c/${org.slug || org.id}/planes`;

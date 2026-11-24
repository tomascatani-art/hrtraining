import { Readable } from "stream";
import { db } from "@/lib/db";
import { fileSize, fileStream, remoteStorage, signedReadUrl } from "@/lib/storage";

// Logo del club: público a propósito (se muestra en la pantalla de ingreso del club).
export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { logoKey: true, logoMime: true } });
  if (!org?.logoKey || !org.logoMime) return new Response("No encontrado", { status: 404 });
  if (remoteStorage()) {
    const url = await signedReadUrl(org.logoKey, { expiresIn: 7 * 86400 });
    if (!url) return new Response("No encontrado", { status: 404 });
    return Response.redirect(url, 302);
  }
  const size = await fileSize(org.logoKey);
  if (size == null) return new Response("No encontrado", { status: 404 });
  return new Response(Readable.toWeb(fileStream(org.logoKey)) as ReadableStream, {
    headers: { "Content-Type": org.logoMime, "Content-Length": String(size), "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}

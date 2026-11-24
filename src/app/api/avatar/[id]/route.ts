import { NextResponse } from "next/server";
import { Readable } from "stream";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileSize, fileStream, remoteStorage, signedReadUrl } from "@/lib/storage";

// Foto de perfil: la ven solo usuarios de la misma organización.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new NextResponse("No autorizado", { status: 401 });
  const { id } = await params;
  const t = await db.user.findUnique({ where: { id }, select: { orgId: true, avatarKey: true } });
  if (!t?.avatarKey || t.orgId !== u.orgId) return new NextResponse("No encontrado", { status: 404 });
  if (remoteStorage()) {
    const url = await signedReadUrl(t.avatarKey, { expiresIn: 86400 });
    if (!url) return new NextResponse("No encontrado", { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=3600" } });
  }
  const size = await fileSize(t.avatarKey);
  if (size == null) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(Readable.toWeb(fileStream(t.avatarKey)) as ReadableStream, { headers: { "Content-Type": "image/jpeg", "Content-Length": String(size), "Cache-Control": "private, max-age=86400" } });
}

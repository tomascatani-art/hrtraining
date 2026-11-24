import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { newKey, remoteStorage, signedUploadUrl } from "@/lib/storage";
import { checkUpload, uploadTicket } from "@/lib/upload";

// Paso 1 de la subida directa: valida y devuelve un enlace temporal para subir el archivo a Supabase.
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!remoteStorage()) return NextResponse.json({ direct: false });
  const c = await checkUpload(u, await req.json().catch(() => ({})));
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  const key = newKey(c.meta.name);
  return NextResponse.json({ direct: true, uploadUrl: await signedUploadUrl(key), ticket: await uploadTicket(u, c.meta, key) });
}

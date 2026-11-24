import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { fileSize } from "@/lib/storage";
import { readTicket, registerUpload } from "@/lib/upload";

// Paso 2 de la subida directa: confirma que el archivo llegó a Supabase y lo registra.
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { ticket } = await req.json().catch(() => ({ ticket: "" }));
  const t = await readTicket(u, String(ticket)).catch(() => null);
  if (!t) return NextResponse.json({ error: "La subida venció. Probá de nuevo." }, { status: 400 });
  const size = await fileSize(t.key);
  if (size == null) return NextResponse.json({ error: "El archivo no llegó a guardarse. Probá de nuevo." }, { status: 400 });
  return NextResponse.json(await registerUpload(u, t.meta, t.key, size || t.meta.size));
}

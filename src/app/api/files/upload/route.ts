import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { putFile } from "@/lib/storage";
import { checkUpload, registerUpload } from "@/lib/upload";

// Subida a través del servidor (disco local). En Vercel + Supabase se usa /api/files/prepare + subida directa.
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  const c = await checkUpload(u, { name: file.name, type: file.type, size: file.size, athleteId: fd.get("athleteId"), folder: fd.get("folder"), note: fd.get("note"), shared: fd.get("shared") });
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  const key = await putFile(Buffer.from(await file.arrayBuffer()), file.name, file.type);
  return NextResponse.json(await registerUpload(u, c.meta, key, file.size));
}

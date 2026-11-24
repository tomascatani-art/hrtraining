import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete, audit, notify } from "@/lib/access";
import { putFile, kindOf, MAX_UPLOAD } from "@/lib/storage";
import { PROFILE_FOLDERS } from "@/lib/catalog";

const ALLOWED = /^(video\/|image\/|application\/pdf|application\/vnd\.|application\/msword|text\/plain|text\/csv)/;

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "El archivo supera los 300 MB" }, { status: 413 });
  if (!ALLOWED.test(file.type)) return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 415 });
  let athleteId = (fd.get("athleteId") as string) || null;
  if (u.role === "ATHLETE") athleteId = u.id;
  else if (athleteId && !(await canSeeAthlete(u, athleteId))) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const rawFolder = String(fd.get("folder") ?? "");
  const folder = athleteId && PROFILE_FOLDERS.some((f) => f.key === rawFolder) ? rawFolder : null;
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  const key = await putFile(Buffer.from(await file.arrayBuffer()), file.name);
  const asset = await db.fileAsset.create({
    data: { orgId: u.orgId, ownerId: u.id, athleteId, name: file.name.slice(0, 200), mime: file.type, size: file.size, storageKey: key, kind: kindOf(file.type), folder, note, shared: !folder && u.role !== "ATHLETE" && fd.get("shared") === "true" },
  });
  await audit(u, "CREAR", "Archivo", file.name, asset.id);
  if (u.role === "ATHLETE" && u.athleteProfile?.coachId) {
    await notify([u.athleteProfile.coachId], { kind: asset.kind === "VIDEO" ? "VIDEO" : "MENSAJE", title: `${u.name} subió ${asset.kind === "VIDEO" ? "un video" : "un archivo"}`, body: file.name, link: folder ? `/app/athletes/${u.id}?tab=carpeta` : asset.kind === "VIDEO" ? `/app/videos?file=${asset.id}` : "/app/files" });
  }
  return NextResponse.json({ id: asset.id, name: asset.name, kind: asset.kind });
}

import { NextResponse } from "next/server";
import { Readable } from "stream";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessFile, fileStat, fileStream } from "@/lib/storage";

// Descarga con soporte de Range (necesario para adelantar/retroceder videos)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new NextResponse("No autorizado", { status: 401 });
  const { id } = await params;
  const f = await db.fileAsset.findUnique({ where: { id } });
  if (!f || !(await canAccessFile(u, f))) return new NextResponse("No encontrado", { status: 404 });
  const st = await fileStat(f.storageKey).catch(() => null);
  if (!st) return new NextResponse("Archivo no disponible", { status: 410 });
  const size = st.size;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const baseHeaders: Record<string, string> = {
    "Content-Type": f.mime, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    "X-Content-Type-Options": "nosniff",
  };
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m?.[1] ? parseInt(m[1]) : 0;
    let end = m?.[2] ? parseInt(m[2]) : size - 1;
    if (!m?.[1] && m?.[2]) { start = size - parseInt(m[2]); end = size - 1; }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(fileStream(f.storageKey, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(fileStream(f.storageKey)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...baseHeaders, "Content-Length": String(size) } });
}

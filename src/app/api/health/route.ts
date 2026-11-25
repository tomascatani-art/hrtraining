import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Se usa para mantener la app "despierta" y para medir velocidad: cuánto tarda la base y si la función arrancó en frío.
const bootedAt = Date.now();
let hits = 0;

export async function GET() {
  hits++;
  const t = Date.now();
  await db.$queryRaw`SELECT 1`;
  const dbMs = Date.now() - t;
  const t2 = Date.now();
  await db.$queryRaw`SELECT 1`;
  return Response.json({
    ok: true,
    region: process.env.VERCEL_REGION ?? "local",
    primeraConsultaMs: dbMs,
    consultaMs: Date.now() - t2,
    arranqueEnFrio: hits === 1,
    despiertaHaceSeg: Math.round((Date.now() - bootedAt) / 1000),
  }, { headers: { "Cache-Control": "no-store" } });
}

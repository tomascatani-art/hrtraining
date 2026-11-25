import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { withVideos } from "@/lib/routine-server";
import { routinePdf } from "@/lib/routine-pdf";
import { currentWeek } from "@/lib/routine";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Ingresá a tu cuenta" }, { status: 401 });
  const { id } = await params;
  const r = await db.routine.findUnique({ where: { id }, include: { athlete: { select: { name: true } }, coach: { select: { name: true } }, org: { select: { name: true, brandName: true } } } });
  const ok = r && r.orgId === u.orgId && (u.role === "ATHLETE" ? r.athleteId === u.id : !r.athleteId || (await canSeeAthlete(u, r.athleteId)));
  if (!r || !ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const data = await withVideos(u.orgId, r.data);
  const only = new URL(req.url).searchParams.get("semana");
  const week = only === "actual" ? currentWeek(data) : null;
  const bytes = await routinePdf({ club: r.org.brandName || r.org.name, athlete: r.athlete?.name, coach: r.coach?.name, name: r.name, data, week });
  const file = `${r.name}${r.athlete ? ` - ${r.athlete.name}` : ""}`.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 80) || "rutina";
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(file)}.pdf"; filename*=UTF-8''${encodeURIComponent(file)}.pdf`, "Cache-Control": "private, no-store" } });
}

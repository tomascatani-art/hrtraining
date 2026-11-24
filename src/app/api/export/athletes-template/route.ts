import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { templateWorkbook } from "@/lib/import-athletes";

export async function GET() {
  const u = await currentUser();
  if (!u || u.role === "ATHLETE") return new NextResponse("No autorizado", { status: 401 });
  const buf = await templateWorkbook();
  return new NextResponse(buf as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="plantilla-deportistas-hrtraining.xlsx"' } });
}

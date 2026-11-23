import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { TEST_MAP, TEST_CATEGORIES } from "@/lib/catalog";

// Exportación compatible con Excel (CSV con BOM UTF-8 y separador ;)
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return new NextResponse("No autorizado", { status: 401 });
  const url = new URL(req.url);
  let ids = await visibleAthleteIds(u);
  const only = url.searchParams.get("athlete");
  if (only) ids = ids.filter((i) => i === only);
  const evals = await db.evaluation.findMany({ where: { athleteId: { in: ids } }, include: { athlete: true }, orderBy: [{ athleteId: "asc" }, { testKey: "asc" }, { date: "asc" }] });
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [["Deportista", "Email", "Fecha", "Categoría", "Test", "Valor", "Unidad", "Notas", "Demo"].join(";")];
  for (const e of evals) {
    const t = TEST_MAP[e.testKey];
    lines.push([e.athlete.name, e.athlete.email, e.date.toISOString().slice(0, 10), t ? TEST_CATEGORIES[t.category] : "", t?.name ?? e.testKey, String(e.value).replace(".", ","), e.unit, e.notes ?? "", e.isDemo ? "DEMO" : ""].map(esc).join(";"));
  }
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="evaluaciones-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}

"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/access";
import { readSheet, toRows, type ImportRow } from "@/lib/import-athletes";
import { sendInviteMail } from "@/lib/account-mail";
import { appOrigin } from "@/lib/origin";
import { parseDay } from "@/lib/metrics";

export type PreviewState = { rows?: ImportRow[]; missing?: string[]; fileName?: string; error?: string } | undefined;

export async function previewImport(_: PreviewState, fd: FormData): Promise<PreviewState> {
  await requireUser(["COACH", "ADMIN"]);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Elegí un archivo" };
  if (file.size > 5 * 1024 * 1024) return { error: "El archivo supera los 5 MB" };
  if (!/\.(xlsx|csv|txt)$/i.test(file.name)) return { error: "Subí un Excel (.xlsx) o un CSV" };
  let table: string[][];
  try { table = await readSheet(Buffer.from(await file.arrayBuffer()), file.name); } catch { return { error: "No se pudo leer el archivo. Guardalo como .xlsx o .csv y probá de nuevo." }; }
  const emails = new Set((await db.user.findMany({ select: { email: true } })).map((x) => x.email.toLowerCase()));
  const { rows, missing } = toRows(table, emails);
  if (missing.length) return { missing, fileName: file.name };
  if (!rows.length) return { error: "La planilla no tiene filas con alumnos", fileName: file.name };
  return { rows, fileName: file.name };
}

export type CommitState = { created?: number; mailed?: number; groups?: string[]; error?: string } | undefined;

export async function commitImport(_: CommitState, fd: FormData): Promise<CommitState> {
  const u = await requireUser(["COACH", "ADMIN"]);
  let rows: ImportRow[];
  try { rows = JSON.parse(String(fd.get("rows") ?? "[]")); } catch { return { error: "Datos inválidos" }; }
  const sendMail = fd.get("sendMail") === "1";
  const existing = new Set((await db.user.findMany({ where: { email: { in: rows.map((r) => String(r.email).toLowerCase()) } }, select: { email: true } })).map((x) => x.email));
  const valid = rows.filter((r) => typeof r.name === "string" && r.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.email)) && !existing.has(String(r.email).toLowerCase()) && !r.errors?.length).slice(0, 500);
  if (!valid.length) return { error: "No hay filas válidas para importar" };
  const groups = new Map((await db.group.findMany({ where: { orgId: u.orgId } })).map((g) => [g.name.trim().toLowerCase(), g]));
  const newGroups: string[] = [];
  const origin = await appOrigin();
  let created = 0, mailed = 0;
  for (const r of valid) {
    let groupId: string | undefined;
    if (r.group) {
      const key = r.group.trim().toLowerCase();
      let g = groups.get(key);
      if (!g) { g = await db.group.create({ data: { orgId: u.orgId, coachId: u.id, name: r.group.trim().slice(0, 80), sport: r.sport } }); groups.set(key, g); newGroups.push(g.name); }
      groupId = g.id;
    }
    const athlete = await db.user.create({
      data: {
        orgId: u.orgId, name: r.name.trim().slice(0, 120), email: String(r.email).toLowerCase(), role: "ATHLETE", inviteToken: randomBytes(24).toString("base64url"),
        athleteProfile: { create: { coachId: u.id, sport: r.sport, position: r.position?.slice(0, 80) ?? null, sex: r.sex, heightCm: r.heightCm, weightKg: r.weightKg, feeAmount: r.fee, birthDate: r.birthDate ? parseDay(r.birthDate, 12) : null } },
        ...(groupId ? { memberships: { create: { groupId } } } : {}),
      },
    });
    created++;
    if (sendMail && (await sendInviteMail({ ...athlete, org: u.org }, origin)).sent) mailed++;
  }
  await audit(u, "CREAR", "Alumno", `Importación de ${created} alumnos desde planilla`);
  revalidatePath("/app/athletes");
  revalidatePath("/app/groups");
  revalidatePath("/app");
  return { created, mailed, groups: newGroups };
}

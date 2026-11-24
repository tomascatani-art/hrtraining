"use server";
import { parseDay } from "@/lib/metrics";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";
import { SPORT_TEMPLATES, MICRO_TYPES } from "@/lib/catalog";

const DAY = 86_400_000;

async function ownPlan(u: SessionUser, id: string) {
  const p = await db.plan.findUnique({ where: { id } });
  if (!p || p.orgId !== u.orgId || (u.role === "COACH" && p.coachId !== u.id)) throw new Error("Sin permiso sobre esta planificación");
  return p;
}

/** Estructura sugerida de mesociclos (proporciones clásicas de periodización por bloques). */
function suggestedStructure(weeks: number, sport: string) {
  const t = SPORT_TEMPLATES[sport] ?? SPORT_TEMPLATES.GENERAL;
  const spec = [
    { name: "Acumulación — base general", phase: "PREP_GENERAL", share: 0.3, caps: ["HIPERTROFIA", "RESISTENCIA_AEROBICA", "MOVILIDAD", "ESTABILIDAD"], vol: 8, int: 4 },
    { name: "Transformación — específico", phase: "PREP_ESPECIFICO", share: 0.25, caps: ["FUERZA_MAXIMA", ...t.focus.slice(0, 2)], vol: 7, int: 7 },
    { name: "Realización — precompetitivo", phase: "PRECOMPETITIVO", share: 0.15, caps: ["POTENCIA", ...t.focus.slice(0, 2)], vol: 5, int: 8 },
    { name: "Competitivo", phase: "COMPETITIVO", share: 0.2, caps: t.focus.slice(0, 3), vol: 4, int: 9 },
    { name: "Puesta a punto", phase: "PUESTA_A_PUNTO", share: 0.05, caps: t.focus.slice(0, 2), vol: 3, int: 9 },
    { name: "Transición", phase: "TRANSICION", share: 0.05, caps: ["MOVILIDAD", "RESISTENCIA_AEROBICA"], vol: 2, int: 2 },
  ];
  let left = weeks;
  return spec.map((s, i) => {
    const w = i === spec.length - 1 ? left : Math.max(1, Math.round(weeks * s.share));
    left -= w;
    return { ...s, caps: [...new Set(s.caps)], weeks: Math.max(1, w) };
  }).filter((s) => s.weeks > 0 && left >= -spec.length);
}

async function buildMicros(planId: string, meso: { id: string; startDate: Date; endDate: Date; phase: string; capacities: string[]; plannedVolume: number; plannedIntensity: number }, startWeekNo: number) {
  const weeks = Math.max(1, Math.round((+meso.endDate - +meso.startDate) / (7 * DAY)));
  for (let w = 0; w < weeks; w++) {
    const s = new Date(+meso.startDate + w * 7 * DAY);
    const type = meso.phase === "TRANSICION" ? "RECUPERACION" : meso.phase === "PUESTA_A_PUNTO" ? (w === weeks - 1 ? "ACTIVACION" : "CARGA") : meso.phase === "COMPETITIVO" ? (w % 2 ? "COMPETENCIA" : "CARGA") : (w + 1) % 4 === 0 ? "RECUPERACION" : w === weeks - 2 && weeks >= 3 ? "CHOQUE" : "CARGA";
    const f = MICRO_TYPES[type].factor;
    await db.planBlock.create({
      data: {
        planId, parentId: meso.id, level: "MICRO", name: `Semana ${startWeekNo + w}`, phase: meso.phase, microType: type, startDate: s, endDate: new Date(+s + 7 * DAY),
        capacities: meso.capacities, plannedVolume: Math.max(1, Math.min(10, Math.round(meso.plannedVolume * f))),
        plannedIntensity: Math.max(1, Math.min(10, meso.plannedIntensity + (type === "CHOQUE" ? 1 : type === "RECUPERACION" ? -2 : 0))),
        plannedLoad: Math.round(meso.plannedVolume * f * 190),
      },
    });
  }
  return weeks;
}

export async function createPlan(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const target = String(fd.get("target") ?? "");
  const [kind, targetId] = target.split(":");
  if (kind === "a") await assertAthlete(u, targetId);
  if (kind === "g") {
    const g = await db.group.findUnique({ where: { id: targetId } });
    if (!g || g.orgId !== u.orgId) throw new Error("Grupo inválido");
  }
  const start = parseDay(String(fd.get("startDate")));
  const end = parseDay(String(fd.get("endDate")));
  if (!(end > start)) throw new Error("La fecha de fin debe ser posterior al inicio");
  const sport = String(fd.get("sport") ?? "GENERAL");
  const plan = await db.plan.create({
    data: {
      orgId: u.orgId, coachId: u.id, name: String(fd.get("name") ?? "Planificación").trim(), sport, goal: String(fd.get("goal") ?? "") || null,
      startDate: start, endDate: end, athleteId: kind === "a" ? targetId : null, groupId: kind === "g" ? targetId : null,
    },
  });
  if (fd.get("auto") === "on") {
    const totalWeeks = Math.max(4, Math.round((+end - +start) / (7 * DAY)));
    const macro = await db.planBlock.create({ data: { planId: plan.id, level: "MACRO", name: "Macrociclo principal", phase: "PREP_GENERAL", startDate: start, endDate: end, capacities: [] } });
    let cursor = +start, weekNo = 1;
    for (const m of suggestedStructure(totalWeeks, sport)) {
      const mEnd = Math.min(+end, cursor + m.weeks * 7 * DAY);
      if (mEnd <= cursor) break;
      const meso = await db.planBlock.create({ data: { planId: plan.id, parentId: macro.id, level: "MESO", name: m.name, phase: m.phase, startDate: new Date(cursor), endDate: new Date(mEnd), capacities: m.caps, plannedVolume: m.vol, plannedIntensity: m.int } });
      weekNo += await buildMicros(plan.id, meso, weekNo);
      cursor = mEnd;
    }
  }
  await audit(u, "CREAR", "Planificación", plan.name, plan.id);
  redirect(`/app/planning/${plan.id}`);
}

export async function updatePlan(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const p = await ownPlan(u, String(fd.get("id")));
  await db.plan.update({ where: { id: p.id }, data: { name: String(fd.get("name") ?? p.name), goal: String(fd.get("goal") ?? "") || null, startDate: parseDay(String(fd.get("startDate"))), endDate: parseDay(String(fd.get("endDate"))) } });
  await audit(u, "EDITAR", "Planificación", p.name, p.id);
  revalidatePath(`/app/planning/${p.id}`);
}

export async function deletePlan(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const p = await ownPlan(u, String(fd.get("id")));
  await db.plan.delete({ where: { id: p.id } });
  await audit(u, "ELIMINAR", "Planificación", p.name, p.id);
  redirect("/app/planning");
}

export async function saveBlock(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const p = await ownPlan(u, String(fd.get("planId")));
  const id = String(fd.get("id") ?? "");
  const level = String(fd.get("level") ?? "MESO");
  const data = {
    name: String(fd.get("name") ?? "").trim() || "Bloque",
    level,
    parentId: String(fd.get("parentId") ?? "") || null,
    phase: String(fd.get("phase") ?? "PREP_GENERAL"),
    microType: level === "MICRO" ? String(fd.get("microType") ?? "CARGA") : null,
    startDate: parseDay(String(fd.get("startDate"))),
    endDate: parseDay(String(fd.get("endDate"))),
    capacities: fd.getAll("capacities").map(String),
    plannedVolume: Number(fd.get("plannedVolume") ?? 5),
    plannedIntensity: Number(fd.get("plannedIntensity") ?? 5),
    plannedLoad: fd.get("plannedLoad") ? Number(fd.get("plannedLoad")) : null,
    notes: String(fd.get("notes") ?? "") || null,
  };
  if (!(data.endDate > data.startDate)) throw new Error("La fecha de fin debe ser posterior al inicio");
  if (id) {
    const b = await db.planBlock.findUnique({ where: { id } });
    if (!b || b.planId !== p.id) throw new Error("Bloque inválido");
    await db.planBlock.update({ where: { id }, data });
  } else {
    const b = await db.planBlock.create({ data: { ...data, planId: p.id } });
    if (level === "MESO" && fd.get("autoMicros") === "on") {
      const prev = await db.planBlock.count({ where: { planId: p.id, level: "MICRO", startDate: { lt: b.startDate } } });
      await buildMicros(p.id, b, prev + 1);
    }
  }
  // Si el bloque cae fuera de la temporada, la temporada se amplía para incluirlo
  await db.plan.update({
    where: { id: p.id },
    data: {
      updatedAt: new Date(),
      ...(data.startDate < p.startDate ? { startDate: data.startDate } : {}),
      ...(data.endDate > p.endDate ? { endDate: data.endDate } : {}),
    },
  });
  await audit(u, id ? "EDITAR" : "CREAR", "Bloque de planificación", `${data.name} (${p.name})`, p.id);
  revalidatePath(`/app/planning/${p.id}`);
  redirect(`/app/planning/${p.id}`);
}

export async function deleteBlock(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const b = await db.planBlock.findUnique({ where: { id: String(fd.get("id")) } });
  if (!b) return;
  await ownPlan(u, b.planId);
  await db.planBlock.delete({ where: { id: b.id } });
  await audit(u, "ELIMINAR", "Bloque de planificación", b.name, b.planId);
  redirect(`/app/planning/${b.planId}`);
}

export async function sharePlan(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const p = await ownPlan(u, String(fd.get("id")));
  const ids = p.athleteId ? [p.athleteId] : p.groupId ? (await db.groupMember.findMany({ where: { groupId: p.groupId } })).map((m) => m.athleteId) : [];
  await notify(ids, { kind: "SESION", title: `Tu planificación "${p.name}" fue actualizada`, link: "/app/calendar" });
  revalidatePath(`/app/planning/${p.id}`);
}

/** Copia una planificación completa (estructura y, si se pide, sus sesiones con ejercicios) a otro deportista, corrida a una nueva fecha de inicio. */
export async function copyPlan(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const p = await ownPlan(u, String(fd.get("id")));
  const athleteId = String(fd.get("athleteId") ?? "");
  await assertAthlete(u, athleteId);
  const start = fd.get("startDate") ? parseDay(String(fd.get("startDate"))) : p.startDate;
  const shift = +start - +p.startDate;
  const move = (d: Date) => new Date(+d + shift);
  const target = await db.user.findUnique({ where: { id: athleteId }, select: { name: true } });
  const name = String(fd.get("name") ?? "").trim() || `${p.name} (${target?.name ?? "copia"})`;
  const copy = await db.plan.create({
    data: { orgId: u.orgId, coachId: u.id, athleteId, name, sport: p.sport, goal: p.goal, startDate: move(p.startDate), endDate: move(p.endDate) },
  });
  const blocks = await db.planBlock.findMany({ where: { planId: p.id } });
  const rank: Record<string, number> = { MACRO: 0, MESO: 1, MICRO: 2 };
  const ids = new Map<string, string>();
  for (const b of [...blocks].sort((a, c) => (rank[a.level] ?? 3) - (rank[c.level] ?? 3))) {
    const { id: oldId, planId: _p, parentId, startDate, endDate, ...rest } = b;
    const nb = await db.planBlock.create({ data: { ...rest, planId: copy.id, parentId: parentId ? ids.get(parentId) ?? null : null, startDate: move(startDate), endDate: move(endDate) } });
    ids.set(oldId, nb.id);
  }
  let sessions = 0;
  if (fd.get("withSessions") === "on") {
    const list = await db.session.findMany({ where: { planId: p.id }, include: { items: true } });
    for (const s of list) {
      await db.session.create({
        data: {
          orgId: u.orgId, coachId: u.id, athleteId, groupId: null, planId: copy.id, title: s.title, date: move(s.date), type: s.type, capacities: s.capacities,
          durationMin: s.durationMin, targetRpe: s.targetRpe, notes: s.notes,
          items: { create: s.items.map(({ id: _i, sessionId: _s, ...rest }) => rest) },
        },
      });
      sessions++;
    }
  }
  await audit(u, "CREAR", "Planificación", `Copia de ${p.name} para ${target?.name ?? ""}${sessions ? ` (${sessions} sesiones)` : ""}`, copy.id);
  redirect(`/app/planning/${copy.id}?copiada=${sessions}`);
}

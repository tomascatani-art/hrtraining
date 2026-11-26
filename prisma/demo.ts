// Generador de la organización de DEMOSTRACIÓN.
// Todos los registros llevan isDemo = true o pertenecen a una organización isDemo.
// Los nombres terminan en "Demo" para que nunca se confundan con personas reales.
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFile } from "fs/promises";
import { putBuffer } from "../src/lib/blob";
import path from "path";

/** Usuarios fáciles en vez de email (Diego 25-11-2026). Las contraseñas no van en el código: se cambian desde Ajustes. */
export const COACH_LOGIN = "hernan";
const OLD_COACH_LOGIN = "entrenador.demo@hrtraining.co";
export const ATHLETE_LOGIN = "alumna";
const OLD_ATHLETE_LOGIN = "deportista.demo@hrtraining.co";
import { LIBRARY } from "./library";
import EXTRA from "./library-extra.json";
import { categoryFromPattern } from "../src/lib/catalog";

const DAY = 86_400_000;
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const day0 = (offset: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + offset * DAY);
};
const at = (offset: number, h: number) => new Date(day0(offset).getTime() + h * 3600_000);

/** Carga la biblioteca base: la técnica completa (LIBRARY) y los nombres de las planillas (library-extra.json).
 *  Solo agrega lo que falta (por nombre); nunca pisa ni borra. Los videos quedan vacíos hasta que el club pegue su link. */
export async function ensureLibrary(db: PrismaClient) {
  const have = await db.exercise.findMany({ where: { orgId: null }, select: { id: true, name: true, category: true, pattern: true, videoUrl: true } });
  const key = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const names = new Set(have.map((e) => key(e.name)));
  // Ponerle categoría a los que no tienen y sacar las búsquedas de YouTube viejas (no son un video).
  for (const e of have) {
    const patch: { category?: string; videoUrl?: null } = {};
    if (!e.category) patch.category = categoryFromPattern(e.pattern);
    if (e.videoUrl && /youtube\.com\/results/.test(e.videoUrl)) patch.videoUrl = null;
    if (Object.keys(patch).length) await db.exercise.update({ where: { id: e.id }, data: patch });
  }
  const base = LIBRARY.filter((e) => !names.has(key(e.name))).map((e) => ({ ...e, orgId: null, category: categoryFromPattern(e.pattern) }));
  base.forEach((e) => names.add(key(e.name)));
  const extra = (EXTRA as [string, string, string, string, string[], string[]][])
    .filter(([n]) => !names.has(key(n)))
    .map(([name, category, pattern, primaryMuscle, capacities, equipment]) => ({
      orgId: null, name, category, pattern, primaryMuscle, muscles: [primaryMuscle], capacities, equipment,
      kineticChain: /CORE|MOVILIDAD/.test(pattern) ? "MIXTA" : "CERRADA", sports: [] as string[], difficulty: 2,
    }));
  if (base.length || extra.length) await db.exercise.createMany({ data: [...base, ...extra] });
  if (base.length || extra.length) console.log(`Biblioteca: +${base.length + extra.length} ejercicios`);
}

/** Bloque de la sesión según el ejercicio (para los datos de demostración). */
function blockFor(name: string, pct: number | null) {
  if (/sprint|cambio de direcci|escalera/i.test(name)) return "VELOCIDAD";
  if (/salto|drop|cargada|vallas/i.test(name)) return "POTENCIA";
  if (/plancha|pallof|dead bug/i.test(name)) return "CORE";
  if (pct || /sentadilla|peso muerto|press|hip thrust|dominadas|remo con barra/i.test(name)) return "FUERZA";
  return "ACCESORIO";
}

export async function deleteDemo(db: PrismaClient) {
  await db.organization.deleteMany({ where: { isDemo: true } });
}

export async function createDemo(db: PrismaClient) {
  await ensureLibrary(db);
  await deleteDemo(db);
  const r = rng(42);
  const hash = await bcrypt.hash("demo1234", 10);
  const org = await db.organization.create({ data: { slug: "club-demo", name: "Hrtraining", isDemo: true, feeAmount: 25000, feeDueDay: 10 } });

  const coach = await db.user.create({ data: { orgId: org.id, email: COACH_LOGIN, name: "Hernán", role: "ADMIN", passwordHash: hash, isDemo: true } });
  const coach2 = await db.user.create({ data: { orgId: org.id, email: "preparador.demo@hrtraining.co", name: "Joaquín", role: "COACH", passwordHash: hash, isDemo: true } });

  const athletesSpec = [
    { name: "Sofía", sport: "ATLETISMO", pos: "Velocista 100/200 m", sex: "F", h: 168, w: 58, email: ATHLETE_LOGIN, lvl: "Avanzado", base: { cmj: 38, sq: 95, spr10: 1.85, spr30: 4.25 } },
    { name: "Tomás", sport: "ATLETISMO", pos: "Saltador de longitud", sex: "M", h: 182, w: 74, lvl: "Élite", base: { cmj: 52, sq: 150, spr10: 1.7, spr30: 3.95 } },
    { name: "Camila", sport: "ATLETISMO", pos: "Vallista 100 m", sex: "F", h: 171, w: 60, lvl: "Avanzado", base: { cmj: 40, sq: 100, spr10: 1.83, spr30: 4.2 } },
    { name: "Mateo", sport: "FUTBOL", pos: "Mediocampista", sex: "M", h: 176, w: 70, lvl: "Intermedio", base: { cmj: 42, sq: 120, spr10: 1.78, spr30: 4.15 } },
    { name: "Lucas", sport: "FUTBOL", pos: "Defensor central", sex: "M", h: 186, w: 80, lvl: "Intermedio", base: { cmj: 40, sq: 135, spr10: 1.82, spr30: 4.25 } },
    { name: "Benjamín", sport: "FUTBOL", pos: "Delantero", sex: "M", h: 178, w: 72, lvl: "Avanzado", base: { cmj: 46, sq: 125, spr10: 1.72, spr30: 4.05 } },
    { name: "Julieta", sport: "NATACION", pos: "Fondista 400/800 m", sex: "F", h: 172, w: 61, lvl: "Avanzado", base: { cmj: 33, sq: 80, spr10: 2.0, spr30: 4.7 } },
    { name: "Nicolás", sport: "NATACION", pos: "Medio fondo 200 m", sex: "M", h: 188, w: 79, lvl: "Avanzado", base: { cmj: 41, sq: 115, spr10: 1.9, spr30: 4.45 } },
    { name: "Valentina", sport: "GENERAL", pos: "Fuerza e hipertrofia", sex: "F", h: 164, w: 63, lvl: "Intermedio", base: { cmj: 28, sq: 85, spr10: 2.05, spr30: 4.9 } },
  ];

  const athletes = [];
  for (const [i, a] of athletesSpec.entries()) {
    const u = await db.user.create({
      data: {
        orgId: org.id, email: a.email ?? `atleta${i + 1}.demo@hrtraining.co`, name: a.name, role: "ATHLETE", passwordHash: hash, isDemo: true,
        athleteProfile: { create: { coachId: i < 6 ? coach.id : coach2.id, sport: a.sport, position: a.pos, sex: a.sex, heightCm: a.h, weightKg: a.w, level: a.lvl, birthDate: new Date(2001 + (i % 6), i % 12, 10 + i), objective: a.sport === "GENERAL" ? "Ganar masa muscular y fuerza" : "Mejorar rendimiento competitivo de temporada" } },
      },
    });
    athletes.push({ ...a, id: u.id });
  }

  const gVel = await db.group.create({ data: { orgId: org.id, coachId: coach.id, name: "Velocidad y saltos", sport: "ATLETISMO", color: "#ffd60a", description: "Grupo de pista ", isDemo: true, members: { create: athletes.filter((a) => a.sport === "ATLETISMO").map((a) => ({ athleteId: a.id })) } } });
  const gFut = await db.group.create({ data: { orgId: org.id, coachId: coach.id, name: "Fútbol Primera", sport: "FUTBOL", color: "#3a8fd6", description: "Plantel ", isDemo: true, members: { create: athletes.filter((a) => a.sport === "FUTBOL").map((a) => ({ athleteId: a.id })) } } });
  const gNat = await db.group.create({ data: { orgId: org.id, coachId: coach2.id, name: "Natación fondo", sport: "NATACION", color: "#8f78e0", description: "Fuerza en seco ", isDemo: true, members: { create: athletes.filter((a) => a.sport === "NATACION").map((a) => ({ athleteId: a.id })) } } });

  // ---- Planificación anual del grupo de velocidad ----
  const pStart = day0(-70);
  const plan = await db.plan.create({ data: { orgId: org.id, coachId: coach.id, groupId: gVel.id, name: "Temporada de pista 2026/27", sport: "ATLETISMO", goal: "Pico de forma para el campeonato nacional", startDate: pStart, endDate: day0(-70 + 7 * 40), isDemo: true } });
  const mesoSpec = [
    { name: "Base general", phase: "PREP_GENERAL", weeks: 6, caps: ["HIPERTROFIA", "RESISTENCIA_AEROBICA", "MOVILIDAD"], vol: 8, int: 4 },
    { name: "Fuerza máxima", phase: "PREP_ESPECIFICO", weeks: 6, caps: ["FUERZA_MAXIMA", "VELOCIDAD"], vol: 7, int: 7 },
    { name: "Conversión a potencia", phase: "PRECOMPETITIVO", weeks: 5, caps: ["POTENCIA", "FUERZA_EXPLOSIVA", "VELOCIDAD"], vol: 5, int: 8 },
    { name: "Competencias regionales", phase: "COMPETITIVO", weeks: 8, caps: ["VELOCIDAD", "POTENCIA"], vol: 4, int: 9 },
    { name: "Bloque de recarga", phase: "PREP_ESPECIFICO", weeks: 5, caps: ["FUERZA_MAXIMA", "FUERZA_EXPLOSIVA"], vol: 6, int: 7 },
    { name: "Puesta a punto nacional", phase: "PUESTA_A_PUNTO", weeks: 3, caps: ["VELOCIDAD", "POTENCIA"], vol: 3, int: 9 },
    { name: "Campeonato", phase: "COMPETITIVO", weeks: 2, caps: ["VELOCIDAD"], vol: 2, int: 10 },
    { name: "Transición", phase: "TRANSICION", weeks: 5, caps: ["MOVILIDAD", "RESISTENCIA_AEROBICA"], vol: 3, int: 2 },
  ];
  const macroA = await db.planBlock.create({ data: { planId: plan.id, level: "MACRO", name: "Macrociclo I — Temporada corta", phase: "PREP_GENERAL", startDate: pStart, endDate: new Date(pStart.getTime() + 25 * 7 * DAY), capacities: [] } });
  const macroB = await db.planBlock.create({ data: { planId: plan.id, level: "MACRO", name: "Macrociclo II — Nacional", phase: "PREP_ESPECIFICO", startDate: new Date(pStart.getTime() + 25 * 7 * DAY), endDate: new Date(pStart.getTime() + 40 * 7 * DAY), capacities: [] } });
  let wk = 0;
  for (const m of mesoSpec) {
    const s = new Date(pStart.getTime() + wk * 7 * DAY);
    const meso = await db.planBlock.create({ data: { planId: plan.id, parentId: wk < 25 ? macroA.id : macroB.id, level: "MESO", name: m.name, phase: m.phase, startDate: s, endDate: new Date(s.getTime() + m.weeks * 7 * DAY), capacities: m.caps, plannedVolume: m.vol, plannedIntensity: m.int } });
    for (let w = 0; w < m.weeks; w++) {
      const ms = new Date(s.getTime() + w * 7 * DAY);
      const type = m.phase === "COMPETITIVO" && w % 2 === 1 ? "COMPETENCIA" : (w + 1) % 4 === 0 ? "RECUPERACION" : w === m.weeks - 2 && m.weeks > 3 ? "CHOQUE" : "CARGA";
      const f = type === "RECUPERACION" ? 0.6 : type === "CHOQUE" ? 1.2 : type === "COMPETENCIA" ? 0.8 : 1;
      await db.planBlock.create({ data: { planId: plan.id, parentId: meso.id, level: "MICRO", name: `Semana ${wk + w + 1}`, phase: m.phase, microType: type, startDate: ms, endDate: new Date(ms.getTime() + 7 * DAY), capacities: m.caps, plannedVolume: Math.max(1, Math.min(10, Math.round(m.vol * f))), plannedIntensity: Math.min(10, m.int + (type === "CHOQUE" ? 1 : 0)), plannedLoad: Math.round(m.vol * f * 190) } });
    }
    wk += m.weeks;
  }

  // ---- Sesiones, registros y bienestar ----
  const ex = await db.exercise.findMany({ where: { orgId: null } });
  const byName = (n: string) => ex.find((e) => e.name.startsWith(n))!;
  const templates: Record<string, { title: string; type: string; caps: string[]; items: [string, number, string, number | null, number | null][] }[]> = {
    ATLETISMO: [
      { title: "Fuerza máxima tren inferior", type: "FUERZA", caps: ["FUERZA_MAXIMA"], items: [["Sentadilla trasera", 4, "4", 0.82, 2], ["Peso muerto rumano", 3, "6", 0.7, 2], ["Zancada búlgara", 3, "6", null, 2], ["Nordic curl", 3, "4", null, null]] },
      { title: "Velocidad y pliometría", type: "PISTA", caps: ["VELOCIDAD", "FUERZA_EXPLOSIVA"], items: [["Sprint de aceleración", 6, "1", null, null], ["Saltos de vallas", 4, "6", null, null], ["Drop jump", 3, "5", null, null]] },
      { title: "Potencia y tronco", type: "FUERZA", caps: ["POTENCIA", "ESTABILIDAD"], items: [["Cargada de potencia", 5, "3", 0.75, 3], ["Sentadilla con salto", 4, "4", 0.3, null], ["Press Pallof", 3, "10", null, null]] },
    ],
    FUTBOL: [
      { title: "Fuerza MD-4", type: "FUERZA", caps: ["FUERZA_MAXIMA", "HIPERTROFIA"], items: [["Sentadilla trasera", 4, "5", 0.8, 2], ["Hip thrust", 3, "8", null, 2], ["Nordic curl", 3, "5", null, null], ["Plancha Copenhague", 3, "20 s", null, null]] },
      { title: "Velocidad y cambios de dirección", type: "PISTA", caps: ["VELOCIDAD", "AGILIDAD"], items: [["Sprint de aceleración", 6, "1", null, null], ["Cambio de dirección", 5, "1", null, null], ["Escalera de coordinación", 3, "2", null, null]] },
    ],
    NATACION: [
      { title: "Fuerza en seco", type: "FUERZA", caps: ["FUERZA_RESISTENCIA", "ESTABILIDAD"], items: [["Dominadas", 4, "6", null, 2], ["Remo invertido", 3, "12", null, 2], ["Face pull", 3, "15", null, null], ["Dead bug", 3, "8", null, null]] },
      { title: "Potencia de piernas y core", type: "FUERZA", caps: ["POTENCIA"], items: [["Salto al cajón", 4, "4", null, null], ["Sentadilla goblet", 3, "10", null, 2], ["Plancha frontal", 3, "40 s", null, null]] },
    ],
    GENERAL: [
      { title: "Torso — hipertrofia", type: "FUERZA", caps: ["HIPERTROFIA"], items: [["Press de banca", 4, "8", 0.72, 2], ["Remo con barra", 4, "10", null, 2], ["Press militar", 3, "8", null, 2], ["Face pull", 3, "15", null, null]] },
      { title: "Pierna — hipertrofia", type: "FUERZA", caps: ["HIPERTROFIA", "FUERZA_MAXIMA"], items: [["Sentadilla trasera", 4, "8", 0.72, 2], ["Hip thrust", 4, "10", null, 1], ["Peso muerto rumano", 3, "10", null, 2], ["Elevación de gemelos", 3, "12", null, null]] },
    ],
  };
  const groupFor: Record<string, string | undefined> = { ATLETISMO: gVel.id, FUTBOL: gFut.id, NATACION: gNat.id };
  const sessionDays = [-41, -39, -37, -34, -32, -30, -27, -25, -23, -20, -18, -16, -13, -11, -9, -6, -4, -2, 0, 1, 3, 5, 8, 10];

  for (const sport of Object.keys(templates)) {
    const tpls = templates[sport];
    const members = athletes.filter((a) => a.sport === sport);
    const groupId = groupFor[sport];
    for (const [k, off] of sessionDays.entries()) {
      const tpl = tpls[k % tpls.length];
      const sess = await db.session.create({
        data: {
          orgId: org.id, coachId: sport === "NATACION" ? coach2.id : coach.id, title: tpl.title, date: at(off, sport === "FUTBOL" ? 9 : 17), type: tpl.type,
          capacities: tpl.caps, durationMin: tpl.type === "PISTA" ? 75 : 65, targetRpe: 7, isDemo: true, planId: sport === "ATLETISMO" ? plan.id : null,
          groupId: groupId ?? null, athleteId: groupId ? null : members[0].id,
          items: { create: tpl.items.map(([n, sets, reps, pct, rir], j) => ({ exerciseId: byName(n).id, order: j, sets, reps, percent1RM: pct, targetRir: rir, restSec: pct ? 180 : 90, block: blockFor(n, pct) })) },
        },
        include: { items: true },
      });
      if (sess.date > new Date()) continue; // futuras (incluso más tarde hoy): sin registro
      for (const [ai, a] of members.entries()) {
        const absent = r() < 0.08;
        if (absent) {
          await db.workoutLog.create({ data: { sessionId: sess.id, athleteId: a.id, status: r() < 0.5 ? "AUSENTE" : "JUSTIFICADO", completedAt: sess.date } });
          continue;
        }
        // La semana actual de Mateo y Sofía tiene una carga más alta (para mostrar alertas)
        const spike = off >= -6 && (a.name.startsWith("Mateo") || a.name.startsWith("Sofía")) ? 2 : 0;
        const rpe = Math.min(10, Math.round(5 + r() * 3 + spike));
        const dur = sess.durationMin + Math.round((r() - 0.5) * 20) + spike * 15;
        const progress = 1 + (41 + off) / 41 * 0.06;
        await db.workoutLog.create({
          data: {
            sessionId: sess.id, athleteId: a.id, status: "COMPLETADO", durationMin: dur, rpe, load: rpe * dur, completedAt: new Date(Math.min(sess.date.getTime() + 2 * 3600_000, Date.now() - 5 * 60_000)),
            feeling: ["Buenas sensaciones", "Piernas pesadas", "Muy bien, rápido", "Algo cansado", null][Math.floor(r() * 5)],
            itemNotes: r() < 0.45 ? { create: [{ itemId: sess.items[0].id, note: off >= -2 && a.name.startsWith("Mateo") ? "Molestia leve en isquio derecho al final" : ["Me sentí bien", "Me costó la última serie", "Salió fácil, puedo subir", "Cansado/a", "Con energía"][Math.floor(r() * 5)] }] } : undefined,
            sets: {
              create: sess.items.flatMap((it) =>
                Array.from({ length: it.sets }, (_, s) => {
                  const reps = parseInt(it.reps) || null;
                  const base1rm = a.base.sq * (it.percent1RM ? 1 : 0);
                  const load = it.percent1RM ? Math.round((base1rm * it.percent1RM * progress) / 2.5) * 2.5 : null;
                  return { itemId: it.id, setNumber: s + 1, reps, loadKg: load, rir: it.targetRir != null ? Math.max(0, it.targetRir + Math.round(r() * 2 - 1)) : null, rpe: it.targetRir != null ? Math.min(10, 10 - (it.targetRir ?? 2) + Math.round(r())) : null, velocity: it.percent1RM && it.percent1RM < 0.5 ? +(1.1 + r() * 0.25).toFixed(2) : null };
                }),
              ),
            },
          },
        });
        void ai;
      }
    }
  }

  // Bienestar diario (42 días)
  for (const a of athletes) {
    const rows = [];
    for (let d = -42; d <= 0; d++) {
      if (r() < 0.12 && d < -1) continue; // algún día sin registrar
      const dip = d >= -1 && (a.name.startsWith("Mateo") || a.name.startsWith("Julieta")) ? 2 : 0;
      const v = () => Math.max(1, Math.min(5, Math.round(3.6 + (r() - 0.5) * 1.6 - dip)));
      rows.push({
        athleteId: a.id, date: new Date(Date.UTC(day0(d).getFullYear(), day0(d).getMonth(), day0(d).getDate())), sleepHours: +(7.4 + (r() - 0.5) * 1.6 - dip * 0.9).toFixed(1), sleepQuality: v(), fatigue: v(), soreness: v(), stress: v(), mood: v(),
        readiness: Math.max(1, Math.min(10, Math.round(7.2 + (r() - 0.5) * 2.5 - dip * 2))), isDemo: true,
        painArea: d === 0 && a.name.startsWith("Mateo") ? "Isquiotibial derecho (molestia leve)" : null,
      });
    }
    await db.wellness.createMany({ data: rows });
  }

  // ---- Evaluaciones (3 momentos) ----
  const moments = [-84, -42, -3];
  for (const a of athletes) {
    for (const [mi, off] of moments.entries()) {
      const g = 1 + mi * 0.035 + (r() - 0.5) * 0.02;
      const evs: { testKey: string; value: number; unit: string; details?: object }[] = [
        { testKey: "CMJ", value: +(a.base.cmj * g).toFixed(1), unit: "cm" },
        { testKey: "SJ", value: +(a.base.cmj * 0.9 * g).toFixed(1), unit: "cm" },
        { testKey: "ABK", value: +(a.base.cmj * 1.12 * g).toFixed(1), unit: "cm" },
        { testKey: "RM1_SQ", value: Math.round((a.base.sq * g) / 2.5) * 2.5, unit: "kg" },
        { testKey: "SPR10", value: +(a.base.spr10 / (1 + mi * 0.012)).toFixed(2), unit: "s" },
        { testKey: "SPR30", value: +(a.base.spr30 / (1 + mi * 0.01)).toFixed(2), unit: "s" },
        { testKey: "RSI", value: +((a.base.cmj / 25) * g * 0.95).toFixed(2), unit: "m/s" },
      ];
      if (a.sport === "FUTBOL") evs.push({ testKey: "YOYO_IR1", value: 1600 + mi * 160 + Math.round(r() * 120), unit: "m" });
      if (a.sport === "NATACION") evs.push({ testKey: "SWIM_100", value: +(62 - mi * 0.8 + r()).toFixed(2), unit: "s" });
      if (a.sport === "GENERAL") evs.push({ testKey: "RM1_BP", value: 45 + mi * 2.5, unit: "kg" });
      const fms = [2, 2, 2, 2, 3, 2, 2].map((s, i) => Math.min(3, s + (mi === 2 && i % 3 === 0 ? 1 : 0) - (i === 3 && mi === 0 ? 1 : 0)));
      const comps = ["FMS_DS", "FMS_HS", "FMS_ILL", "FMS_SM", "FMS_ASLR", "FMS_TSPU", "FMS_RS"];
      evs.push({ testKey: "FMS_TOTAL", value: fms.reduce((x, y) => x + y, 0), unit: "pts", details: Object.fromEntries(comps.map((c, i) => [c, fms[i]])) });
      await db.evaluation.createMany({ data: evs.map((e) => ({ ...e, athleteId: a.id, coachId: coach.id, date: day0(off), isDemo: true })) });
    }
  }

  // ---- Competencias ----
  await db.competition.createMany({
    data: [
      { orgId: org.id, groupId: gVel.id, name: "Torneo regional de pista ", date: day0(12), location: "Estadio provincial", sport: "ATLETISMO", priority: "B", isDemo: true },
      { orgId: org.id, groupId: gVel.id, name: "Campeonato nacional ", date: day0(150), location: "CeNARD", sport: "ATLETISMO", priority: "A", isDemo: true },
      { orgId: org.id, groupId: gFut.id, name: "Fecha 12 — Liga ", date: day0(4), location: "Local", sport: "FUTBOL", priority: "B", isDemo: true },
      { orgId: org.id, groupId: gNat.id, name: "Copa de invierno ", date: day0(20), location: "Natatorio municipal", sport: "NATACION", priority: "A", isDemo: true },
      { orgId: org.id, athleteId: athletes[0].id, name: "Meeting de apertura ", date: day0(-20), location: "Pista municipal", sport: "ATLETISMO", priority: "C", result: "100 m: 12.31 s (viento +0.8)", mark: "12.31", position: 2, isDemo: true },
      { orgId: org.id, athleteId: athletes[1].id, name: "Meeting de apertura ", date: day0(-20), location: "Pista municipal", sport: "ATLETISMO", priority: "C", result: "Longitud: 7.12 m", mark: "7.12", position: 1, isDemo: true },
    ],
  });

  // ---- Objetivos ----
  for (const a of athletes) {
    await db.goal.createMany({
      data: [
        { athleteId: a.id, title: "Completar las sesiones de la semana", metric: "sesiones", target: 4, current: 3, weekly: true, isDemo: true },
        { athleteId: a.id, title: "Registrar bienestar todos los días", metric: "días", target: 7, current: 5, weekly: true, isDemo: true },
        { athleteId: a.id, title: `CMJ por encima de ${Math.round(a.base.cmj * 1.12)} cm`, metric: "cm", target: Math.round(a.base.cmj * 1.12), current: +(a.base.cmj * 1.07).toFixed(1), dueDate: day0(60), isDemo: true },
      ],
    });
  }

  // ---- RM por ejercicio ----
  const sq = byName("Sentadilla trasera"), dl = byName("Peso muerto rumano"), bp = byName("Press de banca"), pc = byName("Cargada de potencia");
  for (const a of athletes) {
    const rows = [
      { exerciseId: sq.id, kg: a.base.sq, date: day0(-45), source: "ENTRENADOR", seen: true },
      { exerciseId: sq.id, kg: a.base.sq + 5, date: day0(-12), source: "ENTRENADOR", seen: true },
      { exerciseId: dl.id, kg: Math.round((a.base.sq * 0.95) / 2.5) * 2.5, date: day0(-30), source: "ENTRENADOR", seen: true },
      { exerciseId: bp.id, kg: Math.round((a.base.sq * 0.62) / 2.5) * 2.5, date: day0(-30), source: "ENTRENADOR", seen: true },
      ...(a.sport === "ATLETISMO" ? [{ exerciseId: pc.id, kg: Math.round((a.base.sq * 0.68) / 2.5) * 2.5, date: day0(-20), source: "ENTRENADOR", seen: true }] : []),
    ];
    await db.exerciseRM.createMany({ data: rows.map((x) => ({ ...x, athleteId: a.id, setById: coach.id, isDemo: true })) });
  }
  // Novedades para mostrar los avisos: Sofía cargó su peso muerto y el entrenador le actualizó la cargada
  await db.exerciseRM.create({ data: { athleteId: athletes[0].id, exerciseId: dl.id, kg: 97.5, date: day0(-1), source: "DEPORTISTA", seen: false, setById: athletes[0].id, isDemo: true } });
  await db.exerciseRM.create({ data: { athleteId: athletes[0].id, exerciseId: pc.id, kg: 70, date: day0(0), source: "ENTRENADOR", seen: false, setById: coach.id, isDemo: true } });

  // ---- Cuotas ----
  const now0 = new Date();
  const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const cur = mk(now0), prev = mk(new Date(now0.getFullYear(), now0.getMonth() - 1, 15));
  for (const [i, a] of athletes.entries()) {
    await db.fee.create({ data: { orgId: org.id, athleteId: a.id, period: prev, amount: 25000, status: "PAGADO", paidAt: new Date(now0.getFullYear(), now0.getMonth() - 1, 5 + i), isDemo: true } });
    const pending = a.name.startsWith("Nicolás") || a.name.startsWith("Lucas");
    if (!pending) await db.fee.create({ data: { orgId: org.id, athleteId: a.id, period: cur, amount: a.name.startsWith("Valentina") ? 0 : 25000, status: a.name.startsWith("Valentina") ? "BONIFICADO" : "PAGADO", paidAt: new Date(now0.getFullYear(), now0.getMonth(), Math.min(now0.getDate(), 2 + i)), isDemo: true } });
  }
  await db.athleteProfile.updateMany({ where: { user: { name: "Nicolás", orgId: org.id } }, data: { paused: true } });

  // ---- Antropometría (DEMO, valores ficticios) ----
  {
    const series: [number, number, number[], number[]][] = [
      // [índice deportista, peso, 6 pliegues, perímetros brazo relajado/flexionado/cintura/cadera/muslo/pantorrilla]
      [0, 58.8, [10, 9, 7, 13, 16, 9], [26.1, 27.6, 66.0, 92.0, 51.4, 34.8]],
      [0, 58.4, [10, 8, 7, 12, 15, 9], [26.2, 27.8, 65.5, 91.8, 51.6, 34.9]],
      [0, 58.1, [9, 8, 6, 12, 15, 8], [26.4, 28.0, 65.2, 91.5, 51.8, 35.0]],
      [0, 58.0, [9, 8, 6, 11, 14, 8], [26.5, 28.2, 65.0, 91.4, 52.0, 35.0]],
    ];
    for (const [i, [ai, w, sk, pe]] of series.entries()) {
      const [triceps, subscapular, supraspinale, abdominal, thigh, calf] = sk;
      const [armRelaxedCm, armFlexedCm, waistCm, hipCm, thighMidCm, calfGirthCm] = pe;
      await db.anthropometry.create({ data: { athleteId: athletes[ai].id, measuredById: coach.id, date: day0(-42 * (series.length - 1 - i) - 3), weightKg: w, heightCm: 168, sittingHeightCm: 88, armSpanCm: 171, triceps, subscapular, supraspinale, abdominal, thigh, calf, armRelaxedCm, armFlexedCm, waistCm, hipCm, thighMidCm, calfGirthCm, note: i === 0 ? "Medición inicial " : null, isDemo: true } });
    }
    const mateo = athletes.find((a) => a.name.startsWith("Mateo"));
    if (mateo) for (const [i, w] of [78.5, 79.2, 79.6].entries()) {
      await db.anthropometry.create({ data: { athleteId: mateo.id, measuredById: coach.id, date: day0(-56 * (2 - i) - 5), weightKg: w, heightCm: 180, triceps: 8 - i * 0.5, subscapular: 10, supraspinale: 7, abdominal: 12 - i, thigh: 11, calf: 7, armFlexedCm: 35 + i * 0.4, waistCm: 80, isDemo: true } });
    }
  }

  // ---- Carpeta del perfil: un documento de ejemplo (DEMO, valores ficticios) ----
  {
    const buf = await readFile(path.resolve(process.cwd(), "prisma/demo-assets/antropometria-demo.pdf"));
    const key = "demo-antropometria-sofia.pdf";
    await putBuffer(key, buf, "application/pdf");
    await db.fileAsset.create({ data: { orgId: org.id, ownerId: coach.id, athleteId: athletes[0].id, name: "Antropometría (ejemplo).pdf", mime: "application/pdf", size: buf.length, storageKey: key, kind: "DOCUMENTO", folder: "ANTROPOMETRIA", note: "Medición de ejemplo" } });
  }

  // ---- Comunicación ----
  const sofia = athletes[0];
  const conv = await db.conversation.create({ data: { orgId: org.id, kind: "DIRECT", members: { create: [{ userId: coach.id }, { userId: sofia.id, lastReadAt: day0(-1) }] } } });
  const msgs: [string, string, number][] = [
    [coach.id, "Hola Sofía, esta semana subimos un poco el volumen de aceleraciones. Avisame cómo responden los isquios.", -3],
    [sofia.id, "Dale. Ayer terminé bien, algo de carga en gemelos nada más.", -2],
    [coach.id, "Perfecto. Subí el video de la salida de tacos así lo revisamos juntas.", -1],
  ];
  for (const [sender, body, d] of msgs) await db.message.create({ data: { conversationId: conv.id, senderId: sender, body, createdAt: at(d, 19) } });
  const gconv = await db.conversation.create({ data: { orgId: org.id, kind: "GROUP", title: gVel.name, groupId: gVel.id, members: { create: [{ userId: coach.id }, ...athletes.filter((a) => a.sport === "ATLETISMO").map((a) => ({ userId: a.id }))] } } });
  await db.message.create({ data: { conversationId: gconv.id, senderId: coach.id, body: "Recuerden: el sábado es el torneo regional. Viernes sesión de activación corta.", createdAt: at(-1, 12) } });

  await db.notification.createMany({
    data: [
      { userId: coach.id, kind: "ALERTA", title: "Mateo reportó una molestia", body: "Isquiotibial derecho (molestia leve)", link: "/app/load" },
      { userId: coach.id, kind: "COMPETENCIA", title: "Fecha 12 — Liga en 4 días", link: "/app/competitions" },
      { userId: sofia.id, kind: "SESION", title: "Nueva sesión asignada: Velocidad y pliometría", link: "/app/calendar" },
    ],
  });
  await db.auditLog.create({ data: { orgId: org.id, userId: coach.id, action: "CREAR", entity: "Demo", summary: "Se generó la organización de demostración" } });
  return org;
}

/** Rutina y plantilla de ejemplo para el club DEMO (marcadas como demo). Solo si todavía no hay ninguna. */
export async function ensureDemoRoutines(db: PrismaClient) {
  const org = await db.organization.findFirst({ where: { isDemo: true } });
  if (!org || (await db.routine.count({ where: { orgId: org.id } }))) return;
  const athlete = await db.user.findFirst({ where: { orgId: org.id, email: ATHLETE_LOGIN } });
  const coach = await db.user.findFirst({ where: { orgId: org.id, email: COACH_LOGIN } });
  const exs = await db.exercise.findMany({ where: { orgId: null }, select: { id: true, name: true } });
  const find = (n: string) => exs.find((e) => e.name.toLowerCase() === n.toLowerCase())?.id ?? null;
  let k = 0;
  const id = () => `demo${(k++).toString(36)}`;
  const row = (name: string, cells: string[], note = "", extra: Record<string, unknown> = {}) => ({ id: id(), exerciseId: find(name), name, note, video: null, cells, rm: ["", "", "", ""], rest: "90", mode: "normal", link: "", ...extra });
  const data = {
    weeks: 4,
    meta: { objective: "Fuerza y potencia de tren inferior (ejemplo)", start: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10), notes: "Datos de ejemplo.", rest: "2-3 min", notice: "Ejemplo de aviso: esta semana bajamos el volumen, priorizá la técnica. Cualquier molestia me avisás." },
    warmup: [
      { id: id(), exerciseId: find("Movilidad de cadera"), name: "Movilidad de cadera", detail: "2x8 c/lado", video: null },
      { id: id(), exerciseId: find("Skipping alto"), name: "Skipping alto", detail: "3x20 m", video: null },
    ],
    days: [
      { id: id(), name: "DÍA 1 · Inferior", weekday: "Martes", blocks: [
        { id: id(), name: "ACTIVACIÓN", rows: [row("Salto al cajón", ["3x5", "3x5", "4x4", "3x3"], "Caer suave, pausa arriba", { focus: "potencia", link: "superserie" }), row("Plancha lateral", ["2x20 s", "2x25 s", "2x30 s", "2x20 s"], "", { focus: "activacion" })] },
        { id: id(), name: "BLOQUE PRINCIPAL", rows: [
          row("Sentadilla trasera con barra", ["4x6", "4x5", "5x4", "3x5"], "", { focus: "fuerza", rm: ["70%", "75%", "80%", "65%"], rmBase: "RIR 2", rest: "150" }),
          row("Peso muerto rumano", ["3x8", "3x8", "4x6", "2x8"], "", { focus: "estructura", link: "circuito" }),
          row("Zancada búlgara", ["3x8 c/lado", "3x8 c/lado", "3x10 c/lado", "2x8 c/lado"], "", { focus: "hipertrofia" }),
        ] },
        { id: id(), name: "METABÓLICO", rows: [row("Burpee", [], "", { focus: "resistencia", mode: "tabata", tabata: { work: "20", rest: "10", rounds: "8" } })] },
      ] },
      { id: id(), name: "DÍA 2 · Superior", weekday: "Jueves", blocks: [
        { id: id(), name: "BLOQUE PRINCIPAL", rows: [
          row("Press de banca", ["4x6", "4x5", "5x4", "3x5"], "Pausa de 1 s en el pecho"),
          row("Dominadas", ["4x5", "4x6", "4x6", "3x5"]),
          row("Remo con barra", ["3x8", "3x8", "4x8", "2x8"]),
        ] },
      ] },
    ],
  };
  if (athlete) await db.routine.create({ data: { orgId: org.id, athleteId: athlete.id, coachId: coach?.id, name: "Rutina pretemporada (ejemplo)", data, isDemo: true } });
  await db.routine.create({ data: { orgId: org.id, coachId: coach?.id, template: true, name: "Fuerza 2 días (ejemplo)", data: { ...data, meta: { ...data.meta, start: "" } }, isDemo: true } });
}

/** Conexiones de ejemplo (DEMO) para el panel del entrenador. Se refrescan en cada despliegue; solo toca usuarios DEMO. */
export async function ensureDemoPresence(db: PrismaClient) {
  const athletes = await db.user.findMany({ where: { isDemo: true, role: "ATHLETE", org: { isDemo: true } }, orderBy: { name: "asc" } });
  const now = Date.now();
  const H = 3600_000;
  // horas desde la última entrada y minutos entre la primera y la última de ese día (null = nunca entró)
  const plan: ([number, number] | null)[] = [[0.4, 54], [15, 0], [16.5, 50], [22, 39], [26, 0], [40, 20], [70, 0], null, null];
  await Promise.all(athletes.map((a, i) => {
    const p = plan[i % plan.length];
    if (!p) return db.user.update({ where: { id: a.id }, data: { lastSeenAt: null, firstSeenAt: null } });
    const last = new Date(now - p[0] * H);
    const first = new Date(+last - p[1] * 60_000);
    return db.user.update({ where: { id: a.id }, data: { lastSeenAt: last, firstSeenAt: first } });
  }));
}

/** Para que el panel DEMO muestre "Planes por vencer": dos rutinas DEMO terminan en pocos días. */
export async function ensureDemoExpiring(db: PrismaClient) {
  const rs = await db.routine.findMany({ where: { isDemo: true, active: true, template: false, athleteId: { not: null }, org: { isDemo: true } }, orderBy: { createdAt: "asc" }, take: 2 });
  const offsets = [3, -2]; // días que faltan (negativo = ya venció)
  await Promise.all(rs.map((r, i) => {
    const d = r.data as { weeks?: number; meta?: Record<string, unknown> };
    const weeks = d.weeks ?? 4;
    const start = new Date(Date.now() - (weeks * 7 - offsets[i]) * 86400000);
    const ymd = start.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    return db.routine.update({ where: { id: r.id }, data: { data: { ...d, meta: { ...(d.meta ?? {}), start: ymd } } as object } });
  }));
}

/**
 * Club DEMO reducido (pedido de Diego): queda el entrenador demo y una sola deportista de referencia (Sofía).
 * Borra solo usuarios DEMO del club DEMO; nunca toca datos reales.
 */
export async function trimDemo(db: PrismaClient) {
  const org = await db.organization.findFirst({ where: { isDemo: true } });
  if (!org) return;
  // Ya no es "club": la cuenta demo es de un preparador físico
  if (org.name !== "Hrtraining") await db.organization.update({ where: { id: org.id }, data: { name: "Hrtraining" } });
  // Diego (25-11-2026): ya es una plataforma en serio, no se muestra la palabra "Demo" en ningún lado.
  for (const x of await db.user.findMany({ where: { orgId: org.id, name: { endsWith: " Demo" } }, select: { id: true, name: true } }))
    await db.user.update({ where: { id: x.id }, data: { name: x.name.replace(/ Demo$/, "") } });
  for (const g of await db.group.findMany({ where: { orgId: org.id, description: { contains: "DEMO" } } }))
    await db.group.update({ where: { id: g.id }, data: { description: g.description!.replace(/\s*\(DEMO\)/, "") } });
  for (const c of await db.competition.findMany({ where: { orgId: org.id, name: { contains: "(DEMO)" } } }))
    await db.competition.update({ where: { id: c.id }, data: { name: c.name.replace(/\s*\(DEMO\)/, "") } });
  for (const n of await db.notification.findMany({ where: { user: { orgId: org.id }, title: { contains: " Demo" } } }))
    await db.notification.update({ where: { id: n.id }, data: { title: n.title.replace(/ Demo\b/g, "") } });
  for (const r of await db.routine.findMany({ where: { orgId: org.id } })) {
    const d = r.data as { meta?: { notes?: string } };
    if (d?.meta?.notes && /demo/i.test(d.meta.notes)) await db.routine.update({ where: { id: r.id }, data: { data: { ...d, meta: { ...d.meta, notes: "" } } as object } });
  }
  for (const f of await db.fileAsset.findMany({ where: { orgId: org.id, OR: [{ name: { contains: "DEMO" } }, { note: { contains: "DEMO" } }] } }))
    await db.fileAsset.update({ where: { id: f.id }, data: { name: f.name.replace(/\s*DEMO/g, ""), note: f.note?.replace(/\s*·\s*DEMO/g, "") ?? null } });
  // Una sola vez: las cuentas pasan a usuario "hernan" y "alumna" (la contraseña no se toca).
  const old = await db.user.findFirst({ where: { orgId: org.id, email: OLD_COACH_LOGIN } });
  if (old && !(await db.user.findUnique({ where: { email: COACH_LOGIN } })))
    await db.user.update({ where: { id: old.id }, data: { email: COACH_LOGIN, name: "Hernán" } });
  const oldA = await db.user.findFirst({ where: { orgId: org.id, email: OLD_ATHLETE_LOGIN } });
  if (oldA && !(await db.user.findUnique({ where: { email: ATHLETE_LOGIN } })))
    await db.user.update({ where: { id: oldA.id }, data: { email: ATHLETE_LOGIN } });
  const keepEmails = [COACH_LOGIN, ATHLETE_LOGIN];
  const coach = await db.user.findFirst({ where: { orgId: org.id, email: keepEmails[0] } });
  if (!coach) return;
  const extra = await db.user.findMany({ where: { orgId: org.id, isDemo: true, email: { notIn: keepEmails } }, select: { id: true } });
  if (!extra.length) return;
  const ids = extra.map((u) => u.id);
  // Lo que armó otro entrenador demo pasa al entrenador que queda
  await db.group.updateMany({ where: { coachId: { in: ids } }, data: { coachId: coach.id } });
  await db.session.updateMany({ where: { coachId: { in: ids } }, data: { coachId: coach.id } });
  await db.plan.updateMany({ where: { coachId: { in: ids } }, data: { coachId: coach.id } });
  await db.evaluation.updateMany({ where: { coachId: { in: ids } }, data: { coachId: coach.id } });
  await db.routine.updateMany({ where: { coachId: { in: ids } }, data: { coachId: coach.id } });
  await db.athleteProfile.updateMany({ where: { coachId: { in: ids } }, data: { coachId: coach.id } });
  // Planes, sesiones y competencias individuales de los que se van
  await db.plan.deleteMany({ where: { orgId: org.id, athleteId: { in: ids } } });
  await db.session.deleteMany({ where: { orgId: org.id, athleteId: { in: ids } } });
  await db.competition.deleteMany({ where: { orgId: org.id, athleteId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  // Conversaciones que quedaron con una sola persona
  const convs = await db.conversation.findMany({ where: { orgId: org.id }, select: { id: true, _count: { select: { members: true } } } });
  const empty = convs.filter((c) => c._count.members < 2).map((c) => c.id);
  if (empty.length) await db.conversation.deleteMany({ where: { id: { in: empty } } });
  console.log(`Demo reducida: se quitaron ${ids.length} usuarios de ejemplo.`);
}

/** Tics de ejemplo (DEMO): la deportista demo marcó ejercicios ayer y hace 3 días. */
export async function ensureDemoChecks(db: PrismaClient) {
  const r = await db.routine.findFirst({ where: { isDemo: true, active: true, template: false, extra: false, athleteId: { not: null }, org: { isDemo: true } } });
  if (!r?.athleteId) return;
  const since = new Date(Date.now() - 4 * 86400000);
  if (await db.routineCheck.count({ where: { routineId: r.id, createdAt: { gte: since } } })) return;
  const days = ((r.data as { days?: { id: string; blocks: { rows: { id: string; name: string }[] }[] }[] }).days ?? []);
  const plan: [number, number, number][] = [[1, 0, 1], [3, Math.min(1, days.length - 1), 0.6]]; // [hace días, día de la rutina, parte hecha]
  for (const [ago, di, part] of plan) {
    const day = days[di]; if (!day) continue;
    const rows = day.blocks.flatMap((b) => b.rows.filter((x) => x.name));
    const d = new Date(Date.now() - ago * 86400000);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    await db.routineCheck.createMany({ data: rows.slice(0, Math.ceil(rows.length * part)).map((x) => ({ routineId: r.id, athleteId: r.athleteId!, date, dayId: day.id, rowId: x.id, createdAt: d })), skipDuplicates: true });
  }
}

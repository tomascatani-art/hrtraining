import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/access";
import { sanitizeRoutine, planEnd } from "@/lib/routine";
import { weeklySummary } from "@/lib/weekly-summary";

/** Fecha y día de la semana en Argentina, sin depender de la zona horaria del servidor. */
const arNow = (now: Date) => { const d = new Date(+now - 3 * 3600_000); return { day: d.toISOString().slice(0, 10), monday: d.getUTCDay() === 1 }; };

/**
 * Avisos que corren una vez por día y por preparador (los dispara cualquiera que abra la app):
 * plan que entra en su última semana o que terminó, y los lunes el resumen de la semana.
 */
export async function runDailyNotices(orgId: string, now = new Date()) {
  const { day, monday } = arNow(now);
  const claimed = await db.organization.updateMany({ where: { id: orgId, OR: [{ dailyRunOn: null }, { dailyRunOn: { not: day } }] }, data: { dailyRunOn: day } });
  if (!claimed.count) return;
  const staff = (await db.user.findMany({ where: { orgId, role: { in: ["ADMIN", "COACH"] }, active: true }, select: { id: true } })).map((s) => s.id);
  await planEndNotices(orgId, staff, now);
  if (monday) {
    const done = await db.organization.updateMany({ where: { id: orgId, OR: [{ digestOn: null }, { digestOn: { not: day } }] }, data: { digestOn: day } });
    if (done.count && staff.length) {
      const s = await weeklySummary(orgId, now);
      if (s.athletes) {
        const parts = [`${s.trained.length} de ${s.athletes} entrenaron`];
        if (s.idle.length) parts.push(`${s.idle.length} sin entrenar`);
        if (s.molestias.length) parts.push(`${s.molestias.length} ${s.molestias.length === 1 ? "molestia anotada" : "molestias anotadas"}`);
        if (s.ending.length) parts.push(`${s.ending.length} ${s.ending.length === 1 ? "plan por terminar" : "planes por terminar"}`);
        if (s.unpaid.length) parts.push(`${s.unpaid.length} ${s.unpaid.length === 1 ? "cuota sin pagar" : "cuotas sin pagar"}`);
        await notify(staff, { kind: "RESUMEN", title: "Tu resumen de la semana", body: parts.join(" · "), link: "/app/resumen" });
      }
    }
  }
}

async function planEndNotices(orgId: string, staff: string[], now: Date) {
  const routines = await db.routine.findMany({
    where: { orgId, active: true, extra: false, template: false, athleteId: { not: null }, endNotice: { lt: 2 }, athlete: { active: true } },
    select: { id: true, name: true, data: true, createdAt: true, endNotice: true, athleteId: true, athlete: { select: { name: true } } },
  });
  for (const r of routines) {
    const { daysLeft } = planEnd(sanitizeRoutine(r.data), r.createdAt, now);
    const stage = daysLeft <= 0 ? 2 : daysLeft <= 7 ? 1 : 0;
    if (stage <= r.endNotice) continue;
    const ok = await db.routine.updateMany({ where: { id: r.id, endNotice: r.endNotice }, data: { endNotice: stage } });
    if (!ok.count) continue;
    // Si ya tiene el próximo plan programado, al preparador no le hace falta el aviso
    const next = await db.routine.count({ where: { athleteId: r.athleteId, active: false, extra: false, startsOn: { not: null } } });
    if (daysLeft < -14) continue; // planes que terminaron hace mucho: se marcan sin avisar
    const first = r.athlete?.name.split(" ")[0] ?? "";
    if (stage === 1) {
      await notify([r.athleteId!], { kind: "SESION", title: "Arrancás la última semana de tu plan", body: "¡Terminalo con todo! Tu preparador ya está al tanto.", link: "/app/routine" });
      if (!next) await notify(staff, { kind: "PLAN", title: `A ${first} le queda una semana de plan`, body: `${r.name}. Es buen momento para armarle el siguiente.`, link: `/app/routines/${r.id}` });
    } else if (!next) {
      await notify(staff, { kind: "PLAN", title: `${first} terminó su plan`, body: `${r.name}. Todavía no tiene el siguiente.`, link: `/app/routines/${r.id}` });
    }
  }
}

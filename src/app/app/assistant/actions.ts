"use server";
import { runAction } from "@/lib/action-error";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit, notify } from "@/lib/access";

type Day = { title: string; items: { exerciseId: string; sets: number; reps: string; percent1RM: number | null; targetRir: number | null; restSec: number | null }[] };

async function _createFromProposal(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const [kind, id] = String(fd.get("target") ?? "").split(":");
  if (kind === "a") await assertAthlete(u, id);
  else if (kind === "g") { const g = await db.group.findUnique({ where: { id } }); if (!g || g.orgId !== u.orgId) throw new Error("Grupo inválido"); }
  else throw new Error("Elegí a quién asignar");
  const plan: Day[] = JSON.parse(String(fd.get("plan")));
  const name = String(fd.get("name") ?? "Rutina");
  const start = new Date(String(fd.get("start")) + "T18:00");
  const weeks = Math.max(1, Math.min(8, Number(fd.get("weeks") ?? 1)));
  const gaps = plan.length <= 2 ? [0, 3] : plan.length === 3 ? [0, 2, 4] : plan.length === 4 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
  let first: string | null = null;
  for (let w = 0; w < weeks; w++) {
    for (const [i, d] of plan.entries()) {
      const s = await db.session.create({
        data: {
          orgId: u.orgId, coachId: u.id, title: `${name} · ${d.title}`, type: "FUERZA", durationMin: 60, targetRpe: 7,
          date: new Date(+start + (w * 7 + gaps[i]) * 86400000), athleteId: kind === "a" ? id : null, groupId: kind === "g" ? id : null,
          items: { create: d.items.map((it, order) => ({ exerciseId: it.exerciseId, order, sets: it.sets, reps: it.reps, percent1RM: it.percent1RM ? it.percent1RM / 100 : null, targetRir: it.targetRir, restSec: it.restSec })) },
        },
      });
      first ??= s.id;
    }
  }
  const ids = kind === "a" ? [id] : (await db.groupMember.findMany({ where: { groupId: id } })).map((m) => m.athleteId);
  await notify(ids, { kind: "SESION", title: `Nueva rutina asignada: ${name}`, link: "/app/calendar" });
  await audit(u, "CREAR", "Rutina (asistente)", `${name}: ${plan.length * weeks} sesiones`);
  redirect(first ? `/app/sessions/${first}` : "/app/calendar");
}

export async function createFromProposal(fd: FormData) { return runAction("createFromProposal", _createFromProposal, fd); }

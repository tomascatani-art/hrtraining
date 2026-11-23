import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Copia de seguridad completa de la organización en JSON (solo administradores).
export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== "ADMIN") return new NextResponse("No autorizado", { status: 403 });
  const orgId = u.orgId;
  const users = await db.user.findMany({ where: { orgId }, select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, athleteProfile: true } });
  const ids = users.map((x) => x.id);
  const [groups, members, exercises, plans, blocks, sessions, items, logs, sets, wellness, evaluations, competitions, goals, conversations, messages, files, analyses, comments, audit] = await Promise.all([
    db.group.findMany({ where: { orgId } }), db.groupMember.findMany({ where: { group: { orgId } } }), db.exercise.findMany({ where: { orgId } }),
    db.plan.findMany({ where: { orgId } }), db.planBlock.findMany({ where: { plan: { orgId } } }), db.session.findMany({ where: { orgId } }),
    db.sessionExercise.findMany({ where: { session: { orgId } } }), db.workoutLog.findMany({ where: { athleteId: { in: ids } } }),
    db.setLog.findMany({ where: { log: { athleteId: { in: ids } } } }), db.wellness.findMany({ where: { athleteId: { in: ids } } }),
    db.evaluation.findMany({ where: { athleteId: { in: ids } } }), db.competition.findMany({ where: { orgId } }), db.goal.findMany({ where: { athleteId: { in: ids } } }),
    db.conversation.findMany({ where: { orgId }, include: { members: true } }), db.message.findMany({ where: { conversation: { orgId } } }),
    db.fileAsset.findMany({ where: { orgId } }), db.videoAnalysis.findMany({ where: { athleteId: { in: ids } } }), db.videoComment.findMany({ where: { analysis: { athleteId: { in: ids } } } }),
    db.auditLog.findMany({ where: { orgId } }),
  ]);
  await db.auditLog.create({ data: { orgId, userId: u.id, action: "EXPORTAR", entity: "Copia de seguridad", summary: "Descarga de copia de seguridad completa" } });
  const body = JSON.stringify({ format: "hrtraining-backup", version: 1, exportedAt: new Date().toISOString(), organization: u.org, users, groups, members, exercises, plans, blocks, sessions, items, logs, sets, wellness, evaluations, competitions, goals, conversations, messages, files, analyses, comments, audit }, null, 1);
  return new NextResponse(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="hrtraining-backup-${new Date().toISOString().slice(0, 10)}.json"` } });
}

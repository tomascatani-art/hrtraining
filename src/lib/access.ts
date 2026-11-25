import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth";

/** IDs de alumnos que el usuario puede ver según su rol. */
export async function visibleAthleteIds(u: SessionUser): Promise<string[]> {
  if (u.role === "ATHLETE") return [u.id];
  if (u.role === "ADMIN") {
    const all = await db.user.findMany({ where: { orgId: u.orgId, role: "ATHLETE" }, select: { id: true } });
    return all.map((a) => a.id);
  }
  const rows = await db.user.findMany({
    where: {
      orgId: u.orgId,
      role: "ATHLETE",
      OR: [
        { athleteProfile: { coachId: u.id } },
        { memberships: { some: { group: { coachId: u.id } } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((a) => a.id);
}

export async function canSeeAthlete(u: SessionUser, athleteId: string) {
  if (u.role === "ATHLETE") return u.id === athleteId;
  const ids = await visibleAthleteIds(u);
  return ids.includes(athleteId);
}

export async function assertAthlete(u: SessionUser, athleteId: string) {
  if (!(await canSeeAthlete(u, athleteId))) throw new Error("Sin permiso sobre este alumno");
}

/** Grupos visibles: el admin ve todos; el entrenador, los suyos; el alumno, donde es miembro. */
export async function visibleGroups(u: SessionUser) {
  if (u.role === "ADMIN") return db.group.findMany({ where: { orgId: u.orgId }, orderBy: { name: "asc" } });
  if (u.role === "COACH") return db.group.findMany({ where: { orgId: u.orgId, coachId: u.id }, orderBy: { name: "asc" } });
  return db.group.findMany({ where: { members: { some: { athleteId: u.id } } }, orderBy: { name: "asc" } });
}

/** Filtro Prisma de sesiones visibles para el usuario. */
export async function sessionWhere(u: SessionUser) {
  if (u.role === "ATHLETE") {
    const groups = await db.groupMember.findMany({ where: { athleteId: u.id }, select: { groupId: true } });
    return { OR: [{ athleteId: u.id }, { groupId: { in: groups.map((g) => g.groupId) } }] };
  }
  if (u.role === "ADMIN") return { orgId: u.orgId };
  const ids = await visibleAthleteIds(u);
  return { orgId: u.orgId, OR: [{ coachId: u.id }, { athleteId: { in: ids } }, { group: { coachId: u.id } }] };
}

export async function audit(u: SessionUser, action: string, entity: string, summary: string, entityId?: string) {
  await db.auditLog.create({ data: { orgId: u.orgId, userId: u.id, action, entity, entityId, summary } });
}

export async function notify(userIds: string[], n: { kind: string; title: string; body?: string; link?: string }) {
  if (!userIds.length) return;
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, ...n })) });
}

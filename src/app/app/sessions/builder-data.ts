import "server-only";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import type { SessionUser } from "@/lib/auth";
import { BLOCKS, CAPACITIES, SESSION_TYPES } from "@/lib/catalog";

export async function builderOptions(u: SessionUser) {
  const ids = await visibleAthleteIds(u);
  const [athletes, groups, plans, exercises] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    visibleGroups(u),
    db.plan.findMany({ where: { orgId: u.orgId, ...(u.role === "COACH" ? { coachId: u.id } : {}) }, orderBy: { startDate: "desc" } }),
    db.exercise.findMany({ where: { OR: [{ orgId: null }, { orgId: u.orgId }] }, orderBy: { name: "asc" }, select: { id: true, name: true, primaryMuscle: true, pattern: true, suggestedSets: true, suggestedReps: true } }),
  ]);
  return {
    exercises,
    targets: { groups: groups.map((g) => ({ value: `g:${g.id}`, label: g.name })), athletes: athletes.map((a) => ({ value: `a:${a.id}`, label: a.name })) },
    plans: plans.map((p) => ({ value: p.id, label: p.name })),
    capacities: Object.entries(CAPACITIES).map(([value, c]) => ({ value, label: c.label })),
    types: Object.entries(SESSION_TYPES).map(([value, label]) => ({ value, label })),
    blocks: Object.entries(BLOCKS).map(([value, b]) => ({ value, label: b.label, color: b.color })),
  };
}

export const toLocalInput = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 16);
};

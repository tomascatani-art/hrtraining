"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { audit } from "@/lib/access";

async function ownGroup(u: SessionUser, id: string) {
  const g = await db.group.findUnique({ where: { id } });
  if (!g || g.orgId !== u.orgId || (u.role === "COACH" && g.coachId !== u.id)) throw new Error("Sin permiso sobre este grupo");
  return g;
}

export async function createGroup(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const name = String(fd.get("name") ?? "").trim();
  if (!name) throw new Error("El grupo necesita un nombre");
  const g = await db.group.create({
    data: { orgId: u.orgId, coachId: String(fd.get("coachId") || u.id), name, sport: String(fd.get("sport") ?? "GENERAL"), color: String(fd.get("color") ?? "#ffd60a"), description: String(fd.get("description") ?? "") || null },
  });
  await db.conversation.create({ data: { orgId: u.orgId, kind: "GROUP", title: name, groupId: g.id, members: { create: [{ userId: g.coachId }] } } });
  await audit(u, "CREAR", "Grupo", `Grupo ${name}`, g.id);
  redirect(`/app/groups/${g.id}`);
}

export async function updateGroup(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const g = await ownGroup(u, String(fd.get("id")));
  await db.group.update({ where: { id: g.id }, data: { name: String(fd.get("name") ?? g.name), sport: String(fd.get("sport") ?? g.sport), color: String(fd.get("color") ?? g.color), description: String(fd.get("description") ?? "") || null } });
  await db.conversation.updateMany({ where: { groupId: g.id }, data: { title: String(fd.get("name") ?? g.name) } });
  revalidatePath(`/app/groups/${g.id}`);
}

export async function addMembers(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const g = await ownGroup(u, String(fd.get("id")));
  const ids = fd.getAll("athleteId").map(String).filter(Boolean);
  const valid = await db.user.findMany({ where: { id: { in: ids }, orgId: u.orgId, role: "ATHLETE" }, select: { id: true } });
  await db.groupMember.createMany({ data: valid.map((a) => ({ groupId: g.id, athleteId: a.id })), skipDuplicates: true });
  const conv = await db.conversation.findUnique({ where: { groupId: g.id } });
  if (conv) await db.conversationMember.createMany({ data: valid.map((a) => ({ conversationId: conv.id, userId: a.id })), skipDuplicates: true });
  await audit(u, "EDITAR", "Grupo", `Se sumaron ${valid.length} alumnos a ${g.name}`, g.id);
  revalidatePath(`/app/groups/${g.id}`);
}

export async function removeMember(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const g = await ownGroup(u, String(fd.get("id")));
  const athleteId = String(fd.get("athleteId"));
  await db.groupMember.delete({ where: { groupId_athleteId: { groupId: g.id, athleteId } } });
  const conv = await db.conversation.findUnique({ where: { groupId: g.id } });
  if (conv) await db.conversationMember.deleteMany({ where: { conversationId: conv.id, userId: athleteId } });
  revalidatePath(`/app/groups/${g.id}`);
}

export async function deleteGroup(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const g = await ownGroup(u, String(fd.get("id")));
  await db.group.delete({ where: { id: g.id } });
  await audit(u, "ELIMINAR", "Grupo", `Grupo ${g.name}`, g.id);
  redirect("/app/groups");
}

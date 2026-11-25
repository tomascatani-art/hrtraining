"use server";
import { runAction } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { notify, visibleAthleteIds } from "@/lib/access";
import { canAccessFile } from "@/lib/storage";

/** Usuarios con los que se puede iniciar un chat directo. */
export async function contactsFor(u: SessionUser) {
  if (u.role === "ATHLETE") {
    const groups = await db.groupMember.findMany({ where: { athleteId: u.id }, include: { group: true } });
    const ids = [u.athleteProfile?.coachId, ...groups.map((g) => g.group.coachId)].filter(Boolean) as string[];
    return db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, orderBy: { name: "asc" } });
  }
  const ath = await visibleAthleteIds(u);
  return db.user.findMany({ where: { orgId: u.orgId, id: { not: u.id }, OR: [{ id: { in: ath } }, { role: { in: ["COACH", "ADMIN"] } }] }, orderBy: [{ role: "asc" }, { name: "asc" }] });
}

async function _openDirect(fd: FormData) {
  const u = await requireUser();
  const to = String(fd.get("to"));
  const contacts = await contactsFor(u);
  if (!contacts.some((c) => c.id === to)) throw new Error("No podés iniciar un chat con este usuario");
  const existing = await db.conversation.findFirst({ where: { kind: "DIRECT", AND: [{ members: { some: { userId: u.id } } }, { members: { some: { userId: to } } }] } });
  const c = existing ?? await db.conversation.create({ data: { orgId: u.orgId, kind: "DIRECT", members: { create: [{ userId: u.id }, { userId: to }] } } });
  redirect(`/app/messages?c=${c.id}`);
}

async function _sendMessage(fd: FormData) {
  const u = await requireUser();
  const conversationId = String(fd.get("conversationId"));
  const m = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: u.id } }, include: { conversation: { include: { members: true } } } });
  if (!m) throw new Error("No sos parte de esta conversación");
  const body = String(fd.get("body") ?? "").trim();
  const fileId = String(fd.get("fileId") ?? "") || null;
  if (!body && !fileId) return;
  if (fileId) {
    const f = await db.fileAsset.findUnique({ where: { id: fileId } });
    if (!f || !(await canAccessFile(u, f))) throw new Error("Archivo inválido");
  }
  await db.message.create({ data: { conversationId, senderId: u.id, body: body || "📎 Archivo adjunto", fileId } });
  await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: u.id } }, data: { lastReadAt: new Date() } });
  const others = m.conversation.members.map((x) => x.userId).filter((id) => id !== u.id);
  // Notificación solo si no tienen ya una notificación de mensaje sin leer de esta conversación
  const link = `/app/messages?c=${conversationId}`;
  const already = await db.notification.findMany({ where: { userId: { in: others }, link, readAt: null }, select: { userId: true } });
  await notify(others.filter((id) => !already.some((a) => a.userId === id)), { kind: "MENSAJE", title: `${m.conversation.kind === "GROUP" ? `${m.conversation.title}: ` : ""}mensaje de ${u.name}`, body: body.slice(0, 120), link });
  revalidatePath("/app/messages");
}

async function _broadcast(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const groupId = String(fd.get("groupId"));
  const g = await db.group.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!g || g.orgId !== u.orgId) throw new Error("Grupo inválido");
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!title) throw new Error("El aviso necesita un título");
  await notify(g.members.map((m) => m.athleteId), { kind: String(fd.get("kind") ?? "AVISO"), title, body, link: "/app/notifications" });
  const conv = await db.conversation.findUnique({ where: { groupId } });
  if (conv) {
    await db.conversationMember.upsert({ where: { conversationId_userId: { conversationId: conv.id, userId: u.id } }, create: { conversationId: conv.id, userId: u.id }, update: {} });
    await db.message.create({ data: { conversationId: conv.id, senderId: u.id, body: `📣 ${title}${body ? `\n${body}` : ""}` } });
  }
  revalidatePath("/app/messages");
  redirect(conv ? `/app/messages?c=${conv.id}` : "/app/messages");
}

export async function openDirect(fd: FormData) { return runAction("openDirect", _openDirect, fd); }
export async function sendMessage(fd: FormData) { return runAction("sendMessage", _sendMessage, fd); }
export async function broadcast(fd: FormData) { return runAction("broadcast", _broadcast, fd); }

import Link from "next/link";
import { Users, Paperclip, Megaphone } from "lucide-react";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleGroups } from "@/lib/access";
import { Avatar, Empty, fmtDate, fmtTime } from "@/components/ui";
import { Submit } from "@/components/forms";
import { AutoRefresh, Composer, ScrollBottom } from "@/components/chat";
import { contactsFor, openDirect, sendMessage, broadcast } from "./actions";

export const metadata = { title: "Mensajes" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string; to?: string; aviso?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const convs = await db.conversation.findMany({
    where: { members: { some: { userId: u.id } } },
    include: { members: { include: { user: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  const contacts = await contactsFor(u);
  const groups = u.role !== "ATHLETE" ? await visibleGroups(u) : [];
  // Atajo ?to=: abrir conversación existente si la hay
  let activeId = sp.c;
  if (!activeId && sp.to) activeId = convs.find((c) => c.kind === "DIRECT" && c.members.some((m) => m.userId === sp.to))?.id;
  const active = activeId ? convs.find((c) => c.id === activeId) : undefined;
  const msgs = active ? await db.message.findMany({ where: { conversationId: active.id }, include: { sender: true, file: true }, orderBy: { createdAt: "asc" }, take: 200 }) : [];
  if (active) await db.conversationMember.update({ where: { conversationId_userId: { conversationId: active.id, userId: u.id } }, data: { lastReadAt: new Date() } });
  if (active) await db.notification.updateMany({ where: { userId: u.id, link: `/app/messages?c=${active.id}`, readAt: null }, data: { readAt: new Date() } });
  const unread = await Promise.all(convs.map(async (c) => {
    const me = c.members.find((m) => m.userId === u.id)!;
    return db.message.count({ where: { conversationId: c.id, senderId: { not: u.id }, createdAt: { gt: me.lastReadAt } } });
  }));
  const titleOf = (c: (typeof convs)[number]) => c.kind === "GROUP" ? c.title ?? "Grupo" : c.members.find((m) => m.userId !== u.id)?.user.name ?? "Conversación";
  const pendingTo = sp.to && !active ? contacts.find((c) => c.id === sp.to) : undefined;

  return (
    <div className="card grid h-[calc(100dvh-12rem)] min-h-[520px] overflow-hidden lg:h-[calc(100dvh-8rem)] md:grid-cols-[320px_1fr]">
      <aside className={clsx("flex flex-col border-r border-ink-700", active || pendingTo || sp.aviso ? "hidden md:flex" : "flex")}>
        <div className="border-b border-ink-700 p-4">
          <h1 className="h2">Mensajes</h1>
          <form action={openDirect} className="mt-3 flex gap-2">
            <select name="to" className="input py-2 text-sm" required defaultValue=""><option value="" disabled>Nuevo chat con…</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role !== "ATHLETE" ? " (entrenador)" : ""}</option>)}</select>
            <Submit className="btn-primary btn-sm" pendingText="…">Abrir</Submit>
          </form>
          {u.role !== "ATHLETE" && <Link href="/app/messages?aviso=1" className="mt-2 inline-flex items-center gap-1.5 text-xs text-volt hover:underline"><Megaphone size={13} />Enviar aviso a un grupo</Link>}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {convs.map((c, i) => (
            <li key={c.id}>
              <Link href={`/app/messages?c=${c.id}`} className={clsx("flex items-center gap-3 border-b border-ink-800 px-4 py-3 transition", c.id === active?.id ? "bg-volt/10" : "hover:bg-ink-800")}>
                {c.kind === "GROUP" ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-700 text-volt"><Users size={16} /></span> : <Avatar name={titleOf(c)} size={36} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-white">{titleOf(c)}</span><span className="ml-auto shrink-0 text-[10px] text-neutral-600">{c.messages[0] ? fmtDate(c.messages[0].createdAt) : ""}</span></div>
                  <div className="truncate text-xs muted">{c.messages[0]?.body ?? "Sin mensajes"}</div>
                </div>
                {unread[i] > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-black">{unread[i]}</span>}
              </Link>
            </li>
          ))}
          {convs.length === 0 && <li className="p-4 text-sm muted">Sin conversaciones.</li>}
        </ul>
      </aside>

      <section className={clsx("flex min-h-0 flex-col", !(active || pendingTo || sp.aviso) && "hidden md:flex")}>
        {sp.aviso && u.role !== "ATHLETE" ? (
          <div className="p-5">
            <Link href="/app/messages" className="mb-3 inline-block text-xs text-volt md:hidden">← Conversaciones</Link>
            <h2 className="h2 mb-1">Aviso grupal</h2>
            <p className="mb-4 text-sm muted">Llega como notificación a cada integrante y queda publicado en el chat del grupo. Ideal para competencias, cambios de horario o recordatorios.</p>
            <form action={broadcast} className="max-w-lg space-y-3">
              <select name="groupId" className="input" required>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <select name="kind" className="input"><option value="AVISO">Aviso general</option><option value="COMPETENCIA">Competencia</option><option value="SESION">Entrenamiento</option></select>
              <input name="title" className="input" placeholder="Título" required />
              <textarea name="body" className="input" placeholder="Detalle" />
              <Submit>Enviar aviso</Submit>
            </form>
          </div>
        ) : pendingTo ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div><Avatar name={pendingTo.name} size={56} /><p className="mt-3 text-white">Iniciar conversación con <b>{pendingTo.name}</b></p>
              <form action={openDirect} className="mt-4"><input type="hidden" name="to" value={pendingTo.id} /><Submit>Abrir chat</Submit></form></div>
          </div>
        ) : active ? (
          <>
            <AutoRefresh />
            <header className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
              <Link href="/app/messages" className="text-sm text-volt md:hidden">←</Link>
              <div className="min-w-0"><div className="truncate font-semibold text-white">{titleOf(active)}</div><div className="truncate text-xs muted">{active.members.map((m) => m.user.name.split(" ")[0]).join(", ")}</div></div>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 && <Empty title="Empezá la conversación" />}
              {msgs.map((m, i) => {
                const mine = m.senderId === u.id;
                const showName = !mine && active.kind === "GROUP" && msgs[i - 1]?.senderId !== m.senderId;
                return (
                  <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={clsx("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-volt text-black" : "rounded-bl-md bg-ink-700 text-neutral-100")}>
                      {showName && <div className="mb-0.5 text-[11px] font-semibold text-volt">{m.sender.name}</div>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.file && (m.file.kind === "VIDEO"
                        ? <video src={`/api/files/${m.file.id}`} controls className="mt-2 max-h-64 rounded-lg" preload="metadata" />
                        : m.file.kind === "IMAGEN" ? <a href={`/api/files/${m.file.id}`} target="_blank"><img src={`/api/files/${m.file.id}`} alt={m.file.name} className="mt-2 max-h-64 rounded-lg" /></a>
                        : <a href={`/api/files/${m.file.id}?download=1`} className={clsx("mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs underline", mine ? "bg-black/10" : "bg-black/30")}><Paperclip size={12} />{m.file.name}</a>)}
                      <div className={clsx("mt-0.5 text-right text-[10px]", mine ? "text-black/60" : "text-neutral-500")}>{fmtDate(m.createdAt)} {fmtTime(m.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
              <ScrollBottom dep={msgs.length} />
            </div>
            <Composer action={sendMessage} conversationId={active.id} />
          </>
        ) : <div className="grid flex-1 place-items-center p-6"><Empty title="Elegí una conversación">O iniciá un chat nuevo desde el panel.</Empty></div>}
      </section>
    </div>
  );
}

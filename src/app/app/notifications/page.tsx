import Link from "next/link";
import { Bell, MessageSquare, AlertTriangle, Trophy, CalendarCheck, Gauge, Film, Megaphone } from "lucide-react";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty, fmtDate, fmtTime } from "@/components/ui";
import { Submit } from "@/components/forms";

export const metadata = { title: "Notificaciones" };

const ICON: Record<string, React.ReactNode> = { MENSAJE: <MessageSquare size={16} />, ALERTA: <AlertTriangle size={16} />, COMPETENCIA: <Trophy size={16} />, SESION: <CalendarCheck size={16} />, EVALUACION: <Gauge size={16} />, VIDEO: <Film size={16} />, AVISO: <Megaphone size={16} /> };

async function markAll() {
  "use server";
  const u = await requireUser();
  await db.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app", "layout");
}

export default async function NotificationsPage() {
  const u = await requireUser();
  const items = await db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Notificaciones" actions={<form action={markAll}><Submit className="btn-ghost">Marcar todas como leídas</Submit></form>} />
      {items.length === 0 ? <Empty title="Sin notificaciones" /> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "#"} className={`card flex items-start gap-3 p-3 transition hover:border-volt/40 ${n.readAt ? "opacity-60" : ""}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${n.kind === "ALERTA" ? "bg-red-500/15 text-red-300" : "bg-volt/15 text-volt"}`}>{ICON[n.kind] ?? <Bell size={16} />}</span>
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{n.title}</div>{n.body && <div className="truncate text-xs muted">{n.body}</div>}</div>
                <span className="shrink-0 text-[11px] text-neutral-600">{fmtDate(n.createdAt)} {fmtTime(n.createdAt)}</span>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-volt" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

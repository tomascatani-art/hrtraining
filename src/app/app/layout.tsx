import { avatarSrc } from "@/lib/avatar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { accentVars, logoUrl } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  // Cuenta pausada por falta de pago: solo la pantalla de cuota, el chat y las notificaciones
  if (u.role === "ATHLETE" && u.athleteProfile?.paused) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!/^\/app\/(paused|pay|messages|notifications)/.test(path)) redirect("/app/paused");
  }
  // Una sola consulta para los mensajes sin leer (antes era una por conversación y frenaba cada pantalla).
  const [[unread], unreadNotifications] = await Promise.all([
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Message" m JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${u.id} WHERE m."createdAt" > cm."lastReadAt" AND m."senderId" <> ${u.id}`,
    db.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  const o = u.org;
  const brand = o.brandName || o.logoKey ? { name: o.brandName || o.name, logo: logoUrl(o) } : null;
  return (
    <div className="contents" style={accentVars(o.brandColor) as React.CSSProperties | undefined}>
    <Shell
      brand={brand}
      user={{ name: u.name, role: u.role, org: u.org.name, avatar: avatarSrc(u) }}
      unreadMessages={Number(unread?.n ?? 0)}
      unreadNotifications={unreadNotifications}
      isDemo={u.org.isDemo}
      paused={u.role === "ATHLETE" && !!u.athleteProfile?.paused}
    >
      {children}
    </Shell>
    </div>
  );
}

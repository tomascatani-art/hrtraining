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
  const memberships = await db.conversationMember.findMany({ where: { userId: u.id }, select: { conversationId: true, lastReadAt: true } });
  const unreadCounts = await Promise.all(
    memberships.map((m) => db.message.count({ where: { conversationId: m.conversationId, createdAt: { gt: m.lastReadAt }, senderId: { not: u.id } } })),
  );
  const unreadNotifications = await db.notification.count({ where: { userId: u.id, readAt: null } });
  const o = u.org;
  const brand = o.brandName || o.logoKey ? { name: o.brandName || o.name, logo: logoUrl(o) } : null;
  return (
    <div className="contents" style={accentVars(o.brandColor) as React.CSSProperties | undefined}>
    <Shell
      brand={brand}
      user={{ name: u.name, role: u.role, org: u.org.name, avatar: avatarSrc(u) }}
      unreadMessages={unreadCounts.reduce((a, b) => a + b, 0)}
      unreadNotifications={unreadNotifications}
      isDemo={u.org.isDemo}
      paused={u.role === "ATHLETE" && !!u.athleteProfile?.paused}
    >
      {children}
    </Shell>
    </div>
  );
}

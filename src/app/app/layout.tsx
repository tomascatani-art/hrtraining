import { avatarSrc } from "@/lib/avatar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { runFeeReminders } from "@/lib/fee-reminders";
import { Shell } from "@/components/shell";
import { accentVars, logoUrl } from "@/lib/brand";
import { startOfDay } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  // Cuenta pausada por falta de pago: solo la pantalla de cuota, el chat y las notificaciones
  if (u.role === "ATHLETE" && u.athleteProfile?.paused) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!/^\/app\/(paused|pay|messages|notifications)/.test(path)) redirect("/app/paused");
  }
  // Última conexión (para el panel del entrenador). Se anota como mucho cada 3 minutos.
  const now = new Date();
  if (!u.lastSeenAt || +now - +u.lastSeenAt > 3 * 60_000) {
    const newDay = !u.lastSeenAt || u.lastSeenAt < startOfDay(now);
    // Se anota después de responder, así la pantalla no espera esta escritura.
    after(() => db.user.update({ where: { id: u.id }, data: { lastSeenAt: now, ...(newDay ? { firstSeenAt: now } : {}) } }).catch(() => {}));
  }
  // Recordatorios automáticos de cuota (una vez por día, después de responder)
  after(() => runFeeReminders(u.orgId).catch(() => {}));
  // Los mensajes internos ya no se usan: solo se cuentan las notificaciones (una consulta menos por pantalla).
  const unreadNotifications = await db.notification.count({ where: { userId: u.id, readAt: null } });
  const o = u.org;
  const brand = o.brandName || o.logoKey ? { name: o.brandName || o.name, logo: logoUrl(o) } : null;
  return (
    <div className="contents" style={accentVars(o.brandColor) as React.CSSProperties | undefined}>
    <Shell
      brand={brand}
      user={{ name: u.name, role: u.role, org: u.org.name, avatar: avatarSrc(u) }}
      unreadMessages={0}
      unreadNotifications={unreadNotifications}
      isDemo={u.org.isDemo}
      paused={u.role === "ATHLETE" && !!u.athleteProfile?.paused}
    >
      {children}
    </Shell>
    </div>
  );
}

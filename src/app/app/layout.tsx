import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const memberships = await db.conversationMember.findMany({ where: { userId: u.id }, select: { conversationId: true, lastReadAt: true } });
  const unreadCounts = await Promise.all(
    memberships.map((m) => db.message.count({ where: { conversationId: m.conversationId, createdAt: { gt: m.lastReadAt }, senderId: { not: u.id } } })),
  );
  const unreadNotifications = await db.notification.count({ where: { userId: u.id, readAt: null } });
  return (
    <Shell
      user={{ name: u.name, role: u.role, org: u.org.name }}
      unreadMessages={unreadCounts.reduce((a, b) => a + b, 0)}
      unreadNotifications={unreadNotifications}
      isDemo={u.org.isDemo}
    >
      {children}
    </Shell>
  );
}

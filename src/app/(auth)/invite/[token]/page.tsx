import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { InviteForm } from "@/components/auth-forms";
import { Logo } from "@/components/ui";
import { accentVars, logoUrl } from "@/lib/brand";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await db.user.findUnique({ where: { inviteToken: token }, include: { org: true } });
  if (!user) notFound();
  return (
    <div className="animate-rise" style={accentVars(user.org.brandColor) as React.CSSProperties | undefined}>
      {(user.org.brandName || user.org.logoKey) && <div className="mb-6"><Logo size={44} brand={{ name: user.org.brandName || user.org.name, logo: logoUrl(user.org) }} /></div>}
      <div className="label text-volt">Invitación</div>
      <h1 className="h1 mt-1">Hola, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 mb-6 text-sm muted">Te sumaron a <b className="text-white">{user.org.brandName || user.org.name}</b> como {user.role === "ATHLETE" ? "deportista" : "entrenador"}. Elegí tu contraseña para entrar.</p>
      <InviteForm token={token} />
    </div>
  );
}

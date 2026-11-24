import Link from "next/link";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/account-mail";
import { ResetForm } from "@/components/auth-forms";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await db.user.findUnique({ where: { resetTokenHash: hashToken(token) }, select: { name: true, resetExpires: true } });
  const valid = !!user?.resetExpires && user.resetExpires > new Date();
  return (
    <div className="animate-rise">
      <h1 className="h1">{valid ? `Hola, ${user!.name.split(" ")[0]}` : "Enlace vencido"}</h1>
      {valid ? (
        <>
          <p className="mt-1 mb-6 text-sm muted">Elegí tu contraseña nueva (mínimo 8 caracteres).</p>
          <ResetForm token={token} />
        </>
      ) : (
        <p className="mt-2 text-sm muted">Este enlace ya se usó o venció. <Link href="/forgot" className="text-volt hover:underline">Pedí uno nuevo</Link>.</p>
      )}
    </div>
  );
}

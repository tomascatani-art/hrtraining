import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LoginForm } from "@/components/auth-forms";
import { Logo } from "@/components/ui";
import { accentVars, logoUrl } from "@/lib/brand";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await db.organization.findUnique({ where: { slug }, select: { name: true, brandName: true } });
  return { title: org ? `Ingresar · ${org.brandName || org.name}` : "Página no encontrada" };
}

/** Pantalla de ingreso con la marca del club. */
export default async function ClubLogin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) notFound();
  const name = org.brandName || org.name;
  return (
    <div className="grid min-h-dvh place-items-center bg-grid p-5" style={accentVars(org.brandColor) as React.CSSProperties | undefined}>
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} withText={false} brand={{ name, logo: logoUrl(org) }} />
          <h1 className="h1 mt-4">{name}</h1>
          <p className="mt-1 text-sm muted">Ingresá para ver tus entrenamientos</p>
        </div>
        <div className="card card-pad"><LoginForm /><p className="mt-3 text-right text-sm"><a href="/forgot" className="text-neutral-400 hover:text-volt">¿Olvidaste tu contraseña?</a></p></div>
        <div className="mx-auto mt-6 h-1.5 w-24 rounded hazard" />
        <p className="mt-4 text-center text-xs text-neutral-600">Con tecnología Hrtraining</p>
      </div>
    </div>
  );
}

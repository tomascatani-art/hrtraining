import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string; clave?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="animate-rise">
      <h1 className="h1">Ingresar</h1>
      <p className="mt-1 mb-6 text-sm muted">¿No tenés cuenta? Pedísela a tu preparador físico.</p>
      {sp.clave === "1" && <p className="mb-4 rounded-xl border border-volt/40 bg-volt/10 p-3 text-sm text-volt">Listo, ya podés ingresar con tu contraseña nueva.</p>}
      <LoginForm next={sp.next} />
      <p className="mt-3 text-right text-sm"><Link href="/forgot" className="text-neutral-400 hover:text-volt">¿Olvidaste tu contraseña?</Link></p>
    </div>
  );
}

import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { demoLoginAction } from "../actions";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string; clave?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="animate-rise">
      <h1 className="h1">Ingresar</h1>
      <p className="mt-1 mb-6 text-sm muted">¿No tenés cuenta? <Link href="/register" className="text-volt hover:underline">Creá tu cuenta</Link></p>
      {sp.clave === "1" && <p className="mb-4 rounded-xl border border-volt/40 bg-volt/10 p-3 text-sm text-volt">Listo, ya podés ingresar con tu contraseña nueva.</p>}
      <LoginForm next={sp.next} />
      <p className="mt-3 text-right text-sm"><Link href="/forgot" className="text-neutral-400 hover:text-volt">¿Olvidaste tu contraseña?</Link></p>
      {/* La demo queda oculta: solo se ve entrando a /login?demo=1 (para mostrarla a un cliente) */}
      {(sp.demo === "1" || sp.demo === "missing") && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-neutral-600"><div className="h-px flex-1 bg-ink-700" />demo<div className="h-px flex-1 bg-ink-700" /></div>
          {sp.demo === "missing" && <p className="mb-3 text-sm text-amber-300">La demo no está cargada.</p>}
          <form action={demoLoginAction} className="grid grid-cols-2 gap-2">
            <button name="as" value="coach" className="btn-ghost">Entrenador demo</button>
            <button name="as" value="athlete" className="btn-ghost">Deportista demo</button>
          </form>
          <p className="mt-3 text-xs text-neutral-600">La demo usa datos ficticios marcados como DEMO.</p>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { demoLoginAction } from "../actions";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="animate-rise">
      <h1 className="h1">Ingresar</h1>
      <p className="mt-1 mb-6 text-sm muted">¿No tenés cuenta? <Link href="/register" className="text-volt hover:underline">Creá tu espacio de trabajo</Link></p>
      <LoginForm next={sp.next} />
      <div className="my-6 flex items-center gap-3 text-xs text-neutral-600"><div className="h-px flex-1 bg-ink-700" />o explorá la demo<div className="h-px flex-1 bg-ink-700" /></div>
      {sp.demo === "missing" && <p className="mb-3 text-sm text-amber-300">La demo no está cargada. Ejecutá <code>npm run db:seed</code>.</p>}
      <form action={demoLoginAction} className="grid grid-cols-2 gap-2">
        <button name="as" value="coach" className="btn-ghost">Entrenador demo</button>
        <button name="as" value="athlete" className="btn-ghost">Deportista demo</button>
      </form>
      <p className="mt-3 text-xs text-neutral-600">La demo usa datos ficticios marcados como DEMO. No corresponden a personas reales.</p>
    </div>
  );
}

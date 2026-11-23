import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-grid grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-ink-700 bg-ink-950 p-10">
        <Link href="/"><Logo size={36} /></Link>
        <div className="relative z-10">
          <div className="label text-volt">Plataforma de alto rendimiento</div>
          <h2 className="mt-3 font-display text-5xl font-bold leading-[1.05] text-white">
            Planificá.<br />Medí.<br /><span className="text-volt">Rendí más.</span>
          </h2>
          <p className="mt-5 max-w-md text-neutral-400">Periodización, evaluaciones físicas, control de cargas y análisis de video en un solo lugar, para entrenadores y deportistas.</p>
        </div>
        <div className="h-2 w-40 hazard rounded" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-volt/10 blur-3xl" />
      </aside>
      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Link href="/"><Logo /></Link></div>
          {children}
        </div>
      </main>
    </div>
  );
}

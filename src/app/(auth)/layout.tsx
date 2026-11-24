import { Logo } from "@/components/ui";

// Entrada a la app: solo el logo y el formulario, en compu y en celular.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-950 flex items-center justify-center p-5 sm:p-10">
      <main className="w-full max-w-sm">
        <div className="mb-10 flex justify-center"><Logo size={40} /></div>
        {children}
      </main>
    </div>
  );
}

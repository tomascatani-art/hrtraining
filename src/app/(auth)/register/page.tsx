import Link from "next/link";
import { redirect } from "next/navigation";
import { signupOpen } from "@/lib/signup";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Crear cuenta" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  // Las cuentas las crea el preparador: el alta libre está cerrada.
  if (!signupOpen()) redirect("/login");
  return (
    <div className="animate-rise">
      <h1 className="h1">Crear cuenta</h1>
      <p className="mt-1 mb-6 text-sm muted">Vas a ser el administrador de tu organización. Después podés sumar entrenadores y alumnos. <Link href="/login" className="text-volt hover:underline">Ya tengo cuenta</Link></p>
      <RegisterForm />
    </div>
  );
}

import Link from "next/link";
import { ForgotForm } from "@/components/auth-forms";

export const metadata = { title: "Recuperar contraseña" };

export default function ForgotPage() {
  return (
    <div className="animate-rise">
      <h1 className="h1">¿Olvidaste tu contraseña?</h1>
      <p className="mt-1 mb-6 text-sm muted">Escribí tu email. Tu entrenador recibe el aviso y te manda por WhatsApp un enlace para elegir una contraseña nueva.</p>
      <ForgotForm />
      <p className="mt-6 text-sm muted"><Link href="/login" className="text-volt hover:underline">Volver a ingresar</Link></p>
    </div>
  );
}

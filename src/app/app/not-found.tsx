import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card card-pad mx-auto mt-10 max-w-lg text-center">
      <h2 className="h2">No encontrado</h2>
      <p className="mt-2 text-sm muted">El recurso no existe o no tenés permiso para verlo.</p>
      <Link href="/app" className="btn-primary mt-5">Volver al inicio</Link>
    </div>
  );
}

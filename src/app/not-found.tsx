import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-grid p-5">
      <div className="card card-pad w-full max-w-sm text-center">
        <h1 className="h2">Página no encontrada</h1>
        <p className="mt-2 text-sm muted">El link no existe o ya no está disponible.</p>
        <Link href="/login" className="btn-primary mt-5">Ir al inicio</Link>
      </div>
    </div>
  );
}

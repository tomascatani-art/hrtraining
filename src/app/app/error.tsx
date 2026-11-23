"use client";
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card card-pad mx-auto mt-10 max-w-lg text-center">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded hazard" />
      <h2 className="h2">No pudimos completar la acción</h2>
      <p className="mt-2 text-sm muted">{error.message || "Ocurrió un error inesperado."}</p>
      <button onClick={reset} className="btn-primary mt-5">Reintentar</button>
    </div>
  );
}

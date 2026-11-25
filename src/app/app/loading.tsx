// Se muestra al instante cuando tocás algo, mientras llega la pantalla (así la app no parece trabada).
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-volt/20"><div className="h-full w-1/3 animate-[loadbar_1s_ease-in-out_infinite] bg-volt" /></div>
      <div className="mb-2 h-3 w-24 rounded bg-ink-800" />
      <div className="mb-6 h-8 w-64 max-w-full rounded-lg bg-ink-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-28 rounded-2xl border border-ink-700 bg-ink-900" />)}
      </div>
    </div>
  );
}

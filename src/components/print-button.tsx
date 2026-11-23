"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-[#ffd60a] print:hidden">Descargar PDF / Imprimir</button>;
}

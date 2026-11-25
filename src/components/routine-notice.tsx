import { Megaphone } from "lucide-react";

/** Aviso del entrenador, destacado arriba en Inicio y en Mi rutina. */
export function Notice({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-volt/60 bg-volt/[0.07] p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-volt"><Megaphone size={15} />Aviso de tu entrenador</div>
      <p className="whitespace-pre-line text-white">{text}</p>
    </div>
  );
}

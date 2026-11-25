"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Elegir un ejercicio escribiendo su nombre (sin scrollear la lista entera). */
export function ExerciseSearchSelect({ exercises, name = "exerciseId" }: { exercises: { id: string; name: string }[]; name?: string }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const first = words[0] ?? "";
    return exercises.filter((e) => words.every((w) => norm(e.name).includes(w)))
      .sort((a, b) => norm(a.name).indexOf(first) - norm(b.name).indexOf(first) || a.name.length - b.name.length).slice(0, 30);
  }, [q, exercises]);
  return (
    <div className="relative">
      <input type="hidden" name={name} value={sel?.id ?? ""} />
      <Search size={16} className="pointer-events-none absolute left-3 top-3 text-neutral-500" />
      <input
        value={sel ? sel.name : q} required={!sel} placeholder="Escribí el nombre… (ej: sentadilla)" className="input pl-9" autoComplete="off"
        onChange={(e) => { setSel(null); setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && !sel && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 shadow-xl">
          {list.length ? list.map((e) => (
            <li key={e.id}><button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { setSel(e); setOpen(false); }} className="block w-full px-3 py-2.5 text-left text-sm text-white hover:bg-ink-800">{e.name}</button></li>
          )) : <li className="px-3 py-2.5 text-sm muted">No hay ejercicios con ese nombre</li>}
        </ul>
      )}
    </div>
  );
}

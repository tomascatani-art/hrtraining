"use client";
import { useState, useTransition } from "react";
import { Link2, Check, Search } from "lucide-react";
import { youtubeSearch, youtubeId } from "@/lib/video";
import { VideoButton } from "@/components/video-player";

/** En la lista de la biblioteca: ver el video adentro de la app y pegar/cambiar el link de YouTube sin entrar al ejercicio. */
export function ExerciseLinkInline({ exerciseId, name, url, canEdit, save }: { exerciseId: string; name: string; url?: string | null; canEdit: boolean; save: (fd: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(url ?? "");
  const [cur, setCur] = useState(url ?? null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    setErr("");
    const fd = new FormData(); fd.set("exerciseId", exerciseId); fd.set("url", val.trim());
    try { await save(fd); setCur(val.trim() || null); setOpen(false); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); }
  });
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <VideoButton url={cur} name={name} />
      {canEdit && <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-volt"><Link2 size={12} />{cur ? "Cambiar link" : "Pegar link"}</button>}
      {open && (
        <div className="basis-full">
          <div className="mt-1 flex gap-2">
            <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())} placeholder="https://www.youtube.com/watch?v=…" className="input flex-1 py-1.5 text-sm" />
            <button type="button" onClick={submit} disabled={pending} className="btn-primary px-3 py-1.5 text-sm"><Check size={14} />{pending ? "…" : "Guardar"}</button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
            <a href={youtubeSearch(name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-400 hover:text-volt"><Search size={11} />Buscar en YouTube</a>
            {val && !youtubeId(val) && !err && <span className="text-neutral-500">No parece un link de YouTube; igual se guarda si es https.</span>}
            {err && <span className="text-red-400">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

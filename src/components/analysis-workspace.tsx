"use client";
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { VideoAnalyzer } from "./video-analyzer";
import { Submit } from "./forms";
import { Avatar } from "./ui";

type Comment = { id: string; body: string; atSecond: number | null; author: string; createdAt: string; mine: boolean };

export function AnalysisWorkspace({ id, srcA, srcB, drawings, comments, saveDrawings, addComment, readOnly }: {
  id: string; srcA: string; srcB: string | null; drawings: never[]; comments: Comment[];
  saveDrawings: (id: string, d: unknown) => Promise<unknown>; addComment: (fd: FormData) => Promise<void>; readOnly?: boolean;
}) {
  const t = useRef(0);
  const [stamp, setStamp] = useState(true);
  const [seek, setSeek] = useState<{ t: number; n: number }>();
  const [atLabel, setAtLabel] = useState("0:00.00");
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <VideoAnalyzer srcA={srcA} srcB={srcB} initial={drawings} onSave={(d) => saveDrawings(id, d)} readOnly={readOnly} seekTo={seek} onTime={(x) => { t.current = x; }} />
      <div className="space-y-4">
        <section className="card card-pad">
          <h2 className="h2 mb-3">Comentarios y correcciones</h2>
          <form action={async (fd) => { await addComment(fd); }} onSubmit={(e) => { const f = e.currentTarget; (f.elements.namedItem("atSecond") as HTMLInputElement).value = stamp ? String(t.current) : ""; }} className="space-y-2">
            <input type="hidden" name="analysisId" value={id} />
            <input type="hidden" name="atSecond" />
            <textarea name="body" required className="input" placeholder="Ej: rodilla en valgo al aterrizar, mantener el tronco más vertical…" onFocus={() => setAtLabel(fmt(t.current))} />
            <label className="flex items-center gap-2 text-xs text-neutral-400"><input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} />Vincular al momento actual ({atLabel})</label>
            <Submit className="btn-primary w-full">Comentar</Submit>
          </form>
          <ul className="mt-4 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2">
                <Avatar name={c.author} size={26} />
                <div className="min-w-0 flex-1 rounded-xl bg-ink-900 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs"><b className="text-white">{c.author}</b>{c.atSecond != null && <button type="button" onClick={() => setSeek({ t: c.atSecond!, n: Date.now() })} className="num rounded bg-volt/15 px-1.5 text-volt hover:bg-volt/25">{fmt(c.atSecond)}</button>}<span className="ml-auto text-neutral-600">{new Date(c.createdAt).toLocaleDateString("es-AR")}</span></div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-200">{c.body}</p>
                </div>
              </li>
            ))}
            {comments.length === 0 && <li className="text-sm muted">Todavía no hay comentarios.</li>}
          </ul>
        </section>
        <section className="card card-pad border-dashed">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-volt" /><h3 className="font-semibold text-white">Asistente IA de movimiento</h3><span className="chip-mute">Próximamente</span></div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">Detectará puntos articulares y patrones (valgo de rodilla, inclinación del tronco, simetría) y propondrá observaciones técnicas. Cada sugerencia quedará en estado “pendiente de validación” hasta que el entrenador la confirme o la descarte. Las mediciones manuales de esta pantalla ya alimentan ese historial.</p>
        </section>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { PlayCircle, X, ExternalLink, Search } from "lucide-react";
import { youtubeId, realVideo, youtubeSearch } from "@/lib/video";

/** Reproductor dentro de la app (sin salir a YouTube). */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const id = youtubeId(url);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (id) return (
    <div>
      {origin && <iframe className="aspect-video w-full rounded-xl bg-black" title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        src={`https://www.youtube.com/embed/${id}?playsinline=1&rel=0&origin=${encodeURIComponent(origin)}`} />}
      <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1 text-xs text-neutral-400 hover:text-volt">¿No se ve? Abrir en YouTube <ExternalLink size={12} /></a>
    </div>
  );
  if (url.startsWith("/api/files/") || /\.(mp4|webm|mov)(\?|$)/i.test(url)) return <video src={url} controls playsInline className="aspect-video w-full rounded-xl bg-black" />;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full"><ExternalLink size={15} />Abrir video</a>;
}

/** Nombre del ejercicio que abre el video en una ventana. Sin video: botón para buscarlo en YouTube. */
export function VideoButton({ url, name, compact }: { url?: string | null; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const v = realVideo(url);
  if (!v) return compact ? null : <a href={youtubeSearch(name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-volt"><Search size={12} />Buscar video</a>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-volt hover:underline" aria-label={`Ver video de ${name}`}>
        <PlayCircle size={compact ? 16 : 14} />{!compact && "Ver video"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-2"><div className="truncate font-semibold text-white">{name}</div><button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white" aria-label="Cerrar"><X size={18} /></button></div>
            <VideoEmbed url={v} title={name} />
          </div>
        </div>
      )}
    </>
  );
}

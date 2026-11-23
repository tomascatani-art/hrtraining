"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";

export function AutoRefresh({ ms = 6000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => { const i = setInterval(() => router.refresh(), ms); return () => clearInterval(i); }, [router, ms]);
  return null;
}

export function ScrollBottom({ dep }: { dep: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "end" }); }, [dep]);
  return <div ref={ref} />;
}

export function Composer({ action, conversationId }: { action: (fd: FormData) => Promise<void>; conversationId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f: File) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/files/upload", { method: "POST", body: fd });
    const j = await r.json(); setBusy(false);
    if (r.ok) setFile({ id: j.id, name: j.name }); else alert(j.error ?? "No se pudo subir");
  };
  return (
    <form ref={form} action={async (fd) => { await action(fd); form.current?.reset(); setFile(null); }} className="border-t border-ink-700 p-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="fileId" value={file?.id ?? ""} />
      {file && <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-ink-800 px-2 py-1 text-xs text-neutral-300"><Paperclip size={12} />{file.name}<button type="button" onClick={() => setFile(null)}><X size={12} /></button></div>}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Adjuntar" disabled={busy}><Paperclip size={17} /></button>
        <textarea name="body" rows={1} className="input max-h-40 min-h-[44px] resize-none" placeholder={busy ? "Subiendo archivo…" : "Escribí un mensaje…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.current?.requestSubmit(); } }} />
        <button className="btn-primary h-11 w-11 shrink-0 p-0" aria-label="Enviar" disabled={busy}><Send size={17} /></button>
      </div>
      <input ref={fileInput} type="file" className="hidden" accept="video/*,image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </form>
  );
}

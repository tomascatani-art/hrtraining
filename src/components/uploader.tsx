"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";

export function Uploader({ athletes, accept, defaultAthlete, allowShare, label = "Subir archivo", onUploaded, compact, folders, defaultFolder }: {
  athletes?: { id: string; name: string }[]; accept?: string; defaultAthlete?: string; allowShare?: boolean; label?: string;
  onUploaded?: (f: { id: string; name: string; kind: string }) => void; compact?: boolean;
  folders?: { key: string; label: string }[]; defaultFolder?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [athleteId, setAthleteId] = useState(defaultAthlete ?? "");
  const [shared, setShared] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [folder, setFolder] = useState(defaultFolder ?? folders?.[0]?.key ?? "");
  const [note, setNote] = useState("");

  const send = (file: File) => {
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (athleteId) fd.append("athleteId", athleteId);
    fd.append("shared", String(shared));
    if (folders && folder) fd.append("folder", folder);
    if (folders && note.trim()) fd.append("note", note.trim());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      const res = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 300) return setError(res.error ?? "No se pudo subir el archivo");
      setNote("");
      onUploaded?.(res);
      router.refresh();
    };
    xhr.onerror = () => { setProgress(null); setError("Error de red al subir"); };
    xhr.send(fd);
  };

  return (
    <div className="space-y-3">
      {athletes && athletes.length > 0 && (
        <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className="input">
          <option value="">Sin deportista asociado</option>
          {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      {folders && (
        <>
          <select value={folder} onChange={(e) => setFolder(e.target.value)} className="input" aria-label="Carpeta">
            {folders.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" maxLength={300} placeholder="Nota opcional (ej.: medición de marzo, hecha por la nutricionista)" aria-label="Nota" />
        </>
      )}
      {allowShare && <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Compartir con toda la organización</label>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) send(f); }}
        onClick={() => input.current?.click()}
        className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed text-center transition ${compact ? "p-4" : "p-8"} ${drag ? "border-volt bg-volt/5" : "border-ink-600 hover:border-volt/50"}`}>
        <UploadCloud className="mb-2 text-volt" size={compact ? 22 : 30} />
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs muted">Arrastrá o tocá para elegir · hasta 300 MB</div>
        {progress != null && <div className="mt-3 h-1.5 w-full max-w-xs rounded-full bg-ink-700"><div className="h-full rounded-full bg-volt transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
      {error && <div className="text-sm text-red-300">{error}</div>}
    </div>
  );
}

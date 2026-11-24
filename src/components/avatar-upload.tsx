"use client";
import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui";
import { setAvatar, removeAvatar } from "@/app/app/profile-photo/actions";

/** Recorta la foto al centro en un cuadrado de 400 px y la comprime (queda liviana, ~50 KB). */
async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.85));
}

export function AvatarUpload({ userId, name, src, size = 88 }: { userId: string; name: string; src: string | null; size?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(src);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = async (f: File) => {
    setError(null);
    try {
      const blob = await squareJpeg(f);
      setPreview(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("userId", userId);
      fd.append("photo", new File([blob], "foto.jpg", { type: "image/jpeg" }));
      start(async () => { try { await setAvatar(fd); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer la foto"); }
  };

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="group relative shrink-0 rounded-full" aria-label="Cambiar foto de perfil">
        <Avatar name={name} size={size} src={preview} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100"><Camera size={size * 0.28} /></span>
      </button>
      <div className="space-y-1.5">
        <button type="button" onClick={() => input.current?.click()} className="btn-ghost btn-sm" disabled={pending}><Camera size={14} />{pending ? "Guardando…" : preview ? "Cambiar foto" : "Subir foto"}</button>
        {preview && !pending && (
          <button type="button" className="block text-xs text-neutral-500 hover:text-red-300" onClick={() => { const fd = new FormData(); fd.append("userId", userId); setPreview(null); start(() => removeAvatar(fd)); }}>
            <Trash2 size={12} className="mr-1 inline" />Quitar foto
          </button>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
    </div>
  );
}

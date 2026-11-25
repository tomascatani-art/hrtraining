"use client";
import { useState } from "react";
import { FileDown, MessageCircle } from "lucide-react";

/** Descargar el PDF de la rutina o mandarlo por WhatsApp (en el celular se adjunta el archivo). */
export function RoutinePdfButtons({ id, fileName, phoneText }: { id: string; fileName: string; phoneText: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const url = `/api/routines/${id}/pdf`;
  const share = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const file = new File([await res.blob()], `${fileName}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: fileName, text: phoneText }); return; }
      // En la compu: se descarga el PDF y se abre WhatsApp con el mensaje para adjuntarlo.
      const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
      window.open(`https://wa.me/?text=${encodeURIComponent(phoneText)}`, "_blank", "noopener");
      setMsg("Se descargó el PDF: adjuntalo en el chat de WhatsApp que se abrió.");
    } catch (e) { if ((e as Error)?.name !== "AbortError") setMsg("No se pudo generar el PDF. Probá de nuevo."); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <a href={url} target="_blank" rel="noopener" className="btn-ghost justify-center"><FileDown size={16} />PDF de la rutina</a>
        <button type="button" onClick={share} disabled={busy} className="btn-ghost justify-center"><MessageCircle size={16} />{busy ? "Preparando…" : "Mandar por WhatsApp"}</button>
      </div>
      {msg && <p className="text-xs text-volt">{msg}</p>}
    </div>
  );
}

import { MessageCircle } from "lucide-react";

/** Abre WhatsApp con el mensaje listo; el entrenador elige el contacto (o va directo si hay número). */
export function WhatsAppShare({ text, phone, label = "Mandar por WhatsApp" }: { text: string; phone?: string | null; label?: string }) {
  const num = (phone ?? "").replace(/\D/g, "");
  const href = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  return <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary w-full sm:w-auto"><MessageCircle size={16} />{label}</a>;
}

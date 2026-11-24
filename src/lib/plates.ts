// Cálculos sin acceso a datos: se usan tanto en el servidor como en el navegador.

export const BAR_KG = 20;
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Redondea a un peso que se pueda armar con barra olímpica (20 kg) y discos de 1,25 kg en adelante. Por debajo de la barra, a 0,5 kg. */
export function roundToPlates(kg: number) {
  if (!Number.isFinite(kg) || kg <= 0) return kg;
  if (kg < BAR_KG) return Math.round(kg * 2) / 2;
  return BAR_KG + Math.round((kg - BAR_KG) / 2.5) * 2.5;
}

/** Discos por lado para un peso total con barra de 20 kg. */
export function plateBreakdown(total: number) {
  if (!(total >= BAR_KG)) return [];
  let side = (total - BAR_KG) / 2;
  const out: number[] = [];
  for (const p of PLATES) while (side + 1e-9 >= p) { out.push(p); side -= p; }
  return out;
}

/** Kilos sugeridos para un % del RM, redondeados a discos. */
export function kgFromPercent(rm: number, pct: number) {
  const exact = (rm * pct) / 100;
  const rounded = roundToPlates(exact);
  return { exact: Math.round(exact * 10) / 10, rounded, adjusted: Math.abs(rounded - exact) > 0.05 };
}

export const NOTE_KINDS = {
  MOLESTIA: { label: "Dolor o molestia", color: "#d9566f" },
  ESFUERZO: { label: "Le costó / cansancio", color: "#f2a93b" },
  BIEN: { label: "Se sintió bien", color: "#5cc26b" },
} as const;

/** Clasifica un comentario libre por palabras clave. Es orientativo: no interpreta síntomas. */
export function classifyNote(text?: string | null): keyof typeof NOTE_KINDS | null {
  if (!text) return null;
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/dolor|molest|lesion|tiron|pinch|contractur|duele/.test(t)) return "MOLESTIA";
  if (/costo|cansad|pesad|dificil|duro|fatig|agotad|sin fuerza/.test(t)) return "ESFUERZO";
  if (/bien|facil|energia|liviano|comod|genial|excelente|subi el peso/.test(t)) return "BIEN";
  return null;
}
export const fmtKg = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

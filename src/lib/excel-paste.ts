// Convierte lo que se copia de una planilla (Excel / Google Sheets) en días, bloques y ejercicios.
// Sirve en el navegador. Formato flexible:
//   DÍA 1 - Inferior            ← fila que empieza con "Día" / "Dia" / "D1": arranca un día
//   ACTIVACIÓN                  ← fila con un solo texto (sin series): arranca un bloque
//   Sentadilla | 3x8 | 3x8 | 4x6   ← ejercicio + una columna por semana (un link https se toma como video)
//   Ejercicio | Semana 1 | Semana 2  ← encabezado: se ignora (y define cuántas semanas hay)
//   Entrada en calor / Calentamiento ← lo que sigue va a la entrada en calor
import { emptyBlock, emptyRow, newId, WEEKDAYS, MAX_WEEKS, type RoutineDay, type WarmupItem } from "./routine";
import { normalizeLink } from "./video";

export type Parsed = { days: RoutineDay[]; warmup: WarmupItem[]; weeks: number; exercises: number };

const clean = (s: string) => s.replace(/ /g, " ").trim();
const isDay = (s: string) => /^(d[ií]a|dia|d)\s*\d+\b/i.test(s) || WEEKDAYS.some((w) => s.toLowerCase().startsWith(w.toLowerCase()));
const isWarm = (s: string) => /^(entrada en calor|calentamiento|activaci[oó]n general)/i.test(s);
const isHeader = (cells: string[]) => /^(ejercicio|ejercicios|nombre)$/i.test(cells[0] ?? "") || cells.slice(1).some((c) => /^(s|sem|semana)\s*\d+$/i.test(c));
const looksLikeLoad = (s: string) => /\d/.test(s) && s.length <= 40;

export function parseSheet(text: string, fallbackWeeks = 4): Parsed {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.split("\t").map(clean)).filter((c) => c.some(Boolean));
  // Semanas: el encabezado manda; si no, la mayor cantidad de columnas con series
  let weeks = 0;
  for (const c of lines) if (isHeader(c)) weeks = Math.max(weeks, c.slice(1).filter((x) => /\d/.test(x)).length);
  if (!weeks) for (const c of lines) weeks = Math.max(weeks, c.slice(1).filter((x) => x && !normalizeLink(x) && looksLikeLoad(x)).length);
  weeks = Math.min(MAX_WEEKS, Math.max(1, weeks || fallbackWeeks));

  const days: RoutineDay[] = [];
  const warmup: WarmupItem[] = [];
  let day: RoutineDay | null = null;
  let inWarm = false;
  let exercises = 0;
  const ensureDay = () => { if (!day) { day = { id: newId(), name: `DÍA ${days.length + 1}`, blocks: [] }; days.push(day); } return day; };

  for (const c of lines) {
    if (isHeader(c)) continue;
    const filled = c.filter(Boolean);
    const first = filled[0] ?? "";
    if (filled.length === 1 || (filled.length <= 2 && !c.slice(1).some(looksLikeLoad))) {
      if (isWarm(first)) { inWarm = true; continue; }
      if (isDay(first)) {
        inWarm = false;
        const wd = WEEKDAYS.find((w) => first.toLowerCase().includes(w.toLowerCase()));
        day = { id: newId(), name: first.toUpperCase().slice(0, 60), ...(wd ? { weekday: wd } : {}), blocks: [] };
        days.push(day);
        continue;
      }
      if (filled.length === 1 && !looksLikeLoad(first) && first.length <= 40 && !inWarm) {
        ensureDay().blocks.push(emptyBlock(first.toUpperCase()));
        continue;
      }
    }
    // Ejercicio
    const name = first.slice(0, 120);
    if (!name) continue;
    const rest = c.slice(c.indexOf(first) + 1);
    const video = rest.map((x) => normalizeLink(x)).find(Boolean) ?? null;
    const loads = rest.filter((x) => x && !normalizeLink(x));
    if (inWarm) {
      warmup.push({ id: newId(), name, detail: loads.join(" · ").slice(0, 120), video });
      continue;
    }
    const d = ensureDay();
    if (!d.blocks.length) d.blocks.push(emptyBlock());
    const cells = Array.from({ length: weeks }, (_, i) => (loads[i] ?? "").slice(0, 40));
    const extra = loads.slice(weeks).join(" · ");
    d.blocks[d.blocks.length - 1].rows.push(emptyRow(weeks, { name, video, cells, note: extra.slice(0, 200) }));
    exercises++;
  }
  // Días sin ejercicios no sirven
  return { days: days.filter((d) => d.blocks.some((b) => b.rows.length)).map((d) => ({ ...d, blocks: d.blocks.filter((b) => b.rows.length) })), warmup, weeks, exercises };
}

import "server-only";
import ExcelJS from "exceljs";
import { SPORTS } from "@/lib/catalog";

// Carga masiva de deportistas desde Excel (.xlsx) o CSV.
export const IMPORT_COLUMNS = ["Nombre y apellido", "Email", "Deporte", "Puesto", "Grupo", "Fecha de nacimiento", "Sexo", "Altura (cm)", "Peso (kg)", "Cuota mensual"] as const;
export const MAX_ROWS = 500;

export type ImportRow = {
  line: number; name: string; email: string; sport: string; position: string | null; group: string | null;
  birthDate: string | null; sex: "F" | "M" | null; heightCm: number | null; weightKg: number | null; fee: number | null;
  errors: string[]; warnings: string[];
};

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const HEADERS: Record<string, keyof ImportRow> = {
  "nombre y apellido": "name", nombre: "name", "nombre completo": "name", deportista: "name", alumno: "name",
  email: "email", mail: "email", "e mail": "email", correo: "email",
  deporte: "sport", puesto: "position", posicion: "position", prueba: "position",
  grupo: "group", categoria: "group", equipo: "group",
  "fecha de nacimiento": "birthDate", nacimiento: "birthDate", "fecha nacimiento": "birthDate",
  sexo: "sex", genero: "sex", altura: "heightCm", talla: "heightCm", estatura: "heightCm", peso: "weightKg",
  "cuota mensual": "fee", cuota: "fee",
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;           // hipervínculo
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);       // fórmula
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
  }
  return String(v);
}

function parseCsv(text: string): string[][] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export async function readSheet(buf: Buffer, filename: string): Promise<string[][]> {
  if (/\.csv$/i.test(filename) || /\.txt$/i.test(filename)) return parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => { const vals: string[] = []; for (let c = 1; c <= Math.max(r.cellCount, IMPORT_COLUMNS.length); c++) vals.push(cellText(r.getCell(c).value).trim()); out.push(vals); });
  return out.filter((r) => r.some((x) => x));
}

const sportKey = (s: string) => {
  const n = norm(s);
  if (!n) return "GENERAL";
  for (const [k, v] of Object.entries(SPORTS)) if (norm(k) === n || norm(v.label) === n || norm(v.label).startsWith(n)) return k;
  return null;
};
const num = (s: string) => { const t = s.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."); if (!t) return null; const n = Number(t.replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : NaN; };
const date = (s: string) => {
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s); if (m) { const y = m[3].length === 2 ? (Number(m[3]) > 30 ? "19" : "20") + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return "x";
};

/** Convierte la planilla en filas validadas. Reconoce los encabezados aunque varíen un poco. */
export function toRows(table: string[][], existingEmails: Set<string>): { rows: ImportRow[]; missing: string[] } {
  if (!table.length) return { rows: [], missing: ["Nombre y apellido", "Email"] };
  const header = table[0].map((h) => HEADERS[norm(h)] ?? null);
  const missing = (["name", "email"] as const).filter((k) => !header.includes(k)).map((k) => (k === "name" ? "Nombre y apellido" : "Email"));
  if (missing.length) return { rows: [], missing };
  const seen = new Set<string>();
  const rows = table.slice(1, MAX_ROWS + 1).map((cells, i): ImportRow => {
    const get = (k: keyof ImportRow) => { const idx = header.indexOf(k); return idx >= 0 ? (cells[idx] ?? "").trim() : ""; };
    const errors: string[] = [], warnings: string[] = [];
    const name = get("name").replace(/\s+/g, " ");
    const email = get("email").toLowerCase();
    if (name.length < 2) errors.push("Falta el nombre");
    if (/^ejemplo/i.test(name)) errors.push("Es la fila de ejemplo de la plantilla");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email inválido");
    else if (existingEmails.has(email)) errors.push("Ya existe un usuario con ese email");
    else if (seen.has(email)) errors.push("Email repetido en la planilla");
    seen.add(email);
    let sport = sportKey(get("sport"));
    if (!sport) { warnings.push(`Deporte "${get("sport")}" no reconocido: se carga como general`); sport = "GENERAL"; }
    const sx = norm(get("sex"));
    const sex = !sx ? null : sx.startsWith("f") || sx.startsWith("muj") ? "F" : sx.startsWith("m") || sx.startsWith("var") || sx.startsWith("hom") ? "M" : null;
    if (sx && !sex) warnings.push("Sexo no reconocido");
    const b = date(get("birthDate")); if (b === "x") warnings.push("Fecha de nacimiento no reconocida (usá dd/mm/aaaa)");
    const h = num(get("heightCm")), w = num(get("weightKg")), fee = num(get("fee"));
    if (h !== null && (Number.isNaN(h) || h < 80 || h > 250)) warnings.push("Altura fuera de rango (en cm)");
    if (w !== null && (Number.isNaN(w) || w < 15 || w > 250)) warnings.push("Peso fuera de rango (en kg)");
    if (fee !== null && (Number.isNaN(fee) || fee < 0)) warnings.push("Cuota no reconocida");
    return {
      line: i + 2, name, email, sport, position: get("position") || null, group: get("group") || null,
      birthDate: b && b !== "x" ? b : null, sex,
      heightCm: h !== null && !Number.isNaN(h) && h >= 80 && h <= 250 ? h : null,
      weightKg: w !== null && !Number.isNaN(w) && w >= 15 && w <= 250 ? w : null,
      fee: fee !== null && !Number.isNaN(fee) && fee >= 0 ? fee : null,
      errors, warnings,
    };
  });
  return { rows, missing: [] };
}

export async function templateWorkbook() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Deportistas");
  ws.addRow([...IMPORT_COLUMNS]);
  ws.addRow(["Ejemplo: Juan Pérez", "juan@ejemplo.com", "Fútbol", "Mediocampista", "Primera", "15/03/2004", "M", 178, 72, 25000]);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD60A" } };
  ws.getRow(2).font = { italic: true, color: { argb: "FF737373" } };
  ws.columns.forEach((c) => (c.width = 22));
  const sports = Object.values(SPORTS).map((s) => s.label);
  const help = wb.addWorksheet("Ayuda");
  help.addRows([["Cómo completar"], ["Una fila por deportista. Solo Nombre y Email son obligatorios."], ["Borrá la fila de ejemplo antes de subir la planilla."], ["Deportes válidos: " + sports.join(", ")], ["Si el grupo no existe, se crea solo."], ["Fecha: dd/mm/aaaa. Altura en cm, peso en kg."]]);
  help.getColumn(1).width = 100;
  return wb.xlsx.writeBuffer();
}

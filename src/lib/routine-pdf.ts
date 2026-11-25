import "server-only";
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString, type PDFFont, type PDFPage } from "pdf-lib";
import { type RoutineData, FOCUS, blockSummary } from "./routine";

// PDF de la rutina para mandar por WhatsApp o imprimir. A4 apaisado, negro y amarillo como la app.
const YEL = rgb(1, 0.839, 0.039), BLACK = rgb(0.02, 0.02, 0.02), INK = rgb(0.13, 0.13, 0.13), GREY = rgb(0.42, 0.42, 0.42), LINE = rgb(0.85, 0.85, 0.85), SOFT = rgb(0.97, 0.97, 0.95);
const W = 842, H = 595, M = 32;

export async function routinePdf(o: { club: string; athlete?: string | null; coach?: string | null; name: string; data: RoutineData; week: number | null }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${o.name}${o.athlete ? ` - ${o.athlete}` : ""}`);
  doc.setCreator("hrtraining.co");
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  const safe = (font: PDFFont, s: string) => [...(s ?? "").replace(/[″”“]/g, '"').replace(/[’‘]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...")].map((ch) => { try { font.encodeText(ch); return ch; } catch { return ""; } }).join("");
  const wrap = (font: PDFFont, s: string, size: number, max: number) => {
    const out: string[] = []; let line = "";
    for (const w of safe(font, s).split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) <= max) line = t;
      else { if (line) out.push(line); line = w; while (font.widthOfTextAtSize(line, size) > max && line.length > 1) { let k = line.length - 1; while (k > 1 && font.widthOfTextAtSize(line.slice(0, k), size) > max) k--; out.push(line.slice(0, k)); line = line.slice(k); } }
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  };
  let page!: PDFPage; let y = 0; let pageNo = 0;
  const text = (s: string, x: number, yy: number, size: number, font = f, color = INK) => page.drawText(safe(font, s), { x, y: yy, size, font, color });
  const link = (x: number, yy: number, w: number, h: number, url: string) => {
    const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, yy, x + w, yy + h], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } });
    const ref = doc.context.register(annot);
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (annots && "push" in annots) (annots as unknown as { push: (r: unknown) => void }).push(ref); else page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
  };
  const newPage = () => {
    page = doc.addPage([W, H]); pageNo++;
    page.drawRectangle({ x: 0, y: H - 46, width: W, height: 46, color: BLACK });
    text("hrtraining", M, H - 29, 15, b, rgb(1, 1, 1)); text(".co", M + b.widthOfTextAtSize("hrtraining", 15), H - 29, 15, b, YEL);
    const right = [o.club, o.athlete].filter(Boolean).join("  ·  ");
    text(right, W - M - f.widthOfTextAtSize(safe(f, right), 9.5), H - 27, 9.5, f, rgb(0.8, 0.8, 0.8));
    text(`Página ${pageNo}`, W - M - 40, 16, 8, f, GREY);
    text("Generado con hrtraining.co", M, 16, 8, f, GREY);
    y = H - 70;
  };
  const need = (h: number) => { if (y - h < 34) newPage(); };
  newPage();

  // Encabezado del plan
  text(o.name, M, y - 6, 20, b, BLACK); y -= 26;
  const d = o.data;
  const meta = [d.meta.objective && `Objetivo: ${d.meta.objective}`, d.meta.start && `Empieza: ${d.meta.start.split("-").reverse().join("/")}`, `${d.weeks} semanas`, o.coach && `Entrenador: ${o.coach}`].filter(Boolean).join("   ·   ");
  text(meta, M, y, 9.5, f, GREY); y -= 16;
  if (d.meta.notice?.trim()) {
    const lines = wrap(f, d.meta.notice, 10, W - 2 * M - 24);
    const h = 22 + lines.length * 13;
    need(h); page.drawRectangle({ x: M, y: y - h + 6, width: W - 2 * M, height: h, color: rgb(1, 0.98, 0.85), borderColor: YEL, borderWidth: 1.2 });
    text("AVISO", M + 12, y - 9, 8.5, b, rgb(0.55, 0.45, 0)); lines.forEach((l, i) => text(l, M + 12, y - 22 - i * 13, 10, f, BLACK)); y -= h + 6;
  }
  if (d.meta.notes?.trim()) { for (const l of wrap(f, `Indicaciones: ${d.meta.notes}`, 9.5, W - 2 * M)) { need(13); text(l, M, y, 9.5, f, INK); y -= 13; } y -= 4; }

  if (d.warmup.some((w) => w.name)) {
    need(30); text("ENTRADA EN CALOR", M, y, 10, b, BLACK); y -= 14;
    const items = d.warmup.filter((w) => w.name).map((w) => `${w.name}${w.detail ? ` (${w.detail})` : ""}`).join("   ·   ");
    for (const l of wrap(f, items, 9.5, W - 2 * M)) { need(13); text(l, M, y, 9.5, f, INK); y -= 13; }
    y -= 6;
  }

  const weeks = o.week != null ? [o.week] : Array.from({ length: d.weeks }, (_, i) => i);
  const colNum = 18, colEx = 220, colRest = 46, colNote = 150;
  const colW = Math.max(46, (W - 2 * M - colNum - colEx - colRest - colNote) / weeks.length);
  const noteW = W - 2 * M - colNum - colEx - colRest - colW * weeks.length;
  for (const day of d.days) {
    need(60);
    page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 24, color: BLACK });
    text(`${day.name}${day.weekday ? `  ·  ${day.weekday}` : ""}`, M + 10, y, 12, b, YEL); y -= 26;
    for (const blk of day.blocks) {
      const rows = blk.rows.filter((r) => r.name);
      if (!rows.length) continue;
      need(48);
      text(blk.name.toUpperCase(), M, y, 10, b, BLACK);
      const sm = blockSummary(blk); if (sm) text(sm, M + b.widthOfTextAtSize(safe(b, blk.name.toUpperCase()), 10) + 10, y, 9, f, GREY);
      y -= 8;
      // encabezado de la tabla
      const head = () => {
        page.drawRectangle({ x: M, y: y - 14, width: W - 2 * M, height: 16, color: SOFT });
        let x = M + colNum; text("Ejercicio", x, y - 10, 8, b, GREY); x += colEx;
        for (const w of weeks) { text(`Sem ${w + 1}`, x + 4, y - 10, 8, b, GREY); x += colW; }
        text("Desc.", x + 4, y - 10, 8, b, GREY); x += colRest; text("Nota", x + 4, y - 10, 8, b, GREY);
        y -= 18;
      };
      head();
      rows.forEach((r, i) => {
        const nameLines = wrap(b, r.name, 9.5, colEx - 8);
        const role = r.focus && FOCUS[r.focus] ? FOCUS[r.focus].label : "";
        const noteLines = wrap(f, [r.rmBase && `RM/RIR: ${r.rmBase}`, r.note].filter(Boolean).join(" · "), 8.5, noteW - 8);
        const tab = r.mode === "tabata";
        const cellLines = weeks.map((w) => wrap(f, tab ? "" : r.cells[w] ?? "", 9, colW - 8));
        const lines = Math.max(nameLines.length + (role ? 1 : 0) + (r.video ? 1 : 0), noteLines.length, ...cellLines.map((c) => c.length + 1), tab ? 2 : 1);
        const h = lines * 11.5 + 8;
        if (y - h < 34) { newPage(); head(); }
        const top = y - 2;
        text(String(i + 1), M + 4, top - 9, 8.5, f, GREY);
        let ly = top - 9;
        nameLines.forEach((l) => { text(l, M + colNum, ly, 9.5, b, BLACK); ly -= 11.5; });
        if (role) { text(role, M + colNum, ly, 7.5, b, rgb(0.55, 0.45, 0)); ly -= 11.5; }
        if (r.video) { text("Ver video", M + colNum, ly, 8, f, rgb(0.1, 0.3, 0.8)); link(M + colNum, ly - 2, 40, 10, r.video); }
        let x = M + colNum + colEx;
        if (tab) { text(`Tabata ${r.tabata?.work || 20}s trabajo / ${r.tabata?.rest || 10}s descanso x ${r.tabata?.rounds || 8} rounds`, x + 4, top - 9, 9, b, BLACK); x += colW * weeks.length; }
        else weeks.forEach((w, k) => {
          cellLines[k].forEach((l, j) => text(l, x + 4, top - 9 - j * 11.5, 9, f, BLACK));
          if (r.rm?.[w]) text(r.rm[w], x + 4, top - 9 - cellLines[k].length * 11.5, 8, f, GREY);
          x += colW;
        });
        text(r.rest && !tab ? `${r.rest}s` : "", x + 4, top - 9, 9, f, INK); x += colRest;
        noteLines.forEach((l, j) => text(l, x + 4, top - 9 - j * 11, 8.5, f, INK));
        y -= h;
        page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: LINE });
        if (r.link && i < rows.length - 1) { need(14); text(r.link === "circuito" ? "> CIRCUITO con el siguiente" : "> SIN DESCANSO, seguir con el siguiente", M + colNum, y - 7, 8, b, rgb(0.55, 0.45, 0)); y -= 13; }
      });
      y -= 10;
    }
    y -= 6;
  }
  return doc.save();
}

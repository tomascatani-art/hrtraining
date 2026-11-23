"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, Minus, Triangle, Type, Pencil, Trash2, Undo2, Save, Eye, Link2 } from "lucide-react";
import clsx from "clsx";

type P = { x: number; y: number };
type Drawing = { id: string; type: "line" | "angle" | "text" | "free"; pts: P[]; t: number; color: string; label?: string };
const FRAME = 1 / 30;
const COLORS = ["#ffd60a", "#ffffff", "#3a8fd6", "#d9566f"];

export function VideoAnalyzer({ srcA, srcB, initial, onSave, readOnly, onTime, seekTo }: {
  srcA: string; srcB?: string | null; initial: Drawing[]; onSave: (d: Drawing[]) => Promise<unknown>; readOnly?: boolean; onTime?: (t: number) => void; seekTo?: { t: number; n: number };
}) {
  const va = useRef<HTMLVideoElement>(null);
  const vb = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [tool, setTool] = useState<Drawing["type"] | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [draws, setDraws] = useState<Drawing[]>(initial);
  const [pending, setPending] = useState<P[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [sync, setSync] = useState(true);
  const [offset, setOffset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();
  const drawingFree = useRef(false);

  const size = () => {
    const c = canvas.current!;
    return { w: c.width, h: c.height };
  };
  const toPx = (p: P) => { const { w, h } = size(); return { x: p.x * w, y: p.y * h }; };
  const angleOf = (pts: P[]) => {
    const [a, b, c] = pts.map(toPx);
    const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  };

  const render = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const dpr = c.width / (c.clientWidth || 1);
    const visible = draws.filter((d) => showAll || Math.abs(d.t - t) < 0.6);
    const all: Drawing[] = [...visible, ...(pending.length ? [{ id: "p", type: tool ?? "line", pts: pending, t, color }] as Drawing[] : [])];
    for (const d of all) {
      ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineWidth = 3 * dpr; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 4 * dpr;
      const px = d.pts.map(toPx);
      if (d.type === "text" && px[0]) {
        ctx.font = `600 ${15 * dpr}px Inter, sans-serif`;
        const w = ctx.measureText(d.label ?? "").width;
        ctx.fillStyle = "rgba(0,0,0,.75)"; ctx.fillRect(px[0].x - 4 * dpr, px[0].y - 18 * dpr, w + 8 * dpr, 24 * dpr);
        ctx.fillStyle = d.color; ctx.fillText(d.label ?? "", px[0].x, px[0].y);
        continue;
      }
      ctx.beginPath();
      px.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      if (d.type !== "free") for (const p of px) { ctx.beginPath(); ctx.arc(p.x, p.y, 5 * dpr, 0, Math.PI * 2); ctx.fill(); }
      if (d.type === "angle" && px.length === 3) {
        const deg = angleOf(d.pts);
        const [a, b, cc] = px;
        const a1 = Math.atan2(a.y - b.y, a.x - b.x), a2 = Math.atan2(cc.y - b.y, cc.x - b.x);
        let diff = a2 - a1; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, 34 * dpr, a1, a1 + diff, diff < 0); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        const label = `${deg.toFixed(1)}°`;
        ctx.font = `700 ${16 * dpr}px "JetBrains Mono", monospace`;
        const w = ctx.measureText(label).width;
        ctx.fillStyle = "#000"; ctx.fillRect(b.x + 12 * dpr, b.y - 30 * dpr, w + 10 * dpr, 24 * dpr);
        ctx.fillStyle = d.color; ctx.fillText(label, b.x + 17 * dpr, b.y - 12 * dpr);
      }
      if (d.type === "line" && px.length === 2) {
        const deg = Math.abs((Math.atan2(-(px[1].y - px[0].y), px[1].x - px[0].x) * 180) / Math.PI);
        const label = `${(deg > 90 ? 180 - deg : deg).toFixed(1)}° vs horizontal`;
        ctx.font = `600 ${12 * dpr}px Inter, sans-serif`;
        ctx.fillText(label, (px[0].x + px[1].x) / 2 + 8 * dpr, (px[0].y + px[1].y) / 2 - 8 * dpr);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, pending, t, showAll, color, tool]);

  useEffect(() => { render(); }, [render]);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const c = canvas.current, b = box.current;
      if (!c || !b) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = b.clientWidth * dpr; c.height = b.clientHeight * dpr;
      render();
    });
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [render]);

  // Loop de tiempo suave
  useEffect(() => {
    let raf = 0;
    const tick = () => { if (va.current) { setT(va.current.currentTime); onTime?.(va.current.currentTime); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onTime]);

  const seek = (s: number) => {
    const v = va.current!;
    v.currentTime = Math.max(0, Math.min(dur || v.duration || 0, s));
    if (sync && vb.current) vb.current.currentTime = Math.max(0, v.currentTime + offset);
  };
  useEffect(() => { if (seekTo) { va.current?.pause(); vb.current?.pause(); setPlaying(false); seek(seekTo.t); } }, [seekTo?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    const v = va.current!;
    if (v.paused) { v.play(); if (sync && vb.current) { vb.current.currentTime = Math.max(0, v.currentTime + offset); vb.current.play(); } setPlaying(true); }
    else { v.pause(); vb.current?.pause(); setPlaying(false); }
  };
  const setSpeed = (r: number) => { setRate(r); if (va.current) va.current.playbackRate = r; if (vb.current) vb.current.playbackRate = r; };
  const step = (n: number) => { va.current?.pause(); vb.current?.pause(); setPlaying(false); seek((va.current?.currentTime ?? 0) + n * FRAME); };

  const pointFrom = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const commit = (d: Omit<Drawing, "id" | "t" | "color">) => { setDraws((x) => [...x, { ...d, id: Math.random().toString(36).slice(2), t: va.current?.currentTime ?? 0, color }]); setPending([]); setDirty(true); };
  const onDown = (e: React.PointerEvent) => {
    if (!tool || readOnly) return;
    va.current?.pause(); vb.current?.pause(); setPlaying(false);
    const p = pointFrom(e);
    if (tool === "text") { const label = window.prompt("Anotación"); if (label) commit({ type: "text", pts: [p], label }); return; }
    if (tool === "free") { drawingFree.current = true; setPending([p]); (e.target as Element).setPointerCapture(e.pointerId); return; }
    const pts = [...pending, p];
    const need = tool === "angle" ? 3 : 2;
    if (pts.length >= need) commit({ type: tool, pts }); else setPending(pts);
  };
  const onMove = (e: React.PointerEvent) => { if (drawingFree.current) setPending((x) => [...x, pointFrom(e)]); };
  const onUp = () => { if (drawingFree.current) { drawingFree.current = false; if (pending.length > 2) commit({ type: "free", pts: pending }); else setPending([]); } };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      if (e.key === "ArrowRight") step(e.shiftKey ? 10 : 1);
      if (e.key === "ArrowLeft") step(e.shiftKey ? -10 : -1);
      if (e.key === "Escape") setPending([]);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  const tools: { k: Drawing["type"]; icon: React.ReactNode; label: string }[] = [
    { k: "line", icon: <Minus size={16} />, label: "Línea" }, { k: "angle", icon: <Triangle size={16} />, label: "Ángulo" },
    { k: "free", icon: <Pencil size={16} />, label: "Trazo" }, { k: "text", icon: <Type size={16} />, label: "Texto" },
  ];
  const markers = draws.map((d) => d.t);

  return (
    <div className="space-y-3">
      <div className={clsx("grid gap-3", srcB && "lg:grid-cols-2")}>
        <div ref={box} className="relative overflow-hidden rounded-2xl border border-ink-700 bg-black">
          <video ref={va} src={srcA} className="block max-h-[70vh] w-full" playsInline preload="metadata" onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} onEnded={() => setPlaying(false)} />
          <canvas ref={canvas} className={clsx("absolute inset-0 h-full w-full touch-none", tool && !readOnly ? "cursor-crosshair" : "pointer-events-none")} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-volt">A · {fmt(t)} · ×{rate}</div>
          {pending.length > 0 && <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">{tool === "angle" ? `Marcá ${3 - pending.length} punto(s) más (el 2º es el vértice)` : "Marcá el punto final"}</div>}
        </div>
        {srcB && (
          <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-black">
            <video ref={vb} src={srcB} className="block max-h-[70vh] w-full" playsInline preload="metadata" muted />
            <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-[#3a8fd6]">B · comparación</div>
          </div>
        )}
      </div>

      <div className="card p-3">
        <div className="relative">
          <input type="range" min={0} max={dur || 0} step={FRAME} value={t} onChange={(e) => seek(Number(e.target.value))} className="w-full" aria-label="Línea de tiempo" />
          {dur > 0 && markers.map((m, i) => <span key={i} className="pointer-events-none absolute top-0 h-1.5 w-1 rounded bg-volt" style={{ left: `${(m / dur) * 100}%` }} />)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => step(-1)} className="btn-ghost btn-sm" title="Cuadro anterior (←)"><ChevronLeft size={16} /></button>
          <button type="button" onClick={toggle} className="btn-primary btn-sm w-20">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button type="button" onClick={() => step(1)} className="btn-ghost btn-sm" title="Cuadro siguiente (→)"><ChevronRight size={16} /></button>
          <span className="num text-xs text-neutral-400">{fmt(t)} / {fmt(dur)}</span>
          <div className="ml-auto flex gap-1">{[0.1, 0.25, 0.5, 1].map((r) => <button type="button" key={r} onClick={() => setSpeed(r)} className={clsx("num rounded-lg px-2 py-1 text-xs", rate === r ? "bg-volt text-black" : "bg-ink-800 text-neutral-400")}>×{r}</button>)}</div>
        </div>
        {srcB && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-700 pt-3 text-xs text-neutral-400">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /><Link2 size={13} />Sincronizar B</label>
            <label className="flex flex-1 items-center gap-2">Desfase B <input type="range" min={-5} max={5} step={FRAME} value={offset} onChange={(e) => { setOffset(Number(e.target.value)); if (vb.current && va.current) vb.current.currentTime = Math.max(0, va.current.currentTime + Number(e.target.value)); }} className="flex-1" /><span className="num w-14">{offset >= 0 ? "+" : ""}{offset.toFixed(2)}s</span></label>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          {tools.map((x) => (
            <button type="button" key={x.k} onClick={() => { setTool(tool === x.k ? null : x.k); setPending([]); }} className={clsx("btn-sm inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold", tool === x.k ? "border-volt bg-volt text-black" : "border-ink-600 text-neutral-300 hover:text-white")}>{x.icon}{x.label}</button>
          ))}
          <div className="mx-1 flex gap-1">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={clsx("h-6 w-6 rounded-full border-2", color === c ? "border-white" : "border-transparent")} style={{ background: c }} aria-label={`Color ${c}`} />)}</div>
          <button type="button" onClick={() => { setDraws((d) => d.slice(0, -1)); setDirty(true); }} className="btn-ghost btn-sm" title="Deshacer"><Undo2 size={14} /></button>
          <button type="button" onClick={() => { if (confirm("¿Borrar todos los dibujos?")) { setDraws([]); setDirty(true); } }} className="btn-ghost btn-sm" title="Borrar todo"><Trash2 size={14} /></button>
          <label className="flex items-center gap-1.5 text-xs text-neutral-400"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /><Eye size={13} />Ver todos</label>
          <button type="button" disabled={!dirty || saving} onClick={() => start(async () => { await onSave(draws); setDirty(false); })} className="btn-primary btn-sm ml-auto"><Save size={14} />{saving ? "Guardando…" : dirty ? "Guardar dibujos" : "Guardado"}</button>
        </div>
      )}
      {draws.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draws.map((d) => (
            <button type="button" key={d.id} onClick={() => seek(d.t)} className="num rounded-md bg-ink-800 px-2 py-1 text-[11px] text-neutral-300 hover:text-volt">
              {fmt(d.t)} · {d.type === "angle" && canvas.current ? `${angleOf(d.pts).toFixed(1)}°` : d.type === "text" ? d.label : d.type === "line" ? "línea" : "trazo"}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-neutral-600">Atajos: espacio = reproducir/pausar · ←/→ = cuadro a cuadro · Shift+←/→ = 10 cuadros · Esc = cancelar punto. Las mediciones de ángulo son en 2D sobre el plano de la cámara: filmá perpendicular al movimiento para mayor precisión.</p>
    </div>
  );
}

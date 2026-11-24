"use client";
import { useState } from "react";
import { BRAND_PRESETS, contrastWithBlack, MIN_CONTRAST, normalizeHex, accentVars } from "@/lib/brand";

/** Elegir color de acento con vista previa; avisa si es muy oscuro para texto negro. */
export function BrandColorPicker({ initial }: { initial: string }) {
  const [hex, setHex] = useState(initial);
  const valid = normalizeHex(hex);
  const ok = !!valid && contrastWithBlack(valid) >= MIN_CONTRAST;
  return (
    <div className="space-y-3">
      <input type="hidden" name="brandColor" value={hex} />
      <div className="flex flex-wrap gap-2">
        {BRAND_PRESETS.map((p) => (
          <button key={p.hex} type="button" onClick={() => setHex(p.hex)} title={p.label} aria-label={p.label} aria-pressed={hex.toLowerCase() === p.hex}
            className={`h-9 w-9 rounded-full border-2 transition ${hex.toLowerCase() === p.hex ? "border-white" : "border-transparent"}`} style={{ background: p.hex }} />
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3" style={ok ? (accentVars(valid) as React.CSSProperties) : undefined}>
        <span className="btn-primary btn-sm pointer-events-none">Vista previa</span>
        <span className="chip-volt">Etiqueta</span>
        <span className="text-sm text-volt">Texto destacado</span>
      </div>
      <p className="text-xs muted">La base de la app es siempre negra; el acento puede ser amarillo o blanco.</p>
    </div>
  );
}

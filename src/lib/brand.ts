// Marca propia del club: color de acento y logo. Sin dependencias de servidor (se usa también en el cliente).
export const DEFAULT_ACCENT = "#ffd60a";
export const BRAND_PRESETS = [
  { hex: "#ffd60a", label: "Amarillo" },
  { hex: "#c6f432", label: "Lima" },
  { hex: "#4ade80", label: "Verde" },
  { hex: "#38d6f5", label: "Celeste" },
  { hex: "#ff8a3d", label: "Naranja" },
  { hex: "#ff7eb6", label: "Rosa" },
  { hex: "#f5f5f4", label: "Blanco" },
];

const rgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const lum = ([r, g, b]: readonly number[]) => {
  const c = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** Contraste del color contra texto negro (los botones de acento llevan texto negro). */
export const contrastWithBlack = (hex: string) => { const c = rgb(hex); return c ? (lum(c) + 0.05) / 0.05 : 0; };
export const MIN_CONTRAST = 8;

export function normalizeHex(hex: string) {
  const c = rgb(hex);
  return c ? "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("") : null;
}

/** Variables CSS del acento (formato "r g b") para Tailwind. null si el color no sirve. */
export function accentVars(hex?: string | null): Record<string, string> | undefined {
  const c = hex ? rgb(hex) : null;
  if (!c || contrastWithBlack(hex!) < MIN_CONTRAST) return undefined;
  const mix = (t: number, to: number) => c.map((v) => Math.round(v + (to - v) * t)).join(" ");
  return { "--volt": c.join(" "), "--volt-400": mix(0.3, 255), "--volt-600": mix(0.12, 0) };
}

export const logoUrl = (org: { id: string; logoKey?: string | null }) => (org.logoKey ? `/api/brand/${org.id}/logo?v=${org.logoKey.slice(0, 10)}` : null);

// Campos de la medición antropométrica (perfil restringido ISAK como referencia de nombres).
export const ANTHRO_GROUPS = [
  { title: "Básicas", unit: "", fields: [
    { key: "weightKg", label: "Peso", unit: "kg", min: 15, max: 250 },
    { key: "heightCm", label: "Talla", unit: "cm", min: 80, max: 250 },
    { key: "sittingHeightCm", label: "Talla sentada", unit: "cm", min: 40, max: 130 },
    { key: "armSpanCm", label: "Envergadura", unit: "cm", min: 80, max: 260 },
  ] },
  { title: "Pliegues", unit: "mm", fields: [
    { key: "triceps", label: "Tricipital", unit: "mm", min: 1, max: 80 },
    { key: "subscapular", label: "Subescapular", unit: "mm", min: 1, max: 80 },
    { key: "supraspinale", label: "Supraespinal", unit: "mm", min: 1, max: 80 },
    { key: "abdominal", label: "Abdominal", unit: "mm", min: 1, max: 80 },
    { key: "thigh", label: "Muslo frontal", unit: "mm", min: 1, max: 80 },
    { key: "calf", label: "Pantorrilla", unit: "mm", min: 1, max: 80 },
  ] },
  { title: "Perímetros", unit: "cm", fields: [
    { key: "armRelaxedCm", label: "Brazo relajado", unit: "cm", min: 10, max: 70 },
    { key: "armFlexedCm", label: "Brazo flexionado", unit: "cm", min: 10, max: 75 },
    { key: "waistCm", label: "Cintura", unit: "cm", min: 40, max: 200 },
    { key: "hipCm", label: "Cadera", unit: "cm", min: 50, max: 200 },
    { key: "thighMidCm", label: "Muslo medio", unit: "cm", min: 25, max: 100 },
    { key: "calfGirthCm", label: "Pantorrilla", unit: "cm", min: 20, max: 70 },
  ] },
] as const;
export type AnthroField = (typeof ANTHRO_GROUPS)[number]["fields"][number];
export type AnthroKey = AnthroField["key"];
export const ANTHRO_FIELDS: readonly AnthroField[] = ANTHRO_GROUPS.flatMap((g) => g.fields as readonly AnthroField[]);
export const SKINFOLDS = ["triceps", "subscapular", "supraspinale", "abdominal", "thigh", "calf"] as const;

/** Sumatoria de 6 pliegues; null si falta alguno (para no comparar sumas distintas). */
export function sum6(m: Partial<Record<AnthroKey, number | null>>) {
  const v = SKINFOLDS.map((k) => m[k]);
  return v.every((x) => typeof x === "number") ? Math.round((v as number[]).reduce((a, b) => a + b, 0) * 10) / 10 : null;
}
export const fmtN = (n: number | null | undefined, d = 1) => (n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: d }));

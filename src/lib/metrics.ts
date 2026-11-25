// Cálculos de carga, fatiga y rendimiento. Funciones puras, sin acceso a la base.

export const DAY = 86_400_000;

export const MONITORING_DISCLAIMER =
  "Los indicadores son herramientas de seguimiento para el entrenador. No constituyen un diagnóstico médico ni predicen lesiones por sí solos. Ante dolor persistente o síntomas, derivar a un profesional de la salud.";

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** Fecha calendario local como medianoche UTC (para columnas @db.Date). */
export function dateOnly(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
/** Día (YYYY-MM-DD) de una columna @db.Date. */
export const dbDay = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - dow);
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export const isoDay = (d: Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export type LoadPoint = { date: Date; load: number };

/** Carga diaria (UA) de los últimos `days` días, incluyendo días sin entrenamiento como 0. */
export function dailySeries(points: LoadPoint[], days: number, until = new Date()) {
  const end = startOfDay(until);
  const map = new Map<string, number>();
  for (const p of points) map.set(isoDay(p.date), (map.get(isoDay(p.date)) ?? 0) + p.load);
  const out: { day: string; load: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    out.push({ day: isoDay(d), load: map.get(isoDay(d)) ?? 0 });
  }
  return out;
}

export function weeklySeries(points: LoadPoint[], weeks: number, until = new Date()) {
  const thisWeek = startOfWeek(until);
  const out: { week: string; start: Date; load: number; sessions: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = addDays(thisWeek, -7 * i);
    const e = addDays(s, 7);
    const inW = points.filter((p) => p.date >= s && p.date < e);
    out.push({
      week: s.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      start: s,
      load: inW.reduce((a, p) => a + p.load, 0),
      sessions: inW.length,
    });
  }
  return out;
}

/** Indicadores de carga sobre los últimos 28 días. */
export function loadIndicators(points: LoadPoint[], until = new Date()) {
  const daily = dailySeries(points, 28, until).map((d) => d.load);
  const last7 = daily.slice(-7);
  const acute = last7.reduce((a, b) => a + b, 0);
  const chronic = daily.reduce((a, b) => a + b, 0) / 4; // promedio semanal de 4 semanas
  const acwr = chronic > 0 ? acute / chronic : null;
  const m = mean(last7);
  const s = sd(last7);
  const monotony = s > 0 ? m / s : null;
  const strain = monotony ? acute * monotony : null;
  return { acute, chronic: Math.round(chronic), acwr, monotony, strain };
}

export type WellnessRow = {
  date: Date;
  sleepQuality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
  readiness: number;
  sleepHours?: number | null;
  painArea?: string | null;
};

export const wellnessScore = (w: Pick<WellnessRow, "sleepQuality" | "fatigue" | "soreness" | "stress" | "mood">) =>
  w.sleepQuality + w.fatigue + w.soreness + w.stress + w.mood; // 5-25, mayor = mejor

export type Alert = {
  level: "REVISAR" | "ATENCION";
  kind: "BIENESTAR" | "DISPONIBILIDAD" | "MOLESTIA" | "CARGA" | "SUENO" | "SIN_REGISTRO";
  title: string;
  detail: string;
};

/** Alertas de seguimiento. Comparan al alumno con su propia línea base. */
export function computeAlerts(wellness: WellnessRow[], loads: LoadPoint[], now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const sorted = [...wellness].sort((a, b) => +a.date - +b.date);
  const latest = sorted.at(-1);
  const recentCutoff = addDays(startOfDay(now), -2);

  if (!latest || latest.date < addDays(startOfDay(now), -4)) {
    alerts.push({ level: "REVISAR", kind: "SIN_REGISTRO", title: "Sin registro de bienestar reciente", detail: "No hay cuestionario de bienestar en los últimos 4 días." });
  }

  if (latest && latest.date >= recentCutoff) {
    const base = sorted.filter((w) => w.date < latest.date && w.date >= addDays(latest.date, -28)).map(wellnessScore);
    const score = wellnessScore(latest);
    if (base.length >= 5) {
      const m = mean(base);
      const s = Math.max(sd(base), 2);
      const z = (score - m) / s;
      if (z <= -1.5) {
        alerts.push({
          level: z <= -2 ? "ATENCION" : "REVISAR",
          kind: "BIENESTAR",
          title: "Bienestar por debajo de su línea base",
          detail: `Puntaje ${score}/25 frente a un promedio personal de ${m.toFixed(1)} (${z.toFixed(1)} DE).`,
        });
      }
    } else if (score <= 12) {
      alerts.push({ level: "REVISAR", kind: "BIENESTAR", title: "Bienestar bajo", detail: `Puntaje ${score}/25.` });
    }
    if (latest.readiness <= 4) {
      alerts.push({ level: latest.readiness <= 2 ? "ATENCION" : "REVISAR", kind: "DISPONIBILIDAD", title: "Baja disponibilidad para entrenar", detail: `Se autoevaluó en ${latest.readiness}/10.` });
    }
    if (latest.painArea) {
      alerts.push({ level: "ATENCION", kind: "MOLESTIA", title: "Reportó molestia", detail: `Zona: ${latest.painArea}. Conversar y, si persiste, derivar a un profesional de la salud.` });
    }
    if (latest.sleepHours != null && latest.sleepHours < 6) {
      alerts.push({ level: "REVISAR", kind: "SUENO", title: "Sueño corto", detail: `${latest.sleepHours} h la última noche.` });
    }
  }

  const ind = loadIndicators(loads, now);
  if (ind.acwr != null && ind.chronic > 0) {
    if (ind.acwr >= 1.5) {
      alerts.push({ level: "ATENCION", kind: "CARGA", title: "Aumento brusco de carga", detail: `La carga de los últimos 7 días es ${ind.acwr.toFixed(2)}× su promedio semanal del último mes.` });
    } else if (ind.acwr >= 1.3) {
      alerts.push({ level: "REVISAR", kind: "CARGA", title: "Carga semanal en aumento", detail: `Relación aguda:crónica ${ind.acwr.toFixed(2)}.` });
    }
  }
  return alerts;
}

/** Mejor marca de una serie según si mayor es mejor. */
export function best<T extends { value: number }>(values: T[], higherIsBetter: boolean): T | null {
  if (!values.length) return null;
  return values.reduce((b, v) => (higherIsBetter ? (v.value > b.value ? v : b) : v.value < b.value ? v : b));
}

/** Variación porcentual con signo orientado: positivo = mejora. */
export function improvement(prev: number, curr: number, higherIsBetter: boolean) {
  if (!prev) return 0;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return higherIsBetter ? pct : -pct;
}

/** 1RM estimado (Epley) a partir de una serie. */
export const epley1RM = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** Interpreta "YYYY-MM-DD" (input type=date) como un día local, a la hora indicada. */
export const parseDay = (s: string, hour = 0) => new Date(`${s.slice(0, 10)}T${String(hour).padStart(2, "0")}:00:00`);

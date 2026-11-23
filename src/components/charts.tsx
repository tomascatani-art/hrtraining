"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, Radar, ReferenceLine, ComposedChart, Legend,
} from "recharts";

// Paleta categórica validada sobre fondo #111 (CVD ΔE ≥ 16). Slot 1 = amarillo de marca.
export const SERIES = ["#ffd60a", "#3a8fd6", "#d9566f", "#8f78e0"];
const AXIS = { stroke: "#525252", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid stroke="#222" strokeDasharray="0" vertical={false} />;

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-white">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-neutral-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="num ml-auto pl-3 font-semibold text-white">{typeof p.value === "number" ? p.value.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : p.value}{unit ? ` ${unit}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, series, unit, height = 240, reference }: {
  data: Record<string, unknown>[]; series: { key: string; name: string }[]; unit?: string; height?: number; reference?: { y: number; label: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="x" {...AXIS} />
        <YAxis {...AXIS} domain={["auto", "auto"]} />
        <Tooltip content={<Tip unit={unit} />} cursor={{ stroke: "#ffd60a", strokeOpacity: 0.3 }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />}
        {reference && <ReferenceLine y={reference.y} stroke="#525252" strokeDasharray="4 4" label={{ value: reference.label, fill: "#737373", fontSize: 10, position: "insideTopLeft" }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={SERIES[i % SERIES.length]} strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: "#111", fill: SERIES[i % SERIES.length] }} activeDot={{ r: 6 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LoadBars({ data, height = 220, highlightLast = true, unit = "UA", dataKey = "load", name = "Carga" }: {
  data: { x: string; [k: string]: unknown }[]; height?: number; highlightLast?: boolean; unit?: string; dataKey?: string; name?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }} barCategoryGap="22%">
        {GRID}
        <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" />
        <YAxis {...AXIS} />
        <Tooltip content={<Tip unit={unit} />} cursor={{ fill: "#ffffff08" }} />
        <Bar dataKey={dataKey} name={name} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={highlightLast && i === data.length - 1 ? "#ffd60a" : "#6b5a10"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WellnessArea({ data, height = 200 }: { data: { x: string; score: number | null; readiness?: number | null }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd60a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ffd60a" stopOpacity={0} />
          </linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" />
        <YAxis {...AXIS} domain={[5, 25]} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="score" name="Bienestar (5-25)" stroke="#ffd60a" strokeWidth={2} fill="url(#wg)" connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProfileRadar({ data, height = 280 }: { data: { axis: string; value: number; prev?: number }[]; height?: number }) {
  const hasPrev = data.some((d) => d.prev != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#2e2e2e" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
        <Tooltip content={<Tip unit="pts" />} />
        {hasPrev && <Radar name="Anterior" dataKey="prev" stroke="#3a8fd6" fill="#3a8fd6" fillOpacity={0.12} strokeWidth={2} />}
        <Radar name="Actual" dataKey="value" stroke="#ffd60a" fill="#ffd60a" fillOpacity={0.22} strokeWidth={2} />
        {hasPrev && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />}
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Dinámica de la planificación: volumen e intensidad planificados (misma escala 1-10). */
export function PlanDynamics({ data, height = 240 }: { data: { x: string; volumen: number; intensidad: number; fase: string; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" />
        <YAxis {...AXIS} domain={[0, 10]} />
        <Tooltip content={<Tip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />
        <Bar dataKey="volumen" name="Volumen" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.55} />)}
        </Bar>
        <Line type="monotone" dataKey="intensidad" name="Intensidad" stroke="#ffd60a" strokeWidth={2} dot={{ r: 3, fill: "#ffd60a" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ values, height = 36, color = "#ffd60a" }: { values: number[]; height?: number; color?: string }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareBars({ data, height = 260, unit }: { data: { x: string; a: number | null; b: number | null }[]; height?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }} barGap={2}>
        {GRID}
        <XAxis dataKey="x" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip content={<Tip unit={unit} />} cursor={{ fill: "#ffffff08" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} />
        <Bar dataKey="a" name="Período A" fill="#3a8fd6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="b" name="Período B" fill="#ffd60a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

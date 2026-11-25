import Link from "next/link";
import { avatarSrc } from "@/lib/avatar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import { monitoringFor } from "@/lib/queries";
import { addDays, isoDay, dbDay, startOfDay, weeklySeries, wellnessScore, startOfWeek } from "@/lib/metrics";
import { PageHeader, Card, Stat, Avatar, fmtNum, Empty } from "@/components/ui";
import { LoadBars } from "@/components/charts";
import { AlertList } from "@/components/alerts";

export const metadata = { title: "Cargas y fatiga" };

const cellColor = (s: number | null) => {
  if (s == null) return "#151515";
  // Escala secuencial de un solo tono (amarillo): más claro = mejor bienestar
  const t = Math.max(0, Math.min(1, (s - 8) / 14));
  const l = 18 + t * 52;
  return `hsl(48 ${40 + t * 60}% ${l}%)`;
};

export default async function LoadPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  let ids = await visibleAthleteIds(u);
  const groups = await visibleGroups(u);
  if (sp.group) {
    const m = await db.groupMember.findMany({ where: { groupId: sp.group } });
    ids = ids.filter((i) => m.some((x) => x.athleteId === i));
  }
  const mon = await monitoringFor(ids);
  const today = startOfDay(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const checkedToday = mon.filter((m) => m.lastWellness && dbDay(m.lastWellness.date) === isoDay(today));
  const alerts = mon.flatMap((m) => m.alerts.map((a) => ({ ...a, athlete: m.user })));
  const avgToday = checkedToday.length ? checkedToday.reduce((s, m) => s + wellnessScore(m.lastWellness!), 0) / checkedToday.length : null;

  // Carga externa: volumen (kg) semanal a partir de las series registradas
  const sets = ids.length ? await db.setLog.findMany({ where: { log: { athleteId: { in: ids }, completedAt: { gte: addDays(startOfWeek(today), -7 * 7) } } }, select: { reps: true, loadKg: true, rpe: true, rir: true, log: { select: { completedAt: true } } } }) : [];
  const ext = weeklySeries(sets.map((s) => ({ date: s.log.completedAt, load: (s.reps ?? 0) * (s.loadKg ?? 0) })), 8).map((w) => ({ x: w.week, load: Math.round(w.load / Math.max(1, ids.length)) }));
  const int = weeklySeries(mon.flatMap((m) => m.points), 8).map((w) => ({ x: w.week, load: Math.round(w.load / Math.max(1, ids.length)) }));
  const recentRir = sets.filter((s) => s.rir != null && s.log.completedAt >= addDays(today, -7));
  const avgRir = recentRir.length ? recentRir.reduce((a, s) => a + (s.rir ?? 0), 0) / recentRir.length : null;
  const recentLogs = mon.flatMap((m) => m.points.filter((p) => p.date >= addDays(today, -7)));

  return (
    <>
      <PageHeader title="Control de cargas y fatiga" subtitle="Carga interna (sRPE), carga externa (volumen), bienestar diario y disponibilidad. Las alertas comparan a cada alumno con su propia línea base."
        actions={<form className="flex gap-2"><select name="group" defaultValue={sp.group ?? ""} className="input py-2 text-sm"><option value="">Todos</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select><button className="btn-ghost btn-sm">Filtrar</button></form>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Check-in de hoy" value={`${checkedToday.length}/${mon.length}`} hint="cuestionarios completados" />
        <Stat label="Bienestar promedio" value={avgToday != null ? avgToday.toFixed(1) : "—"} unit="/25" hint="registros de hoy" />
        <Stat label="Con alertas" value={new Set(alerts.filter((a) => a.kind !== "SIN_REGISTRO").map((a) => a.athlete.id)).size} hint="alumnos" accent={alerts.some((a) => a.level === "ATENCION")} />
        <Stat label="Carga 7d promedio" value={fmtNum(mon.reduce((s, m) => s + m.indicators.acute, 0) / Math.max(1, mon.length))} unit="UA" />
        <Stat label="RIR medio 7d" value={avgRir != null ? avgRir.toFixed(1) : "—"} hint={`${recentLogs.length} sesiones registradas`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3 xl:items-start">
        <Card title="Mapa de bienestar · 14 días" className="xl:col-span-2" pad={false}>
          {mon.length ? (
            <div className="overflow-x-auto px-4 pb-4 sm:px-5">
              <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-xs">
                <thead><tr><th className="py-2 text-left label">Alumno</th>{days.map((d) => <th key={+d} className="num text-[10px] font-normal text-neutral-500">{d.getDate()}</th>)}</tr></thead>
                <tbody>
                  {mon.map((m) => (
                    <tr key={m.user.id}>
                      <td className="whitespace-nowrap pr-2"><Link href={`/app/athletes/${m.user.id}?tab=carga`} className="text-neutral-200 hover:text-volt">{m.user.name}</Link></td>
                      {days.map((d) => {
                        const w = m.wellness.find((x) => dbDay(x.date) === isoDay(d));
                        const s = w ? wellnessScore(w) : null;
                        return <td key={+d} title={w ? `${s}/25 · disponibilidad ${w.readiness}/10${w.painArea ? ` · molestia: ${w.painArea}` : ""}` : "Sin registro"} className="num h-7 min-w-[28px] rounded text-center text-[10px] font-semibold" style={{ background: cellColor(s), color: s != null && s >= 16 ? "#000" : "#a3a3a3" }}>{s ?? ""}{w?.painArea ? "•" : ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500">
                <span>Bajo</span><div className="h-2 w-32 rounded" style={{ background: `linear-gradient(90deg, ${cellColor(8)}, ${cellColor(15)}, ${cellColor(22)})` }} /><span>Alto</span><span className="ml-3">• = molestia reportada</span>
              </div>
            </div>
          ) : <div className="p-5"><Empty title="Sin alumnos" /></div>}
        </Card>
        <Card title="Alertas"><AlertList items={alerts.filter((a) => a.kind !== "SIN_REGISTRO")} /></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Carga interna · sRPE" action={<span className="label">UA por alumno</span>}><LoadBars data={int} /></Card>
        <Card title="Carga externa · volumen" action={<span className="label">kg por alumno</span>}><LoadBars data={ext} unit="kg" name="Volumen" /></Card>
      </div>

      <Card title="Indicadores por alumno" className="mt-6" pad={false}>
        <div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead><tr><th>Alumno</th><th>Aguda 7d</th><th>Crónica 4s</th><th>Ag:Cr</th><th>Monotonía</th><th>Strain</th><th>Sueño</th><th>Disponib.</th><th>Sin registro</th></tr></thead>
            <tbody>
              {mon.map((m) => (
                <tr key={m.user.id}>
                  <td><Link href={`/app/athletes/${m.user.id}?tab=carga`} className="flex items-center gap-2 hover:text-volt"><Avatar name={m.user.name} src={avatarSrc(m.user)} size={26} /><span className="text-white">{m.user.name}</span></Link></td>
                  <td className="num">{fmtNum(m.indicators.acute)}</td>
                  <td className="num">{fmtNum(m.indicators.chronic)}</td>
                  <td className={`num ${(m.indicators.acwr ?? 0) >= 1.5 ? "text-red-300" : (m.indicators.acwr ?? 0) >= 1.3 ? "text-amber-300" : ""}`}>{m.indicators.acwr?.toFixed(2) ?? "—"}</td>
                  <td className="num">{m.indicators.monotony?.toFixed(2) ?? "—"}</td>
                  <td className="num">{m.indicators.strain != null ? fmtNum(m.indicators.strain) : "—"}</td>
                  <td className="num">{m.lastWellness?.sleepHours ?? "—"} h</td>
                  <td className="num">{m.lastWellness ? `${m.lastWellness.readiness}/10` : "—"}</td>
                  <td>{m.alerts.some((a) => a.kind === "SIN_REGISTRO") ? <span className="chip-amber">+4 días</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 px-5 py-4 text-[11px] leading-relaxed text-neutral-600">
          <p><b className="text-neutral-400">sRPE</b> = RPE de la sesión (CR-10) × duración en minutos. <b className="text-neutral-400">Ag:Cr</b> = carga de 7 días ÷ promedio semanal de 4 semanas. <b className="text-neutral-400">Monotonía</b> = media diaria ÷ desvío estándar (Foster). <b className="text-neutral-400">Strain</b> = carga semanal × monotonía.</p>
          <p>Estos valores describen la carga y sus cambios; ninguno predice lesiones por sí solo. Usalos junto con la observación y la conversación con el alumno.</p>
        </div>
      </Card>
    </>
  );
}

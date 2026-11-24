import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { RoutineView } from "@/components/routine-view";
import { withVideos } from "@/lib/routine-server";
import { currentWeek } from "@/lib/routine";

export const metadata = { title: "Mi rutina" };

export default async function MyRoutine() {
  const u = await requireUser(["ATHLETE"]);
  const r = await db.routine.findFirst({ where: { athleteId: u.id, active: true }, orderBy: { updatedAt: "desc" }, include: { coach: { select: { name: true } } } });
  if (!r) return (<><PageHeader title="Mi rutina" /><Empty title="Todavía no tenés rutina">Cuando tu entrenador te la cargue, la vas a ver acá con los videos de cada ejercicio.</Empty></>);
  const data = await withVideos(u.orgId, r.data);
  const week = currentWeek(data);
  return (
    <>
      <PageHeader title={r.name} eyebrow="Mi rutina"
        subtitle={<>{r.coach ? `De ${r.coach.name} · ` : ""}actualizada {fmtDate(r.updatedAt)}{week != null ? ` · vas por la semana ${week + 1} de ${data.weeks}` : data.meta.start ? "" : ""}</>} />
      <RoutineView data={data} week={week} />
    </>
  );
}

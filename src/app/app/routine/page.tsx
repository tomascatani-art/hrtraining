import Link from "next/link";
import { Notice } from "@/components/routine-notice";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty, fmtDate } from "@/components/ui";
import { RoutineView } from "@/components/routine-view";
import { withVideos, currentRoutine, extraRoutines } from "@/lib/routine-server";
import { currentWeek, sanitizeRoutine } from "@/lib/routine";

export const metadata = { title: "Mi rutina" };

export default async function MyRoutine({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const u = await requireUser(["ATHLETE"]);
  const sp = await searchParams;
  const main = await currentRoutine(u.id);
  const extras = await extraRoutines(u.id);
  const r = (sp.r && extras.find((x) => x.id === sp.r)) || main || extras[0];
  if (!r) return (<><PageHeader title="Mi rutina" /><Empty title="Todavía no tenés rutina">Cuando tu entrenador te la cargue, la vas a ver acá con los videos de cada ejercicio.</Empty></>);
  const data = await withVideos(u.orgId, r.data);
  const week = currentWeek(data);
  const notice = main ? sanitizeRoutine(main.data).meta.notice?.trim() : "";
  const coach = r.coachId ? await db.user.findUnique({ where: { id: r.coachId }, select: { name: true } }) : null;
  return (
    <>
      <PageHeader title={r.name} eyebrow={r.extra ? "Rutina extra" : "Mi rutina"}
        subtitle={<>{coach ? `De ${coach.name} · ` : ""}actualizada {fmtDate(r.updatedAt)}{week != null ? ` · vas por la semana ${week + 1} de ${data.weeks}` : ""}</>} />
      {notice && !r.extra && <Notice text={notice} />}
      {extras.length > 0 && (
        <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {main && <Link href="/app/routine" className={r.id === main.id ? "chip-volt whitespace-nowrap" : "chip-mute whitespace-nowrap hover:text-white"}>Plan principal</Link>}
          {extras.map((x) => <Link key={x.id} href={`/app/routine?r=${x.id}`} className={r.id === x.id ? "chip-volt whitespace-nowrap" : "chip-mute whitespace-nowrap hover:text-white"}>{x.name}</Link>)}
        </div>
      )}
      <RoutineView data={data} week={week} />
    </>
  );
}


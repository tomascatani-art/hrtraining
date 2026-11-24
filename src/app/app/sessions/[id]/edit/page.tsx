import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionWhere } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { SessionBuilder } from "@/components/session-builder";
import { builderOptions } from "../../builder-data";
import { saveSession } from "../../actions";

export default async function EditSession({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const s = await db.session.findFirst({ where: { id, ...(await sessionWhere(u)) }, include: { items: { orderBy: { order: "asc" }, include: { _count: { select: { setLogs: true } } } } } });
  if (!s) notFound();
  const opts = await builderOptions(u);
  const editable = s.items.filter((i) => i._count.setLogs === 0);
  const locked = s.items.length - editable.length;
  return (
    <>
      <PageHeader title="Editar sesión" subtitle={locked ? `${locked} ejercicio(s) ya tienen series registradas por deportistas y se conservan sin cambios.` : undefined} />
      <SessionBuilder action={saveSession} {...opts}
        initial={{
          id: s.id, title: s.title, date: s.date.toISOString(), type: s.type, durationMin: s.durationMin, targetRpe: s.targetRpe, capacities: s.capacities,
          target: s.groupId ? `g:${s.groupId}` : `a:${s.athleteId}`, planId: s.planId ?? "", notes: s.notes ?? "",
          items: editable.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets, reps: i.reps, loadKg: i.loadKg?.toString() ?? "", percent1RM: i.percent1RM ? String(Math.round(i.percent1RM * 100)) : "", targetRir: i.targetRir?.toString() ?? "", restSec: i.restSec?.toString() ?? "", tempo: i.tempo ?? "", notes: i.notes ?? "", block: i.block ?? "" })),
        }} />
    </>
  );
}

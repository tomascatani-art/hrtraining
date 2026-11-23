import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { saveDrawings, addVideoComment, setAnalysisStatus, deleteAnalysis } from "../actions";

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const a = await db.videoAnalysis.findUnique({ where: { id }, include: { athlete: true, video: true, compare: true, comments: { include: { author: true }, orderBy: { createdAt: "desc" } } } });
  if (!a || !(await canSeeAthlete(u, a.athleteId))) notFound();
  const staff = u.role !== "ATHLETE";
  return (
    <>
      <PageHeader eyebrow={`${a.athlete.name}${a.movement ? ` · ${a.movement}` : ""}`} title={a.title}
        actions={staff ? <>
          <form action={setAnalysisStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={a.status === "REVISADO" ? "PENDIENTE" : "REVISADO"} /><Submit className={a.status === "REVISADO" ? "btn-ghost" : "btn-primary"}>{a.status === "REVISADO" ? "Marcar pendiente" : "Marcar como revisado"}</Submit></form>
          <form action={deleteAnalysis}><input type="hidden" name="id" value={a.id} /><ConfirmSubmit message="¿Eliminar el análisis? Los videos se conservan." className="btn-danger">Eliminar</ConfirmSubmit></form>
        </> : <span className={a.status === "REVISADO" ? "chip-green" : "chip-amber"}>{a.status === "REVISADO" ? "Revisado por el entrenador" : "Pendiente de revisión"}</span>} />
      <AnalysisWorkspace id={a.id} srcA={`/api/files/${a.videoId}`} srcB={a.compareId ? `/api/files/${a.compareId}` : null}
        drawings={(a.drawings as never[]) ?? []} saveDrawings={saveDrawings} addComment={addVideoComment}
        comments={a.comments.map((c) => ({ id: c.id, body: c.body, atSecond: c.atSecond, author: c.author.name, createdAt: c.createdAt.toISOString(), mine: c.authorId === u.id }))} />
    </>
  );
}

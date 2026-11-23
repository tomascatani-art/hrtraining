import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ExerciseForm } from "../../form";
export default async function EditExercise({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const e = await db.exercise.findUnique({ where: { id } });
  if (!e || e.orgId !== u.orgId) notFound();
  return (<><PageHeader title={`Editar: ${e.name}`} /><ExerciseForm e={e} /></>);
}

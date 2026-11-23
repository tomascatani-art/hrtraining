import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ExerciseForm } from "../form";
export const metadata = { title: "Nuevo ejercicio" };
export default async function NewExercise() {
  await requireUser(["COACH", "ADMIN"]);
  return (<><PageHeader title="Nuevo ejercicio" subtitle="Queda disponible para todos los entrenadores de tu organización." /><ExerciseForm /></>);
}

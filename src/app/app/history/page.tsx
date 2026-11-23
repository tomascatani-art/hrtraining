import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { HistoryPanel } from "@/components/athlete-panels";

export const metadata = { title: "Historial" };

export default async function HistoryPage() {
  const u = await requireUser();
  if (u.role !== "ATHLETE") redirect("/app/athletes");
  return (<><PageHeader title="Historial de entrenamiento" subtitle="Todas tus sesiones registradas con series, cargas, RIR y comentarios del entrenador." /><HistoryPanel athleteId={u.id} /></>);
}

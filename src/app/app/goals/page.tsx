import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { GoalsPanel } from "@/components/athlete-panels";

export const metadata = { title: "Objetivos" };

export default async function GoalsPage() {
  const u = await requireUser();
  if (u.role !== "ATHLETE") redirect("/app/athletes");
  return (<><PageHeader title="Mis objetivos" subtitle="Metas semanales y de temporada. Podés actualizar tu progreso." /><GoalsPanel athleteId={u.id} canEdit /></>);
}

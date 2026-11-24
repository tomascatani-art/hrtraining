import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RMPanel } from "@/components/rm-panel";

export const metadata = { title: "Mis RM" };

export default async function MyRM() {
  const u = await requireUser();
  if (u.role !== "ATHLETE") redirect("/app/athletes");
  return (
    <>
      <PageHeader title="Mis RM" subtitle="Tu repetición máxima en cada ejercicio. Con estos valores, las sesiones que indican un % calculan solas cuántos kilos usar." />
      <RMPanel athleteId={u.id} viewer="ATHLETE" />
    </>
  );
}

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateOnly } from "@/lib/metrics";
import { PageHeader, Card } from "@/components/ui";
import { WellnessForm } from "@/components/wellness-form";
import { LoadPanel } from "@/components/athlete-panels";
import { saveWellness } from "./actions";

export const metadata = { title: "Bienestar" };

export default async function WellnessPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const u = await requireUser();
  if (u.role !== "ATHLETE") redirect("/app/load");
  const sp = await searchParams;
  const today = await db.wellness.findUnique({ where: { athleteId_date: { athleteId: u.id, date: dateOnly(new Date()) } } });
  return (
    <>
      <PageHeader title="Bienestar diario" subtitle="Un registro de 30 segundos, idealmente al despertar. Tu entrenador lo usa para ajustar la carga." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={today ? "Hoy ya registraste · podés actualizar" : "¿Cómo llegás hoy?"} className="xl:col-span-1">
          {sp.ok && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">¡Gracias! Registro guardado.</div>}
          <WellnessForm action={saveWellness} initial={today ?? undefined} />
        </Card>
        <div className="xl:col-span-2"><LoadPanel athleteId={u.id} /></div>
      </div>
    </>
  );
}

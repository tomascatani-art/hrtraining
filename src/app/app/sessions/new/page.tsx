import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SessionBuilder } from "@/components/session-builder";
import { builderOptions } from "../builder-data";
import { saveSession } from "../actions";

export const metadata = { title: "Nueva sesión" };

export default async function NewSession({ searchParams }: { searchParams: Promise<{ date?: string; group?: string; athlete?: string; plan?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  const opts = await builderOptions(u);
  const d = sp.date ? new Date(`${sp.date}T21:00:00Z`) : (() => { const x = new Date(); x.setHours(x.getHours() + 1, 0, 0, 0); return x; })();
  return (
    <>
      <PageHeader title="Nueva sesión" subtitle="Armá la sesión con ejercicios de la biblioteca. Asignala a un alumno o a un grupo completo." />
      <SessionBuilder action={saveSession} {...opts}
        initial={{ title: "", date: d.toISOString(), type: "FUERZA", durationMin: 60, targetRpe: 7, capacities: [], target: sp.group ? `g:${sp.group}` : sp.athlete ? `a:${sp.athlete}` : "", planId: sp.plan ?? "", notes: "", items: [] }} />
    </>
  );
}

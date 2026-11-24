import { requireUser } from "@/lib/auth";
import { PageHeader, Tabs } from "@/components/ui";
import { IntervalTimer, StrengthCalculator, EnergyCalculator } from "@/components/tools";

export const metadata = { title: "Herramientas" };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const u = await requireUser();
  const t = (await searchParams).t ?? "timer";
  const p = u.athleteProfile;
  const age = p?.birthDate ? Math.floor((Date.now() - +p.birthDate) / (365.25 * 86400000)) : null;
  return (
    <>
      <PageHeader title="Herramientas" subtitle="Temporizador por intervalos, calculadora de fuerza con discos y estimación de energía diaria." />
      <Tabs active={t} items={[
        { key: "timer", label: "Temporizador", href: "/app/tools?t=timer" },
        { key: "fuerza", label: "Calculadora de fuerza", href: "/app/tools?t=fuerza" },
        { key: "energia", label: "Energía y macros", href: "/app/tools?t=energia" },
      ]} />
      {t === "timer" && <IntervalTimer />}
      {t === "fuerza" && <StrengthCalculator />}
      {t === "energia" && <EnergyCalculator initial={{ weightKg: p?.weightKg, heightCm: p?.heightCm, age, sex: p?.sex }} />}
    </>
  );
}

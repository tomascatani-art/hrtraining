import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import { TESTS, TEST_CATEGORIES, TEST_MAP, SPORT_TEMPLATES, FMS_COMPONENTS, isBasicTest } from "@/lib/catalog";
import { isoDay } from "@/lib/metrics";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { saveBattery } from "../actions";

export const metadata = { title: "Nueva evaluación" };

export default async function NewEvaluation({ searchParams }: { searchParams: Promise<{ athlete?: string; group?: string; tests?: string | string[]; preset?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const [athletes, groups] = await Promise.all([db.user.findMany({ where: { id: { in: ids } }, include: { athleteProfile: true }, orderBy: { name: "asc" } }), visibleGroups(u)]);
  let selected = (Array.isArray(sp.tests) ? sp.tests : sp.tests ? [sp.tests] : []).filter((k) => TEST_MAP[k] && isBasicTest(k));
  if (selected.includes("FMS_TOTAL")) selected = [...selected.filter((k) => k !== "FMS_TOTAL"), ...FMS_COMPONENTS];
  selected = [...new Set(selected)];

  let targets: typeof athletes = [];
  if (sp.athlete && ids.includes(sp.athlete)) targets = athletes.filter((a) => a.id === sp.athlete);
  if (sp.group) {
    const m = await db.groupMember.findMany({ where: { groupId: sp.group } });
    targets = athletes.filter((a) => m.some((x) => x.athleteId === a.id));
  }
  const sport = targets[0]?.athleteProfile?.sport ?? "GENERAL";
  const suggested = (SPORT_TEMPLATES[sport]?.tests ?? []).filter(isBasicTest);

  if (!targets.length || !selected.length) {
    return (
      <>
        <PageHeader title="Nueva evaluación" subtitle="1 · Elegí a quién evaluar y qué batería de tests aplicar. Podés evaluar a un grupo completo en una sola planilla." />
        <Card className="max-w-4xl">
          <form className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Alumno"><select name="athlete" defaultValue={sp.athlete ?? ""} className="input"><option value="">—</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
              <Field label="o grupo completo"><select name="group" defaultValue={sp.group ?? ""} className="input"><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
            </div>
            {(Object.keys(TEST_CATEGORIES) as (keyof typeof TEST_CATEGORIES)[]).map((c) => (
              <div key={c}>
                <div className="label mb-2 text-volt/80">{TEST_CATEGORIES[c]}</div>
                <div className="flex flex-wrap gap-2">
                  {TESTS.filter((t) => t.category === c && (c !== "FMS" || t.key === "FMS_TOTAL")).map((t) => (
                    <label key={t.key} className="cursor-pointer" title={t.protocol}>
                      <input type="checkbox" name="tests" value={t.key} defaultChecked={selected.includes(t.key) || (!selected.length && suggested.includes(t.key))} className="peer sr-only" />
                      <span className="chip-mute py-1 peer-checked:border-volt peer-checked:bg-volt peer-checked:text-black">{t.key === "FMS_TOTAL" ? "FMS completo (7 patrones)" : t.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end"><button className="btn-primary">Continuar a la planilla</button></div>
          </form>
        </Card>
      </>
    );
  }

  const videos = await db.fileAsset.findMany({ where: { orgId: u.orgId, kind: "VIDEO", OR: [{ athleteId: { in: targets.map((t) => t.id) } }, { shared: true }] }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <>
      <PageHeader title="Nueva evaluación" subtitle={`2 · Cargá los resultados. ${targets.length} alumno(s), ${selected.length} test(s). Los campos vacíos se ignoran.`} actions={<Link href="/app/evaluations/new" className="btn-ghost">Cambiar selección</Link>} />
      <form action={saveBattery} className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Fecha"><input type="date" name="date" defaultValue={isoDay(new Date())} className="input" required /></Field>
            <Field label="Video adjunto (opcional)"><select name="videoId" className="input"><option value="">Sin video</option>{videos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
            <Field label="Notas / condiciones"><input name="notes" className="input" placeholder="Ej: plataforma de contacto, pista sintética, viento +1.0" /></Field>
          </div>
        </Card>
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th className="sticky left-0 z-10 bg-ink-850">Alumno</th>{selected.map((k) => <th key={k} title={TEST_MAP[k].protocol}>{TEST_MAP[k].name}<div className="text-[9px] normal-case tracking-normal text-neutral-600">{TEST_MAP[k].unit}{k.startsWith("FMS_") ? " · 0-3" : ""}</div></th>)}</tr></thead>
              <tbody>
                {targets.map((a) => (
                  <tr key={a.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-ink-850 font-medium text-white">{a.name}</td>
                    {selected.map((k) => (
                      <td key={k}><input name={`v__${a.id}__${k}`} inputMode="decimal" className="input w-24 py-1.5 text-center" {...(k.startsWith("FMS_") ? { type: "number", min: 0, max: 3 } : { type: "text" })} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected.some((k) => k.startsWith("FMS_")) && <p className="px-5 pb-4 pt-2 text-xs muted">Si completás los 7 patrones FMS, el total se calcula automáticamente y se guarda el perfil completo.</p>}
          {selected.includes("RSI") && <p className="px-5 pb-4 text-xs muted">RSI = altura de vuelo (m) ÷ tiempo de contacto (s). Ej: 0,32 m / 0,18 s = 1,78.</p>}
        </Card>
        <div className="flex justify-end"><Submit>Guardar resultados</Submit></div>
      </form>
    </>
  );
}

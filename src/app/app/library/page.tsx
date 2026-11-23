import Link from "next/link";
import { Search, PlayCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAPACITIES, CHAINS, DIFFICULTY, EQUIPMENT, MUSCLES, PATTERNS, SPORTS } from "@/lib/catalog";
import { PageHeader, Empty } from "@/components/ui";

export const metadata = { title: "Biblioteca de ejercicios" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const where: Prisma.ExerciseWhereInput = { OR: [{ orgId: null }, { orgId: u.orgId }], AND: [] };
  const and = where.AND as Prisma.ExerciseWhereInput[];
  if (sp.q) and.push({ OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { objective: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }] });
  if (sp.muscle) and.push({ muscles: { has: sp.muscle } });
  if (sp.chain) and.push({ kineticChain: sp.chain });
  if (sp.pattern) and.push({ pattern: sp.pattern });
  if (sp.capacity) and.push({ capacities: { has: sp.capacity } });
  if (sp.sport) and.push({ sports: { has: sp.sport } });
  if (sp.equipment) and.push({ equipment: { has: sp.equipment } });
  if (sp.level) and.push({ difficulty: Number(sp.level) });
  if (sp.own === "1") and.push({ orgId: u.orgId });
  const items = await db.exercise.findMany({ where, orderBy: { name: "asc" } });
  const sel = (name: string, label: string, opts: [string, string][]) => (
    <select name={name} defaultValue={sp[name] ?? ""} className="input py-2 text-sm"><option value="">{label}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  );
  return (
    <>
      <PageHeader title="Biblioteca de ejercicios" subtitle={`${items.length} ejercicios. Filtrá por músculo, cadena cinética, patrón, capacidad, deporte, material o nivel.`}
        actions={u.role !== "ATHLETE" ? <Link href="/app/library/new" className="btn-primary">Crear ejercicio</Link> : undefined} />
      <form className="card card-pad mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-4 xl:col-span-5"><Search size={15} className="absolute left-3 top-3 text-neutral-500" /><input name="q" defaultValue={sp.q} placeholder="Buscar por nombre u objetivo…" className="input pl-9" /></div>
        {sel("muscle", "Grupo muscular", MUSCLES.map((m) => [m, m]))}
        {sel("chain", "Cadena cinética", Object.entries(CHAINS))}
        {sel("pattern", "Patrón de movimiento", Object.entries(PATTERNS))}
        {sel("capacity", "Capacidad física", Object.entries(CAPACITIES).map(([k, v]) => [k, v.label]))}
        {sel("sport", "Deporte", Object.entries(SPORTS).map(([k, v]) => [k, v.label]))}
        {sel("equipment", "Material", EQUIPMENT.map((m) => [m, m]))}
        {sel("level", "Nivel", Object.entries(DIFFICULTY).map(([k, v]) => [k, v]))}
        {u.role !== "ATHLETE" && <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="own" value="1" defaultChecked={sp.own === "1"} />Solo propios</label>}
        <div className="flex gap-2"><button className="btn-primary flex-1">Filtrar</button><Link href="/app/library" className="btn-ghost">Limpiar</Link></div>
      </form>
      {items.length === 0 ? <Empty title="No hay ejercicios con esos filtros" /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((e) => (
            <Link key={e.id} href={`/app/library/${e.id}`} className="card card-hover group flex flex-col p-4">
              <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 relative overflow-hidden">
                {e.imageUrl ? <img src={e.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" /> : <span className="font-display text-3xl font-bold text-ink-500">{e.pattern.slice(0, 3)}</span>}
                {e.videoUrl && <PlayCircle className="absolute bottom-2 right-2 text-volt" size={20} />}
              </div>
              <div className="flex items-start gap-2"><div className="flex-1 font-semibold text-white group-hover:text-volt">{e.name}</div>{e.orgId && <span className="chip-volt">Propio</span>}</div>
              <div className="mt-1 text-xs muted">{e.primaryMuscle} · {PATTERNS[e.pattern]?.split(" /")[0] ?? e.pattern} · {DIFFICULTY[e.difficulty]}</div>
              <div className="mt-2 flex flex-wrap gap-1">{e.capacities.slice(0, 3).map((c) => <span key={c} className="chip-mute">{CAPACITIES[c]?.label}</span>)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

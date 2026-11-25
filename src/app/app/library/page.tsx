import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAPACITIES, CHAINS, DIFFICULTY, EQUIPMENT, MUSCLES, PATTERNS, SPORTS, EX_CATEGORIES } from "@/lib/catalog";
import { PageHeader, Empty } from "@/components/ui";
import { exerciseVideos } from "@/lib/exercise-video";
import { ExerciseLinkInline } from "@/components/exercise-link-inline";
import { setExerciseLink } from "./actions";

export const metadata = { title: "Biblioteca de ejercicios" };
const PAGE = 60;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  // Diego: el alumno solo ve lo que le planifica su preparador, no la biblioteca entera.
  if (u.role === "ATHLETE") redirect("/app/routine");
  const staff = true;
  const scope: Prisma.ExerciseWhereInput = { OR: [{ orgId: null }, { orgId: u.orgId }] };
  const and: Prisma.ExerciseWhereInput[] = [];
  if (sp.q) for (const w of sp.q.trim().split(/\s+/).slice(0, 5)) and.push({ name: { contains: w, mode: "insensitive" } });
  if (sp.cat) and.push({ category: sp.cat });
  if (sp.muscle) and.push({ muscles: { has: sp.muscle } });
  if (sp.chain) and.push({ kineticChain: sp.chain });
  if (sp.pattern) and.push({ pattern: sp.pattern });
  if (sp.capacity) and.push({ capacities: { has: sp.capacity } });
  if (sp.sport) and.push({ sports: { has: sp.sport } });
  if (sp.equipment) and.push({ equipment: { has: sp.equipment } });
  if (sp.level) and.push({ difficulty: Number(sp.level) });
  if (sp.own === "1") and.push({ orgId: u.orgId });
  if (sp.video === "1" || sp.video === "0") {
    const linked = (await db.exerciseLink.findMany({ where: { orgId: u.orgId }, select: { exerciseId: true } })).map((l) => l.exerciseId);
    const withVideo: Prisma.ExerciseWhereInput = { OR: [{ id: { in: linked } }, { AND: [{ videoUrl: { startsWith: "https://" } }, { NOT: { videoUrl: { contains: "youtube.com/results" } } }] }, { videoUrl: { startsWith: "/api/files/" } }] };
    and.push(sp.video === "1" ? withVideo : { NOT: withVideo });
  }
  const where: Prisma.ExerciseWhereInput = { ...scope, AND: and };
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, all, counts] = await Promise.all([
    db.exercise.count({ where }),
    db.exercise.count({ where: scope }),
    db.exercise.groupBy({ by: ["category"], where: scope, _count: true }),
  ]);
  const items = await db.exercise.findMany({ where, orderBy: [{ orgId: { sort: "desc", nulls: "last" } }, { name: "asc" }], skip: (page - 1) * PAGE, take: PAGE });
  const videos = await exerciseVideos(u.orgId, items.map((e) => e.id));
  const linkedCount = await db.exerciseLink.count({ where: { orgId: u.orgId } });
  const byCat = new Map(counts.map((c) => [c.category ?? "", c._count]));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch } as Record<string, string | undefined>).filter((e): e is [string, string] => !!e[1]));
    const s = p.toString(); return s ? `/app/library?${s}` : "/app/library";
  };
  const sel = (name: string, label: string, opts: [string, string][]) => (
    <select name={name} defaultValue={sp[name] ?? ""} className="input py-2 text-sm"><option value="">{label}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  );
  const pages = Math.ceil(total / PAGE);
  const advanced = ["muscle", "chain", "pattern", "capacity", "sport", "equipment", "level", "own", "video"].some((k) => sp[k]);
  return (
    <>
      <PageHeader title="Biblioteca de ejercicios" subtitle={`${all} ejercicios cargados · ${linkedCount} con tu link de video. Tocá “Pegar link” para ponerle el video de YouTube; el alumno lo ve adentro de la app.`}
        actions={staff ? <Link href="/app/library/new" className="btn-primary">Crear ejercicio</Link> : undefined} />

      <form className="relative mb-3">
        {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
        <Search size={16} className="absolute left-3 top-3 text-neutral-500" />
        <input name="q" defaultValue={sp.q} placeholder="Buscar ejercicio… (ej: sentadilla búlgara, plancha, cargada)" className="input pl-9" />
      </form>

      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link href={qs({ cat: undefined })} className={!sp.cat ? "chip-volt whitespace-nowrap" : "chip-mute whitespace-nowrap hover:text-white"}>Todos · {all}</Link>
        {EX_CATEGORIES.filter((c) => byCat.get(c)).map((c) => (
          <Link key={c} href={qs({ cat: c })} className={sp.cat === c ? "chip-volt whitespace-nowrap" : "chip-mute whitespace-nowrap hover:text-white"}>{c} · {byCat.get(c)}</Link>
        ))}
      </div>

      <details className="card mb-5" open={advanced}>
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-neutral-300"><SlidersHorizontal size={14} />Más filtros (músculo, patrón, material, nivel, video)</summary>
        <form className="grid gap-2 border-t border-ink-700 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          {sel("muscle", "Grupo muscular", MUSCLES.map((m) => [m, m]))}
          {sel("pattern", "Patrón de movimiento", Object.entries(PATTERNS))}
          {sel("equipment", "Material", EQUIPMENT.map((m) => [m, m]))}
          {sel("level", "Nivel", Object.entries(DIFFICULTY).map(([k, v]) => [k, v]))}
          {sel("capacity", "Capacidad física", Object.entries(CAPACITIES).map(([k, v]) => [k, v.label]))}
          {sel("chain", "Cadena cinética", Object.entries(CHAINS))}
          {sel("sport", "Deporte", Object.entries(SPORTS).map(([k, v]) => [k, v.label]))}
          {sel("video", "Con o sin video", [["1", "Con video"], ["0", "Sin video todavía"]])}
          {staff && <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="own" value="1" defaultChecked={sp.own === "1"} />Solo los que creé yo</label>}
          <div className="flex gap-2"><button className="btn-primary flex-1">Filtrar</button><Link href="/app/library" className="btn-ghost">Limpiar</Link></div>
        </form>
      </details>

      {items.length === 0 ? <Empty title="No hay ejercicios con esa búsqueda" action={staff ? <Link href="/app/library/new" className="btn-primary">Crearlo</Link> : undefined}>Probá con otra palabra o sacá filtros.</Empty> : (
        <>
          <div className="mb-2 text-xs muted">{total === all ? `${total} ejercicios` : `${total} de ${all} ejercicios`}{pages > 1 && ` · página ${page} de ${pages}`}</div>
          <div className="card divide-y divide-ink-700">
            {items.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <Link href={`/app/library/${e.id}`} className="group min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2"><span className="truncate font-semibold text-white group-hover:text-volt">{e.name}</span>{e.orgId && <span className="chip-volt">Mío</span>}</div>
                  <div className="truncate text-xs muted">{e.category ?? PATTERNS[e.pattern]?.split(" /")[0]}{e.primaryMuscle !== e.category && ` · ${e.primaryMuscle}`}{e.equipment.length ? ` · ${e.equipment.slice(0, 2).join(", ")}` : ""}</div>
                </Link>
                <div className="ml-auto"><ExerciseLinkInline exerciseId={e.id} name={e.name} url={videos.get(e.id)} canEdit={staff} save={setExerciseLink} /></div>
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn-ghost">Anterior</Link>}
              <span className="text-sm muted">{page} / {pages}</span>
              {page < pages && <Link href={qs({ page: String(page + 1) })} className="btn-ghost">Siguiente</Link>}
            </div>
          )}
        </>
      )}
    </>
  );
}

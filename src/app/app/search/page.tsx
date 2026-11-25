import Link from "next/link";
import { Search, Users, Dumbbell, ClipboardList, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds, visibleGroups } from "@/lib/access";
import { Avatar } from "@/components/ui";
import { avatarSrc } from "@/lib/avatar";
import { exerciseVideos } from "@/lib/exercise-video";
import { VideoButton } from "@/components/video-player";

export const metadata = { title: "Buscar" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section className="card">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3 text-sm font-semibold text-white"><span className="text-volt">{icon}</span>{title}<span className="muted">· {count}</span></div>
      <div className="divide-y divide-ink-800">{children}</div>
    </section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const staff = u.role !== "ATHLETE";
  const words = q.split(/\s+/).filter(Boolean);
  const like = (field: string) => ({ AND: words.map((w) => ({ [field]: { contains: w, mode: "insensitive" as const } })) });
  let athletes: { id: string; name: string; email: string; avatarKey: string | null; avatarAt: Date | null; athleteProfile: { sport: string } | null }[] = [];
  let routines: { id: string; name: string; template: boolean; extra: boolean; active: boolean; athlete: { name: string } | null; match: string | null }[] = [];
  let groups: { id: string; name: string }[] = [];
  let exercises: { id: string; name: string; category: string | null }[] = [];
  if (words.length) {
    const ids = staff ? await visibleAthleteIds(u) : [u.id];
    if (staff) exercises = await db.exercise.findMany({ where: { OR: [{ orgId: null }, { orgId: u.orgId }], ...like("name") }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" }, take: 25 });
    if (staff) {
      athletes = await db.user.findMany({ where: { id: { in: ids }, OR: [like("name"), like("email")] }, select: { id: true, name: true, email: true, avatarKey: true, avatarAt: true, athleteProfile: { select: { sport: true } } }, orderBy: { name: "asc" }, take: 20 });
      const gs = await visibleGroups(u);
      groups = gs.filter((g) => words.every((w) => norm(g.name).includes(norm(w))));
    }
    // Rutinas y plantillas: por nombre o por un ejercicio que tengan adentro.
    const all = await db.routine.findMany({
      where: { orgId: u.orgId, ...(staff ? { OR: [{ template: true }, { athleteId: { in: ids } }] } : { athleteId: u.id, OR: [{ active: true }, { extra: true }] }) },
      select: { id: true, name: true, template: true, extra: true, active: true, startsOn: true, data: true, athlete: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 500,
    });
    const nw = words.map(norm);
    for (const r of all) {
      const inName = nw.every((w) => norm(r.name).includes(w) || norm(r.athlete?.name ?? "").includes(w));
      let match: string | null = null;
      if (!inName) {
        const d = r.data as { days?: { name?: string; blocks?: { rows?: { name?: string }[] }[] }[] };
        for (const day of d.days ?? []) for (const b of day.blocks ?? []) for (const row of b.rows ?? []) if (!match && row.name && nw.every((w) => norm(row.name!).includes(w))) match = `${day.name}: ${row.name}`;
      }
      if (inName || match) routines.push({ id: r.id, name: r.name, template: r.template, extra: r.extra, active: r.active || !!r.startsOn, athlete: r.athlete, match });
    }
    routines = routines.sort((a, b) => Number(b.active) - Number(a.active)).slice(0, 25);
  }
  const vids = await exerciseVideos(u.orgId, exercises.map((e) => e.id));
  const total = athletes.length + routines.length + groups.length + exercises.length;
  return (
    <div className="mx-auto max-w-3xl">
      <form className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-3.5 text-neutral-500" />
        <input name="q" defaultValue={q} autoFocus placeholder={staff ? "Buscar alumnos, ejercicios, rutinas, plantillas, grupos…" : "Buscar algo de tu rutina…"} className="input py-3 pl-11 text-base" />
      </form>
      {!words.length ? <p className="text-center text-sm muted">Escribí un nombre: por ejemplo “Sofía”, “sentadilla” o “pretemporada”.</p> :
        total === 0 ? <p className="text-center text-sm muted">No encontré nada con “{q}”.</p> : (
        <div className="space-y-4">
          <Section icon={<Users size={16} />} title="Alumnos" count={athletes.length}>
            {athletes.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={a.name} src={avatarSrc(a)} size={34} />
                <Link href={`/app/athletes/${a.id}`} className="min-w-0 flex-1 truncate font-semibold text-white hover:text-volt">{a.name}</Link>
                <Link href={`/app/athletes/${a.id}?tab=rutina`} className="text-xs text-volt hover:underline">Plan</Link>
              </div>
            ))}
          </Section>
          <Section icon={<ClipboardList size={16} />} title={staff ? "Rutinas y plantillas" : "Tu rutina"} count={routines.length}>
            {routines.map((r) => (
              <Link key={r.id} href={staff ? `/app/routines/${r.id}` : r.extra ? `/app/routine?r=${r.id}` : "/app/routine"} className="block px-4 py-2.5 hover:bg-ink-900">
                <div className="flex items-center gap-2"><span className="truncate font-semibold text-white">{r.name}</span>{r.template && <span className="chip-mute">Plantilla</span>}{r.extra && <span className="chip-mute">Extra</span>}{staff && !r.template && !r.active && <span className="chip-mute">Anterior</span>}</div>
                <div className="truncate text-xs muted">{[r.athlete?.name, r.match && `Tiene ${r.match}`].filter(Boolean).join(" · ")}</div>
              </Link>
            ))}
          </Section>
          <Section icon={<Dumbbell size={16} />} title="Ejercicios" count={exercises.length}>
            {exercises.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/app/library/${e.id}`} className="min-w-0 flex-1"><div className="truncate font-semibold text-white hover:text-volt">{e.name}</div><div className="text-xs muted">{e.category}</div></Link>
                <VideoButton url={vids.get(e.id)} name={e.name} compact={!staff} />
              </div>
            ))}
          </Section>
          <Section icon={<UsersRound size={16} />} title="Grupos" count={groups.length}>
            {groups.map((g) => <Link key={g.id} href={`/app/groups/${g.id}`} className="block px-4 py-2.5 font-semibold text-white hover:text-volt">{g.name}</Link>)}
          </Section>
        </div>
      )}
    </div>
  );
}

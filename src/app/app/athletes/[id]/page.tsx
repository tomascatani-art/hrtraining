import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { FileText, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeAthlete } from "@/lib/access";
import { SPORTS, sportLabel } from "@/lib/catalog";
import { FolderPanel } from "@/components/folder-panel";
import { Avatar, DemoBadge, Tabs, Card, Field } from "@/components/ui";
import { Submit, CopyField } from "@/components/forms";
import { LoadPanel, EvalPanel, HistoryPanel, GoalsPanel } from "@/components/athlete-panels";
import { RMPanel } from "@/components/rm-panel";
import { TrainingInsights } from "@/components/insights";
import { updateAthlete, regenerateInvite } from "../actions";

export default async function AthleteDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; invitado?: string; carpeta?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!(await canSeeAthlete(u, id))) notFound();
  const a = await db.user.findUnique({ where: { id }, include: { athleteProfile: true, memberships: { include: { group: true } } } });
  if (!a || a.role !== "ATHLETE") notFound();
  const coaches = await db.user.findMany({ where: { orgId: u.orgId, role: { in: ["COACH", "ADMIN"] } }, orderBy: { name: "asc" } });
  const tab = sp.tab ?? "resumen";
  const p = a.athleteProfile;
  const age = p?.birthDate ? Math.floor((Date.now() - +p.birthDate) / (365.25 * 86400000)) : null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const base = `/app/athletes/${id}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center animate-rise">
        <Avatar name={a.name} size={64} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="h1">{a.name}</h1>{a.isDemo && <DemoBadge />}{!a.active && <span className="chip-red">Inactivo</span>}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <span className="chip-volt">{sportLabel(p?.sport)}</span>
            {p?.position && <span className="chip-mute">{p.position}</span>}
            {p?.level && <span className="chip-mute">{p.level}</span>}
            {age != null && <span className="chip-mute">{age} años</span>}
            {p?.heightCm && <span className="chip-mute">{p.heightCm} cm</span>}
            {p?.weightKg && <span className="chip-mute">{p.weightKg} kg</span>}
            {a.memberships.map((m) => <Link key={m.groupId} href={`/app/groups/${m.groupId}`} className="chip-mute hover:text-white">{m.group.name}</Link>)}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/messages?to=${a.id}`} className="btn-ghost"><MessageSquare size={16} />Mensaje</Link>
          <Link href={`/report/${a.id}`} target="_blank" className="btn-ghost"><FileText size={16} />Informe PDF</Link>
        </div>
      </div>

      {(sp.invitado === "1" || a.inviteToken) && a.inviteToken && (
        <div className="card card-pad mb-6 border-volt/40">
          <div className="font-semibold text-white">Invitación pendiente</div>
          <p className="mb-3 text-sm muted">Compartí este enlace con {a.name.split(" ")[0]} para que elija su contraseña y active su cuenta.</p>
          <CopyField value={`${origin}/invite/${a.inviteToken}`} />
        </div>
      )}

      <Tabs active={tab} items={[
        { key: "resumen", label: "Perfil", href: `${base}?tab=resumen` },
        { key: "carga", label: "Carga y bienestar", href: `${base}?tab=carga` },
        { key: "rm", label: "RM", href: `${base}?tab=rm` },
        { key: "evaluaciones", label: "Evaluaciones", href: `${base}?tab=evaluaciones` },
        { key: "historial", label: "Historial", href: `${base}?tab=historial` },
        { key: "objetivos", label: "Objetivos", href: `${base}?tab=objetivos` },
        { key: "carpeta", label: "Carpeta", href: `${base}?tab=carpeta` },
      ]} />

      {tab === "carga" && <LoadPanel athleteId={id} />}
      {tab === "carpeta" && <FolderPanel athleteId={id} viewerId={u.id} staff base={`${base}?tab=carpeta`} active={sp.carpeta} />}
      {tab === "rm" && <RMPanel athleteId={id} viewer="COACH" />}
      {tab === "evaluaciones" && <EvalPanel athleteId={id} canEdit />}
      {tab === "historial" && <><TrainingInsights athleteId={id} /><HistoryPanel athleteId={id} /></>}
      {tab === "objetivos" && <GoalsPanel athleteId={id} canEdit />}
      {tab === "resumen" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Datos del deportista" className="xl:col-span-2">
            <form action={updateAthlete} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Nombre"><input name="name" defaultValue={a.name} className="input" /></Field>
              <Field label="Deporte"><select name="sport" defaultValue={p?.sport} className="input">{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
              <Field label="Puesto / prueba"><input name="position" defaultValue={p?.position ?? ""} className="input" /></Field>
              <Field label="Entrenador responsable"><select name="coachId" defaultValue={p?.coachId ?? ""} className="input">{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Fecha de nacimiento"><input name="birthDate" type="date" defaultValue={p?.birthDate?.toISOString().slice(0, 10)} className="input" /></Field>
              <Field label="Sexo"><select name="sex" defaultValue={p?.sex ?? ""} className="input"><option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">Otro</option></select></Field>
              <Field label="Altura (cm)"><input name="heightCm" type="number" step="0.1" defaultValue={p?.heightCm ?? ""} className="input" /></Field>
              <Field label="Peso (kg)"><input name="weightKg" type="number" step="0.1" defaultValue={p?.weightKg ?? ""} className="input" /></Field>
              <Field label="Nivel"><select name="level" defaultValue={p?.level ?? ""} className="input"><option>Iniciación</option><option>Intermedio</option><option>Avanzado</option><option>Élite</option></select></Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-neutral-300"><input type="checkbox" name="active" defaultChecked={a.active} /> Cuenta activa</label>
              <Field label="Objetivo principal" className="sm:col-span-2"><textarea name="objective" defaultValue={p?.objective ?? ""} className="input" /></Field>
              <Field label="Notas privadas del entrenador" className="sm:col-span-2"><textarea name="notes" defaultValue={p?.notes ?? ""} className="input" /></Field>
              <div className="sm:col-span-2 flex justify-end"><Submit>Guardar cambios</Submit></div>
            </form>
          </Card>
          <div className="space-y-6">
            <Card title="Acceso">
              <div className="text-sm"><div className="label">Email</div><div className="text-white">{a.email}</div></div>
              <div className="mt-3 text-sm"><div className="label">Último ingreso</div><div className="text-white">{a.lastLoginAt ? a.lastLoginAt.toLocaleString("es-AR") : "Nunca"}</div></div>
              <form action={regenerateInvite} className="mt-4"><input type="hidden" name="id" value={a.id} /><Submit className="btn-ghost w-full">Generar nuevo enlace de acceso</Submit></form>
            </Card>
            <Card title="Atajos">
              <div className="grid gap-2">
                <Link href={`/app/calendar?new=1&athlete=${a.id}`} className="btn-ghost justify-start">Asignar sesión individual</Link>
                <Link href={`/app/evaluations/new?athlete=${a.id}`} className="btn-ghost justify-start">Cargar evaluación</Link>
                <Link href={`/app/planning/new?athlete=${a.id}`} className="btn-ghost justify-start">Crear planificación individual</Link>
                <Link href={`/app/videos?athlete=${a.id}`} className="btn-ghost justify-start">Videos y análisis</Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

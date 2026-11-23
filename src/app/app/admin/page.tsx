import { headers } from "next/headers";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Field, Avatar, DemoBadge } from "@/components/ui";
import { Submit, CopyField, ConfirmSubmit } from "@/components/forms";
import { inviteCoach, updateUser, resetDemo } from "./actions";

export const metadata = { title: "Administración" };

const ROLE: Record<string, string> = { ADMIN: "Administrador", COACH: "Entrenador", ATHLETE: "Deportista" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ invited?: string; page?: string }> }) {
  const u = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0));
  const [users, logs, totalLogs, counts] = await Promise.all([
    db.user.findMany({ where: { orgId: u.orgId }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { _count: { select: { coachedAthletes: true } } } }),
    db.auditLog.findMany({ where: { orgId: u.orgId }, include: { user: true }, orderBy: { createdAt: "desc" }, skip: page * 50, take: 50 }),
    db.auditLog.count({ where: { orgId: u.orgId } }),
    Promise.all([db.session.count({ where: { orgId: u.orgId } }), db.evaluation.count({ where: { athlete: { orgId: u.orgId } } }), db.fileAsset.aggregate({ where: { orgId: u.orgId }, _sum: { size: true } })]),
  ]);
  const invited = sp.invited ? users.find((x) => x.id === sp.invited) : undefined;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Administración" subtitle={`${u.org.name} · usuarios, permisos, historial de cambios y copias de seguridad.`}
        actions={<a href="/api/backup" className="btn-ghost"><Download size={15} />Copia de seguridad (JSON)</a>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Entrenadores", users.filter((x) => x.role !== "ATHLETE").length], ["Deportistas", users.filter((x) => x.role === "ATHLETE").length], ["Sesiones", counts[0]], ["Evaluaciones", counts[1]], ["Almacenamiento", `${((counts[2]._sum.size ?? 0) / 1e6).toFixed(1)} MB`]].map(([l, v]) => (
          <div key={l as string} className="card card-pad"><div className="label">{l}</div><div className="num mt-1 text-2xl font-semibold text-white">{v}</div></div>
        ))}
      </div>
      {invited?.inviteToken && <div className="card card-pad mb-6 border-volt/40"><div className="mb-2 font-semibold text-white">Enlace de invitación para {invited.name}</div><CopyField value={`${origin}/invite/${invited.inviteToken}`} /></div>}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Usuarios y permisos" className="xl:col-span-2" pad={false}>
          <div className="overflow-x-auto">
            <table className="table min-w-[680px]">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
              <tbody>
                {users.map((x) => (
                  <tr key={x.id}>
                    <td><div className="flex items-center gap-2"><Avatar name={x.name} size={28} /><div><div className="text-white">{x.name} {x.isDemo && <DemoBadge />}</div><div className="text-xs muted">{x.email}{x.role !== "ATHLETE" && x._count.coachedAthletes ? ` · ${x._count.coachedAthletes} deportistas` : ""}</div></div></div></td>
                    <td colSpan={2}>
                      <form action={updateUser} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={x.id} />
                        <select name="role" defaultValue={x.role} disabled={x.id === u.id || x.role === "ATHLETE"} className="input w-36 py-1.5 text-xs">{(x.role === "ATHLETE" ? ["ATHLETE"] : ["ADMIN", "COACH"]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
                        <label className="flex items-center gap-1 text-xs text-neutral-400"><input type="checkbox" name="active" defaultChecked={x.active} disabled={x.id === u.id} />Activo</label>
                        {x.id !== u.id && <Submit className="btn-ghost btn-sm" pendingText="…">Guardar</Submit>}
                      </form>
                    </td>
                    <td className="text-xs muted">{x.inviteToken ? <span className="chip-amber">Invitación pendiente</span> : x.lastLoginAt ? x.lastLoginAt.toLocaleDateString("es-AR") : "—"}</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Sumar entrenador">
            <form action={inviteCoach} className="space-y-3">
              <Field label="Nombre"><input name="name" className="input" required /></Field>
              <Field label="Email"><input name="email" type="email" className="input" required /></Field>
              <Field label="Rol"><select name="role" className="input"><option value="COACH">Entrenador / preparador físico</option><option value="ADMIN">Administrador</option></select></Field>
              <Submit className="btn-primary w-full">Generar invitación</Submit>
            </form>
            <p className="mt-3 text-[11px] text-neutral-600">Entrenador: ve a sus deportistas y grupos. Administrador: ve toda la organización y gestiona usuarios.</p>
          </Card>
          {u.org.isDemo && (
            <Card title="Organización de demostración">
              <p className="mb-3 text-sm muted">Restablece todos los datos ficticios al estado inicial. Las fechas se recalculan desde hoy.</p>
              <form action={resetDemo}><ConfirmSubmit message="¿Restablecer la demo? Se borran los cambios hechos en ella." className="btn-ghost w-full">Restablecer demo</ConfirmSubmit></form>
            </Card>
          )}
        </div>
      </div>
      <Card title="Historial de modificaciones" className="mt-6" pad={false}>
        <div className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-xs text-neutral-400">{l.createdAt.toLocaleString("es-AR")}</td>
                  <td className="text-sm text-white">{l.user?.name ?? "—"}</td>
                  <td><span className={l.action === "ELIMINAR" ? "chip-red" : l.action === "CREAR" ? "chip-green" : "chip-mute"}>{l.action}</span></td>
                  <td className="text-sm text-neutral-300">{l.entity}</td>
                  <td className="text-sm text-neutral-400">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between px-5 py-3 text-xs">
          {page > 0 ? <a href={`/app/admin?page=${page - 1}`} className="text-volt">← Más recientes</a> : <span />}
          {(page + 1) * 50 < totalLogs ? <a href={`/app/admin?page=${page + 1}`} className="text-volt">Anteriores →</a> : <span />}
        </div>
      </Card>
    </>
  );
}

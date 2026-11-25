import { headers } from "next/headers";
import { avatarSrc } from "@/lib/avatar";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Field, Avatar, DemoBadge } from "@/components/ui";
import { Submit, CopyField, ConfirmSubmit } from "@/components/forms";
import { inviteCoach, updateUser, resetDemo, resetLinkForUser, dismissResetRequest } from "./actions";
import { WhatsAppShare } from "@/components/whatsapp-share";

export const metadata = { title: "Administración" };

const ROLE: Record<string, string> = { ADMIN: "Administrador", COACH: "Entrenador", ATHLETE: "Alumno" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ invited?: string; page?: string; mail?: string; para?: string; clave?: string }> }) {
  const u = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0));
  const [users, logs, totalLogs, counts] = await Promise.all([
    db.user.findMany({ where: { orgId: u.orgId }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { _count: { select: { coachedAthletes: true } } } }),
    db.auditLog.findMany({ where: { orgId: u.orgId }, include: { user: true }, orderBy: { createdAt: "desc" }, skip: page * 50, take: 50 }),
    db.auditLog.count({ where: { orgId: u.orgId } }),
    Promise.all([db.session.count({ where: { orgId: u.orgId } }), db.evaluation.count({ where: { athlete: { orgId: u.orgId } } }), db.fileAsset.aggregate({ where: { orgId: u.orgId }, _sum: { size: true } })]),
  ]);
  const requests = users.filter((x) => x.resetRequestedAt && +x.resetRequestedAt > Date.now() - 14 * 86400000);
  const resetFor = sp.para && sp.clave ? users.find((x) => x.id === sp.para) : undefined;
  const invited = sp.invited ? users.find((x) => x.id === sp.invited) : undefined;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Administración" subtitle={`${u.org.name} · usuarios, permisos, historial de cambios y copias de seguridad.`}
        actions={<a href="/api/backup" className="btn-ghost"><Download size={15} />Copia de seguridad (JSON)</a>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Entrenadores", users.filter((x) => x.role !== "ATHLETE").length], ["Alumnos", users.filter((x) => x.role === "ATHLETE").length], ["Sesiones", counts[0]], ["Evaluaciones", counts[1]], ["Almacenamiento", `${((counts[2]._sum.size ?? 0) / 1e6).toFixed(1)} MB`]].map(([l, v]) => (
          <div key={l as string} className="card card-pad"><div className="label">{l}</div><div className="num mt-1 text-2xl font-semibold text-white">{v}</div></div>
        ))}
      </div>
      {invited?.inviteToken && <div className="card card-pad mb-6 border-volt/40"><div className="mb-2 font-semibold text-white">Enlace de invitación para {invited.name}</div><div className="mb-3"><WhatsAppShare label="Mandar link por WhatsApp" text={`Hola ${invited.name.split(" ")[0]}! Te sumé a hrtraining. Entrá a este link y elegí tu contraseña: ${origin}/invite/${invited.inviteToken}`} /></div><CopyField value={`${origin}/invite/${invited.inviteToken}`} /></div>}
      {resetFor && sp.clave && (() => {
        const link = `${origin}/reset/${sp.clave}`;
        return (
          <div id="claves" className="card card-pad mb-6 border-volt/40">
            <div className="font-semibold text-white">Enlace para que {resetFor.name} elija una contraseña nueva</div>
            <p className="mb-3 text-sm muted">Vale por 60 minutos y se usa una sola vez. Mandáselo por WhatsApp o copialo.</p>
            <CopyField value={link} />
            <div className="mt-3"><WhatsAppShare text={`Hola ${resetFor.name.split(" ")[0]}, entrá a este enlace para elegir tu contraseña nueva de ${u.org.brandName ?? u.org.name}: ${link} (vale por 60 minutos)`} /></div>
          </div>
        );
      })()}
      {requests.length > 0 && (
        <Card title={`Pedidos de contraseña nueva (${requests.length})`} className="mb-6" >
          <div id={resetFor ? undefined : "claves"} className="space-y-2">
            {requests.map((x) => (
              <div key={x.id} className="flex flex-col gap-2 rounded-xl border border-ink-700 p-3 sm:flex-row sm:items-center">
                <div className="flex-1"><div className="text-white">{x.name}</div><div className="text-xs muted">{x.email} · pidió el {x.resetRequestedAt!.toLocaleString("es-AR")}</div></div>
                <form action={resetLinkForUser}><input type="hidden" name="id" value={x.id} /><Submit className="btn-primary btn-sm" pendingText="Generando…">Generar enlace para WhatsApp</Submit></form>
                <form action={dismissResetRequest}><input type="hidden" name="id" value={x.id} /><Submit className="btn-ghost btn-sm" pendingText="…">Descartar</Submit></form>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Usuarios y permisos" className="xl:col-span-2" pad={false}>
          <div className="overflow-x-auto">
            <table className="table min-w-[680px]">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
              <tbody>
                {users.map((x) => (
                  <tr key={x.id}>
                    <td><div className="flex items-center gap-2"><Avatar name={x.name} src={avatarSrc(x)} size={28} /><div><div className="text-white">{x.name} {x.isDemo && <DemoBadge />}</div><div className="text-xs muted">{x.email}{x.role !== "ATHLETE" && x._count.coachedAthletes ? ` · ${x._count.coachedAthletes} alumnos` : ""}</div></div></div></td>
                    <td colSpan={2}>
                      <form action={updateUser} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={x.id} />
                        <select name="role" defaultValue={x.role} disabled={x.id === u.id || x.role === "ATHLETE"} className="input w-36 py-1.5 text-xs">{(x.role === "ATHLETE" ? ["ATHLETE"] : ["ADMIN", "COACH"]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
                        <label className="flex items-center gap-1 text-xs text-neutral-400"><input type="checkbox" name="active" defaultChecked={x.active} disabled={x.id === u.id} />Activo</label>
                        {x.id !== u.id && <Submit className="btn-ghost btn-sm" pendingText="…">Guardar</Submit>}
                      </form>
                    </td>
                    <td className="text-xs muted">{x.inviteToken ? <span className="chip-amber">Invitación pendiente</span> : x.lastLoginAt ? x.lastLoginAt.toLocaleDateString("es-AR") : "—"}</td>
                    <td>{x.id !== u.id && !x.inviteToken && <form action={resetLinkForUser}><input type="hidden" name="id" value={x.id} /><Submit className="btn-ghost btn-sm whitespace-nowrap" pendingText="…">Contraseña</Submit></form>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          {false && u.org.isDemo && (
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

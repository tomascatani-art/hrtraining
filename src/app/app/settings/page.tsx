import { requireUser } from "@/lib/auth";
import { sportLabel } from "@/lib/catalog";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { headers } from "next/headers";
import { updateProfile, changePassword, updateOrg, updateBrand, addFocusRole, removeFocusRole, resetFocusRoles } from "./actions";
import { focusRoles } from "@/lib/routine";
import { X } from "lucide-react";
import { AvatarUpload } from "@/components/avatar-upload";
import { avatarSrc } from "@/lib/avatar";
import { BrandColorPicker } from "@/components/brand-color";
import { Logo } from "@/components/ui";
import { DEFAULT_ACCENT, logoUrl } from "@/lib/brand";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const u = await requireUser();
  const p = u.athleteProfile;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title={u.role === "ATHLETE" ? "Mi perfil" : "Ajustes"} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card title="Perfil">
          <div className="mb-4"><AvatarUpload userId={u.id} name={u.name} src={avatarSrc(u)} /></div>
          <form action={updateProfile} className="space-y-3">
            <Field label="Nombre"><input name="name" defaultValue={u.name} className="input" /></Field>
            <Field label="Email"><input value={u.email} disabled className="input opacity-60" /></Field>
            <Submit>Guardar</Submit>
          </form>
          {p && (
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-700 pt-4 text-sm">
              <div><dt className="label">Deporte</dt><dd className="text-white">{sportLabel(p.sport)}</dd></div>
              <div><dt className="label">Puesto</dt><dd className="text-white">{p.position ?? "—"}</dd></div>
              <div><dt className="label">Altura</dt><dd className="text-white">{p.heightCm ?? "—"} cm</dd></div>
              <div><dt className="label">Peso</dt><dd className="text-white">{p.weightKg ?? "—"} kg</dd></div>
              <div className="col-span-2"><dt className="label">Objetivo</dt><dd className="text-white">{p.objective ?? "—"}</dd></div>
            </dl>
          )}
        </Card>
        <Card title="Contraseña">
          <form action={changePassword} className="space-y-3">
            <Field label="Actual"><input name="current" type="password" className="input" required /></Field>
            <Field label="Nueva"><input name="next" type="password" minLength={8} className="input" required /></Field>
            <Submit>Cambiar contraseña</Submit>
          </form>
        </Card>
        {u.role === "ADMIN" && (
          <Card title="Organización">
            <form action={updateOrg} className="space-y-3">
              <Field label="Tu marca o tu nombre como preparador"><input name="org" defaultValue={u.org.name} className="input" /></Field>
              <Field label="WhatsApp para cuotas (con código de país, ej. 5491122334455)"><input name="whatsapp" inputMode="tel" defaultValue={u.org.whatsapp ?? ""} className="input" placeholder="54911…" /></Field>
              <Field label="Link de pago de la cuota (ej. link de Mercado Pago)"><input name="payLink" inputMode="url" defaultValue={u.org.payLink ?? ""} className="input" placeholder="https://mpago.la/…" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cuota mensual"><input name="feeAmount" inputMode="decimal" defaultValue={u.org.feeAmount ?? ""} className="input" placeholder="Ej: 25000" /></Field>
                <Field label="Vence el día"><input name="feeDueDay" type="number" min={1} max={28} defaultValue={u.org.feeDueDay} className="input" /></Field>
              </div>
              <div className="rounded-xl border border-ink-700 p-3">
                <Field label="Mercado Pago: Access Token de producción" hint="Lo sacás en Mercado Pago Developers › Tus integraciones › Credenciales de producción. Se guarda cifrado y no se vuelve a mostrar.">
                  <input name="mpToken" type="password" autoComplete="off" className="input" placeholder={u.org.mpToken ? "Configurado · dejalo vacío para mantenerlo" : "APP_USR-…"} />
                </Field>
                {u.org.mpToken ? <label className="mt-2 flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="mpRemove" value="1" />Desconectar Mercado Pago</label>
                  : <p className="mt-2 text-xs muted">Con esto tus alumnos pagan la cuota desde la app y se marca sola como pagada.</p>}
              </div>
              <Submit>Guardar</Submit>
            </form>
          </Card>
        )}
        {u.role === "ADMIN" && (
          <Card title="Tu marca" className="lg:col-span-2">
            <form action={updateBrand} className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label="Nombre que ven tus alumnos" hint="Si lo dejás vacío se usa Hrtraining"><input name="brandName" defaultValue={u.org.brandName ?? ""} maxLength={60} className="input" placeholder={u.org.name} /></Field>
                <Field label="Tu enlace de ingreso para alumnos" hint={u.org.slug ? `${origin}/c/${u.org.slug}` : "Ej: hernan-training (solo letras, números y guiones)"}><input name="slug" defaultValue={u.org.slug ?? ""} maxLength={40} className="input" placeholder="tu-nombre" /></Field>
                <Field label="Logo (PNG, JPG o WebP, hasta 2 MB)"><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-white" /></Field>
                {u.org.logoKey && <label className="flex items-center gap-2 text-sm text-neutral-300"><input type="checkbox" name="removeLogo" value="1" />Quitar el logo actual</label>}
              </div>
              <div className="space-y-3">
                <span className="label block">Color de acento</span>
                <BrandColorPicker initial={u.org.brandColor ?? DEFAULT_ACCENT} />
                <div className="rounded-xl border border-ink-700 p-3">
                  <span className="label mb-2 block">Así se ve hoy</span>
                  <Logo brand={u.org.brandName || u.org.logoKey ? { name: u.org.brandName || u.org.name, logo: logoUrl(u.org) } : null} />
                </div>
              </div>
              <div className="lg:col-span-2"><Submit>Guardar marca</Submit></div>
            </form>
          </Card>
        )}
        {u.role !== "ATHLETE" && (
          <div id="roles" className="scroll-mt-24 lg:col-span-2">
            <Card title="Roles de los ejercicios">
              <p className="mb-3 text-sm muted">Son las etiquetas de “Rol en la sesión” que le ponés a cada ejercicio de la rutina. Agregá las tuyas o borrá las que no uses.</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(focusRoles(u.org.focusRoles)).map(([k, r]) => (
                  <form key={k} action={removeFocusRole} className={`inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-sm font-semibold ${r.cls}`}>
                    <input type="hidden" name="key" value={k} />{r.label}
                    <button className="rounded-full p-1 opacity-70 hover:opacity-100" aria-label={`Borrar ${r.label}`} title="Borrar"><X size={13} /></button>
                  </form>
                ))}
              </div>
              <form action={addFocusRole} className="mt-4 flex gap-2">
                <input name="label" required maxLength={30} placeholder="Nuevo rol (ej: Pliometría)" className="input min-w-0 flex-1" />
                <Submit className="btn-primary" pendingText="…">Agregar</Submit>
              </form>
              {Array.isArray(u.org.focusRoles) && <form action={resetFocusRoles} className="mt-2"><button className="text-xs text-neutral-500 hover:text-white">Volver a los roles de siempre</button></form>}
            </Card>
          </div>
        )}
        <Card title="Privacidad">
          <p className="text-sm leading-relaxed text-neutral-400">Cada usuario ve solo la información que le corresponde: los alumnos acceden a sus propios datos; y vos, como preparador, ves a todos tus alumnos. Los archivos se sirven solo a usuarios autorizados. Podés descargar tus evaluaciones desde la sección Evaluaciones.</p>
        </Card>
      </div>
    </>
  );
}

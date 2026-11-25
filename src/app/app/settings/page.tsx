import { requireUser } from "@/lib/auth";
import { sportLabel } from "@/lib/catalog";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { headers } from "next/headers";
import { updateProfile, changePassword, updateOrg, updateBrand } from "./actions";
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
        <Card title="Privacidad">
          <p className="text-sm leading-relaxed text-neutral-400">Cada usuario ve solo la información que le corresponde: los alumnos acceden a sus propios datos; y vos, como preparador, ves a todos tus alumnos. Los archivos se sirven solo a usuarios autorizados. Podés descargar tus evaluaciones desde la sección Evaluaciones.</p>
        </Card>
      </div>
    </>
  );
}

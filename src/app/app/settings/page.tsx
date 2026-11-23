import { requireUser } from "@/lib/auth";
import { sportLabel } from "@/lib/catalog";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { updateProfile, changePassword, updateOrg } from "./actions";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const u = await requireUser();
  const p = u.athleteProfile;
  return (
    <>
      <PageHeader title={u.role === "ATHLETE" ? "Mi perfil" : "Ajustes"} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card title="Perfil">
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
              <Field label="Nombre del gimnasio, club o equipo"><input name="org" defaultValue={u.org.name} className="input" /></Field>
              <Submit>Guardar</Submit>
            </form>
          </Card>
        )}
        <Card title="Privacidad">
          <p className="text-sm leading-relaxed text-neutral-400">Cada usuario ve solo la información que le corresponde: los deportistas acceden a sus propios datos; los entrenadores, a los deportistas y grupos a su cargo; los administradores, a toda la organización. Los archivos se sirven solo a usuarios autorizados. Podés descargar tus evaluaciones desde la sección Evaluaciones.</p>
        </Card>
      </div>
    </>
  );
}

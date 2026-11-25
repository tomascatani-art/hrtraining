import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SPORTS } from "@/lib/catalog";
import { PageHeader, Card, Field } from "@/components/ui";
import { Submit } from "@/components/forms";
import { createAthlete } from "../actions";

export const metadata = { title: "Nuevo alumno" };

export default async function NewAthlete() {
  const u = await requireUser(["COACH", "ADMIN"]);
  const [groups, coaches] = await Promise.all([
    db.group.findMany({ where: { orgId: u.orgId }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { orgId: u.orgId, role: { in: ["COACH", "ADMIN"] } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Nuevo alumno" subtitle="Se genera un enlace de invitación para que el alumno elija su contraseña y acceda a su espacio personal." />
      <Card className="max-w-3xl">
        <form action={createAthlete} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre y apellido"><input name="name" className="input" required /></Field>
          <Field label="Email"><input name="email" type="email" className="input" required /></Field>
          <Field label="Deporte"><select name="sport" className="input">{Object.entries(SPORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Puesto / prueba / especialidad"><input name="position" className="input" /></Field>
          <Field label="Grupo"><select name="groupId" className="input"><option value="">Sin grupo</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          <Field label="Entrenador responsable"><select name="coachId" className="input" defaultValue={u.id}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Fecha de nacimiento"><input name="birthDate" type="date" className="input" /></Field>
          <Field label="Sexo"><select name="sex" className="input"><option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">Otro / prefiere no decir</option></select></Field>
          <Field label="Altura (cm)"><input name="heightCm" type="number" step="0.1" className="input" /></Field>
          <Field label="Peso (kg)"><input name="weightKg" type="number" step="0.1" className="input" /></Field>
          <Field label="Nivel"><select name="level" className="input"><option>Iniciación</option><option>Intermedio</option><option>Avanzado</option><option>Élite</option></select></Field>
          <Field label="Objetivo principal" className="sm:col-span-2"><textarea name="objective" className="input" /></Field>
          <div className="sm:col-span-2 flex justify-end"><Submit>Crear y generar invitación</Submit></div>
        </form>
      </Card>
    </>
  );
}

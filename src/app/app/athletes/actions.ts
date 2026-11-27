"use server";
import { runAction } from "@/lib/action-error";
import { parseDay } from "@/lib/metrics";
import { randomBytes } from "crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit } from "@/lib/access";
import { sendInviteMail, createResetLink } from "@/lib/account-mail";
import { appOrigin } from "@/lib/origin";
import { cookies } from "next/headers";
import { hashPassword } from "@/lib/auth";
import { waPhone } from "@/lib/phone";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

const athleteSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().min(3, "Poné un email o un usuario de al menos 3 letras").regex(/^\S+$/, "El usuario no puede tener espacios"),
});

async function _createAthlete(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { name, email } = athleteSchema.parse({ name: String(fd.get("name") ?? "").trim(), email: String(fd.get("email") ?? "").trim().toLowerCase() });
  if (await db.user.findUnique({ where: { email } })) throw new Error("Ese usuario o email ya está en uso. Probá con otro.");
  // Contraseña inicial que pone el preparador (el alumno la puede cambiar después). Además queda el link.
  const pw = String(fd.get("password") ?? "").trim();
  if (pw && pw.length < 6) throw new Error("La contraseña tiene que tener al menos 6 caracteres");
  const token = randomBytes(24).toString("base64url");
  const groupId = str(fd.get("groupId"));
  const athlete = await db.user.create({
    data: {
      orgId: u.orgId, name, email, role: "ATHLETE", inviteToken: token, ...(pw ? { passwordHash: await hashPassword(pw) } : {}),
      athleteProfile: {
        create: {
          coachId: str(fd.get("coachId")) ?? u.id, sport: String(fd.get("sport") ?? "GENERAL"), position: str(fd.get("position")),
          sex: str(fd.get("sex")), heightCm: num(fd.get("heightCm")), weightKg: num(fd.get("weightKg")), level: str(fd.get("level")),
          objective: str(fd.get("objective")), birthDate: str(fd.get("birthDate")) ? parseDay(String(fd.get("birthDate")), 12) : null,
          phone: waPhone(fd.get("phone")),
        },
      },
      ...(groupId ? { memberships: { create: { groupId } } } : {}),
    },
  });
  await audit(u, "CREAR", "Alumno", `Alta de ${name}`, athlete.id);
  const mail = fd.get("sendMail") === "on" ? await sendInviteMail({ ...athlete, org: u.org }, await appOrigin()) : { sent: false };
  revalidatePath("/app/athletes");
  // Se muestra una sola vez en el perfil para que el preparador se la pase (dura 10 minutos, no queda guardada).
  if (pw) (await cookies()).set(`alta_${athlete.id}`, pw, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: `/app/athletes/${athlete.id}` });
  redirect(`/app/athletes/${athlete.id}?invitado=1${mail.sent ? "&mail=1" : ""}`);
}

async function _updateAthlete(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = String(fd.get("id"));
  await assertAthlete(u, id);
  await db.user.update({
    where: { id },
    data: {
      name: String(fd.get("name") ?? "").trim() || undefined,
      active: fd.get("active") === "on",
      athleteProfile: {
        update: {
          sport: String(fd.get("sport") ?? "GENERAL"), position: str(fd.get("position")), sex: str(fd.get("sex")),
          heightCm: num(fd.get("heightCm")), weightKg: num(fd.get("weightKg")), level: str(fd.get("level")), objective: str(fd.get("objective")),
          notes: str(fd.get("notes")), coachId: str(fd.get("coachId")) ?? undefined,
          ...(fd.has("phone") ? { phone: waPhone(fd.get("phone")) } : {}),
          birthDate: str(fd.get("birthDate")) ? parseDay(String(fd.get("birthDate")), 12) : null,
        },
      },
    },
  });
  await audit(u, "EDITAR", "Alumno", `Edición de perfil`, id);
  revalidatePath(`/app/athletes/${id}`);
}

async function _regenerateInvite(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = String(fd.get("id"));
  await assertAthlete(u, id);
  const a = await db.user.update({ where: { id }, data: { inviteToken: randomBytes(24).toString("base64url") } });
  const mail = fd.get("sendMail") === "1" ? await sendInviteMail({ ...a, org: u.org }, await appOrigin()) : { sent: false };
  revalidatePath(`/app/athletes/${id}`);
  redirect(`/app/athletes/${id}?invitado=1${mail.sent ? "&mail=1" : ""}`);
}

/** El entrenador genera un enlace para que el alumno elija una contraseña nueva (por si no le llega el mail). */
async function _resetLinkForAthlete(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = String(fd.get("id"));
  await assertAthlete(u, id);
  const url = await createResetLink(id, await appOrigin());
  await db.user.update({ where: { id }, data: { resetRequestedAt: null } });
  await audit(u, "EDITAR", "Alumno", "Enlace para cambiar contraseña", id);
  redirect(`/app/athletes/${id}?clave=${encodeURIComponent(url.split("/reset/")[1])}`);
}

/** El preparador le pone una contraseña nueva al alumno (por ejemplo si se la olvidó) y se la pasa. No se guarda a la vista. */
async function _setAthletePassword(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = String(fd.get("id"));
  await assertAthlete(u, id);
  const pw = String(fd.get("password") ?? "").trim();
  if (pw.length < 6) throw new Error("La contraseña tiene que tener al menos 6 caracteres");
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), resetRequestedAt: null } });
  await audit(u, "EDITAR", "Alumno", "Contraseña nueva puesta por el preparador", id);
  (await cookies()).set(`alta_${id}`, pw, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: `/app/athletes/${id}` });
  redirect(`/app/athletes/${id}?invitado=1&nueva=1`);
}

async function _saveGoal(fd: FormData) {
  const u = await requireUser();
  const athleteId = u.role === "ATHLETE" ? u.id : String(fd.get("athleteId"));
  await assertAthlete(u, athleteId);
  const id = str(fd.get("id"));
  const data = {
    title: String(fd.get("title") ?? "").trim(), metric: str(fd.get("metric")), target: num(fd.get("target")), current: num(fd.get("current")),
    weekly: fd.get("weekly") === "on", dueDate: str(fd.get("dueDate")) ? parseDay(String(fd.get("dueDate")), 12) : null,
  };
  if (!data.title) throw new Error("El objetivo necesita un título");
  if (id) {
    const g = await db.goal.findUnique({ where: { id } });
    if (!g || g.athleteId !== athleteId) throw new Error("Objetivo no encontrado");
    await db.goal.update({ where: { id }, data });
  } else {
    await db.goal.create({ data: { ...data, athleteId } });
  }
  revalidatePath("/app/goals");
  revalidatePath(`/app/athletes/${athleteId}`);
}

async function _toggleGoal(fd: FormData) {
  const u = await requireUser();
  const g = await db.goal.findUnique({ where: { id: String(fd.get("id")) } });
  if (!g) return;
  await assertAthlete(u, g.athleteId);
  await db.goal.update({ where: { id: g.id }, data: { done: !g.done } });
  revalidatePath("/app/goals");
  revalidatePath(`/app/athletes/${g.athleteId}`);
}

async function _deleteGoal(fd: FormData) {
  const u = await requireUser();
  const g = await db.goal.findUnique({ where: { id: String(fd.get("id")) } });
  if (!g) return;
  await assertAthlete(u, g.athleteId);
  await db.goal.delete({ where: { id: g.id } });
  revalidatePath("/app/goals");
  revalidatePath(`/app/athletes/${g.athleteId}`);
}

export async function createAthlete(fd: FormData) { return runAction("createAthlete", _createAthlete, fd); }
export async function updateAthlete(fd: FormData) { return runAction("updateAthlete", _updateAthlete, fd); }
export async function regenerateInvite(fd: FormData) { return runAction("regenerateInvite", _regenerateInvite, fd); }
export async function resetLinkForAthlete(fd: FormData) { return runAction("resetLinkForAthlete", _resetLinkForAthlete, fd); }
export async function saveGoal(fd: FormData) { return runAction("saveGoal", _saveGoal, fd); }
export async function toggleGoal(fd: FormData) { return runAction("toggleGoal", _toggleGoal, fd); }
export async function deleteGoal(fd: FormData) { return runAction("deleteGoal", _deleteGoal, fd); }
export async function setAthletePassword(fd: FormData) { return runAction("setAthletePassword", _setAthletePassword, fd); }

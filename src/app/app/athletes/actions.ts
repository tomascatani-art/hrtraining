"use server";
import { parseDay } from "@/lib/metrics";
import { randomBytes } from "crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertAthlete, audit } from "@/lib/access";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
const str = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

const athleteSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
});

export async function createAthlete(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const { name, email } = athleteSchema.parse({ name: String(fd.get("name") ?? "").trim(), email: String(fd.get("email") ?? "").trim().toLowerCase() });
  if (await db.user.findUnique({ where: { email } })) throw new Error("Ya existe un usuario con ese email");
  const token = randomBytes(24).toString("base64url");
  const groupId = str(fd.get("groupId"));
  const athlete = await db.user.create({
    data: {
      orgId: u.orgId, name, email, role: "ATHLETE", inviteToken: token,
      athleteProfile: {
        create: {
          coachId: str(fd.get("coachId")) ?? u.id, sport: String(fd.get("sport") ?? "GENERAL"), position: str(fd.get("position")),
          sex: str(fd.get("sex")), heightCm: num(fd.get("heightCm")), weightKg: num(fd.get("weightKg")), level: str(fd.get("level")),
          objective: str(fd.get("objective")), birthDate: str(fd.get("birthDate")) ? parseDay(String(fd.get("birthDate")), 12) : null,
        },
      },
      ...(groupId ? { memberships: { create: { groupId } } } : {}),
    },
  });
  await audit(u, "CREAR", "Deportista", `Alta de ${name}`, athlete.id);
  revalidatePath("/app/athletes");
  redirect(`/app/athletes/${athlete.id}?invitado=1`);
}

export async function updateAthlete(fd: FormData) {
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
          birthDate: str(fd.get("birthDate")) ? parseDay(String(fd.get("birthDate")), 12) : null,
        },
      },
    },
  });
  await audit(u, "EDITAR", "Deportista", `Edición de perfil`, id);
  revalidatePath(`/app/athletes/${id}`);
}

export async function regenerateInvite(fd: FormData) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const id = String(fd.get("id"));
  await assertAthlete(u, id);
  await db.user.update({ where: { id }, data: { inviteToken: randomBytes(24).toString("base64url") } });
  revalidatePath(`/app/athletes/${id}`);
  redirect(`/app/athletes/${id}?invitado=1`);
}

export async function saveGoal(fd: FormData) {
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

export async function toggleGoal(fd: FormData) {
  const u = await requireUser();
  const g = await db.goal.findUnique({ where: { id: String(fd.get("id")) } });
  if (!g) return;
  await assertAthlete(u, g.athleteId);
  await db.goal.update({ where: { id: g.id }, data: { done: !g.done } });
  revalidatePath("/app/goals");
  revalidatePath(`/app/athletes/${g.athleteId}`);
}

export async function deleteGoal(fd: FormData) {
  const u = await requireUser();
  const g = await db.goal.findUnique({ where: { id: String(fd.get("id")) } });
  if (!g) return;
  await assertAthlete(u, g.athleteId);
  await db.goal.delete({ where: { id: g.id } });
  revalidatePath("/app/goals");
  revalidatePath(`/app/athletes/${g.athleteId}`);
}

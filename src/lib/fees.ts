import "server-only";
import { db } from "@/lib/db";

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(y, m - 1, 15).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 15));
};

/** Estado de la cuota del mes para un deportista. Sin registro = pendiente. */
export async function feeStatusFor(athleteId: string, period = monthKey()) {
  const [fee, user] = await Promise.all([
    db.fee.findUnique({ where: { athleteId_period: { athleteId, period } } }),
    db.user.findUnique({ where: { id: athleteId }, include: { athleteProfile: true, org: true } }),
  ]);
  const amount = fee?.amount ?? user?.athleteProfile?.feeAmount ?? user?.org.feeAmount ?? null;
  return { status: fee?.status ?? "PENDIENTE", amount, paused: !!user?.athleteProfile?.paused, org: user?.org };
}

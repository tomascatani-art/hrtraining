import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { monthKey, monthLabel, shiftMonth } from "@/lib/fees";
import { PageHeader, Card, Stat, Empty, Avatar, DemoBadge, fmtDate } from "@/components/ui";
import { Submit } from "@/components/forms";
import { setFeeStatus, setPaused, remindFee, setAthleteFee } from "./actions";

export const metadata = { title: "Cuotas" };
const money = (n: number | null | undefined) => (n == null ? "—" : `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`);
const STATUS: Record<string, { label: string; cls: string }> = {
  PAGADO: { label: "Pagó", cls: "chip-green" },
  BONIFICADO: { label: "Bonificado", cls: "chip-mute" },
  PENDIENTE: { label: "Pendiente", cls: "chip-red" },
};

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ m?: string; f?: string }> }) {
  const u = await requireUser(["COACH", "ADMIN"]);
  const sp = await searchParams;
  const period = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : monthKey();
  const ids = await visibleAthleteIds(u);
  const [athletes, fees] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids }, active: true }, include: { athleteProfile: true }, orderBy: { name: "asc" } }),
    db.fee.findMany({ where: { athleteId: { in: ids }, period } }),
  ]);
  const org = u.org;
  const rows = athletes.map((a) => {
    const fee = fees.find((f) => f.athleteId === a.id);
    return { a, fee, status: fee?.status ?? "PENDIENTE", amount: fee?.amount ?? a.athleteProfile?.feeAmount ?? org.feeAmount ?? null };
  });
  const filter = sp.f ?? "todos";
  const shown = rows.filter((r) => filter === "todos" || (filter === "pendientes" ? r.status === "PENDIENTE" : filter === "pausados" ? r.a.athleteProfile?.paused : r.status !== "PENDIENTE"));
  const paid = rows.filter((r) => r.status === "PAGADO");
  const pending = rows.filter((r) => r.status === "PENDIENTE");
  const sum = (xs: typeof rows) => xs.reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const overdue = period === monthKey() && new Date().getDate() > org.feeDueDay;
  const q = (f: string) => `/app/fees?m=${period}&f=${f}`;

  return (
    <>
      <PageHeader title="Cuotas" subtitle={`Estado de pago de cada deportista. Vencimiento: día ${org.feeDueDay} de cada mes.`}
        actions={<div className="flex items-center gap-1">
          <Link href={`/app/fees?m=${shiftMonth(period, -1)}`} className="btn-ghost px-2" aria-label="Mes anterior"><ChevronLeft size={16} /></Link>
          <span className="min-w-[150px] text-center font-display font-semibold text-white">{monthLabel(period)}</span>
          <Link href={`/app/fees?m=${shiftMonth(period, 1)}`} className="btn-ghost px-2" aria-label="Mes siguiente"><ChevronRight size={16} /></Link>
        </div>} />
      {!org.feeAmount && u.role === "ADMIN" && <div className="card card-pad mb-6 text-sm">Todavía no definiste la cuota mensual del club ni el WhatsApp de contacto. <Link href="/app/settings" className="text-volt hover:underline">Configurarlo en Ajustes</Link>.</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cobrado" value={money(sum(paid))} hint={`${paid.length} pagaron`} />
        <Stat label="Pendiente" value={money(sum(pending))} hint={`${pending.length} deportistas${overdue ? " · vencido" : ""}`} accent={overdue && pending.length > 0} />
        <Stat label="Al día" value={rows.length ? Math.round(((rows.length - pending.length) / rows.length) * 100) : "—"} unit={rows.length ? "%" : undefined} hint="pagos y bonificados" />
        <Stat label="Cuentas pausadas" value={rows.filter((r) => r.a.athleteProfile?.paused).length} hint="solo ven el chat" />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap gap-1.5">
        {[["todos", "Todos"], ["pendientes", "Pendientes"], ["al-dia", "Al día"], ["pausados", "Pausados"]].map(([k, l]) => (
          <Link key={k} href={q(k)} className={filter === k ? "tab tab-active" : "tab border border-ink-700"}>{l}</Link>
        ))}
      </div>
      <Card pad={false}>
        {shown.length ? (
          <ul className="divide-y divide-ink-800">
            {shown.map(({ a, fee, status, amount }) => {
              const paused = !!a.athleteProfile?.paused;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={a.name} size={34} />
                  <div className="min-w-[150px] flex-1">
                    <Link href={`/app/athletes/${a.id}`} className="font-semibold text-white hover:text-volt">{a.name}</Link> {a.isDemo && <DemoBadge />}
                    <div className="text-xs muted">{money(amount)}{fee?.paidAt && status === "PAGADO" ? ` · pagó el ${fmtDate(fee.paidAt)}` : ""}{paused ? " · cuenta pausada" : ""}</div>
                  </div>
                  <span className={STATUS[status].cls}>{STATUS[status].label}</span>
                  <div className="flex flex-wrap gap-1">
                    {(["PAGADO", "PENDIENTE", "BONIFICADO"] as const).filter((s) => s !== status).map((s) => (
                      <form key={s} action={setFeeStatus}><input type="hidden" name="athleteId" value={a.id} /><input type="hidden" name="period" value={period} /><input type="hidden" name="status" value={s} />{s === "PAGADO" && amount != null && <input type="hidden" name="amount" value={amount} />}
                        <Submit className={s === "PAGADO" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} pendingText="…">{s === "PAGADO" ? "Pagó" : s === "PENDIENTE" ? "Pendiente" : "Bonificar"}</Submit></form>
                    ))}
                    {status === "PENDIENTE" && <form action={remindFee}><input type="hidden" name="athleteId" value={a.id} /><input type="hidden" name="period" value={period} /><Submit className="btn-ghost btn-sm" pendingText="…"><Bell size={13} />Recordar</Submit></form>}
                    <form action={setPaused}><input type="hidden" name="athleteId" value={a.id} /><input type="hidden" name="paused" value={paused ? "0" : "1"} /><Submit className={paused ? "btn-ghost btn-sm text-volt" : "btn-ghost btn-sm"} pendingText="…">{paused ? "Reactivar" : "Pausar cuenta"}</Submit></form>
                  </div>
                  <details className="w-full text-xs sm:w-auto">
                    <summary className="cursor-pointer text-neutral-500 hover:text-white">Cuota propia</summary>
                    <form action={setAthleteFee} className="mt-2 flex gap-2"><input type="hidden" name="athleteId" value={a.id} /><input name="feeAmount" inputMode="decimal" defaultValue={a.athleteProfile?.feeAmount ?? ""} placeholder={org.feeAmount ? `Club: ${org.feeAmount}` : "Monto"} className="input w-32 py-1 text-xs" /><Submit className="btn-ghost btn-sm" pendingText="…">Guardar</Submit></form>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : <div className="p-5"><Empty title="Nadie en este filtro" /></div>}
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs muted"><MessageCircle size={13} />Una cuenta pausada solo puede ver la pantalla de cuota y el chat. Al marcar «Pagó» se reactiva sola.</p>
    </>
  );
}

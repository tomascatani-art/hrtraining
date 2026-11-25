import Link from "next/link";
import clsx from "clsx";

export function Logo({ size = 32, withText = true, brand }: { size?: number; withText?: boolean; brand?: { name: string; logo?: string | null } | null }) {
  if (brand) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2.5">
        {brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo} alt="" width={size} height={size} className="shrink-0 rounded-[10px] bg-white/5 object-contain" style={{ width: size, height: size }} />
        ) : (
          <span className="grid shrink-0 place-items-center rounded-[10px] bg-volt font-display font-bold text-black" style={{ width: size, height: size, fontSize: size * 0.45 }}>{brand.name.trim().charAt(0).toUpperCase()}</span>
        )}
        {withText && <span className="truncate font-display text-[17px] font-bold tracking-tight text-white">{brand.name}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={size > 64 ? "/brand/hr-logo.png" : "/brand/hr-logo-128.png"} alt="HR Rendimiento & Disciplina" width={size} height={size} className="shrink-0 rounded-full" style={{ width: size, height: size }} />
      {withText && (
        <span className="font-display text-[17px] font-bold tracking-tight text-white">
          hrtraining
        </span>
      )}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-rise">
      <div>
        {eyebrow && <div className="label mb-1.5 text-volt/80">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm muted max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, hint, accent, href, icon }: { label: string; value: React.ReactNode; unit?: string; hint?: React.ReactNode; accent?: boolean; href?: string; icon?: React.ReactNode }) {
  const body = (
    <div className={clsx("card card-pad h-full relative overflow-hidden", href && "card-hover", accent && "border-volt/40")}>
      {accent && <div className="absolute inset-x-0 top-0 h-0.5 bg-volt" />}
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {icon && <span className={clsx(accent ? "text-volt" : "text-neutral-600")}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-3xl font-semibold text-white">{value}</span>
        {unit && <span className="text-sm text-neutral-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Card({ title, action, children, className, pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("card animate-rise", pad && "card-pad", className)}>
      {(title || action) && (
        <div className={clsx("mb-4 flex items-center justify-between gap-3", !pad && "px-4 pt-4 sm:px-5 sm:pt-5")}>
          {title && <h2 className="h2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 p-8 text-center">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full hazard opacity-70" />
      <div className="font-display font-semibold text-white">{title}</div>
      {children && <div className="mt-1 text-sm muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DemoBadge(_: { show?: boolean }) {
  return null; // Diego: no mostrar "DEMO" en ningún lado
}
function _OldDemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return <span className="chip border-volt/50 bg-volt text-black font-bold tracking-wider" title="Dato de demostración, no corresponde a una persona real">DEMO</span>;
}

const AV = ["#ffd60a", "#f5f5f4", "#fb923c", "#a3a3a3", "#facc15", "#e7e5e4"];
export function Avatar({ name, size = 36, src }: { name: string; size?: number; src?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  const c = AV[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-black" style={{ width: size, height: size, background: c, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={clsx("tab", active === t.key && "tab-active")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Delta({ value, suffix = "%" }: { value: number | null | undefined; suffix?: string }) {
  if (value == null || !isFinite(value)) return <span className="text-neutral-600">—</span>;
  const pos = value > 0.05;
  const neg = value < -0.05;
  return (
    <span className={clsx("num text-xs font-semibold", pos && "text-emerald-400", neg && "text-red-400", !pos && !neg && "text-neutral-500")}>
      {pos ? "▲" : neg ? "▼" : "•"} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

// Zona horaria de visualización (el servidor puede correr en UTC)
export const TZ = process.env.NEXT_PUBLIC_TZ || "America/Argentina/Buenos_Aires";
export const fmtDate = (d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) =>
  new Date(d).toLocaleDateString("es-AR", { timeZone: typeof d === "string" && d.length === 10 ? "UTC" : TZ, ...opts });
export const fmtDateLong = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
export const fmtNum = (n: number | null | undefined, dec = 0) => (n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: dec, minimumFractionDigits: dec }));

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import clsx from "clsx";
import { Suspense } from "react";
import { ActionErrorBanner } from "./action-error-banner";
import { NavProgress } from "@/components/nav-progress";
import {
  LayoutDashboard, Users, UsersRound, CalendarDays, Dumbbell, Gauge, Activity, LineChart,
  Video, MessageSquare, FolderOpen, Trophy, Shapes, ShieldCheck, Settings, HeartPulse, Target, Menu, X, Bell, LogOut, Sparkles, Wallet, Wrench, ChevronDown, ClipboardList, Search,
} from "lucide-react";
import { Logo, Avatar } from "./ui";
import { logoutAction } from "@/app/(auth)/actions";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number; group?: string };

export function navFor(role: string, unread: number): { main: Item[]; mobile: Item[] } {
  if (role === "ATHLETE") {
    const main: Item[] = [
      { href: "/app", label: "Inicio", icon: LayoutDashboard },
      { href: "/app/routine", label: "Mi rutina", icon: ClipboardList },
      { href: "/app/calendar", label: "Calendario", icon: CalendarDays },
      { href: "/app/wellness", label: "Bienestar", icon: HeartPulse },
      { href: "/app/stats", label: "Mi progreso", icon: LineChart },
      { href: "/app/rm", label: "Mis RM", icon: Dumbbell },
      { href: "/app/folder", label: "Mi carpeta", icon: FolderOpen },
      { href: "/app/goals", label: "Objetivos", icon: Target },
      { href: "/app/history", label: "Historial", icon: Activity },
      { href: "/app/files", label: "Archivos", icon: FolderOpen },
      { href: "/app/tools", label: "Herramientas", icon: Wrench },
      { href: "/app/settings", label: "Mi perfil", icon: Settings },
    ];
    return { main, mobile: pick(main, ["/app", "/app/routine", "/app/calendar", "/app/wellness", "/app/stats"]) };
  }
  // Menú agrupado en 5 secciones para no abrumar (Diego, 24-11-2026)
  const main: Item[] = [
    { href: "/app", label: "Inicio", icon: LayoutDashboard },
    { href: "/app/athletes", label: "Alumnos", icon: Users, group: "Alumnos" },
    { href: "/app/groups", label: "Grupos", icon: UsersRound, group: "Alumnos" },
    { href: "/app/fees", label: "Cuotas", icon: Wallet, group: "Alumnos" },
    { href: "/app/routines", label: "Rutinas", icon: ClipboardList, group: "Entrenamiento" },
    { href: "/app/calendar", label: "Calendario", icon: CalendarDays, group: "Entrenamiento" },
    { href: "/app/library", label: "Biblioteca", icon: Dumbbell, group: "Entrenamiento" },
    { href: "/app/competitions", label: "Competencias", icon: Trophy, group: "Entrenamiento" },
    { href: "/app/load", label: "Cargas y fatiga", icon: HeartPulse, group: "Rendimiento" },
    { href: "/app/stats", label: "Estadísticas", icon: LineChart, group: "Rendimiento" },
    { href: "/app/files", label: "Archivos", icon: FolderOpen, group: "Comunicación" },
    { href: "/app/sports", label: "Deportes", icon: Shapes, group: "Mi cuenta" },
    { href: "/app/assistant", label: "Asistente", icon: Sparkles, group: "Mi cuenta" },
    { href: "/app/tools", label: "Herramientas", icon: Wrench, group: "Mi cuenta" },
  ];
  if (role === "ADMIN") main.push({ href: "/app/admin", label: "Usuarios y respaldo", icon: ShieldCheck, group: "Mi cuenta" });
  main.push({ href: "/app/settings", label: "Ajustes", icon: Settings, group: "Mi cuenta" });
  return { main, mobile: pick(main, ["/app", "/app/athletes", "/app/routines", "/app/library", "/app/fees"]) };
}

const pick = (items: Item[], hrefs: string[]) => hrefs.map((h) => items.find((i) => i.href === h)!).filter(Boolean);

const isActive = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

export function Shell({
  user, unreadMessages, unreadNotifications, isDemo, paused = false, brand, children,
}: {
  user: { name: string; role: string; org: string; avatar?: string | null };
  unreadMessages: number; unreadNotifications: number; isDemo: boolean; paused?: boolean; children: React.ReactNode;
  brand?: { name: string; logo?: string | null } | null;
}) {
  const realPath = usePathname();
  const router = useRouter();
  // Al tocar un ítem del menú se marca al instante, sin esperar a que llegue la pantalla.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => { setTapped(null); }, [realPath]);
  const path = tapped ?? realPath;
  // Al pasar el mouse por un ítem se pide la pantalla por adelantado, así al hacer clic ya está.
  const warm = (href: string) => { try { router.prefetch(href, { kind: PrefetchKind.FULL }); } catch {} };
  const [open, setOpen] = useState(false);
  const nav = navFor(user.role, unreadMessages);
  // Cuenta pausada: solo cuota y chat
  const pausedNav: Item[] = [{ href: "/app/paused", label: "Mi cuota", icon: Wallet }];
  const { main, mobile } = paused ? { main: pausedNav, mobile: pausedNav } : nav;
  const roleLabel = user.role === "ADMIN" ? "Preparador físico" : user.role === "COACH" ? "Ayudante" : "Alumno";

  const activeGroup = main.find((i) => i.group && isActive(path, i.href))?.group ?? (path.startsWith("/app/sessions") && main.some((i) => i.group === "Entrenamiento") ? "Entrenamiento" : undefined);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const toggle = (g: string) => setOpenGroups((xs) => (xs.includes(g) ? xs.filter((x) => x !== g) : [...xs, g]));

  const NavLink = ({ it, onNav, nested }: { it: Item; onNav?: () => void; nested?: boolean }) => {
    const active = isActive(path, it.href);
    const I = it.icon;
    return (
      <Link href={it.href} prefetch={false} onMouseEnter={() => warm(it.href)} onPointerDown={() => warm(it.href)} onClick={() => { setTapped(it.href); onNav?.(); }}
        className={clsx("group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition", nested && "pl-5",
          active ? "bg-volt text-black" : "text-neutral-400 hover:bg-ink-800 hover:text-white")}>
        <I size={17} />
        <span className="flex-1">{it.label}</span>
        {!!it.badge && <span className={clsx("num rounded-full px-1.5 text-[10px] font-bold", active ? "bg-black text-volt" : "bg-volt text-black")}>{it.badge}</span>}
      </Link>
    );
  };

  const NavList = ({ onNav }: { onNav?: () => void }) => {
    const groups: string[] = [];
    for (const it of main) if (it.group && !groups.includes(it.group)) groups.push(it.group);
    return (
      <nav className="space-y-0.5">
        {main.filter((i) => !i.group).map((it) => <NavLink key={it.href} it={it} onNav={onNav} />)}
        {groups.map((g) => {
          const items = main.filter((i) => i.group === g);
          const isOpen = g === activeGroup || openGroups.includes(g);
          const badge = items.some((i) => i.badge);
          return (
            <div key={g} className="pt-1">
              <button type="button" onClick={() => toggle(g)} aria-expanded={isOpen}
                className={clsx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-white", g === activeGroup ? "text-volt" : "text-neutral-500")}>
                <span className="flex-1 text-left">{g}</span>
                {badge && !isOpen && <span className="h-2 w-2 rounded-full bg-volt" />}
                <ChevronDown size={14} className={clsx("transition", isOpen && "rotate-180")} />
              </button>
              {isOpen && <div className="space-y-0.5">{items.map((it) => <NavLink key={it.href} it={it} onNav={onNav} nested />)}</div>}
            </div>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-700 bg-ink-950 lg:flex">
        {brand ? (
          <div className="flex h-16 min-w-0 items-center px-5"><Link href="/app" className="min-w-0"><Logo brand={brand} /></Link></div>
        ) : (
          <Link href="/app" className="flex flex-col items-center gap-1.5 px-5 pb-3 pt-5"><Logo size={64} withText={false} /><span className="font-display text-lg font-bold tracking-tight text-white">hrtraining</span></Link>
        )}
        <div className="mx-4 mb-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2">
          <div className="label">Tu espacio</div>
          <div className="truncate text-sm font-semibold text-white">{user.org}</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4"><NavList /></div>
        <div className="border-t border-ink-700 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={user.name} src={user.avatar} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-neutral-500">{roleLabel}</div>
            </div>
            <form action={logoutAction}><button className="rounded-lg p-2 text-neutral-500 hover:bg-ink-800 hover:text-white" title="Cerrar sesión"><LogOut size={16} /></button></form>
          </div>
          {brand && <div className="px-2 pt-1 text-[11px] text-neutral-600">Con tecnología Hrtraining</div>}
        </div>
      </aside>

      {/* Barra superior */}
      <Suspense fallback={null}><NavProgress /></Suspense>
      <header style={{ paddingTop: "env(safe-area-inset-top)" }} className="sticky top-0 z-20 box-content flex h-14 items-center gap-3 border-b border-ink-700 bg-ink-950/85 px-4 backdrop-blur lg:h-16 lg:px-8">
        <div className="min-w-0 lg:hidden"><Link href="/app" className="min-w-0"><Logo size={28} brand={brand} /></Link></div>
        <div className="flex-1" />
        <Link href="/app/search" className="flex items-center gap-2 rounded-xl p-2 text-neutral-400 hover:bg-ink-800 hover:text-white lg:border lg:border-ink-700 lg:px-3 lg:py-1.5" aria-label="Buscar">
          <Search size={19} /><span className="hidden text-sm lg:inline">Buscar alumnos, ejercicios, rutinas…</span>
        </Link>
        <Link href="/app/notifications" className="relative rounded-xl p-2 text-neutral-400 hover:bg-ink-800 hover:text-white" aria-label="Notificaciones">
          <Bell size={19} />
          {unreadNotifications > 0 && <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-black">{unreadNotifications}</span>}
        </Link>
        <button className="rounded-xl p-2 text-neutral-400 hover:bg-ink-800 lg:hidden" onClick={() => setOpen(true)} aria-label="Menú"><Menu size={20} /></button>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12"><Suspense fallback={null}><ActionErrorBanner /></Suspense>{children}</main>

      {/* Navegación inferior móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {mobile.map((it) => {
            const I = it.icon;
            const active = isActive(path, it.href);
            return (
              <Link key={it.href} href={it.href} prefetch={false} onPointerDown={() => warm(it.href)} onClick={() => setTapped(it.href)} className={clsx("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-volt" : "text-neutral-500")}>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-volt" />}
                <I size={20} />
                <span className="truncate max-w-[72px]">{it.label}</span>
                {!!it.badge && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-volt" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Menú móvil completo */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }} className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-l border-ink-700 bg-ink-950 animate-rise">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-sm font-semibold text-white">{user.name}</span>
              <button onClick={() => setOpen(false)} className="p-2 text-neutral-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3"><NavList onNav={() => setOpen(false)} /></div>
            <form action={logoutAction} className="border-t border-ink-700 p-3"><button className="btn-ghost w-full"><LogOut size={16} />Cerrar sesión</button></form>
          </div>
        </div>
      )}
    </div>
  );
}

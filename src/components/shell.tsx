"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, Users, UsersRound, CalendarRange, CalendarDays, Dumbbell, Gauge, Activity, LineChart,
  Video, MessageSquare, FolderOpen, Trophy, Shapes, ShieldCheck, Settings, HeartPulse, Target, Menu, X, Bell, LogOut, Sparkles, Wallet, Wrench,
} from "lucide-react";
import { Logo, Avatar } from "./ui";
import { logoutAction } from "@/app/(auth)/actions";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number };

export function navFor(role: string, unread: number): { main: Item[]; mobile: Item[] } {
  if (role === "ATHLETE") {
    const main: Item[] = [
      { href: "/app", label: "Inicio", icon: LayoutDashboard },
      { href: "/app/calendar", label: "Calendario", icon: CalendarDays },
      { href: "/app/wellness", label: "Bienestar", icon: HeartPulse },
      { href: "/app/evaluations", label: "Evaluaciones", icon: Gauge },
      { href: "/app/stats", label: "Mi progreso", icon: LineChart },
      { href: "/app/rm", label: "Mis RM", icon: Dumbbell },
      { href: "/app/folder", label: "Mi carpeta", icon: FolderOpen },
      { href: "/app/goals", label: "Objetivos", icon: Target },
      { href: "/app/history", label: "Historial", icon: Activity },
      { href: "/app/videos", label: "Videos", icon: Video },
      { href: "/app/messages", label: "Mensajes", icon: MessageSquare, badge: unread },
      { href: "/app/files", label: "Archivos", icon: FolderOpen },
      { href: "/app/library", label: "Ejercicios", icon: Dumbbell },
      { href: "/app/tools", label: "Herramientas", icon: Wrench },
      { href: "/app/settings", label: "Mi perfil", icon: Settings },
    ];
    return { main, mobile: pick(main, ["/app", "/app/calendar", "/app/wellness", "/app/stats", "/app/messages"]) };
  }
  const main: Item[] = [
    { href: "/app", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/athletes", label: "Deportistas", icon: Users },
    { href: "/app/groups", label: "Grupos", icon: UsersRound },
    { href: "/app/planning", label: "Planificación", icon: CalendarRange },
    { href: "/app/calendar", label: "Calendario", icon: CalendarDays },
    { href: "/app/library", label: "Biblioteca", icon: Dumbbell },
    { href: "/app/evaluations", label: "Evaluaciones", icon: Gauge },
    { href: "/app/load", label: "Cargas y fatiga", icon: HeartPulse },
    { href: "/app/stats", label: "Estadísticas", icon: LineChart },
    { href: "/app/videos", label: "Video análisis", icon: Video },
    { href: "/app/messages", label: "Mensajes", icon: MessageSquare, badge: unread },
    { href: "/app/files", label: "Archivos", icon: FolderOpen },
    { href: "/app/competitions", label: "Competencias", icon: Trophy },
    { href: "/app/sports", label: "Deportes", icon: Shapes },
    { href: "/app/assistant", label: "Asistente", icon: Sparkles },
    { href: "/app/fees", label: "Cuotas", icon: Wallet },
    { href: "/app/tools", label: "Herramientas", icon: Wrench },
  ];
  if (role === "ADMIN") main.push({ href: "/app/admin", label: "Administración", icon: ShieldCheck });
  main.push({ href: "/app/settings", label: "Ajustes", icon: Settings });
  return { main, mobile: pick(main, ["/app", "/app/athletes", "/app/planning", "/app/load", "/app/messages"]) };
}

const pick = (items: Item[], hrefs: string[]) => hrefs.map((h) => items.find((i) => i.href === h)!).filter(Boolean);

const isActive = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

export function Shell({
  user, unreadMessages, unreadNotifications, isDemo, paused = false, brand, children,
}: {
  user: { name: string; role: string; org: string };
  unreadMessages: number; unreadNotifications: number; isDemo: boolean; paused?: boolean; children: React.ReactNode;
  brand?: { name: string; logo?: string | null } | null;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = navFor(user.role, unreadMessages);
  // Cuenta pausada: solo cuota y chat
  const pausedNav: Item[] = [{ href: "/app/paused", label: "Mi cuota", icon: Wallet }, ...nav.main.filter((i) => i.href === "/app/messages")];
  const { main, mobile } = paused ? { main: pausedNav, mobile: pausedNav } : nav;
  const roleLabel = user.role === "ADMIN" ? "Administrador" : user.role === "COACH" ? "Entrenador" : "Deportista";

  const NavList = ({ onNav }: { onNav?: () => void }) => (
    <nav className="space-y-0.5">
      {main.map((it) => {
        const active = isActive(path, it.href);
        const I = it.icon;
        return (
          <Link key={it.href} href={it.href} onClick={onNav}
            className={clsx("group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-volt text-black" : "text-neutral-400 hover:bg-ink-800 hover:text-white")}>
            <I size={17} />
            <span className="flex-1">{it.label}</span>
            {!!it.badge && <span className={clsx("num rounded-full px-1.5 text-[10px] font-bold", active ? "bg-black text-volt" : "bg-volt text-black")}>{it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-700 bg-ink-950 lg:flex">
        <div className="flex h-16 min-w-0 items-center px-5"><Link href="/app" className="min-w-0"><Logo brand={brand} /></Link></div>
        <div className="mx-4 mb-3 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2">
          <div className="label">Organización</div>
          <div className="truncate text-sm font-semibold text-white">{user.org}</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4"><NavList /></div>
        <div className="border-t border-ink-700 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={user.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-neutral-500">{roleLabel}</div>
            </div>
            <form action={logoutAction}><button className="rounded-lg p-2 text-neutral-500 hover:bg-ink-800 hover:text-white" title="Cerrar sesión"><LogOut size={16} /></button></form>
          </div>
          {brand && <div className="px-2 pt-1 text-[11px] text-neutral-600">Con tecnología Hrtraining.co</div>}
        </div>
      </aside>

      {/* Barra superior */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-700 bg-ink-950/85 px-4 backdrop-blur lg:h-16 lg:px-8">
        <div className="min-w-0 lg:hidden"><Link href="/app" className="min-w-0"><Logo size={28} brand={brand} /></Link></div>
        {isDemo && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-volt/40 bg-volt/10 px-3 py-1 text-xs text-volt">
            <span className="h-1.5 w-1.5 rounded-full bg-volt animate-pulse" /> Modo demostración: datos ficticios
          </div>
        )}
        <div className="flex-1" />
        <Link href="/app/notifications" className="relative rounded-xl p-2 text-neutral-400 hover:bg-ink-800 hover:text-white" aria-label="Notificaciones">
          <Bell size={19} />
          {unreadNotifications > 0 && <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-black">{unreadNotifications}</span>}
        </Link>
        <button className="rounded-xl p-2 text-neutral-400 hover:bg-ink-800 lg:hidden" onClick={() => setOpen(true)} aria-label="Menú"><Menu size={20} /></button>
      </header>
      {isDemo && <div className="sm:hidden bg-volt px-4 py-1 text-center text-[11px] font-semibold text-black">Modo demostración: datos ficticios</div>}

      <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>

      {/* Navegación inferior móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {mobile.map((it) => {
            const I = it.icon;
            const active = isActive(path, it.href);
            return (
              <Link key={it.href} href={it.href} className={clsx("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-volt" : "text-neutral-500")}>
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
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col border-l border-ink-700 bg-ink-950 animate-rise">
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

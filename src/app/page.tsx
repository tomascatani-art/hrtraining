import Link from "next/link";
import { CalendarRange, Gauge, HeartPulse, LineChart, Video, MessageSquare, Dumbbell, Shapes, ShieldCheck, ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { demoLoginAction } from "./(auth)/actions";

const FEATURES = [
  { icon: CalendarRange, t: "Planificación periodizada", d: "Temporadas con macro, meso y microciclos, fases, capacidades y dinámica de volumen e intensidad. Plan vs. ejecutado en tiempo real." },
  { icon: Gauge, t: "Evaluaciones físicas", d: "CMJ, SJ, Abalakov, RSI, 1RM/3RM, VBT, FMS completo, sprints, Cooper, Navette y tests por deporte. Planillas grupales y comparación entre momentos." },
  { icon: HeartPulse, t: "Cargas y fatiga", d: "sRPE, RIR, volumen, monotonía y bienestar diario. Alertas contra la línea base de cada deportista, sin diagnósticos." },
  { icon: Video, t: "Video análisis", d: "Cámara lenta, cuadro por cuadro, comparación lado a lado, líneas, ángulos articulares y comentarios con marca de tiempo." },
  { icon: LineChart, t: "Estadísticas", d: "Evolución de fuerza, potencia, saltos y velocidad; marcas personales; comparación de períodos; informes en PDF y exportación a Excel." },
  { icon: MessageSquare, t: "Comunicación", d: "Chat individual y grupal con videos y archivos, avisos de competencias, notificaciones y comentarios sobre cada sesión." },
  { icon: Dumbbell, t: "Biblioteca de ejercicios", d: "Filtros por músculo, cadena cinética, patrón, capacidad, deporte, material y nivel. Ejercicios propios con video." },
  { icon: Shapes, t: "Multideporte", d: "Plantillas de evaluación y planificación para natación, atletismo, fútbol, básquet, rugby, tenis, hockey, triatlón, ciclismo y combate." },
  { icon: ShieldCheck, t: "Roles y seguridad", d: "Administrador, entrenador y deportista con accesos independientes, historial de cambios y copias de seguridad." },
];

export default async function Landing() {
  const u = await currentUser();
  return (
    <div className="min-h-dvh overflow-x-hidden bg-ink-950">
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2">
            {u ? <Link href="/app" className="btn-primary btn-sm">Ir a mi panel</Link> : <><Link href="/login" className="btn-ghost btn-sm">Ingresar</Link><Link href="/register" className="btn-primary btn-sm">Crear cuenta</Link></>}
          </nav>
        </div>
      </header>

      <section className="relative bg-grid">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-volt/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-volt/40 bg-volt/10 px-3 py-1 text-xs font-semibold text-volt"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-volt" />Software de alto rendimiento</div>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl">
            Entrená con datos.<br /><span className="text-volt">Rendí con criterio.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-neutral-400">Hrtraining.co conecta entrenadores, preparadores físicos y deportistas: planificación, evaluaciones, control de cargas, video análisis y comunicación en una sola plataforma.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">Empezar gratis <ArrowRight size={18} /></Link>
            <form action={demoLoginAction}><button name="as" value="coach" className="btn-ghost px-6 py-3 text-base">Ver demo de entrenador</button></form>
            <form action={demoLoginAction}><button name="as" value="athlete" className="btn-ghost px-6 py-3 text-base">Ver demo de deportista</button></form>
          </div>
          <p className="mt-3 text-xs text-neutral-600">La demo usa datos ficticios identificados como DEMO.</p>

          {/* Vista esquemática del producto */}
          <div className="relative mt-14 rounded-3xl border border-ink-700 bg-ink-900/80 p-3 shadow-[0_40px_120px_-40px_rgba(255,214,10,.35)]">
            <span className="absolute -top-3 right-6 z-10 rounded-full border border-volt/40 bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt">Vista ilustrativa · datos de ejemplo</span>
            <div className="grid gap-3 rounded-2xl bg-ink-950 p-4 sm:grid-cols-4">
              {[["Carga 7 días", "1.877", "UA"], ["Bienestar", "17.4", "/25"], ["CMJ", "+4,9", "%"], ["Asistencia", "92", "%"]].map(([l, v, un]) => (
                <div key={l} className="rounded-xl border border-ink-700 bg-ink-850 p-4"><div className="label">{l}</div><div className="mt-1 font-mono text-3xl font-semibold text-white">{v}<span className="ml-1 text-sm text-neutral-500">{un}</span></div></div>
              ))}
              <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 sm:col-span-3">
                <div className="label mb-3">Dinámica de la temporada</div>
                <div className="flex h-28 items-end gap-1">
                  {[8, 8, 9, 5, 7, 8, 9, 5, 6, 7, 8, 4, 6, 6, 7, 3, 5, 5, 4, 2, 3, 3, 2, 1].map((h, i) => <div key={i} className="flex-1 rounded-t" style={{ height: `${h * 10}%`, background: i < 4 ? "#22d3ee" : i < 12 ? "#3b82f6" : i < 16 ? "#a78bfa" : i < 20 ? "#ff6b3d" : "#ffd60a", opacity: 0.85 }} />)}
                </div>
              </div>
              <div className="rounded-xl border border-volt/40 bg-volt/5 p-4">
                <div className="label text-volt">Alerta</div>
                <div className="mt-2 text-sm font-semibold text-white">Bienestar bajo su línea base</div>
                <div className="mt-1 text-xs text-neutral-400">Conversar antes de la sesión de hoy.</div>
              </div>
            </div>
            <div className="px-2 pt-2 text-right text-[10px] text-neutral-600">Ilustración con valores de ejemplo</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="label text-volt">Módulos</div>
        <h2 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Todo el proceso de entrenamiento, conectado.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: I, t, d }) => (
            <div key={t} className="card card-pad card-hover">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-volt text-black"><I size={20} /></div>
              <h3 className="mt-4 font-display text-lg font-semibold text-white">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-ink-800 bg-ink-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <div className="label text-volt">Para entrenadores</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-white">Decidí con información, no con intuición sola.</h3>
            <ul className="mt-4 space-y-2 text-neutral-300">{["Dashboard del equipo con alertas y asistencia", "Sesiones individuales o grupales en minutos", "Planillas de evaluación para todo el grupo", "Asistente que propone rutinas y vos validás"].map((x) => <li key={x} className="flex gap-2"><span className="text-volt">▸</span>{x}</li>)}</ul>
          </div>
          <div>
            <div className="label text-volt">Para deportistas</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-white">Tu entrenamiento del día, en el bolsillo.</h3>
            <ul className="mt-4 space-y-2 text-neutral-300">{["Registro de series, kilos, RIR y RPE desde el celular", "Bienestar diario en 30 segundos", "Evolución, marcas personales y objetivos", "Videos y correcciones de tu entrenador"].map((x) => <li key={x} className="flex gap-2"><span className="text-volt">▸</span>{x}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="font-display text-4xl font-bold text-white">¿Listo para entrenar distinto?</h2>
        <Link href="/register" className="btn-primary mt-6 px-8 py-3 text-base">Crear mi espacio de trabajo</Link>
      </section>
      <footer className="border-t border-ink-800 py-8 text-center text-xs text-neutral-600">
        <div className="mx-auto mb-3 h-1 w-24 rounded hazard" />
        © {new Date().getFullYear()} Hrtraining.co · Los indicadores de la plataforma son herramientas de seguimiento y no reemplazan la evaluación de un profesional de la salud.
      </footer>
    </div>
  );
}

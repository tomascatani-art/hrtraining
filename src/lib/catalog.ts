// Catálogos de dominio: deportes, capacidades, fases, tests y plantillas por deporte.

export const SPORTS: Record<string, { label: string; color: string }> = {
  GENERAL: { label: "Preparación física general", color: "#ffd60a" },
  NATACION: { label: "Natación", color: "#22d3ee" },
  ATLETISMO: { label: "Atletismo", color: "#ff6b3d" },
  FUTBOL: { label: "Fútbol", color: "#4ade80" },
  BASQUET: { label: "Básquet", color: "#fb923c" },
  RUGBY: { label: "Rugby", color: "#f43f5e" },
  TENIS: { label: "Tenis", color: "#facc15" },
  HOCKEY: { label: "Hockey", color: "#60a5fa" },
  TRIATLON: { label: "Triatlón", color: "#2dd4bf" },
  CICLISMO: { label: "Ciclismo", color: "#e879f9" },
  COMBATE: { label: "Deportes de combate", color: "#a78bfa" },
};
export const sportLabel = (k?: string | null) => (k && SPORTS[k]?.label) || k || "—";

export const CAPACITIES: Record<string, { label: string; color: string; short: string }> = {
  FUERZA_MAXIMA: { label: "Fuerza máxima", short: "Fmax", color: "#ffd60a" },
  FUERZA_EXPLOSIVA: { label: "Fuerza explosiva", short: "Fexp", color: "#facc15" },
  FUERZA_VELOCIDAD: { label: "Fuerza-velocidad", short: "F-V", color: "#fb923c" },
  FUERZA_RESISTENCIA: { label: "Fuerza-resistencia", short: "F-R", color: "#f97316" },
  POTENCIA: { label: "Potencia", short: "Pot", color: "#ff6b3d" },
  HIPERTROFIA: { label: "Hipertrofia", short: "Hip", color: "#f43f5e" },
  RESISTENCIA_AEROBICA: { label: "Resistencia aeróbica", short: "Raer", color: "#22d3ee" },
  RESISTENCIA_ANAEROBICA: { label: "Resistencia anaeróbica", short: "Ranae", color: "#3b82f6" },
  VELOCIDAD: { label: "Velocidad", short: "Vel", color: "#a78bfa" },
  AGILIDAD: { label: "Agilidad", short: "Agi", color: "#e879f9" },
  COORDINACION: { label: "Coordinación", short: "Coord", color: "#2dd4bf" },
  MOVILIDAD: { label: "Movilidad", short: "Mov", color: "#4ade80" },
  ESTABILIDAD: { label: "Estabilidad", short: "Est", color: "#94a3b8" },
};
export const capLabel = (k: string) => CAPACITIES[k]?.label ?? k;

export const PHASES: Record<string, { label: string; color: string; hint: string }> = {
  PREP_GENERAL: { label: "Preparatorio general", color: "#22d3ee", hint: "Volumen alto, intensidad moderada. Base de capacidades." },
  PREP_ESPECIFICO: { label: "Preparatorio específico", color: "#3b82f6", hint: "Transferencia al gesto deportivo, sube la intensidad." },
  PRECOMPETITIVO: { label: "Precompetitivo", color: "#a78bfa", hint: "Intensidad alta, volumen en descenso." },
  COMPETITIVO: { label: "Competitivo", color: "#ff6b3d", hint: "Mantener rendimiento, gestionar fatiga." },
  PUESTA_A_PUNTO: { label: "Puesta a punto", color: "#facc15", hint: "Reducción de volumen manteniendo intensidad (tapering)." },
  TRANSICION: { label: "Transición / recuperación", color: "#4ade80", hint: "Recuperación activa y regeneración." },
};

export const MICRO_TYPES: Record<string, { label: string; factor: number }> = {
  ACTIVACION: { label: "Activación", factor: 0.7 },
  CARGA: { label: "Carga", factor: 1 },
  CHOQUE: { label: "Choque", factor: 1.25 },
  RECUPERACION: { label: "Recuperación", factor: 0.55 },
  COMPETENCIA: { label: "Competencia", factor: 0.8 },
};

export const SESSION_TYPES: Record<string, string> = {
  FUERZA: "Fuerza / gimnasio",
  PISTA: "Pista / campo",
  TECNICO: "Técnico-táctico",
  RESISTENCIA: "Resistencia",
  RECUPERACION: "Recuperación",
  EVALUACION: "Evaluación",
  COMPETENCIA: "Competencia",
};

export const MUSCLES = [
  "Cuádriceps", "Isquiotibiales", "Glúteos", "Aductores", "Gemelos", "Core", "Lumbares",
  "Pectoral", "Dorsal", "Trapecio", "Deltoides", "Bíceps", "Tríceps", "Antebrazo", "Cuerpo completo",
];
export const PATTERNS: Record<string, string> = {
  SENTADILLA: "Sentadilla / dominante de rodilla",
  BISAGRA: "Bisagra de cadera",
  ZANCADA: "Zancada / unilateral",
  EMPUJE_H: "Empuje horizontal",
  EMPUJE_V: "Empuje vertical",
  TRACCION_H: "Tracción horizontal",
  TRACCION_V: "Tracción vertical",
  ROTACION: "Rotación / antirrotación",
  CARGADA: "Olímpico / triple extensión",
  SALTO: "Salto / pliometría",
  CARRERA: "Carrera / sprint",
  CORE: "Estabilidad de tronco",
  MOVILIDAD: "Movilidad",
};
export const EQUIPMENT = [
  "Barra", "Mancuernas", "Kettlebell", "Máquina", "Polea", "Banda elástica", "Peso corporal",
  "Cajón", "Balón medicinal", "Trineo", "TRX", "Encoder VBT", "Vallas", "Conos", "Fitball", "Bosu",
];
export const CHAINS: Record<string, string> = { CERRADA: "Cadena cerrada", ABIERTA: "Cadena abierta", MIXTA: "Mixta" };
export const DIFFICULTY: Record<number, string> = { 1: "Básico", 2: "Intermedio", 3: "Avanzado" };

// ---------- Tests de rendimiento ----------
export type TestDef = {
  key: string;
  name: string;
  category: "SALTOS" | "FUERZA" | "VBT" | "FMS" | "VELOCIDAD" | "RESISTENCIA" | "ESPECIFICO";
  unit: string;
  higherIsBetter: boolean;
  protocol: string;
  sports?: string[];
  needsLoad?: boolean;
};

export const TEST_CATEGORIES: Partial<Record<TestDef["category"], string>> = {
  SALTOS: "Saltos y reactividad",
  FUERZA: "Fuerza máxima",
  VELOCIDAD: "Velocidad y agilidad",
  RESISTENCIA: "Resistencia",
};

const ALL_TESTS: TestDef[] = [
  { key: "CMJ", name: "Countermovement Jump (CMJ)", category: "SALTOS", unit: "cm", higherIsBetter: true, protocol: "Manos en la cintura, contramovimiento libre. Mejor de 3 intentos." },
  { key: "SJ", name: "Squat Jump", category: "SALTOS", unit: "cm", higherIsBetter: true, protocol: "Desde 90° de rodilla, 2-3 s de pausa, sin contramovimiento." },
  { key: "ABK", name: "Abalakov", category: "SALTOS", unit: "cm", higherIsBetter: true, protocol: "CMJ con braceo libre." },
  { key: "DJ", name: "Drop Jump (altura)", category: "SALTOS", unit: "cm", higherIsBetter: true, protocol: "Caída desde cajón (registrar altura de caída en notas)." },
  { key: "RSI", name: "Reactive Strength Index", category: "SALTOS", unit: "m/s", higherIsBetter: true, protocol: "Altura de vuelo (m) / tiempo de contacto (s) en Drop Jump." },
  { key: "RM1_SQ", name: "1RM Sentadilla", category: "FUERZA", unit: "kg", higherIsBetter: true, protocol: "Aproximaciones progresivas, máximo 5 intentos al RM." },
  { key: "RM1_BP", name: "1RM Press de banca", category: "FUERZA", unit: "kg", higherIsBetter: true, protocol: "Agarre estandarizado, pausa breve en el pecho." },
  { key: "RM1_DL", name: "1RM Peso muerto", category: "FUERZA", unit: "kg", higherIsBetter: true, protocol: "Convencional o sumo (indicar en notas)." },
  { key: "RM3_SQ", name: "3RM Sentadilla", category: "FUERZA", unit: "kg", higherIsBetter: true, protocol: "Carga máxima para 3 repeticiones técnicas." },
  { key: "RM3_BP", name: "3RM Press de banca", category: "FUERZA", unit: "kg", higherIsBetter: true, protocol: "Carga máxima para 3 repeticiones técnicas." },
  { key: "IMTP", name: "Tirón isométrico (IMTP)", category: "FUERZA", unit: "N", higherIsBetter: true, protocol: "Fuerza pico en plataforma de fuerza." },
  { key: "VBT_SQ", name: "VMP Sentadilla (carga fija)", category: "VBT", unit: "m/s", higherIsBetter: true, protocol: "Velocidad media propulsiva a carga fija; registrar kg en notas.", needsLoad: true },
  { key: "VBT_BP", name: "VMP Press banca (carga fija)", category: "VBT", unit: "m/s", higherIsBetter: true, protocol: "Velocidad media propulsiva a carga fija.", needsLoad: true },
  { key: "POT_PICO", name: "Potencia pico (salto)", category: "VBT", unit: "W", higherIsBetter: true, protocol: "Potencia pico estimada en CMJ o plataforma." },
  { key: "FMS_TOTAL", name: "FMS — puntaje total", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "Suma de los 7 patrones (0-21). Se calcula automáticamente desde los componentes." },
  { key: "FMS_DS", name: "Deep / Overhead Squat", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3." },
  { key: "FMS_HS", name: "Hurdle Step", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3, se toma el lado más bajo." },
  { key: "FMS_ILL", name: "In-line Lunge", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3." },
  { key: "FMS_SM", name: "Shoulder Mobility", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3." },
  { key: "FMS_ASLR", name: "Active Straight Leg Raise", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3." },
  { key: "FMS_TSPU", name: "Trunk Stability Push-Up", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3." },
  { key: "FMS_RS", name: "Rotary Stability", category: "FMS", unit: "pts", higherIsBetter: true, protocol: "0-3." },
  { key: "SPR10", name: "Sprint 10 m", category: "VELOCIDAD", unit: "s", higherIsBetter: false, protocol: "Salida de pie, fotocélulas si es posible." },
  { key: "SPR20", name: "Sprint 20 m", category: "VELOCIDAD", unit: "s", higherIsBetter: false, protocol: "Salida de pie." },
  { key: "SPR30", name: "Sprint 30 m", category: "VELOCIDAD", unit: "s", higherIsBetter: false, protocol: "Salida de pie." },
  { key: "T_TEST", name: "T-Test de agilidad", category: "VELOCIDAD", unit: "s", higherIsBetter: false, protocol: "Protocolo estándar 10×5 m." },
  { key: "PRO_AGI", name: "Pro Agility 5-10-5", category: "VELOCIDAD", unit: "s", higherIsBetter: false, protocol: "Ida y vuelta con cambio de dirección." },
  { key: "COOPER", name: "Test de Cooper (12 min)", category: "RESISTENCIA", unit: "m", higherIsBetter: true, protocol: "Distancia máxima en 12 minutos." },
  { key: "NAVETTE", name: "Course Navette", category: "RESISTENCIA", unit: "etapa", higherIsBetter: true, protocol: "20 m ida y vuelta, registrar la última etapa completa." },
  { key: "YOYO_IR1", name: "Yo-Yo IR1", category: "ESPECIFICO", unit: "m", higherIsBetter: true, protocol: "Recuperación intermitente nivel 1.", sports: ["FUTBOL", "RUGBY", "HOCKEY", "BASQUET"] },
  { key: "SWIM_100", name: "100 m libre (natación)", category: "ESPECIFICO", unit: "s", higherIsBetter: false, protocol: "Pileta de 25 o 50 m (indicar).", sports: ["NATACION", "TRIATLON"] },
  { key: "SWIM_CSS", name: "Critical Swim Speed (400/200)", category: "ESPECIFICO", unit: "s/100m", higherIsBetter: false, protocol: "CSS = (T400 - T200) / 2.", sports: ["NATACION", "TRIATLON"] },
  { key: "FTP", name: "FTP ciclismo", category: "ESPECIFICO", unit: "W", higherIsBetter: true, protocol: "95% de la potencia media en 20 min.", sports: ["CICLISMO", "TRIATLON"] },
  { key: "RUN_5K", name: "5 km carrera", category: "ESPECIFICO", unit: "s", higherIsBetter: false, protocol: "Tiempo total en segundos.", sports: ["ATLETISMO", "TRIATLON"] },
  { key: "SAQ_TENIS", name: "Spider drill (tenis)", category: "ESPECIFICO", unit: "s", higherIsBetter: false, protocol: "Recorrido a 5 conos de la línea de fondo.", sports: ["TENIS"] },
  { key: "SJFT", name: "Special Judo Fitness Test (índice)", category: "ESPECIFICO", unit: "índice", higherIsBetter: false, protocol: "(FC final + FC 1 min) / lanzamientos totales.", sports: ["COMBATE"] },
];
/** Tests que se usan en la app: solo los básicos (Diego 2026-11-25). El resto queda para leer datos viejos. */
export const BASIC_TESTS = ["CMJ", "ABK", "RM1_SQ", "RM1_BP", "RM1_DL", "SPR10", "SPR30", "COOPER"];
export const TESTS: TestDef[] = ALL_TESTS.filter((t) => BASIC_TESTS.includes(t.key));
export const isBasicTest = (k: string) => BASIC_TESTS.includes(k);
export const TEST_MAP = Object.fromEntries(ALL_TESTS.map((t) => [t.key, t]));
export const FMS_COMPONENTS = ["FMS_DS", "FMS_HS", "FMS_ILL", "FMS_SM", "FMS_ASLR", "FMS_TSPU", "FMS_RS"];

// ---------- Plantillas por deporte ----------
export const SPORT_TEMPLATES: Record<string, { focus: string[]; tests: string[]; weekly: string[]; note: string }> = {
  GENERAL: { focus: ["FUERZA_MAXIMA", "HIPERTROFIA", "RESISTENCIA_AEROBICA", "MOVILIDAD"], tests: ["CMJ", "RM1_SQ", "RM1_BP", "FMS_TOTAL", "COOPER"], weekly: ["FUERZA", "FUERZA", "RESISTENCIA", "FUERZA", "RECUPERACION"], note: "Desarrollo integral con énfasis en fuerza y salud." },
  NATACION: { focus: ["RESISTENCIA_AEROBICA", "FUERZA_RESISTENCIA", "POTENCIA", "MOVILIDAD"], tests: ["SWIM_100", "SWIM_CSS", "CMJ", "FMS_SM"], weekly: ["RESISTENCIA", "FUERZA", "RESISTENCIA", "TECNICO", "RESISTENCIA", "FUERZA"], note: "Fuerza en seco complementaria, foco en hombro y core." },
  ATLETISMO: { focus: ["VELOCIDAD", "FUERZA_EXPLOSIVA", "POTENCIA", "FUERZA_MAXIMA"], tests: ["SPR10", "SPR30", "CMJ", "RSI", "RM1_SQ"], weekly: ["PISTA", "FUERZA", "PISTA", "RECUPERACION", "PISTA", "FUERZA"], note: "Pliometría y fuerza máxima alineadas con la temporada de pista." },
  FUTBOL: { focus: ["VELOCIDAD", "AGILIDAD", "RESISTENCIA_ANAEROBICA", "FUERZA_EXPLOSIVA"], tests: ["YOYO_IR1", "SPR10", "SPR30", "CMJ", "T_TEST"], weekly: ["TECNICO", "FUERZA", "TECNICO", "PISTA", "COMPETENCIA", "RECUPERACION"], note: "Microciclo estructurado alrededor del partido (MD-4 a MD+1)." },
  BASQUET: { focus: ["POTENCIA", "AGILIDAD", "FUERZA_EXPLOSIVA", "RESISTENCIA_ANAEROBICA"], tests: ["CMJ", "ABK", "PRO_AGI", "YOYO_IR1"], weekly: ["TECNICO", "FUERZA", "TECNICO", "FUERZA", "COMPETENCIA"], note: "Salto vertical y cambios de dirección." },
  RUGBY: { focus: ["FUERZA_MAXIMA", "POTENCIA", "HIPERTROFIA", "RESISTENCIA_ANAEROBICA"], tests: ["RM1_SQ", "RM1_BP", "CMJ", "SPR10", "YOYO_IR1"], weekly: ["FUERZA", "TECNICO", "FUERZA", "TECNICO", "COMPETENCIA", "RECUPERACION"], note: "Masa muscular y potencia de contacto." },
  TENIS: { focus: ["AGILIDAD", "VELOCIDAD", "ESTABILIDAD", "FUERZA_RESISTENCIA"], tests: ["SAQ_TENIS", "PRO_AGI", "CMJ", "FMS_TOTAL"], weekly: ["TECNICO", "FUERZA", "TECNICO", "PISTA", "TECNICO"], note: "Desplazamientos cortos y prevención de hombro." },
  HOCKEY: { focus: ["RESISTENCIA_ANAEROBICA", "VELOCIDAD", "AGILIDAD", "FUERZA_EXPLOSIVA"], tests: ["YOYO_IR1", "SPR20", "T_TEST", "CMJ"], weekly: ["TECNICO", "FUERZA", "TECNICO", "PISTA", "COMPETENCIA"], note: "Esfuerzos intermitentes de alta intensidad." },
  TRIATLON: { focus: ["RESISTENCIA_AEROBICA", "FUERZA_RESISTENCIA", "MOVILIDAD"], tests: ["FTP", "RUN_5K", "SWIM_CSS", "CMJ"], weekly: ["RESISTENCIA", "RESISTENCIA", "FUERZA", "RESISTENCIA", "RESISTENCIA", "RECUPERACION"], note: "Distribución de volumen entre tres disciplinas." },
  CICLISMO: { focus: ["RESISTENCIA_AEROBICA", "FUERZA_RESISTENCIA", "POTENCIA"], tests: ["FTP", "CMJ", "RM1_SQ"], weekly: ["RESISTENCIA", "FUERZA", "RESISTENCIA", "RESISTENCIA", "RECUPERACION"], note: "Fuerza de piernas en temporada baja." },
  COMBATE: { focus: ["POTENCIA", "FUERZA_RESISTENCIA", "RESISTENCIA_ANAEROBICA", "FUERZA_MAXIMA"], tests: ["SJFT", "CMJ", "RM1_BP", "RM1_DL"], weekly: ["TECNICO", "FUERZA", "TECNICO", "RESISTENCIA", "TECNICO"], note: "Control de peso y potencia en agarre y tronco." },
};

/** Bloques dentro de una sesión. El color identifica el bloque en el armado y en la vista del deportista. */
export const BLOCKS: Record<string, { label: string; color: string }> = {
  ACTIVACION: { label: "Activación", color: "#3a8fd6" },
  MOVILIDAD: { label: "Movilidad", color: "#4fb39a" },
  TECNICA: { label: "Técnica", color: "#4fc3d9" },
  VELOCIDAD: { label: "Velocidad", color: "#5cc26b" },
  POTENCIA: { label: "Potencia / explosivo", color: "#f2a93b" },
  FUERZA: { label: "Fuerza", color: "#ffd60a" },
  CONTRASTE: { label: "Contraste", color: "#a98bf0" },
  HIPERTROFIA: { label: "Hipertrofia", color: "#e8608c" },
  ACCESORIO: { label: "Accesorio", color: "#8fb3c9" },
  CORE: { label: "Core", color: "#d9b84a" },
  ESTABILIDAD: { label: "Estabilidad / propiocepción", color: "#7d8cff" },
  METABOLICO: { label: "Metabólico / resistencia", color: "#d9566f" },
  PREVENCION: { label: "Prevención", color: "#c98aa6" },
  VUELTA_CALMA: { label: "Vuelta a la calma", color: "#94a3b8" },
};

/** Frases rápidas para que el deportista anote cómo le fue en un ejercicio con un toque. */
export const QUICK_NOTES = ["Me sentí bien", "Me costó", "Salió fácil", "Con energía", "Cansado/a", "Dolor o molestia", "Subí el peso", "Bajé el peso"];

// Carpeta por deportista: secciones para ordenar documentos del perfil.
export const PROFILE_FOLDERS = [
  { key: "ANTROPOMETRIA", label: "Antropometría", hint: "Mediciones, pliegues, composición corporal" },
  { key: "ESTUDIOS", label: "Estudios médicos", hint: "Aptos, análisis, informes de profesionales" },
  { key: "NUTRICION", label: "Nutrición", hint: "Planes y seguimientos" },
  { key: "EVALUACIONES", label: "Evaluaciones externas", hint: "Tests hechos fuera de la app" },
  { key: "FOTOS", label: "Fotos de seguimiento", hint: "Fotos de evolución" },
  { key: "OTROS", label: "Otros", hint: "Todo lo demás" },
] as const;
export type FolderKey = (typeof PROFILE_FOLDERS)[number]["key"];
export const folderLabel = (k?: string | null) => PROFILE_FOLDERS.find((f) => f.key === k)?.label ?? "Otros";

/** Categorías de la biblioteca (filtro rápido arriba de la lista). */
export const EX_CATEGORIES = ["Fuerza", "Olímpico", "Complejos", "Pliometría", "Velocidad", "Core", "Calistenia", "Kettlebell", "Suspensión (TRX)", "Bandas elásticas", "Trineo", "Combate", "Equilibrio", "Natación en seco", "Movilidad", "Flexibilidad"];
export const categoryFromPattern = (p: string) =>
  ({ CARGADA: "Olímpico", SALTO: "Pliometría", CARRERA: "Velocidad", CORE: "Core", ROTACION: "Core", MOVILIDAD: "Movilidad" } as Record<string, string>)[p] ?? "Fuerza";

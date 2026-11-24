# Hrtraining.co

Plataforma de entrenamiento de alto rendimiento para entrenadores, preparadores físicos y deportistas. Reúne planificación, sesiones, biblioteca de ejercicios, evaluaciones físicas, control de cargas y bienestar, video análisis y comunicación en una sola aplicación web, adaptada a escritorio y celular.

## Qué incluye

| Módulo | Qué hace |
|---|---|
| **Paneles** | Panel del entrenador (equipo, alertas, carga semanal, próximas sesiones) y panel del deportista (entrenamiento del día, bienestar, objetivos y progreso). |
| **Deportistas y grupos** | Alta de deportistas con link de invitación, perfil completo, grupos, historial y objetivos. Cada usuario ve solo sus datos. |
| **Planificación** | Temporada anual con macrociclos, mesociclos y microciclos, fases, capacidades y tipos de microciclo. Línea de tiempo, gráficos de volumen e intensidad y comparación de lo planificado contra lo ejecutado. Estructura automática según la fecha objetivo. |
| **Sesiones y calendario** | Constructor de sesiones con ejercicios, series, repeticiones, %1RM, RIR, pausa y tempo. Repetición semanal, duplicado y calendario interactivo. |
| **Registro del deportista** | Registro de la sesión por serie, RPE y comentarios. El entrenador responde sobre cada registro. |
| **Biblioteca** | 37 ejercicios base con contenido técnico y filtros por músculo, patrón, equipamiento, cadena y dificultad. El entrenador crea los suyos con video propio o clona los de la base. |
| **Evaluaciones** | 36 tests: CMJ, SJ, Abalakov, DJ, RSI, 1RM/3RM, VBT, potencia, FMS completo, Cooper, Navette, sprints, agilidad y tests por deporte. Se cargan como planilla por grupo, con video adjunto, ranking, evolución, comparación entre deportistas y exportación a Excel (CSV). |
| **Cargas y fatiga** | Carga por sRPE, relación aguda/crónica, monotonía y strain de Foster, bienestar diario y desvío respecto de la línea base personal. Las alertas son orientativas y **no son diagnósticos médicos**. |
| **Video análisis** | Reproducción cuadro a cuadro y en cámara lenta, dibujo de líneas, ángulos, trazos y texto, comparación lado a lado sincronizada y comentarios con marca de tiempo. |
| **RM por ejercicio** | RM de cada deportista con historial. Las sesiones con % calculan los kilos solas y los redondean a discos. Aviso a la otra parte cuando cambia un RM. Estimación desde lo entrenado. |
| **Bloques y notas** | Bloques dentro de la sesión (activación, fuerza, contraste, core…). El deportista anota cómo le fue en cada ejercicio con frases rápidas, y el entrenador ve los kilos usados y esas notas mientras arma la próxima sesión. Aviso de ejercicio repetido en los últimos 30 días. |
| **Panel «Hoy»** | Quién entrenó hoy, quién marcó dolor o molestia en los últimos 2 días y los RM nuevos que cargaron los deportistas. Racha de constancia y gráfico de sensaciones para el deportista. |
| **Cuotas** | Estado de pago mensual, cuota propia por deportista, recordatorio, bonificación y pausa de cuenta (el deportista solo ve su cuota y el chat; al marcar «Pagó» se reactiva). Contacto por WhatsApp. |
| **Herramientas** | Temporizador por intervalos (Tabata, EMOM, 30/30), calculadora de fuerza con tabla de % y discos por lado, y estimación de energía y macros. |
| **Carpeta del deportista** | Documentos por perfil en secciones (Antropometría, Estudios médicos, Nutrición, Evaluaciones externas, Fotos de seguimiento, Otros) con nota. Solo los ven el deportista y sus entrenadores; la app no interpreta estudios médicos. |
| **Antropometría** | Mediciones por fecha (peso, tallas, 6 pliegues, perímetros), sumatoria de 6 pliegues, evolución en gráficos e historial. La carga el entrenador; el deportista la ve en Mi carpeta. Seguimiento, no diagnóstico. |
| **Marca propia** | Nombre, logo y acento del club (solo amarillo o blanco sobre base negra) en toda la app, pantalla de ingreso propia en `/c/<enlace>` e invitaciones con la marca. |
| **Cobro con Mercado Pago** | Cada club conecta su Access Token (se guarda cifrado con AES-256-GCM). El deportista paga su cuota desde la app (Checkout Pro); el pago se verifica consultando a Mercado Pago, la cuota se marca pagada, se reactiva la cuenta y se avisa al entrenador. Aviso automático en `/api/payments/mercadopago` cuando la app está publicada con https. |
| **Uso en celular** | Diseño adaptable a computadora y celular; en el celular la biblioteca de ejercicios se abre a pantalla completa para armar sesiones. Se puede instalar en la pantalla de inicio (manifest web). |
| **Comunicación** | Chats directos y grupales con adjuntos, avisos masivos y notificaciones. |
| **Estadísticas e informes** | Comparación de períodos, asistencia, cumplimiento e informe imprimible en PDF por deportista. |
| **Asistente** | Generador de semanas de entrenamiento basado en reglas y en el historial. La propuesta siempre la revisa el entrenador antes de crearse. |
| **Administración** | Roles (administrador, entrenador, deportista), varios entrenadores por organización, registro de cambios, copia de seguridad en JSON y reinicio de la demo. |
| **Plantillas por deporte** | Fútbol, básquet, rugby, hockey, vóley, atletismo, tenis, natación, ciclismo, crossfit y general, cada una con tests y capacidades sugeridas. |

## Datos de demostración y cuentas reales

La base incluye una organización de demostración llamada **Club Demo Hrtraining**. Todos sus nombres terminan en "Demo" y la interfaz muestra la etiqueta *Modo demostración: datos ficticios*.

| Cuenta | Email | Contraseña |
|---|---|---|
| Entrenador (administrador) | entrenador.demo@hrtraining.co | demo1234 |
| Preparador físico | preparador.demo@hrtraining.co | demo1234 |
| Deportista | deportista.demo@hrtraining.co | demo1234 |

Para usar la plataforma en serio, cualquier persona crea su cuenta en **Crear cuenta**. Se genera una organización vacía y propia, sin datos de demostración. Desde ahí da de alta a sus deportistas e invita a otros entrenadores.

## Tecnología

- Next.js 15 (App Router, componentes de servidor y server actions), React 19 y TypeScript.
- PostgreSQL con Prisma.
- Autenticación propia: contraseñas con bcrypt y sesión JWT en una cookie httpOnly.
- Tailwind CSS, Recharts y lucide-react.

## Instalación local

Requisitos: Node.js 20 o superior y PostgreSQL 14 o superior.

```bash
npm install
cp .env.example .env          # completar DATABASE_URL y AUTH_SECRET
npx prisma migrate deploy     # crea las tablas
npm run db:seed               # biblioteca base + datos de demostración
npm run dev                   # http://localhost:3000
```

Para producción: `npm run build` y luego `npm start`.

### Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. |
| `AUTH_SECRET` | Secreto para firmar sesiones, de 32 caracteres o más (`openssl rand -hex 32`). |
| `UPLOAD_DIR` | Carpeta donde se guardan videos y archivos. |
| `APP_TZ` / `NEXT_PUBLIC_TZ` | Zona horaria de la organización (por defecto `America/Argentina/Buenos_Aires`). |
| `SEED_DEMO` | `false` para no crear la demo al ejecutar el seed. |

## Despliegue

**Recomendado: un servidor con disco persistente** (Railway, Render, Fly.io o un VPS) más PostgreSQL administrado (Neon, Supabase o el del mismo proveedor).

1. Crear la base y copiar su `DATABASE_URL`.
2. Cargar las variables de entorno.
3. Comando de build: `npm run deploy:build` (aplica migraciones y compila).
4. Comando de inicio: `npm start`.
5. Montar un volumen persistente en la ruta de `UPLOAD_DIR` para videos y archivos.
6. Una sola vez: `npm run db:seed`.

**Vercel:** la aplicación funciona, pero su disco es temporal, así que los videos y archivos subidos se pierden. Antes de usar Vercel hay que conectar el almacenamiento a S3, Cloudflare R2 o Supabase Storage. Todo el acceso a archivos está aislado en `src/lib/storage.ts`, así que el cambio se hace en ese único archivo.

## Seguridad y privacidad

- Cada consulta filtra por organización y por permisos: un deportista solo ve lo suyo y un entrenador solo ve a sus deportistas (el administrador ve a toda la organización).
- Los archivos se sirven a través de la aplicación, con control de acceso, nunca como archivos públicos.
- Las acciones relevantes quedan en el registro de cambios.
- Los indicadores de carga y bienestar son herramientas de seguimiento. No diagnostican lesiones y ningún indicador aislado predice una lesión.

## Hoja de ruta

- Almacenamiento de archivos en S3/R2 y transcodificación de video.
- Asistente con IA para planificación y análisis de video, siempre validado por el entrenador.
- Integración con wearables (GPS, frecuencia cardíaca, plataformas de salto, encoders VBT).
- Aplicación instalable (PWA) con notificaciones push y modo sin conexión.
- Exportación nativa a .xlsx e informes PDF generados en el servidor.
- Pagos y suscripciones para organizaciones.

## Estructura

```
prisma/            esquema, migraciones, biblioteca base y datos demo
src/app/           páginas públicas, autenticación, /app (plataforma) y API
src/components/    interfaz, gráficos, constructor de sesiones, video análisis
src/lib/           autenticación, permisos, métricas, catálogo de tests, almacenamiento
```

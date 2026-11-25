// Se ejecuta en cada despliegue: carga la biblioteca de ejercicios y, si todavía no existe, la organización DEMO.
// Nunca borra ni pisa datos reales.
process.env.TZ = process.env.APP_TZ || "America/Argentina/Buenos_Aires";
import { PrismaClient } from "@prisma/client";
import { createDemo, ensureLibrary, ensureDemoRoutines, ensureDemoPresence, ensureDemoExpiring, trimDemo, ensureDemoChecks } from "./demo";

const db = new PrismaClient();
async function main() {
  await ensureLibrary(db);
  if (process.env.SEED_DEMO === "false") return;
  if (await db.organization.count({ where: { isDemo: true } })) { await trimDemo(db); await ensureDemoRoutines(db); await ensureDemoPresence(db); await ensureDemoExpiring(db); await ensureDemoChecks(db); return console.log("Demo ya cargada."); }
  await createDemo(db);
  await trimDemo(db);
  await ensureDemoRoutines(db);
  await ensureDemoPresence(db);
  await ensureDemoExpiring(db);
  await ensureDemoChecks(db);
  console.log("Demo creada: entrenador.demo@hrtraining.co / deportista.demo@hrtraining.co (contraseña demo1234)");
}
main().finally(() => db.$disconnect());

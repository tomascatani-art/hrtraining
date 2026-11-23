process.env.TZ = process.env.APP_TZ || "America/Argentina/Buenos_Aires";
import { PrismaClient } from "@prisma/client";
import { createDemo, ensureLibrary } from "./demo";

const db = new PrismaClient();
async function main() {
  await ensureLibrary(db);
  if (process.env.SEED_DEMO !== "false") {
    await createDemo(db);
    console.log("Demo creada: entrenador.demo@hrtraining.co / deportista.demo@hrtraining.co (contraseña demo1234)");
  }
}
main().finally(() => db.$disconnect());

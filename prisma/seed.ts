process.env.TZ = process.env.APP_TZ || "America/Argentina/Buenos_Aires";
import { PrismaClient } from "@prisma/client";
import { createDemo, ensureLibrary } from "./demo";

const db = new PrismaClient();
async function main() {
  await ensureLibrary(db);
  if (process.env.SEED_DEMO !== "false") {
    await createDemo(db);
    console.log("Demo creada: usuarios hernan y alumna");
  }
}
main().finally(() => db.$disconnect());

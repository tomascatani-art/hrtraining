// Las migraciones no funcionan a través del pooler en modo "transaction" (puerto 6543 / pgbouncer=true):
// se quedan colgadas. Para migrar y sembrar se usa la misma conexión por el puerto 5432 (modo "session").
import { execSync } from "node:child_process";
const raw = process.env.DATABASE_URL ?? "";
let url = raw;
try {
  const u = new URL(raw);
  if (u.port === "6543") u.port = "5432";
  u.searchParams.delete("pgbouncer");
  url = u.toString();
} catch {}
const env = { ...process.env, DATABASE_URL: url };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx tsx prisma/seed-if-empty.ts", { stdio: "inherit", env });

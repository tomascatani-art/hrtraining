// Zona horaria de la aplicación para cálculos de días y semanas en el servidor.
process.env.TZ = process.env.APP_TZ || "America/Argentina/Buenos_Aires";

import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;

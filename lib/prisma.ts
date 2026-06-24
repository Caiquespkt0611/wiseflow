import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Algumas conexões para suportar requests/queries concorrentes sem serializar
    // tudo numa única conexão. Mantido baixo de propósito: em serverless cada
    // instância abre seu próprio pool, então valores altos esgotariam o limite do Supabase.
    max: 5,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Always persist — prevents new connections per request in production (serverless)
globalForPrisma.prisma = prisma;

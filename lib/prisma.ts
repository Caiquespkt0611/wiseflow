import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * O pooler do Supabase na porta 5432 é modo sessão: cada conexão fica presa ao
 * cliente e o teto é de 15 no total. Em serverless várias instâncias sobem ao
 * mesmo tempo e estouram esse teto, e a API responde 500 com EMAXCONNSESSION
 * (o que na tela vira "sumiram meus dados"). A porta 6543 é o modo transação,
 * onde a conexão volta para o pool a cada query e o teto é muito maior.
 */
function urlDoBanco(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  if (!url.includes("pooler.supabase.com:5432")) return url;
  return url.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543");
}

function createPrismaClient() {
  const pool = new Pool({
    connectionString: urlDoBanco(),
    // Poucas conexões por instância, e devolvidas rápido: em modo transação
    // isso basta para as queries concorrentes do dashboard sem segurar o pool.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
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

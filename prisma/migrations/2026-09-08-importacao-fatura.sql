-- AlterTable
ALTER TABLE "despesas_variaveis" ADD COLUMN     "conferidaEm" TIMESTAMP(3),
ADD COLUMN     "importacaoId" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "importacoes_fatura" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cartao" TEXT NOT NULL,
    "mesRef" TEXT NOT NULL,
    "totalInformado" DOUBLE PRECISION,
    "totalLido" DOUBLE PRECISION NOT NULL,
    "itensLidos" INTEGER NOT NULL,
    "criadas" INTEGER NOT NULL,
    "conferidas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "arquivos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacoes_fatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "importacoes_fatura_userId_idx" ON "importacoes_fatura"("userId");

-- CreateIndex
CREATE INDEX "importacoes_fatura_userId_cartao_mesRef_idx" ON "importacoes_fatura"("userId", "cartao", "mesRef");

-- CreateIndex
CREATE INDEX "despesas_variaveis_importacaoId_idx" ON "despesas_variaveis"("importacaoId");

-- AddForeignKey
ALTER TABLE "despesas_variaveis" ADD CONSTRAINT "despesas_variaveis_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "importacoes_fatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes_fatura" ADD CONSTRAINT "importacoes_fatura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tabela nasce fechada. O scripts/fechar-rls.mjs faria isso depois, mas entre o
-- CREATE TABLE e a proxima rodada do script a tabela fica exposta na API REST
-- que o Supabase publica sozinha. Aqui ela ja nasce com RLS e sem grant publico.
ALTER TABLE "importacoes_fatura" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_full_access_importacoes_fatura" ON "importacoes_fatura";
CREATE POLICY "service_full_access_importacoes_fatura" ON "importacoes_fatura"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON "importacoes_fatura" FROM anon, authenticated;

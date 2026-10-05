-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reservaMinima" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "emprestimos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "contrato" TEXT,
    "modalidade" TEXT NOT NULL,
    "pagamento" TEXT NOT NULL,
    "periodicidade" TEXT NOT NULL DEFAULT 'mensal',
    "valorContratado" DOUBLE PRECISION NOT NULL,
    "taxaMensal" DOUBLE PRECISION NOT NULL,
    "cetMensal" DOUBLE PRECISION,
    "taxaEstimada" BOOLEAN NOT NULL DEFAULT false,
    "parcelasTotal" INTEGER NOT NULL,
    "valorParcela" DOUBLE PRECISION NOT NULL,
    "valoresParcelas" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "primeiroVencimento" TIMESTAMP(3) NOT NULL,
    "proximaParcela" INTEGER NOT NULL DEFAULT 1,
    "parcelasAntecipadas" INTEGER NOT NULL DEFAULT 0,
    "quitadoEm" TIMESTAMP(3),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emprestimos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emprestimos_userId_idx" ON "emprestimos"("userId");

-- AddForeignKey
ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tabela nasce fechada, igual a importacoes_fatura: sem isso ela fica exposta
-- na API REST do Supabase até a próxima rodada do scripts/fechar-rls.mjs.
ALTER TABLE "emprestimos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_full_access_emprestimos" ON "emprestimos";
CREATE POLICY "service_full_access_emprestimos" ON "emprestimos"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON "emprestimos" FROM anon, authenticated;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "cartaoMensal" DOUBLE PRECISION;

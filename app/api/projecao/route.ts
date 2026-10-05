import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projetar } from "@/lib/projecao";
import { hojeUTC } from "@/lib/emprestimos";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mesBase = Number(searchParams.get("mes") ?? new Date().getMonth() + 1);
  const anoBase = Number(searchParams.get("ano") ?? new Date().getFullYear());

  // Período: mês atual até dezembro do ano seguinte
  const totalMeses = (12 - mesBase + 1) + 12;

  const userId = session.user.id;
  const [receitas, despesasFixas, despesasVariaveis, receitasVariaveis, contasBancarias, emprestimos] = await Promise.all([
    prisma.receita.findMany({ where: { userId, ativa: true } }),
    prisma.despesaFixa.findMany({ where: { userId, ativa: true } }),
    prisma.despesaVariavel.findMany({ where: { userId } }),
    prisma.receitaVariavel.findMany({ where: { userId } }),
    prisma.contaBancaria.findMany({ where: { userId } }),
    prisma.emprestimo.findMany({ where: { userId } }),
  ]);

  const saldoBancario = contasBancarias.reduce((sum, c) => sum + c.saldo, 0);
  const projecao = projetar(
    { receitas, receitasVariaveis, despesasFixas, despesasVariaveis, emprestimos },
    saldoBancario,
    mesBase,
    anoBase,
    totalMeses,
    hojeUTC()
  );

  return NextResponse.json({ projecao, saldoBancario });
}

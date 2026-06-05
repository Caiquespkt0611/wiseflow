import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get("mes") ?? new Date().getMonth() + 1);
  const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  const [receitas, despesasFixas, despesasVariaveis, contasBancarias] = await Promise.all([
    prisma.receita.findMany({
      where: {
        userId: session.user.id,
        ativa: true,
        OR: [
          { recorrente: false, data: { gte: inicio, lte: fim } },
          // Recorrente ainda pendente este mês: data não foi avançada para além do mês
          { recorrente: true, data: { lte: fim } },
        ],
      },
    }),
    prisma.despesaFixa.findMany({
      where: {
        userId: session.user.id,
        ativa: true,
        OR: [
          { dataProximoVencimento: null },
          { dataProximoVencimento: { lte: fim } },
        ],
      },
    }),
    prisma.despesaVariavel.findMany({
      where: {
        userId: session.user.id,
        dataInicio: { lte: fim },
      },
    }),
    prisma.contaBancaria.findMany({
      where: { userId: session.user.id },
    }),
  ]);

  const totalReceitas = receitas.reduce((sum, r) => sum + r.valor, 0);
  const totalFixas = despesasFixas.reduce((sum, d) => sum + d.valor, 0);

  // Only count parcelas that are active in the given month
  const totalVariaveis = despesasVariaveis.reduce((sum, d) => {
    const dataInicio = new Date(d.dataInicio);
    const mesInicio = dataInicio.getMonth();
    const anoInicio = dataInicio.getFullYear();
    const diffMeses =
      (ano - anoInicio) * 12 + (mes - 1 - mesInicio);
    const parcelaAtualCalc = d.parcelaAtual + diffMeses;
    if (parcelaAtualCalc >= 1 && parcelaAtualCalc <= d.parcelasTotal) {
      return sum + d.valorParcela;
    }
    return sum;
  }, 0);

  const totalDespesas = totalFixas + totalVariaveis;
  const saldoBancario = contasBancarias.reduce((sum, c) => sum + c.saldo, 0);
  // PSI = previsão de fechamento: saldo atual + receitas pendentes - despesas do mês
  const psi = saldoBancario + totalReceitas - totalDespesas;

  return NextResponse.json({
    totalReceitas,
    totalDespesas,
    totalFixas,
    totalVariaveis,
    psi,
    saldoBancario,
    contas: contasBancarias,
    receitas,
    despesasFixas,
    despesasVariaveis: despesasVariaveis.map((d) => {
      const dataInicio = new Date(d.dataInicio);
      const diffMeses =
        (ano - dataInicio.getFullYear()) * 12 +
        (mes - 1 - dataInicio.getMonth());
      return {
        ...d,
        parcelaAtualMes: d.parcelaAtual + diffMeses,
      };
    }),
  });
}

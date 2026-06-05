import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mesBase = Number(searchParams.get("mes") ?? new Date().getMonth() + 1);
  const anoBase = Number(searchParams.get("ano") ?? new Date().getFullYear());

  const [receitas, despesasFixas, despesasVariaveis] = await Promise.all([
    prisma.receita.findMany({ where: { userId: session.user.id } }),
    prisma.despesaFixa.findMany({ where: { userId: session.user.id, ativa: true } }),
    prisma.despesaVariavel.findMany({ where: { userId: session.user.id } }),
  ]);

  const projecao = [];
  let psiAcumulado = 0;

  for (let i = 0; i < 12; i++) {
    let mes = mesBase + i;
    let ano = anoBase;
    if (mes > 12) {
      mes -= 12;
      ano += 1;
    }

    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const totalReceitas = receitas
      .filter((r) => {
        if (r.recorrente && r.ativa) return true;
        const data = new Date(r.data);
        return data >= inicio && data <= fim;
      })
      .reduce((sum, r) => sum + r.valor, 0);

    const totalFixas = despesasFixas.reduce((sum, d) => sum + d.valor, 0);

    const totalVariaveis = despesasVariaveis.reduce((sum, d) => {
      const dataInicio = new Date(d.dataInicio);
      const diffMeses =
        (ano - dataInicio.getFullYear()) * 12 + (mes - 1 - dataInicio.getMonth());
      const parcelaAtualCalc = d.parcelaAtual + diffMeses;
      if (parcelaAtualCalc >= 1 && parcelaAtualCalc <= d.parcelasTotal) {
        return sum + d.valorParcela;
      }
      return sum;
    }, 0);

    const totalDespesas = totalFixas + totalVariaveis;
    const psiMes = totalReceitas - totalDespesas;
    psiAcumulado += psiMes;

    projecao.push({
      mes,
      ano,
      label: `${String(mes).padStart(2, "0")}/${ano}`,
      totalReceitas,
      totalDespesas,
      totalFixas,
      totalVariaveis,
      psiMes,
      psiAcumulado,
    });
  }

  return NextResponse.json(projecao);
}

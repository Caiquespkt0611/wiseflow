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

  // Período: mês atual até dezembro do ano seguinte
  const totalMeses = (12 - mesBase + 1) + 12;

  const [receitas, despesasFixas, despesasVariaveis, receitasVariaveis, contasBancarias] = await Promise.all([
    prisma.receita.findMany({ where: { userId: session.user.id, ativa: true }, }),
    prisma.despesaFixa.findMany({ where: { userId: session.user.id, ativa: true } }),
    prisma.despesaVariavel.findMany({ where: { userId: session.user.id } }),
    prisma.receitaVariavel.findMany({ where: { userId: session.user.id } }),
    prisma.contaBancaria.findMany({ where: { userId: session.user.id } }),
  ]);

  const saldoBancario = contasBancarias.reduce((sum, c) => sum + c.saldo, 0);

  const projecao = [];
  let previsaoAcumulada = saldoBancario;

  for (let i = 0; i < totalMeses; i++) {
    let mes = mesBase + i;
    let ano = anoBase;
    while (mes > 12) { mes -= 12; ano += 1; }

    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));

    const mesKey = `${ano}-${String(mes).padStart(2, "0")}`;

    const totalReceitasFixas = receitas
      .filter((r) => {
        if (r.parcelada && r.mesesTotal) {
          // A parcelada não avança a data ao receber; a recebida no mês sai por confirmadaAte,
          // senão ela conta de novo em cima do saldo bancário que já a inclui.
          if (r.confirmadaAte) {
            const c = new Date(r.confirmadaAte);
            if (c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes) return false;
          }
          const dataInicio = new Date(r.data);
          const diffMeses =
            (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
          return diffMeses >= 0 && diffMeses < r.mesesTotal;
        }
        if (r.recorrente) {
          if (new Date(r.data) > fim) return false;
          if ((r.excecoes as string[])?.includes(mesKey)) return false;
          return true;
        }
        const data = new Date(r.data);
        return data >= inicio && data <= fim;
      })
      .reduce((sum, r) => sum + r.valor, 0);

    const totalReceitasVar = receitasVariaveis.reduce((sum, r) => {
      const dataInicio = new Date(r.dataInicio);
      const diffMeses = (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
      const parcelaAtualCalc = r.parcelaAtual + diffMeses;
      // parcelaAtual é a próxima parcela NÃO paga; parcelas abaixo dela já foram quitadas.
      if (parcelaAtualCalc >= r.parcelaAtual && parcelaAtualCalc <= r.parcelasTotal) {
        return sum + r.valorParcela;
      }
      return sum;
    }, 0);

    const totalReceitas = totalReceitasFixas + totalReceitasVar;

    // Fixas: só conta se dataInicio já chegou neste mês E o próximo vencimento não passou deste mês.
    // Compara mês com mês em UTC, igual ao painel: comparar com "fim do mês" no fuso do servidor
    // fazia a conta paga que volta em 1º do mês seguinte contar de novo neste mês.
    const totalFixas = despesasFixas
      .filter((d) => {
        const ini = new Date(d.dataInicio);
        if (ini.getUTCFullYear() > ano || (ini.getUTCFullYear() === ano && ini.getUTCMonth() + 1 > mes)) return false;
        if (!d.dataProximoVencimento) return true;
        const prox = new Date(d.dataProximoVencimento);
        return prox.getUTCFullYear() * 12 + prox.getUTCMonth() + 1 <= ano * 12 + mes;
      })
      .reduce((sum, d) => sum + d.valor, 0);

    const totalVariaveis = despesasVariaveis.reduce((sum, d) => {
      const dataInicio = new Date(d.dataInicio);
      const diffMeses =
        (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
      const parcelaAtualCalc = d.parcelaAtual + diffMeses;
      // parcelaAtual é a próxima parcela NÃO paga; parcelas abaixo dela já foram quitadas.
      if (parcelaAtualCalc >= d.parcelaAtual && parcelaAtualCalc <= d.parcelasTotal) {
        return sum + d.valorParcela;
      }
      return sum;
    }, 0);

    const totalDespesas = totalFixas + totalVariaveis;
    const previsaoMes = totalReceitas - totalDespesas;
    previsaoAcumulada += previsaoMes;

    projecao.push({
      mes,
      ano,
      label: `${String(mes).padStart(2, "0")}/${ano}`,
      isAtual: i === 0,
      totalReceitas,
      totalDespesas,
      totalFixas,
      totalVariaveis,
      previsaoMes,
      previsaoAcumulada,
    });
  }

  return NextResponse.json({ projecao, saldoBancario });
}

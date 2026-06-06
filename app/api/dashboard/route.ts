import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function calcReceitas(
  receitas: { valor: number; recorrente: boolean; parcelada: boolean; ativa: boolean; data: Date; mesesTotal?: number | null; excecoes?: string[] | null }[],
  inicio: Date,
  fim: Date,
  mes: number,
  ano: number
) {
  const mesKey = `${ano}-${String(mes).padStart(2, "0")}`;
  return receitas
    .filter((r) => {
      if (!r.ativa) return false;
      if (r.parcelada && r.mesesTotal) {
        const diffMeses = (ano - r.data.getUTCFullYear()) * 12 + (mes - 1 - r.data.getUTCMonth());
        return diffMeses >= 0 && diffMeses < r.mesesTotal;
      }
      if (r.recorrente) {
        if (r.data > fim) return false;
        if ((r.excecoes ?? []).includes(mesKey)) return false;
        return true;
      }
      return r.data >= inicio && r.data <= fim;
    })
    .reduce((sum, r) => sum + r.valor, 0);
}

function calcFixas(
  fixas: { valor: number; dataProximoVencimento: Date | null }[],
  fim: Date
) {
  return fixas
    .filter((d) => !d.dataProximoVencimento || d.dataProximoVencimento <= fim)
    .reduce((sum, d) => sum + d.valor, 0);
}

function calcVariaveis(
  variaveis: { valorParcela: number; parcelaAtual: number; parcelasTotal: number; dataInicio: Date }[],
  mes: number,
  ano: number
) {
  return variaveis.reduce((sum, d) => {
    const diffMeses =
      (ano - d.dataInicio.getFullYear()) * 12 + (mes - 1 - d.dataInicio.getMonth());
    const parcelaAtualCalc = d.parcelaAtual + diffMeses;
    if (parcelaAtualCalc >= 1 && parcelaAtualCalc <= d.parcelasTotal) {
      return sum + d.valorParcela;
    }
    return sum;
  }, 0);
}

function groupByCategoria<T extends { categoria: string; valor: number }>(items: T[]) {
  const map: Record<string, number> = {};
  for (const item of items) {
    map[item.categoria] = (map[item.categoria] ?? 0) + item.valor;
  }
  return Object.entries(map)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get("mes") ?? new Date().getMonth() + 1);
  const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const isFuturo = ano * 12 + mes > anoAtual * 12 + mesAtual;

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  const [todasReceitas, todasFixas, todasVariaveis, contasBancarias] = await Promise.all([
    prisma.receita.findMany({ where: { userId: session.user.id } }),
    prisma.despesaFixa.findMany({ where: { userId: session.user.id, ativa: true } }),
    prisma.despesaVariavel.findMany({ where: { userId: session.user.id } }),
    prisma.contaBancaria.findMany({ where: { userId: session.user.id } }),
  ]);

  const saldoBancarioReal = contasBancarias.reduce((sum, c) => sum + c.saldo, 0);

  // Para meses futuros: acumula PSI desde o mês atual até o mês anterior ao solicitado
  let saldoEfetivo = saldoBancarioReal;
  if (isFuturo) {
    let m = mesAtual;
    let a = anoAtual;
    while (a * 12 + m < ano * 12 + mes) {
      const ini = new Date(a, m - 1, 1);
      const fim_m = new Date(a, m, 0, 23, 59, 59);
      const r = calcReceitas(todasReceitas.map(x => ({ ...x, data: new Date(x.data) })), ini, fim_m, m, a);
      const f = calcFixas(todasFixas.map(x => ({ ...x, dataProximoVencimento: x.dataProximoVencimento ? new Date(x.dataProximoVencimento) : null })), fim_m);
      const v = calcVariaveis(todasVariaveis.map(x => ({ ...x, dataInicio: new Date(x.dataInicio) })), m, a);
      saldoEfetivo += r - f - v;
      m++;
      if (m > 12) { m = 1; a++; }
    }
  }

  const receitasFixadas = todasReceitas.map(x => ({ ...x, data: new Date(x.data) }));
  const fixasFixadas = todasFixas.map(x => ({ ...x, dataProximoVencimento: x.dataProximoVencimento ? new Date(x.dataProximoVencimento) : null }));
  const variaveisFixadas = todasVariaveis.map(x => ({ ...x, dataInicio: new Date(x.dataInicio) }));

  const totalReceitas = calcReceitas(receitasFixadas, inicio, fim, mes, ano);
  const totalFixas = calcFixas(fixasFixadas, fim);
  const totalVariaveis = calcVariaveis(variaveisFixadas, mes, ano);
  const totalDespesas = totalFixas + totalVariaveis;
  const psi = saldoEfetivo + totalReceitas - totalDespesas;

  // Breakdown por categoria (para gráficos)
  const fixasFiltradas = fixasFixadas.filter(
    (d) => !d.dataProximoVencimento || d.dataProximoVencimento <= fim
  );
  const categoriasFixas = groupByCategoria(
    fixasFiltradas.map((d) => ({ categoria: (d as { categoria?: string }).categoria ?? "Outros", valor: d.valor }))
  );

  const variaveisFiltradas = variaveisFixadas.filter((d) => {
    const diffMeses =
      (ano - d.dataInicio.getFullYear()) * 12 + (mes - 1 - d.dataInicio.getMonth());
    const parcelaAtualCalc = d.parcelaAtual + diffMeses;
    return parcelaAtualCalc >= 1 && parcelaAtualCalc <= d.parcelasTotal;
  });
  const categoriasVariaveis = groupByCategoria(
    variaveisFiltradas.map((d) => ({ categoria: (d as { categoria?: string }).categoria ?? "Outros", valor: d.valorParcela }))
  );

  const cartaoVariaveis = groupByCategoria(
    variaveisFiltradas.map((d) => ({ categoria: (d as { cartao?: string }).cartao ?? "Sem cartão", valor: d.valorParcela }))
  );

  return NextResponse.json({
    totalReceitas,
    totalDespesas,
    totalFixas,
    totalVariaveis,
    psi,
    saldoBancario: saldoEfetivo,
    isFuturo,
    categoriasFixas,
    categoriasVariaveis,
    cartaoVariaveis,
  });
}

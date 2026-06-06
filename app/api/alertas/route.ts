import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type Alerta = {
  id: string;
  tipo: "receita" | "despesa_fixa" | "despesa_variavel" | "receita_variavel";
  descricao: string;
  valor: number;
  diaVencimento: number;
  diasAteVencimento: number;
  responsavel: string;
  extra?: string;
};

const WINDOW_BEFORE = 2;
const WINDOW_AFTER = 5;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const now = new Date();
  const today = now.getDate();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const mesKey = `${ano}-${String(mes).padStart(2, "0")}`;

  const [receitas, despesasFixas, despesasVariaveis, receitasVariaveis] = await Promise.all([
    prisma.receita.findMany({ where: { userId: session.user.id, ativa: true } }),
    prisma.despesaFixa.findMany({ where: { userId: session.user.id, ativa: true } }),
    prisma.despesaVariavel.findMany({ where: { userId: session.user.id } }),
    prisma.receitaVariavel.findMany({ where: { userId: session.user.id } }),
  ]);

  const alertas: Alerta[] = [];

  // Receitas fixas recorrentes/parceladas
  for (const r of receitas) {
    if (!r.recorrente && !r.parcelada) continue;
    if ((r.excecoes as string[])?.includes(mesKey)) continue;

    if (r.parcelada && r.mesesTotal) {
      const dataInicio = new Date(r.data);
      const diffMeses = (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
      if (diffMeses < 0 || diffMeses >= r.mesesTotal) continue;
    }

    if (r.confirmadaAte) {
      const c = new Date(r.confirmadaAte);
      if (c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes) continue;
    }

    const diaVencimento = new Date(r.data).getUTCDate();
    const diasAte = diaVencimento - today;
    if (diasAte < -WINDOW_BEFORE || diasAte > WINDOW_AFTER) continue;

    alertas.push({
      id: r.id,
      tipo: "receita",
      descricao: r.descricao,
      valor: r.valor,
      diaVencimento,
      diasAteVencimento: diasAte,
      responsavel: r.responsavel,
    });
  }

  // Despesas fixas
  for (const d of despesasFixas) {
    if (d.dataProximoVencimento) {
      const v = new Date(d.dataProximoVencimento);
      const vYear = v.getUTCFullYear();
      const vMonth = v.getUTCMonth() + 1;
      if (vYear > ano || (vYear === ano && vMonth > mes)) continue;
    }

    const diaVencimento = new Date(d.dataInicio).getUTCDate();
    const diasAte = diaVencimento - today;
    if (diasAte < -WINDOW_BEFORE || diasAte > WINDOW_AFTER) continue;

    alertas.push({
      id: d.id,
      tipo: "despesa_fixa",
      descricao: d.descricao,
      valor: d.valor,
      diaVencimento,
      diasAteVencimento: diasAte,
      responsavel: d.responsavel,
    });
  }

  // Despesas variáveis
  for (const d of despesasVariaveis) {
    const dataInicio = new Date(d.dataInicio);
    const diffMeses = (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
    const parcelaAtualCalc = d.parcelaAtual + diffMeses;
    if (parcelaAtualCalc < 1 || parcelaAtualCalc > d.parcelasTotal) continue;

    if (d.confirmadaAte) {
      const c = new Date(d.confirmadaAte);
      if (c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes) continue;
    }

    const diaVencimento = dataInicio.getUTCDate();
    const diasAte = diaVencimento - today;
    if (diasAte < -WINDOW_BEFORE || diasAte > WINDOW_AFTER) continue;

    alertas.push({
      id: d.id,
      tipo: "despesa_variavel",
      descricao: d.descricao,
      valor: d.valorParcela,
      diaVencimento,
      diasAteVencimento: diasAte,
      responsavel: d.responsavel,
      extra: `Parcela ${parcelaAtualCalc}/${d.parcelasTotal} • ${d.cartao}`,
    });
  }

  // Receitas variáveis
  for (const r of receitasVariaveis) {
    const dataInicio = new Date(r.dataInicio);
    const diffMeses = (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
    const parcelaAtualCalc = r.parcelaAtual + diffMeses;
    if (parcelaAtualCalc < 1 || parcelaAtualCalc > r.parcelasTotal) continue;

    if (r.confirmadaAte) {
      const c = new Date(r.confirmadaAte);
      if (c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes) continue;
    }

    const diaVencimento = dataInicio.getUTCDate();
    const diasAte = diaVencimento - today;
    if (diasAte < -WINDOW_BEFORE || diasAte > WINDOW_AFTER) continue;

    alertas.push({
      id: r.id,
      tipo: "receita_variavel",
      descricao: r.descricao,
      valor: r.valorParcela,
      diaVencimento,
      diasAteVencimento: diasAte,
      responsavel: r.responsavel,
      extra: `Parcela ${parcelaAtualCalc}/${r.parcelasTotal}`,
    });
  }

  alertas.sort((a, b) => a.diasAteVencimento - b.diasAteVencimento);

  return NextResponse.json({ alertas });
}

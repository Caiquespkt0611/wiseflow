import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CATEGORIAS_BASE = [
  "Alimentação", "Beleza", "Educação", "Empréstimo", "Finanças", "Investimento",
  "Lazer", "Moradia", "Negócios", "Outros", "Pets", "Plano de Celular",
  "Saúde", "Streaming", "Tecnologia", "Transporte", "Vestuário",
];

/** Alimenta o interpretador com os valores que o usuário já usa de verdade. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userId = session.user.id;

  const [despesasVar, receitasVar, despesasFixas] = await Promise.all([
    prisma.despesaVariavel.findMany({
      where: { userId },
      select: { cartao: true, categoria: true, responsavel: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.receitaVariavel.findMany({
      where: { userId },
      select: { fonte: true, categoria: true, responsavel: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.despesaFixa.findMany({
      where: { userId },
      select: { categoria: true, responsavel: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Mantém a ordem de uso: o que ele mais lançou por último aparece primeiro.
  const unicos = (valores: string[]) => valores.filter((v, i) => v && valores.indexOf(v) === i);

  const cartoes = unicos(despesasVar.map((d) => d.cartao));
  const fontes = unicos(receitasVar.map((r) => r.fonte));
  const responsaveis = unicos([
    ...despesasVar.map((d) => d.responsavel),
    ...receitasVar.map((r) => r.responsavel),
    ...despesasFixas.map((d) => d.responsavel),
  ]);
  const categorias = unicos([
    ...despesasVar.map((d) => d.categoria),
    ...receitasVar.map((r) => r.categoria),
    ...despesasFixas.map((d) => d.categoria),
    ...CATEGORIAS_BASE,
  ]).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return NextResponse.json({
    cartoes,
    fontes,
    categorias,
    responsaveis,
    responsavelPadrao: responsaveis[0] ?? session.user.name ?? "",
  });
}

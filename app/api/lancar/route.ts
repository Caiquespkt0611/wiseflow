import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const base = {
  descricao: z.string().min(1),
  valorTotal: z.number().positive(),
  categoria: z.string().min(1).default("Outros"),
  responsavel: z.string().min(1),
  data: z.string().min(1),
};

const schema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("despesa_variavel"),
    cartao: z.string().min(1),
    parcelasTotal: z.number().int().min(1).max(120),
    ...base,
  }),
  z.object({
    tipo: z.literal("despesa_fixa"),
    ...base,
  }),
  z.object({
    tipo: z.literal("receita_variavel"),
    fonte: z.string().min(1),
    parcelasTotal: z.number().int().min(1).max(120),
    ...base,
  }),
  z.object({
    tipo: z.literal("receita_fixa"),
    tipoReceita: z.string().min(1).default("Outros"),
    ...base,
  }),
]);

/** Arredonda em centavos para a parcela não carregar dízima. */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const dados = schema.parse(await req.json());
    const userId = session.user.id;
    const data = new Date(`${dados.data}T12:00:00.000Z`);

    if (dados.tipo === "despesa_variavel" || dados.tipo === "receita_variavel") {
      const valorParcela = centavos(dados.valorTotal / dados.parcelasTotal);
      const comum = {
        userId,
        descricao: dados.descricao,
        categoria: dados.categoria,
        valorTotal: dados.valorTotal,
        parcelaAtual: 1,
        parcelasTotal: dados.parcelasTotal,
        valorParcela,
        responsavel: dados.responsavel,
        dataInicio: data,
      };

      const criado =
        dados.tipo === "despesa_variavel"
          ? await prisma.despesaVariavel.create({ data: { ...comum, cartao: dados.cartao } })
          : await prisma.receitaVariavel.create({ data: { ...comum, fonte: dados.fonte } });

      return NextResponse.json({ tipo: dados.tipo, registro: criado }, { status: 201 });
    }

    if (dados.tipo === "despesa_fixa") {
      const criado = await prisma.despesaFixa.create({
        data: {
          userId,
          descricao: dados.descricao,
          valor: dados.valorTotal,
          categoria: dados.categoria,
          responsavel: dados.responsavel,
          recorrente: true,
          ativa: true,
          dataInicio: data,
          dataProximoVencimento: data,
        },
      });
      return NextResponse.json({ tipo: dados.tipo, registro: criado }, { status: 201 });
    }

    const criado = await prisma.receita.create({
      data: {
        userId,
        descricao: dados.descricao,
        tipo: dados.tipoReceita,
        valor: dados.valorTotal,
        data,
        responsavel: dados.responsavel,
        recorrente: true,
        parcelada: false,
        ativa: true,
      },
    });
    return NextResponse.json({ tipo: dados.tipo, registro: criado }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

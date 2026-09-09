import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { centavos, dataInicioFatura, mesRefValido } from "@/lib/fatura";

const novoSchema = z.object({
  descricao: z.string().min(1).max(120),
  valorParcela: z.number().positive(),
  parcelaAtual: z.number().int().min(1).max(120),
  parcelasTotal: z.number().int().min(1).max(120),
  categoria: z.string().min(1).max(40),
  responsavel: z.string().min(1).max(40),
  dataCompra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const schema = z.object({
  cartao: z.string().min(1).max(60),
  mesRef: z.string().refine(mesRefValido, "mês inválido"),
  totalInformado: z.number().nullable(),
  totalLido: z.number(),
  itensLidos: z.number().int().min(0),
  arquivos: z.array(z.string().max(200)).max(8).default([]),
  criar: z.array(novoSchema).max(300).default([]),
  conferir: z.array(z.string().min(1)).max(300).default([]),
});

/** Grava a importação inteira: ou entra tudo, ou não entra nada. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const dados = schema.parse(await req.json());
    const userId = session.user.id;

    if (dados.criar.length === 0 && dados.conferir.length === 0) {
      return NextResponse.json({ error: "nada_a_fazer" }, { status: 400 });
    }
    if (dados.criar.some((c) => c.parcelaAtual > c.parcelasTotal)) {
      return NextResponse.json({ error: "parcela_invalida" }, { status: 400 });
    }

    // Ninguém marca como conferida uma despesa que não é dele.
    const ids = Array.from(new Set(dados.conferir));
    if (ids.length > 0) {
      const donas = await prisma.despesaVariavel.count({ where: { id: { in: ids }, userId } });
      if (donas !== ids.length) {
        return NextResponse.json({ error: "despesa_nao_encontrada" }, { status: 404 });
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const importacao = await tx.importacaoFatura.create({
        data: {
          userId,
          cartao: dados.cartao,
          mesRef: dados.mesRef,
          totalInformado: dados.totalInformado,
          totalLido: dados.totalLido,
          itensLidos: dados.itensLidos,
          criadas: dados.criar.length,
          conferidas: ids,
          arquivos: dados.arquivos,
        },
      });

      if (dados.criar.length > 0) {
        await tx.despesaVariavel.createMany({
          data: dados.criar.map((c) => ({
            userId,
            descricao: c.descricao,
            cartao: dados.cartao,
            categoria: c.categoria,
            valorTotal: centavos(c.valorParcela * c.parcelasTotal),
            parcelaAtual: c.parcelaAtual,
            parcelasTotal: c.parcelasTotal,
            valorParcela: centavos(c.valorParcela),
            responsavel: c.responsavel,
            dataInicio: dataInicioFatura(dados.mesRef, c.dataCompra),
            origem: "fatura",
            importacaoId: importacao.id,
            conferidaEm: new Date(),
          })),
        });
      }

      if (ids.length > 0) {
        await tx.despesaVariavel.updateMany({
          where: { id: { in: ids }, userId },
          data: { conferidaEm: new Date() },
        });
      }

      return importacao;
    });

    return NextResponse.json(
      { id: resultado.id, criadas: dados.criar.length, conferidas: ids.length },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("fatura/confirmar:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Últimas importações, para conferir e desfazer. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const importacoes = await prisma.importacaoFatura.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return NextResponse.json(
    importacoes.map((i) => ({
      id: i.id,
      cartao: i.cartao,
      mesRef: i.mesRef,
      totalLido: i.totalLido,
      totalInformado: i.totalInformado,
      itensLidos: i.itensLidos,
      criadas: i.criadas,
      conferidas: i.conferidas.length,
      arquivos: i.arquivos,
      createdAt: i.createdAt,
    }))
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  descricao: z.string().min(1).optional(),
  cartao: z.string().min(1).optional(),
  categoria: z.string().optional(),
  valorTotal: z.number().positive().optional(),
  parcelaAtual: z.number().int().min(1).optional(),
  parcelasTotal: z.number().int().min(1).optional(),
  valorParcela: z.number().positive().optional(),
  responsavel: z.string().min(1).optional(),
  dataInicio: z.string().optional(),
  confirmadaAte: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const despesa = await prisma.despesaVariavel.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!despesa) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const updated = await prisma.despesaVariavel.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(data.dataInicio && { dataInicio: new Date(data.dataInicio) }),
        ...(data.confirmadaAte !== undefined && {
          confirmadaAte: data.confirmadaAte ? new Date(data.confirmadaAte) : null,
        }),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const despesa = await prisma.despesaVariavel.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!despesa) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.despesaVariavel.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

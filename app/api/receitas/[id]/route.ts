import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  descricao: z.string().min(1).optional(),
  tipo: z.string().min(1).optional(),
  valor: z.number().optional(),
  data: z.string().optional(),
  responsavel: z.string().min(1).optional(),
  recorrente: z.boolean().optional(),
  parcelada: z.boolean().optional(),
  mesesTotal: z.number().int().positive().optional().nullable(),
  excecoes: z.array(z.string()).optional(),
  ativa: z.boolean().optional(),
  confirmadaAte: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const receita = await prisma.receita.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!receita) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const updated = await prisma.receita.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(data.data && { data: new Date(data.data) }),
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

  const receita = await prisma.receita.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!receita) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.receita.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

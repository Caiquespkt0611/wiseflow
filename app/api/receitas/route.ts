import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  descricao: z.string().min(1),
  tipo: z.string().min(1),
  valor: z.number(),
  data: z.string(),
  responsavel: z.string().min(1),
  recorrente: z.boolean().default(false),
  parcelada: z.boolean().default(false),
  mesesTotal: z.number().int().positive().optional().nullable(),
  excecoes: z.array(z.string()).default([]),
  ativa: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");
  const ano = searchParams.get("ano");

  let where: Record<string, unknown> = { userId: session.user.id };

  if (mes && ano) {
    const inicio = new Date(Number(ano), Number(mes) - 1, 1);
    const fim = new Date(Number(ano), Number(mes), 0, 23, 59, 59);
    where = {
      ...where,
      OR: [
        { data: { gte: inicio, lte: fim } },
        { recorrente: true, ativa: true },
      ],
    };
  }

  const receitas = await prisma.receita.findMany({
    where,
    orderBy: { data: "desc" },
  });

  return NextResponse.json(receitas);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const receita = await prisma.receita.create({
      data: { ...data, data: new Date(data.data), userId: session.user.id },
    });

    return NextResponse.json(receita, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

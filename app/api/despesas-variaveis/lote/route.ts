import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Atualização em lote (ex: botão "Pagar tudo" de um cartão).
// Aplica todas as mudanças numa única transação: ou todas passam, ou nenhuma.
// Isso evita o pagamento parcial que acontecia com N requests paralelos.
const updateSchema = z.object({
  id: z.string().min(1),
  dataInicio: z.string().optional(),
  confirmadaAte: z.string().nullable().optional(),
  parcelaAtual: z.number().int().optional(),
});

const schema = z.object({
  updates: z.array(updateSchema).min(1),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { updates } = schema.parse(body);

    // Garante que todas as despesas pertencem ao usuário antes de tocar em qualquer uma.
    const ids = updates.map((u) => u.id);
    const owned = await prisma.despesaVariavel.findMany({
      where: { id: { in: ids }, userId: session.user.id },
      select: { id: true },
    });
    if (owned.length !== new Set(ids).size) {
      return NextResponse.json({ error: "Despesa não encontrada" }, { status: 404 });
    }

    const result = await prisma.$transaction(
      updates.map((u) =>
        prisma.despesaVariavel.update({
          where: { id: u.id },
          data: {
            ...(u.parcelaAtual !== undefined && { parcelaAtual: u.parcelaAtual }),
            ...(u.dataInicio && { dataInicio: new Date(u.dataInicio) }),
            ...(u.confirmadaAte !== undefined && {
              confirmadaAte: u.confirmadaAte ? new Date(u.confirmadaAte) : null,
            }),
          },
        })
      )
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

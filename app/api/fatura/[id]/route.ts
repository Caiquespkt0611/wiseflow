import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Desfaz a importação: apaga o que ela criou e devolve ao estado anterior o que
 * ela apenas marcou como conferido. É isso que substitui o "zerar o mês": se a
 * leitura saiu torta, ele volta atrás num clique sem tocar em nada que já existia.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userId = session.user.id;
  const importacao = await prisma.importacaoFatura.findFirst({
    where: { id: params.id, userId },
  });
  if (!importacao) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  try {
    const apagadas = await prisma.$transaction(async (tx) => {
      const removidas = await tx.despesaVariavel.deleteMany({
        where: { importacaoId: importacao.id, userId },
      });

      if (importacao.conferidas.length > 0) {
        await tx.despesaVariavel.updateMany({
          where: { id: { in: importacao.conferidas }, userId },
          data: { conferidaEm: null },
        });
      }

      await tx.importacaoFatura.delete({ where: { id: importacao.id } });
      return removidas.count;
    });

    return NextResponse.json({ apagadas, desconferidas: importacao.conferidas.length });
  } catch (error) {
    console.error("fatura/desfazer:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

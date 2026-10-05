import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hojeUTC, parcelasEmAberto, amortizar } from "@/lib/emprestimos";

/**
 * Ações sobre um empréstimo:
 *   pagar      a próxima parcela saiu da conta (como o "pago" das contas do mês)
 *   desfazer   volta o último "pagar"
 *   antecipar  as N últimas parcelas foram quitadas no banco
 *   amortizar  pagou um valor e a parcela diminuiu (mesmo prazo)
 *   quitar     o contrato foi quitado inteiro hoje
 *   reabrir    desfaz uma quitação marcada por engano
 *   editar     corrige dados do contrato (taxa, apelido, parcela...)
 */
const schema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("pagar") }),
  z.object({ acao: z.literal("desfazer") }),
  z.object({ acao: z.literal("antecipar"), parcelas: z.number().int().min(1) }),
  z.object({ acao: z.literal("desfazerAntecipacao"), parcelas: z.number().int().min(1) }),
  z.object({ acao: z.literal("amortizar"), valor: z.number().positive() }),
  z.object({ acao: z.literal("quitar") }),
  z.object({ acao: z.literal("reabrir") }),
  z.object({
    acao: z.literal("editar"),
    dados: z
      .object({
        apelido: z.string().min(1),
        taxaMensal: z.number().positive(),
        valorParcela: z.number().positive(),
        proximaParcela: z.number().int().min(1),
        pagamento: z.enum(["conta", "folha", "fgts"]),
        observacao: z.string().nullable(),
      })
      .partial(),
  }),
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const e = await prisma.emprestimo.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!e) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const hoje = hojeUTC();
    const abertas = parcelasEmAberto(e, hoje);
    let data: Parameters<typeof prisma.emprestimo.update>[0]["data"];

    switch (body.acao) {
      case "pagar":
        if (!abertas.length) return NextResponse.json({ error: "Não há parcela em aberto" }, { status: 400 });
        data = { proximaParcela: abertas[0] + 1 };
        break;
      case "desfazer":
        data = { proximaParcela: Math.max(1, e.proximaParcela - 1) };
        break;
      case "antecipar":
        if (body.parcelas > abertas.length) return NextResponse.json({ error: "Mais parcelas do que as em aberto" }, { status: 400 });
        data = { parcelasAntecipadas: e.parcelasAntecipadas + body.parcelas };
        break;
      case "desfazerAntecipacao":
        data = { parcelasAntecipadas: Math.max(0, e.parcelasAntecipadas - body.parcelas) };
        break;
      case "amortizar": {
        const r = amortizar(e, body.valor, hoje);
        const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const nota = r.quitou
          ? `Quitado com amortização de ${brl(body.valor)} em ${hoje.toISOString().slice(0, 10)}.`
          : `Amortizado ${brl(body.valor)} em ${hoje.toISOString().slice(0, 10)}: parcela de ${brl(r.parcelaAntes)} para ${brl(r.parcelaDepois)}.`;
        data = r.quitou
          ? { quitadoEm: hoje, observacao: [e.observacao, nota].filter(Boolean).join(" ") }
          : {
              valorParcela: r.emprestimo.valorParcela,
              valoresParcelas: r.emprestimo.valoresParcelas,
              observacao: [e.observacao, nota].filter(Boolean).join(" "),
            };
        break;
      }
      case "quitar":
        data = { quitadoEm: hoje };
        break;
      case "reabrir":
        data = { quitadoEm: null };
        break;
      case "editar":
        data = body.dados;
        break;
    }

    const atualizado = await prisma.emprestimo.update({ where: { id: e.id }, data });
    return NextResponse.json(atualizado);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

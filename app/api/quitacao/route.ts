import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { carregarDados } from "@/lib/dados-usuario";
import { projetar, mesesBase, cartaoSugerido } from "@/lib/projecao";
import {
  hojeUTC,
  simularPlano,
  reservaSugerida,
  parcelasEmAberto,
  vencimento,
  valorDaParcela,
  custoQuitar,
  restanteNominal,
  abertasNaData,
} from "@/lib/emprestimos";

/**
 * O plano de quitação é calculado na hora, nunca gravado: muda sozinho quando
 * entra uma receita nova, quando um empréstimo é antecipado ou quando o saldo
 * da conta é atualizado. Só a reserva e o piso do cartão ficam salvos.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = session.user.id;

  const [{ dados, saldoBancario }, usuario] = await Promise.all([
    carregarDados(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { reservaMinima: true, cartaoMensal: true } }),
  ]);

  const hoje = hojeUTC();
  const mesBase = hoje.getUTCMonth() + 1;
  const anoBase = hoje.getUTCFullYear();
  // Mesmo período da Projeção: até dezembro do ano que vem, que é até onde
  // existe receita lançada. Depois disso o plano estaria chutando.
  const totalMeses = 12 - mesBase + 1 + 12;
  const projecao = projetar(dados, saldoBancario, mesBase, anoBase, totalMeses, hoje);

  const { searchParams } = new URL(req.url);
  const numero = (nome: string) => {
    const v = searchParams.get(nome);
    return v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  };

  const cartaoSug = cartaoSugerido(projecao);
  const cartao = numero("cartao") ?? usuario?.cartaoMensal ?? cartaoSug;
  const base = mesesBase(projecao, cartao);

  const parcelasMes = dados.emprestimos
    .filter((e) => e.pagamento === "conta")
    .reduce((s, e) => s + (parcelasEmAberto(e, hoje).length ? e.valorParcela : 0), 0);
  const reservaSug = reservaSugerida(base, parcelasMes);
  const reserva = numero("reserva") ?? usuario?.reservaMinima ?? reservaSug;

  const plano = simularPlano({ meses: base, saldoInicial: saldoBancario, emprestimos: dados.emprestimos, reserva, hoje });

  const emprestimos = dados.emprestimos.map((e) => {
    const abertas = parcelasEmAberto(e, hoje);
    const ultima = abertas[abertas.length - 1];
    const naData = abertasNaData(e, hoje, hoje);
    return {
      ...e,
      abertas: abertas.length,
      pagas: abertas.length ? abertas[0] - 1 : e.parcelasTotal - e.parcelasAntecipadas,
      proximoVencimento: abertas.length ? vencimento(e, abertas[0]).toISOString() : null,
      proximoValor: abertas.length ? valorDaParcela(e, abertas[0]) : 0,
      terminaEm: ultima ? vencimento(e, ultima).toISOString() : null,
      restante: restanteNominal(e, hoje),
      quitarHoje: custoQuitar(e, hoje, hoje),
      atrasadas: abertas.length - naData.length,
    };
  });

  return NextResponse.json({
    hoje: hoje.toISOString(),
    saldoBancario,
    config: { reserva, reservaSugerida: reservaSug, cartao, cartaoSugerido: cartaoSug, salvo: { reserva: usuario?.reservaMinima ?? null, cartao: usuario?.cartaoMensal ?? null } },
    emprestimos,
    plano,
  });
}

const configSchema = z.object({
  reservaMinima: z.number().min(0).nullable(),
  cartaoMensal: z.number().min(0).nullable(),
});

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const data = configSchema.parse(await req.json());
    await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

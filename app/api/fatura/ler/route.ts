import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  conciliar, centavos, mesRefValido, mesmoCartao, parcelaNoMes, totalDaFatura,
  type DespesaNoMes,
} from "@/lib/fatura";
import { lerFatura, TIPOS_ACEITOS, type Arquivo } from "@/lib/fatura-leitura";

// Ler uma fatura inteira demora mais que o padrão de 10s da Vercel.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ARQUIVOS = 8;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Leitura de imagem não tem interpretador local de reserva, ao contrário da voz.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sem_chave" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "envio_invalido" }, { status: 400 });
  }

  const cartao = String(form.get("cartao") ?? "").trim();
  const mesRef = String(form.get("mesRef") ?? "").trim();
  const totalBruto = String(form.get("totalInformado") ?? "").trim();
  const totalInformado = totalBruto && Number.isFinite(Number(totalBruto)) ? Number(totalBruto) : null;
  const enviados = form.getAll("arquivos").filter((a): a is File => a instanceof File);

  if (!cartao) return NextResponse.json({ error: "sem_cartao" }, { status: 400 });
  if (!mesRefValido(mesRef)) return NextResponse.json({ error: "mes_invalido" }, { status: 400 });
  if (enviados.length === 0) return NextResponse.json({ error: "sem_arquivo" }, { status: 400 });
  if (enviados.length > MAX_ARQUIVOS) return NextResponse.json({ error: "arquivos_demais" }, { status: 400 });

  let soma = 0;
  for (const arquivo of enviados) {
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      return NextResponse.json({ error: "tipo_nao_aceito", detalhe: arquivo.name }, { status: 400 });
    }
    soma += arquivo.size;
    if (arquivo.size > MAX_BYTES || soma > MAX_TOTAL) {
      return NextResponse.json({ error: "arquivo_grande", detalhe: arquivo.name }, { status: 400 });
    }
  }

  const userId = session.user.id;
  const [ano, mes] = mesRef.split("-").map(Number);

  try {
    const arquivos: Arquivo[] = await Promise.all(
      enviados.map(async (a) => ({
        nome: a.name,
        tipo: a.type,
        base64: Buffer.from(await a.arrayBuffer()).toString("base64"),
      }))
    );

    const [categoriasUsadas, todas] = await Promise.all([
      prisma.despesaVariavel.findMany({ where: { userId }, select: { categoria: true }, distinct: ["categoria"] }),
      prisma.despesaVariavel.findMany({ where: { userId } }),
    ]);

    const leitura = await lerFatura(
      arquivos,
      cartao,
      mesRef,
      categoriasUsadas.map((c) => c.categoria)
    );
    if (!leitura) return NextResponse.json({ error: "sem_resposta" }, { status: 502 });

    // Só entram na conciliação as despesas daquele cartão que caem no mês da fatura.
    const despesas: DespesaNoMes[] = todas
      .filter((d) => mesmoCartao(d.cartao, cartao))
      .map((d) => {
        const parcela = parcelaNoMes(
          { dataInicio: new Date(d.dataInicio), parcelaAtual: d.parcelaAtual, parcelasTotal: d.parcelasTotal },
          ano,
          mes
        );
        return parcela === null
          ? null
          : {
              id: d.id,
              descricao: d.descricao,
              cartao: d.cartao,
              categoria: d.categoria,
              responsavel: d.responsavel,
              valorParcela: d.valorParcela,
              parcelaNoMes: parcela,
              parcelasTotal: d.parcelasTotal,
            };
      })
      .filter((d): d is DespesaNoMes => d !== null);

    const conciliacao = conciliar(leitura.itens, despesas);
    const totalLido = totalDaFatura(leitura.itens);
    const referencia = totalInformado ?? leitura.totalImpresso;

    return NextResponse.json({
      cartao,
      mesRef,
      totalLido,
      totalInformado,
      totalImpresso: leitura.totalImpresso,
      diferenca: referencia === null ? null : centavos(totalLido - referencia),
      itensLidos: leitura.itens.length,
      arquivos: arquivos.map((a) => a.nome),
      avisos: leitura.avisos,
      ...conciliacao,
    });
  } catch (error) {
    console.error("fatura/ler:", error);
    return NextResponse.json({ error: "falha_leitura" }, { status: 502 });
  }
}

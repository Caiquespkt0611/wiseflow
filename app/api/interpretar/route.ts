import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

/** O que o Claude precisa devolver. Mesmo formato do interpretador local. */
const Saida = z.object({
  tipo: z.enum(["despesa_fixa", "despesa_variavel", "receita_fixa", "receita_variavel"]),
  descricao: z.string(),
  valorTotal: z.number().nullable(),
  parcelasTotal: z.number().int().min(1).max(120),
  cartao: z.string(),
  categoria: z.string(),
  responsavel: z.string(),
  data: z.string(),
  conferir: z.array(z.string()),
});

const entrada = z.object({
  fala: z.string().min(1).max(500),
  cartoes: z.array(z.string()).max(50).default([]),
  fontes: z.array(z.string()).max(50).default([]),
  categorias: z.array(z.string()).max(60).default([]),
  responsaveis: z.array(z.string()).max(20).default([]),
  // Data de hoje no aparelho de quem fala. O servidor roda em UTC: depois das 21h
  // de Brasília ele já está no dia seguinte e o lançamento caía na data errada.
  hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function instrucoes(dados: z.infer<typeof entrada>, hoje: string): string {
  return [
    "Você transforma uma frase falada em português em um lançamento financeiro do WiseFlow.",
    `Hoje é ${hoje}.`,
    "",
    "Os quatro tipos:",
    "- despesa_variavel: compra no cartão, parcelada ou à vista. Exige cartão.",
    "- despesa_fixa: conta que se repete todo mês (aluguel, academia, assinatura). Não tem cartão nem parcelas.",
    "- receita_variavel: dinheiro que entra em uma ou mais parcelas. O campo cartao guarda a fonte.",
    "- receita_fixa: entrada recorrente, como salário.",
    "",
    "Regras:",
    "- valorTotal é o valor cheio da compra, não o da parcela. Se ele disser o valor da parcela, multiplique pelo número de parcelas.",
    "- parcelasTotal é 1 quando não houver parcelamento.",
    "- data no formato yyyy-mm-dd. Sem data dita, use hoje. Entenda ontem, anteontem e 'dia 12'.",
    "- descricao curta, sem verbo de comando: 'Tênis', não 'Comprei um tênis'.",
    "- cartao, categoria e responsavel devem sair das listas abaixo. Só invente um valor novo se nada da lista servir.",
    "- conferir lista os campos que ficaram incertos, usando exatamente estas palavras: valor, cartão, fonte, categoria, descrição, data. Vazio quando tudo estiver claro.",
    "",
    `Cartões: ${dados.cartoes.join(" | ") || "nenhum"}`,
    `Fontes de receita: ${dados.fontes.join(" | ") || "nenhuma"}`,
    `Categorias: ${dados.categorias.join(" | ") || "Outros"}`,
    `Responsáveis: ${dados.responsaveis.join(" | ") || "não informado"}`,
    `Responsável padrão: ${dados.responsaveis[0] ?? ""}`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    // Sem chave configurada o cliente usa o interpretador local.
    return NextResponse.json({ error: "sem_chave" }, { status: 503 });
  }

  try {
    const dados = entrada.parse(await req.json());
    const hoje = dados.hoje ?? new Date().toISOString().slice(0, 10);
    const client = new Anthropic();

    const resposta = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2000,
      system: instrucoes(dados, hoje),
      messages: [{ role: "user", content: dados.fala }],
      output_config: {
        effort: "low",
        format: zodOutputFormat(Saida),
      },
    });

    if (!resposta.parsed_output) {
      return NextResponse.json({ error: "sem_resposta" }, { status: 502 });
    }

    return NextResponse.json({ ...resposta.parsed_output, transcricao: dados.fala });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("interpretar:", error);
    return NextResponse.json({ error: "falha_claude" }, { status: 502 });
  }
}

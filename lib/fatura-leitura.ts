/**
 * A parte da importação de fatura que fala com o Claude: o formato pedido, as
 * instruções e a limpeza do que voltou. Fica fora da rota para poder ser testada
 * sem subir o Next e sem sessão.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { centavos, type ItemFatura } from "@/lib/fatura";

export const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const Item = z.object({
  descricao: z.string(),
  valor: z.number(),
  parcelaAtual: z.number().int().nullable(),
  parcelasTotal: z.number().int().nullable(),
  dataCompra: z.string().nullable(),
  categoria: z.string(),
  linha: z.enum(["compra", "encargo", "estorno", "pagamento"]),
});

const Saida = z.object({
  itens: z.array(Item),
  totalImpresso: z.number().nullable(),
  avisos: z.array(z.string()),
});

export interface Arquivo {
  nome: string;
  tipo: string;
  base64: string;
}

export function instrucoes(cartao: string, mesRef: string, categorias: string[]): string {
  return [
    "Você lê faturas de cartão de crédito brasileiras e devolve as linhas de lançamento.",
    `A fatura é do cartão ${cartao}, referência ${mesRef}.`,
    "Os arquivos podem ser páginas ou prints de uma mesma fatura. Leia todos e devolva uma lista só, sem repetir linha.",
    "",
    "Para cada linha:",
    "- descricao: o nome do estabelecimento limpo, sem código de maquininha, sem cidade e sem a marcação de parcela. 'PAGSEGURO *TENIS SP 03/10' vira 'Tênis'. Quando não der para entender, mantenha o texto original.",
    "- valor: o valor cobrado nesta fatura, sempre positivo. Em compra parcelada é o valor da parcela, não o da compra inteira.",
    "- parcelaAtual e parcelasTotal: quando a linha mostrar '03/10', devolva 3 e 10. Compra à vista devolve null nos dois.",
    "- dataCompra: a data impressa na linha, em yyyy-mm-dd. Sem data, null. O ano quase nunca aparece na fatura, deduza pelo mês de referência.",
    "- categoria: escolha uma da lista abaixo. Só invente outra se nenhuma servir.",
    "- linha: classifique o que é aquela linha.",
    "  compra: consumo normal, inclusive assinatura e parcelamento.",
    "  encargo: anuidade, juros, multa, IOF, seguro, tarifa.",
    "  estorno: crédito, devolução, cashback, ajuste a favor do cliente.",
    "  pagamento: pagamento da fatura anterior, saldo anterior, débito automático da própria fatura.",
    "",
    "Não invente linha que não está na imagem e não some valores por conta própria.",
    "totalImpresso: o total desta fatura como está escrito nela. Se não aparecer, null.",
    "avisos: o que ficou ilegível, cortado ou duvidoso. Vazio quando a leitura foi limpa.",
    "",
    `Categorias: ${categorias.join(" | ") || "Outros"}`,
  ].join("\n");
}

export interface LeituraBruta {
  itens: ItemFatura[];
  totalImpresso: number | null;
  avisos: string[];
}

/** Manda a fatura para o Claude e devolve as linhas já saneadas. */
export async function lerFatura(
  arquivos: Arquivo[],
  cartao: string,
  mesRef: string,
  categorias: string[]
): Promise<LeituraBruta | null> {
  const conteudo: Anthropic.ContentBlockParam[] = arquivos.map((arquivo) =>
    arquivo.tipo === "application/pdf"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: arquivo.base64 },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: arquivo.tipo as "image/jpeg" | "image/png" | "image/webp",
            data: arquivo.base64,
          },
        }
  );
  conteudo.push({ type: "text", text: "Leia esta fatura e devolva as linhas." });

  const client = new Anthropic();
  const resposta = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: instrucoes(cartao, mesRef, categorias),
    messages: [{ role: "user", content: conteudo }],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(Saida),
    },
  });

  if (!resposta.parsed_output) return null;

  const itens: ItemFatura[] = resposta.parsed_output.itens
    .filter((i) => Number.isFinite(i.valor) && i.valor !== 0)
    .map((i) => ({
      descricao: i.descricao.trim() || "Sem descrição",
      valor: centavos(Math.abs(i.valor)),
      parcelaAtual: i.parcelaAtual && i.parcelaAtual > 0 ? i.parcelaAtual : null,
      parcelasTotal: i.parcelasTotal && i.parcelasTotal > 0 ? i.parcelasTotal : null,
      dataCompra: i.dataCompra && /^\d{4}-\d{2}-\d{2}$/.test(i.dataCompra) ? i.dataCompra : null,
      categoria: i.categoria?.trim() || "Outros",
      linha: i.linha,
    }));

  return {
    itens,
    totalImpresso: resposta.parsed_output.totalImpresso,
    avisos: resposta.parsed_output.avisos ?? [],
  };
}

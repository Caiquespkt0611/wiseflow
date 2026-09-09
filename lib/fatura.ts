/**
 * Conciliação de fatura de cartão.
 *
 * A regra que manda aqui é a mesma do dashboard: uma despesa variável não é o
 * gasto de um mês, é a compra inteira. Ela aparece num mês quando
 * parcelaAtual + (meses desde dataInicio) ainda cabe dentro de parcelasTotal.
 * Por isso a fatura nunca substitui o mês: ela concilia contra o que já existe.
 */

/** Uma linha lida da fatura. */
export interface ItemFatura {
  descricao: string;
  /** Valor cobrado nesta fatura. Para compra parcelada é o valor da parcela. */
  valor: number;
  parcelaAtual: number | null;
  parcelasTotal: number | null;
  /** Data da compra impressa na fatura, quando existir (yyyy-mm-dd). */
  dataCompra: string | null;
  categoria: string;
  linha: LinhaFatura;
}

export type LinhaFatura = "compra" | "encargo" | "estorno" | "pagamento";

/** Uma despesa já cadastrada, projetada no mês da fatura. */
export interface DespesaNoMes {
  id: string;
  descricao: string;
  cartao: string;
  categoria: string;
  responsavel: string;
  valorParcela: number;
  parcelaNoMes: number;
  parcelasTotal: number;
}

export type Confianca = "alta" | "media" | "baixa";

export interface Pareado {
  item: ItemFatura;
  despesa: DespesaNoMes;
  confianca: Confianca;
}

export interface Conciliacao {
  jaTem: Pareado[];
  novos: ItemFatura[];
  sumiu: DespesaNoMes[];
  ignorados: ItemFatura[];
}

/** Centavos batem, não reais: R$ 0,01 de folga cobre arredondamento de parcela. */
const FOLGA = 0.015;

const RUIDO = new Set([
  "parc", "parcela", "parcelado", "de", "da", "do", "e", "ltda", "me", "sa", "s",
  "eireli", "com", "comercio", "servicos", "brasil", "br", "sp", "rj", "pr", "pagamento",
  "compra", "cartao", "credito", "debito",
]);

/** Deixa a descrição comparável: sem acento, sem símbolo e sem o ruído da maquininha. */
export function normalizar(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !RUIDO.has(t) && !/^\d+$/.test(t));
}

/** Compara nome de cartão ignorando acento, caixa e espaço sobrando. */
export function mesmoCartao(a: string, b: string): boolean {
  const limpar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return limpar(a) === limpar(b);
}

/**
 * Jaccard entre os tokens, aceitando token contido em token: a fatura escreve
 * "MERCADOLIVRE" onde o cadastro diz "Mercado Livre". Serve só para desempatar,
 * nunca para casar sozinho.
 */
export function similaridade(a: string, b: string): number {
  const ta = normalizar(a);
  const tb = normalizar(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const parece = (x: string, y: string) =>
    x === y || (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)));

  const comuns = ta.filter((x) => tb.some((y) => parece(x, y))).length;
  return comuns / (ta.length + tb.length - comuns);
}

/**
 * Qual parcela desta despesa cai no mês pedido. Devolve null quando a despesa
 * não aparece no mês. Espelha calcVariaveis do dashboard, inclusive o uso de UTC.
 */
export function parcelaNoMes(
  despesa: { dataInicio: Date; parcelaAtual: number; parcelasTotal: number },
  ano: number,
  mes: number
): number | null {
  const diff =
    (ano - despesa.dataInicio.getUTCFullYear()) * 12 +
    (mes - 1 - despesa.dataInicio.getUTCMonth());
  const parcela = despesa.parcelaAtual + diff;
  if (diff < 0 || parcela > despesa.parcelasTotal) return null;
  return parcela;
}

/**
 * Casa os itens da fatura com as despesas já cadastradas.
 *
 * O valor da parcela é a chave forte: descrição de fatura é lixo ("PAGSEGURO *XYZ")
 * e dois valores idênticos no mesmo cartão e mês são raros. A descrição só desempata
 * quando mais de uma despesa tem o mesmo valor.
 */
export function conciliar(itens: ItemFatura[], despesas: DespesaNoMes[]): Conciliacao {
  const ignorados = itens.filter((i) => i.linha === "pagamento" || i.linha === "estorno");
  const cobrancas = itens.filter((i) => i.linha === "compra" || i.linha === "encargo");

  const livres = new Map(despesas.map((d) => [d.id, d]));
  const jaTem: Pareado[] = [];
  const pendentes = [...cobrancas];

  const candidatos = (item: ItemFatura) =>
    Array.from(livres.values())
      .filter((d) => Math.abs(d.valorParcela - item.valor) <= FOLGA)
      .sort((a, b) => similaridade(item.descricao, b.descricao) - similaridade(item.descricao, a.descricao));

  const casar = (item: ItemFatura, despesa: DespesaNoMes, confianca: Confianca) => {
    livres.delete(despesa.id);
    jaTem.push({ item, despesa, confianca });
    pendentes.splice(pendentes.indexOf(item), 1);
  };

  // 1) valor e parcela batendo ("3/10" na fatura contra a 3ª parcela prevista).
  for (const item of [...pendentes]) {
    if (!item.parcelaAtual || !item.parcelasTotal) continue;
    const achou = candidatos(item).find(
      (d) => d.parcelaNoMes === item.parcelaAtual && d.parcelasTotal === item.parcelasTotal
    );
    if (achou) casar(item, achou, "alta");
  }

  // 2) valor batendo e descrição parecida.
  for (const item of [...pendentes]) {
    const achou = candidatos(item).find((d) => similaridade(item.descricao, d.descricao) >= 0.34);
    if (achou) casar(item, achou, "media");
  }

  // 3) valor batendo e só uma despesa possível. Sem descrição parecida, então é o
  //    balde que ele mais precisa conferir.
  for (const item of [...pendentes]) {
    const lista = candidatos(item);
    if (lista.length === 1) casar(item, lista[0], "baixa");
  }

  return { jaTem, novos: pendentes, sumiu: Array.from(livres.values()), ignorados };
}

/** Soma o que a fatura cobra de verdade: compras e encargos menos estornos. */
export function totalDaFatura(itens: ItemFatura[]): number {
  const soma = itens.reduce((total, i) => {
    if (i.linha === "compra" || i.linha === "encargo") return total + i.valor;
    if (i.linha === "estorno") return total - i.valor;
    return total;
  }, 0);
  return centavos(soma);
}

export function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Data que alinha a parcela com o mês da fatura. O dashboard só olha mês e ano de
 * dataInicio, então a compra precisa ancorar no mês de referência: gravar a data
 * real de uma compra antiga jogaria a parcela para o mês errado.
 */
export function dataInicioFatura(mesRef: string, dataCompra: string | null): Date {
  const [ano, mes] = mesRef.split("-").map(Number);
  let dia = 10;
  if (dataCompra && dataCompra.startsWith(mesRef)) {
    const lido = Number(dataCompra.slice(8, 10));
    if (lido >= 1 && lido <= 28) dia = lido;
  }
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
}

export function mesRefValido(mesRef: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(mesRef)) return false;
  const mes = Number(mesRef.slice(5));
  return mes >= 1 && mes <= 12;
}

export function rotuloMes(mesRef: string): string {
  const [ano, mes] = mesRef.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(ano, mes - 1, 1)));
}

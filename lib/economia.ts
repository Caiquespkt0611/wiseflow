import type { DespesaVariavel, DespesaFixa, ReceitaVariavel } from "@prisma/client";

/**
 * Onde o dinheiro está indo e o que dá para cortar. Regras simples sobre os
 * lançamentos, sem IA: cada achado mostra de onde veio, para dar para conferir.
 *
 * O olhar é o que sai por mês, não o valor da compra: uma TV de R$ 2 mil em 10x
 * pesa R$ 200 no mês, e é isso que aperta a conta.
 */

export interface ItemGasto {
  id: string;
  descricao: string;
  onde: string; // cartão ou "Conta do mês"
  categoria: string;
  porMes: number;
  restam?: number; // parcelas que faltam, se for parcelado
  reembolsado?: boolean;
}

export interface Achado {
  chave: string;
  titulo: string;
  porMes: number;
  porAno: number;
  texto: string;
  destaque?: string; // no lugar de "por mês", quando média não faz sentido
  itens: ItemGasto[];
  tom: "corte" | "atencao" | "info";
}

export interface Categoria {
  categoria: string;
  porMes: number;
  fatia: number; // 0..1
}

export interface Economia {
  meses: number; // quantos meses entraram na média
  saidaMedia: number;
  categorias: Categoria[];
  achados: Achado[];
}

const NEGOCIO = /neg[oó]cio/i;
const JUROS = /juros|multa|atraso|encargo|rotativo|anuidade|\biof\b/i;
const DELIVERY = /ifood|99\s?food|rappi|delivery|uber\s?eats|z[eé] delivery/i;
const CORRIDA = /\buber\b|\b99\b(?!\s?food)|99pop|taxi|t[aá]xi/i;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function parcelaNoMes(d: DespesaVariavel, ano: number, mes: number): number {
  const ini = new Date(d.dataInicio);
  const diff = (ano - ini.getUTCFullYear()) * 12 + (mes - 1 - ini.getUTCMonth());
  const k = d.parcelaAtual + diff;
  return diff >= 0 && k <= d.parcelasTotal ? d.valorParcela : 0;
}

function fixaNoMes(d: DespesaFixa, ano: number, mes: number): number {
  const ini = new Date(d.dataInicio);
  if (ini.getUTCFullYear() * 12 + ini.getUTCMonth() + 1 > ano * 12 + mes) return 0;
  return d.valor;
}

export function analisarGastos(opts: {
  despesasVariaveis: DespesaVariavel[];
  despesasFixas: DespesaFixa[];
  receitasVariaveis: ReceitaVariavel[];
  hoje: Date;
  meses?: number;
}): Economia {
  const { despesasVariaveis, despesasFixas, receitasVariaveis, hoje } = opts;
  const n = opts.meses ?? 3;
  const janela = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1));
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  });
  const media = (f: (ano: number, mes: number) => number) => janela.reduce((s, m) => s + f(m.ano, m.mes), 0) / n;

  // Compra feita para alguém que devolve (tem receita parcelada com o mesmo nome).
  const reembolsos = new Set(receitasVariaveis.map((r) => norm(r.descricao)));
  const ehReembolsada = (d: DespesaVariavel) =>
    reembolsos.has(norm(d.descricao)) || /terceiro/i.test(d.categoria);

  const variaveis = despesasVariaveis
    .map((d) => ({ d, porMes: media((a, m) => parcelaNoMes(d, a, m)) }))
    .filter((x) => x.porMes > 0);
  const fixas = despesasFixas.map((d) => ({ d, porMes: media((a, m) => fixaNoMes(d, a, m)) })).filter((x) => x.porMes > 0);

  const itemV = ({ d, porMes }: { d: DespesaVariavel; porMes: number }): ItemGasto => ({
    id: d.id,
    descricao: d.descricao.trim(),
    onde: d.cartao,
    categoria: d.categoria,
    porMes,
    restam: d.parcelasTotal >= 24 ? undefined : d.parcelasTotal - d.parcelaAtual + 1,
    reembolsado: ehReembolsada(d),
  });
  const itemF = ({ d, porMes }: { d: DespesaFixa; porMes: number }): ItemGasto => ({
    id: d.id,
    descricao: d.descricao.trim(),
    onde: "Conta do mês",
    categoria: d.categoria,
    porMes,
  });

  // Categorias: o que é do casal. Reembolsado e custo da empresa ficam de fora.
  const doCasal = [
    ...variaveis.filter((x) => !ehReembolsada(x.d) && !NEGOCIO.test(x.d.categoria)).map(itemV),
    ...fixas.filter((x) => !NEGOCIO.test(x.d.categoria)).map(itemF),
  ];
  const saidaMedia = doCasal.reduce((s, i) => s + i.porMes, 0);
  const porCat = new Map<string, number>();
  for (const i of doCasal) porCat.set(i.categoria, (porCat.get(i.categoria) ?? 0) + i.porMes);
  const categorias = Array.from(porCat.entries())
    .map(([categoria, porMes]) => ({ categoria, porMes, fatia: saidaMedia ? porMes / saidaMedia : 0 }))
    .sort((a, b) => b.porMes - a.porMes);

  const achados: Achado[] = [];
  const soma = (itens: ItemGasto[]) => itens.reduce((s, i) => s + i.porMes, 0);
  const ordenar = (itens: ItemGasto[]) => itens.sort((a, b) => b.porMes - a.porMes);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // 1. Juros, multa e IOF: corte de 100%, não compra nada.
  // É cobrança avulsa: a soma das faturas lançadas diz mais que a média.
  const juros = ordenar(
    variaveis.filter((x) => JUROS.test(x.d.descricao) && !NEGOCIO.test(x.d.categoria)).map(itemV)
  ).map((i) => ({ ...i, porMes: i.porMes * n }));
  if (juros.length) {
    const t = soma(juros);
    achados.push({
      chave: "juros",
      titulo: "Juros, multa e IOF",
      porMes: t / n,
      porAno: (t / n) * 12,
      destaque: `${brl(t)} nas faturas já lançadas`,
      tom: "corte",
      texto:
        "Dinheiro que não compra nada. Juros de atraso de fatura vêm do rotativo, o crédito mais caro do país. Pagar a fatura inteira até o vencimento, com débito automático do valor total, zera essa linha. IOF aparece em compra em dólar (ferramentas de IA, App Store): onde der, pagar em reais ou pelo cartão da empresa.",
      itens: juros,
    });
  }

  // 2. Assinaturas: lançadas como 50 parcelas, ou streaming e celular.
  const ehAssinatura = (d: DespesaVariavel) =>
    d.parcelasTotal >= 24 || /streaming|plano de celular|assinatura/i.test(d.categoria);
  const assinaturas = ordenar(
    variaveis.filter((x) => ehAssinatura(x.d) && !NEGOCIO.test(x.d.categoria) && !ehReembolsada(x.d)).map(itemV)
  );
  if (assinaturas.length) {
    const t = soma(assinaturas);
    const nomes = assinaturas.map((i) => norm(i.descricao).split(" ")[0]);
    const repetidas = Array.from(new Set(nomes.filter((x, i) => nomes.indexOf(x) !== i)));
    achados.push({
      chave: "assinaturas",
      titulo: "Assinaturas do casal",
      porMes: t,
      porAno: t * 12,
      tom: "atencao",
      texto:
        `${assinaturas.length} assinaturas, ${brl(t * 12)} por ano. ` +
        (repetidas.length
          ? `Tem serviço repetido (${repetidas.join(", ")}): veja se existe plano família ou casal, que costuma sair bem mais barato que dois individuais. `
          : "") +
        "Regra prática: a que ninguém usou no último mês, cancela. Dá para voltar quando quiser, e streaming dá para alternar (um por mês em vez de todos juntos).",
      itens: assinaturas,
    });
  }

  // 3. Custo da empresa no cartão pessoal.
  const empresa = ordenar(variaveis.filter((x) => NEGOCIO.test(x.d.categoria)).map(itemV));
  if (empresa.length) {
    const t = soma(empresa);
    achados.push({
      chave: "empresa",
      titulo: "Custos da InnovAdapt no cartão pessoal",
      porMes: t,
      porAno: t * 12,
      tom: "info",
      texto:
        "Não é gasto do casal, mas passa pelo cartão de vocês e ocupa limite. Se o reembolso atrasa um mês, vira rotativo. O ideal é um cartão no CNPJ para esses serviços. Enquanto isso, confira todo mês se o \"Custo IA\" que a empresa devolve cobre esta lista.",
      itens: empresa,
    });
  }

  // 4. Delivery e corridas: gasto pequeno e frequente, que some sem ninguém ver.
  const miudo = ordenar(
    variaveis.filter((x) => DELIVERY.test(x.d.descricao) || CORRIDA.test(x.d.descricao)).map(itemV)
  );
  if (miudo.length) {
    const t = soma(miudo);
    achados.push({
      chave: "miudo",
      titulo: "Delivery e corridas",
      porMes: t,
      porAno: t * 12,
      tom: "atencao",
      texto:
        "Cada um parece pouco, junto é uma conta fixa. Um teto por semana (por exemplo, dois pedidos) costuma cortar metade sem sentir. Corrida repetida no mesmo trajeto pode sair mais barata com transporte por assinatura ou combustível.",
      itens: miudo,
    });
  }

  // 5. Cursos: compra por impulso clássica, e vários ao mesmo tempo ninguém termina.
  const cursos = ordenar(
    variaveis.filter((x) => /educa/i.test(x.d.categoria) && !NEGOCIO.test(x.d.categoria) && !ehReembolsada(x.d)).map(itemV)
  );
  if (cursos.length >= 4) {
    const t = soma(cursos);
    achados.push({
      chave: "cursos",
      titulo: "Cursos ao mesmo tempo",
      porMes: t,
      porAno: t * 12,
      tom: "atencao",
      texto: `${cursos.length} cursos sendo pagos juntos. O que já foi comprado segue, mas nenhum novo até terminar os que estão abertos. Curso que não foi aberto em 7 dias costuma ter reembolso garantido por lei (compra pela internet): vale olhar os mais recentes.`,
      itens: cursos,
    });
  }

  // 6. Parcelamentos ainda rodando: o que já está comprometido e quando libera.
  const parcelados = ordenar(
    variaveis
      .filter((x) => !ehAssinatura(x.d) && x.d.parcelasTotal > 1 && !ehReembolsada(x.d) && !NEGOCIO.test(x.d.categoria))
      .map(itemV)
  );
  if (parcelados.length) {
    const t = soma(parcelados);
    achados.push({
      chave: "parcelados",
      titulo: "Compras parceladas rodando",
      porMes: t,
      porAno: t * 12,
      tom: "info",
      texto:
        `${parcelados.length} compras parceladas tomam ${brl(t)} do mês. Não dá para cortar o que já foi comprado, mas dá para não somar: até o plano de quitação andar, a regra é não abrir parcelamento novo. Cada uma que termina devolve a parcela para o caixa, e esse dinheiro vai para o plano.`,
      itens: parcelados,
    });
  }

  // 7. Compras para terceiros: não são gasto, mas dependem do reembolso entrar.
  const terceiros = ordenar(variaveis.filter((x) => ehReembolsada(x.d)).map(itemV));
  if (terceiros.length) {
    const t = soma(terceiros);
    achados.push({
      chave: "terceiros",
      titulo: "Compras no cartão para outras pessoas",
      porMes: t,
      porAno: t * 12,
      tom: "info",
      texto:
        "Têm reembolso lançado, então não pesam na conta, desde que o dinheiro entre antes da fatura. Se alguém atrasar, quem paga juros são vocês. Vale não emprestar o cartão de novo até quitar os empréstimos.",
      itens: terceiros,
    });
  }

  return { meses: n, saidaMedia, categorias, achados };
}

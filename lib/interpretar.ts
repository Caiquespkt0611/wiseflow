// Interpreta uma frase falada em português e devolve um lançamento pronto para conferência.
// Roda inteiro no navegador: sem API externa, sem chave e sem custo por lançamento.

export type TipoLancamento =
  | "despesa_fixa"
  | "despesa_variavel"
  | "receita_fixa"
  | "receita_variavel";

export interface OpcoesInterpretacao {
  cartoes: string[];
  /** Fontes já usadas em receitas variáveis. */
  fontes: string[];
  categorias: string[];
  responsavelPadrao: string;
}

export interface Lancamento {
  tipo: TipoLancamento;
  descricao: string;
  valorTotal: number | null;
  parcelasTotal: number;
  /** Cartão, quando despesa variável. Fonte, quando receita variável. */
  cartao: string;
  categoria: string;
  responsavel: string;
  /** yyyy-mm-dd */
  data: string;
  /** Campos que o interpretador não conseguiu deduzir com segurança. */
  conferir: string[];
  transcricao: string;
}

/** Tira acento mantendo o comprimento do texto, para os índices continuarem batendo com o original. */
const ACENTOS: Record<string, string> = {
  á: "a", à: "a", â: "a", ã: "a", ä: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", õ: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n",
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .split("")
    .map((c) => ACENTOS[c] ?? c)
    .join("");
}

const NUMEROS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
  novecentos: 900, mil: 1000,
};

const PALAVRAS_NUMERO = Object.keys(NUMEROS).join("|");

/** "mil duzentos e cinquenta" -> 1250 */
function numeroPorExtenso(trecho: string): number | null {
  const tokens = trecho.split(/[\s]+|\be\b/).filter((t) => t && t !== "e");
  let total = 0;
  let acumulado = 0;
  let achou = false;

  for (const token of tokens) {
    const valor = NUMEROS[token];
    if (valor === undefined) continue;
    achou = true;
    if (valor === 1000) {
      acumulado = (acumulado === 0 ? 1 : acumulado) * 1000;
      total += acumulado;
      acumulado = 0;
    } else {
      acumulado += valor;
    }
  }

  return achou ? total + acumulado : null;
}

/** "1.250,90" ou "1250,90" ou "450" -> número */
function numeroPorDigito(trecho: string): number | null {
  const limpo = trecho.replace(/\./g, "").replace(",", ".");
  const valor = parseFloat(limpo);
  return Number.isFinite(valor) ? valor : null;
}

const CATEGORIA_POR_PALAVRA: [RegExp, string][] = [
  [/uber|99|gasolina|combustivel|alcool|etanol|ipva|onibus|estacionament|pedagio|mecanic|pneu|oficina|licenciament|revisao|moto|carro/, "Transporte"],
  [/mercado|supermercad|ifood|restaurante|lanche|padaria|acougue|feira|almoc|jantar|pizza|cafe|hortifruti|delivery/, "Alimentação"],
  [/curso|faculdade|escola|apostila|livro|ingles|mensalidade escolar|material escolar|creche/, "Educação"],
  [/aluguel|condominio|luz|energia|agua|gas|internet|iptu|reforma|movel|casa|apartament/, "Moradia"],
  [/farmacia|remedio|medic|dentista|exame|plano de saude|consulta|academia|psicolog|terapia/, "Saúde"],
  [/roupa|tenis|sapato|camisa|calca|vestido|riachuelo|renner|blusa|casaco|bolsa/, "Vestuário"],
  [/cinema|viagem|bar |show|passeio|hotel|airbnb|balada|parque|ingresso/, "Lazer"],
  [/pet |racao|veterinari|cachorr|gat[oa]|banho e tosa/, "Pets"],
  [/salao|cabelo|manicure|barbeir|unha|sobrancelha|depilac|estetica/, "Beleza"],
  [/celular|notebook|fone|computador|carregador|monitor|teclado|mouse|tablet/, "Tecnologia"],
  [/netflix|spotify|disney|hbo|max |prime video|youtube|globoplay|streaming/, "Streaming"],
  [/innovadapt|empresa|cliente|dominio|servidor|vercel|supabase|anuncio|trafego/, "Negócios"],
  [/tarifa|juros|anuidade|seguro|imposto|taxa/, "Finanças"],
  [/investiment|tesouro|cdb|acoes|cripto|bitcoin|aporte/, "Investimento"],
  [/emprestim|financiament|consignad/, "Empréstimo"],
  [/plano de celular|vivo|claro|tim |oi fibra|recarga/, "Plano de Celular"],
];

const VERBOS_RECEITA = /\b(recebi|receber|recebemos|entrou|ganhei|ganhamos|vendi|vendemos|receita|salario|freela|comissao|bonus|premio|restituicao|rendimento)\b/;
const MARCAS_FIXO = /\b(fix[oa]|mensal|mensalidade|todo mes|todos os meses|recorrente|assinatura|sempre)\b/;

/** Palavras de comando que nunca fazem parte da descrição. */
const COMANDO = new Set([
  "comprei", "compramos", "compra", "gastei", "gastamos", "paguei", "pagamos",
  "lancar", "lanca", "lance", "lancei", "anota", "anotar", "adiciona", "adicionar",
  "coloca", "colocar", "poe", "por", "foi", "fiz", "fizemos", "peguei", "pegamos",
  "recebi", "recebemos", "receber", "entrou", "ganhei", "ganhamos", "vendi", "vendemos",
  "reais", "real", "conto", "contos", "pila", "pilas",
  "fixo", "fixa", "mensal", "recorrente", "sempre",
  "cartao", "credito", "debito", "parcelado", "parcelada", "dividido", "dividida",
  "vezes", "parcela", "parcelas", "valor", "despesa", "receita", "gasto",
  "hoje", "ontem", "anteontem", "dia", "mes", "meses", "todo", "todos", "os",
]);

/** Ligações que só atrapalham quando sobram nas pontas da descrição. */
const LIGACAO = new Set([
  "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "com",
  "para", "pra", "pro", "e", "o", "a", "um", "uma", "uns", "umas", "meu",
  "minha", "meus", "minhas", "que", "ao", "aos",
]);

interface Faixa {
  inicio: number;
  fim: number;
}

function removerFaixas(texto: string, faixas: Faixa[]): string {
  const ordenadas = [...faixas].sort((a, b) => b.inicio - a.inicio);
  let resultado = texto;
  for (const { inicio, fim } of ordenadas) {
    resultado = resultado.slice(0, inicio) + " " + resultado.slice(fim);
  }
  return resultado;
}

function limparDescricao(bruta: string): string {
  const tokens = bruta
    .replace(/[.,;!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !COMANDO.has(normalizar(t)));

  while (tokens.length && LIGACAO.has(normalizar(tokens[0]))) tokens.shift();
  while (tokens.length && LIGACAO.has(normalizar(tokens[tokens.length - 1]))) tokens.pop();

  const texto = tokens.join(" ").trim();
  return texto ? texto[0].toUpperCase() + texto.slice(1) : "";
}

/** Escolhe a opção existente que mais casa com o que foi falado. */
function melhorOpcao(norm: string, opcoes: string[]): { valor: string; faixa: Faixa | null } | null {
  let melhor: { valor: string; pontos: number; faixa: Faixa | null } | null = null;

  for (const opcao of opcoes) {
    const palavras = normalizar(opcao)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 2);
    if (!palavras.length) continue;

    let pontos = 0;
    let inicio = Infinity;
    let fim = -1;

    for (const palavra of palavras) {
      const pos = norm.indexOf(palavra);
      if (pos === -1) continue;
      pontos++;
      inicio = Math.min(inicio, pos);
      fim = Math.max(fim, pos + palavra.length);
    }

    if (pontos === 0) continue;
    if (!melhor || pontos > melhor.pontos) {
      melhor = { valor: opcao, pontos, faixa: fim > inicio ? { inicio, fim } : null };
    }
  }

  return melhor ? { valor: melhor.valor, faixa: melhor.faixa } : null;
}

function dataISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function interpretar(fala: string, opcoes: OpcoesInterpretacao): Lancamento {
  const original = fala.trim();
  const norm = normalizar(original);
  const consumido: Faixa[] = [];
  const conferir: string[] = [];

  // 1. Parcelas ------------------------------------------------------------
  let parcelasTotal = 1;
  const padroesParcela: RegExp[] = [
    new RegExp(`\\b(?:em|dividid[oa] em)?\\s*(\\d+)\\s*x\\b`),
    new RegExp(`\\b(?:em|dividid[oa] em)?\\s*(\\d+)\\s*(?:vezes|parcelas)\\b`),
    new RegExp(`\\b(?:em|dividid[oa] em)\\s*(${PALAVRAS_NUMERO})\\s*(?:vezes|parcelas|x)\\b`),
  ];
  for (const padrao of padroesParcela) {
    const achado = norm.match(padrao);
    if (!achado || achado.index === undefined) continue;
    const bruto = achado[1];
    const numero = /^\d+$/.test(bruto) ? parseInt(bruto, 10) : numeroPorExtenso(bruto);
    if (numero && numero > 0 && numero <= 120) {
      parcelasTotal = numero;
      consumido.push({ inicio: achado.index, fim: achado.index + achado[0].length });
      break;
    }
  }

  // 2. Valor ---------------------------------------------------------------
  let valorTotal: number | null = null;
  const padroesValor: { regex: RegExp; extenso: boolean }[] = [
    { regex: /r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/, extenso: false },
    { regex: /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:reais|real|contos?|pilas?)\b/, extenso: false },
    { regex: new RegExp(`((?:(?:${PALAVRAS_NUMERO})(?:\\s+e\\s+|\\s+)?)+)\\s*(?:reais|real|contos?|pilas?)\\b`), extenso: true },
  ];
  for (const { regex, extenso } of padroesValor) {
    const achado = norm.match(regex);
    if (!achado || achado.index === undefined) continue;
    const numero = extenso ? numeroPorExtenso(achado[1]) : numeroPorDigito(achado[1]);
    if (numero !== null && numero > 0) {
      valorTotal = numero;
      consumido.push({ inicio: achado.index, fim: achado.index + achado[0].length });
      break;
    }
  }

  // Centavos ditos à parte: "quarenta e cinco reais e noventa centavos"
  if (valorTotal !== null && Number.isInteger(valorTotal)) {
    const centavos = norm.match(new RegExp(`(\\d{1,2}|(?:(?:${PALAVRAS_NUMERO})(?:\\s+e\\s+|\\s+)?)+)\\s*centavos\\b`));
    if (centavos && centavos.index !== undefined) {
      const numero = /^\d+$/.test(centavos[1]) ? parseInt(centavos[1], 10) : numeroPorExtenso(centavos[1]);
      if (numero !== null && numero > 0 && numero < 100) {
        valorTotal += numero / 100;
        consumido.push({ inicio: centavos.index, fim: centavos.index + centavos[0].length });
      }
    }
  }

  // Sem "reais" na frase: pega o maior número solto que ainda não foi usado.
  if (valorTotal === null) {
    const restante = normalizar(removerFaixas(original, consumido));
    const soltos = restante.match(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) ?? [];
    const candidatos = soltos
      .map(numeroPorDigito)
      .filter((n): n is number => n !== null && n > 0);
    if (candidatos.length) {
      valorTotal = Math.max(...candidatos);
      const alvo = soltos[candidatos.indexOf(valorTotal)];
      const pos = norm.indexOf(alvo);
      if (pos !== -1) consumido.push({ inicio: pos, fim: pos + alvo.length });
      // Só pede conferência quando havia mais de um número solto na frase.
      if (candidatos.length > 1) conferir.push("valor");
    }
  }

  if (valorTotal === null) conferir.push("valor");

  // 3. Natureza do lançamento ---------------------------------------------
  const ehReceita = VERBOS_RECEITA.test(norm);
  const ehFixo = MARCAS_FIXO.test(norm) || (!ehReceita && parcelasTotal === 1 && /\bconta\b/.test(norm) && MARCAS_FIXO.test(norm));

  let tipo: TipoLancamento;
  if (ehReceita) {
    tipo = ehFixo && parcelasTotal === 1 ? "receita_fixa" : "receita_variavel";
  } else {
    tipo = ehFixo && parcelasTotal === 1 ? "despesa_fixa" : "despesa_variavel";
  }

  // 4. Cartão ou fonte -----------------------------------------------------
  let cartao = "";
  if (tipo === "despesa_variavel") {
    const achado = melhorOpcao(norm, opcoes.cartoes);
    if (achado) {
      cartao = achado.valor;
      if (achado.faixa) consumido.push(achado.faixa);
    } else {
      conferir.push("cartão");
    }
  } else if (tipo === "receita_variavel") {
    const achado = melhorOpcao(norm, opcoes.fontes);
    if (achado) {
      cartao = achado.valor;
      if (achado.faixa) consumido.push(achado.faixa);
    }
  }

  // 5. Data ----------------------------------------------------------------
  const hoje = new Date();
  let data = new Date(hoje);
  if (/\banteontem\b/.test(norm)) {
    data.setDate(hoje.getDate() - 2);
  } else if (/\bontem\b/.test(norm)) {
    data.setDate(hoje.getDate() - 1);
  } else {
    const diaDito = norm.match(/\bdia\s+(\d{1,2})\b/);
    if (diaDito) {
      const dia = parseInt(diaDito[1], 10);
      if (dia >= 1 && dia <= 31) {
        data = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
        if (diaDito.index !== undefined) {
          consumido.push({ inicio: diaDito.index, fim: diaDito.index + diaDito[0].length });
        }
      }
    }
  }

  // 6. Descrição -----------------------------------------------------------
  let descricao = limparDescricao(removerFaixas(original, consumido));

  // 7. Categoria -----------------------------------------------------------
  let categoria = "Outros";
  for (const [padrao, nome] of CATEGORIA_POR_PALAVRA) {
    if (padrao.test(norm) && opcoes.categorias.includes(nome)) {
      categoria = nome;
      break;
    }
  }
  if (categoria === "Outros") conferir.push("categoria");

  if (!descricao) {
    descricao = categoria === "Outros" ? "" : categoria;
    conferir.push("descrição");
  }

  // Receita variável exige fonte. Sem uma reconhecida, a descrição serve de ponto de partida.
  if (tipo === "receita_variavel" && !cartao) {
    cartao = descricao;
    conferir.push("fonte");
  }

  return {
    tipo,
    descricao,
    valorTotal,
    parcelasTotal,
    cartao,
    categoria,
    responsavel: opcoes.responsavelPadrao,
    data: dataISO(data),
    conferir: conferir.filter((c, i) => conferir.indexOf(c) === i),
    transcricao: original,
  };
}

export const ROTULO_TIPO: Record<TipoLancamento, string> = {
  despesa_fixa: "Despesa fixa",
  despesa_variavel: "Despesa variável",
  receita_fixa: "Receita fixa",
  receita_variavel: "Receita variável",
};

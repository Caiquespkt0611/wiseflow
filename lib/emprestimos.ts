/**
 * Conta de empréstimo e plano de quitação. Funções puras: a API, a projeção e a
 * tela usam as mesmas, então o número que aparece no plano é o mesmo da projeção.
 *
 * Antecipação: o contrato do Bradesco diz que o valor presente das parcelas
 * antecipadas usa "taxa de desconto igual à taxa de juros pactuada". Por isso o
 * desconto usa taxaMensal (juros do contrato), não o CET. Conferido contra o
 * extrato de evolução (DDC) do 551288025 em 04/10/2026.
 */

export interface EmprestimoBase {
  id: string;
  apelido: string;
  banco: string;
  contrato: string | null;
  modalidade: string;
  pagamento: string; // "conta" | "folha" | "fgts"
  periodicidade: string; // "mensal" | "anual"
  valorContratado: number;
  taxaMensal: number;
  cetMensal: number | null;
  taxaEstimada: boolean;
  parcelasTotal: number;
  valorParcela: number;
  valoresParcelas: number[];
  primeiroVencimento: Date | string;
  proximaParcela: number;
  parcelasAntecipadas: number;
  quitadoEm: Date | string | null;
  observacao?: string | null;
}

const DIA_MS = 86_400_000;

function utc(d: Date | string): Date {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

/** Hoje à meia-noite UTC, no calendário do Brasil (o servidor roda em UTC). */
export function hojeUTC(agora = new Date()): Date {
  const br = new Date(agora.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()));
}

/** Vencimento da parcela k (1 = primeira). Dia 31 em mês curto cai no último dia. */
export function vencimento(e: EmprestimoBase, k: number): Date {
  const p = utc(e.primeiroVencimento);
  const passo = e.periodicidade === "anual" ? 12 : 1;
  const alvo = p.getUTCMonth() + (k - 1) * passo;
  const ano = p.getUTCFullYear() + Math.floor(alvo / 12);
  const mes = ((alvo % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(p.getUTCDate(), ultimoDia)));
}

export function valorDaParcela(e: EmprestimoBase, k: number): number {
  return e.valoresParcelas?.[k - 1] ?? e.valorParcela;
}

/** Última parcela que ainda existe depois das antecipações. */
export function ultimaParcela(e: EmprestimoBase): number {
  return e.parcelasTotal - e.parcelasAntecipadas;
}

/**
 * A próxima parcela em aberto. Na conta, quem diz é o botão "Paguei", como nas
 * contas do mês, porque o saldo da conta também é atualizado à mão. Na folha e
 * no FGTS ninguém paga nada: a data passou, a parcela foi descontada.
 */
export function proximaEmAberto(e: EmprestimoBase, hoje: Date): number {
  if (e.pagamento === "conta") return e.proximaParcela;
  let k = e.proximaParcela;
  while (k <= ultimaParcela(e) && vencimento(e, k) < hoje) k++;
  return k;
}

/** Parcelas ainda devidas (índices), já descontando antecipação e quitação. */
export function parcelasEmAberto(e: EmprestimoBase, hoje: Date): number[] {
  const ks: number[] = [];
  const quitado = e.quitadoEm ? utc(e.quitadoEm) : null;
  for (let k = proximaEmAberto(e, hoje); k <= ultimaParcela(e); k++) {
    if (quitado && vencimento(e, k) >= quitado) break;
    ks.push(k);
  }
  return ks;
}

export function estaQuitado(e: EmprestimoBase, hoje: Date): boolean {
  return parcelasEmAberto(e, hoje).length === 0;
}

/** Quanto a parcela k vale na data: trazida a valor presente pela taxa do contrato. */
export function valorPresente(e: EmprestimoBase, k: number, data: Date): number {
  const dias = Math.max(0, (vencimento(e, k).getTime() - data.getTime()) / DIA_MS);
  return valorDaParcela(e, k) / Math.pow(1 + e.taxaMensal / 100, dias / 30);
}

/**
 * Parcelas que um pagamento na data ainda alcança. As que venceram antes já
 * saíram pelo fluxo normal do mês (ou estão atrasadas, e atrasada não tem
 * desconto: entra cheia no mês atual).
 */
export function abertasNaData(e: EmprestimoBase, data: Date, hoje = data): number[] {
  return parcelasEmAberto(e, hoje).filter((k) => vencimento(e, k) >= data);
}

export function custoQuitar(e: EmprestimoBase, data: Date, hoje = data): number {
  return abertasNaData(e, data, hoje).reduce((s, k) => s + valorPresente(e, k, data), 0);
}

export function restanteNominal(e: EmprestimoBase, hoje: Date): number {
  return parcelasEmAberto(e, hoje).reduce((s, k) => s + valorDaParcela(e, k), 0);
}

/** Custo, na data, de antecipar as `qtd` últimas parcelas em aberto. */
export function custoAntecipar(e: EmprestimoBase, qtd: number, data: Date, hoje = data): number {
  const ks = abertasNaData(e, data, hoje);
  return ks.slice(Math.max(0, ks.length - qtd)).reduce((s, k) => s + valorPresente(e, k, data), 0);
}

/**
 * O que o empréstimo cobra do caixa no mês. Só "conta" sai do caixa. Com
 * `atrasadas`, soma também parcela de mês anterior que ainda não foi marcada
 * como paga (igual às contas do mês, que ficam no mês atual até serem pagas).
 */
export function cobradoNoMes(e: EmprestimoBase, ano: number, mes: number, hoje: Date, atrasadas = false): number {
  if (e.pagamento !== "conta") return 0;
  const chave = ano * 12 + mes;
  let total = 0;
  for (const k of parcelasEmAberto(e, hoje)) {
    const v = vencimento(e, k);
    const vk = v.getUTCFullYear() * 12 + v.getUTCMonth() + 1;
    if (vk > chave) break;
    if (vk === chave || atrasadas) total += valorDaParcela(e, k);
  }
  return total;
}

/**
 * Consignado que o plano quitou ou encurtou: nos meses em que o contrato
 * original descontaria e o novo não desconta mais, o salário vem cheio.
 */
function devolvidoAoSalario(e: EmprestimoBase, original: EmprestimoBase, ano: number, mes: number, hoje: Date): number {
  if (e.pagamento !== "folha") return 0;
  const comoConta = (x: EmprestimoBase) => cobradoNoMes({ ...x, pagamento: "conta" }, ano, mes, hoje);
  return Math.max(0, comoConta(original) - comoConta(e));
}

/* ───────────────────────── Plano de quitação ───────────────────────── */

export interface MesBase {
  ano: number;
  mes: number;
  label: string;
  receitas: number;
  despesas: number; // sem os empréstimos
}

export type Acao =
  | {
      tipo: "quitar";
      data: string;
      emprestimoId: string;
      apelido: string;
      valor: number;
      eliminado: number; // soma das parcelas que deixam de existir
      economia: number;
      liberaPorMes: number;
      liberaNoCaixa: boolean; // folha e conta liberam dinheiro; FGTS libera o FGTS
    }
  | {
      tipo: "antecipar";
      data: string;
      emprestimoId: string;
      apelido: string;
      valor: number;
      parcelas: number;
      eliminado: number;
      economia: number;
      terminaEm: string; // novo último vencimento
    };

export interface LinhaPlano {
  ano: number;
  mes: number;
  label: string;
  saldoSem: number;
  saldoCom: number;
  parcelasSem: number;
  parcelasCom: number;
  pagoNoPlano: number;
}

export interface Plano {
  acoes: Acao[];
  linhas: LinhaPlano[];
  economiaTotal: number;
  pagoTotal: number;
  parcelaHoje: number; // soma das parcelas de um mês cheio hoje (conta + folha)
  semDividaEm: string | null; // quando a última parcela some, com o plano
  semDividaSemPlano: string | null;
  fimDoHorizonte: { sem: number; com: number };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Antecipa as `qtd` últimas parcelas. Todas = quitado hoje. */
export function aplicarEscolha(e: EmprestimoBase, qtd: number, hoje: Date): EmprestimoBase {
  const total = abertasNaData(e, hoje, hoje).length;
  if (qtd <= 0 || total === 0) return e;
  if (qtd >= total) return { ...e, quitadoEm: hoje };
  return { ...e, parcelasAntecipadas: e.parcelasAntecipadas + qtd };
}

/** Parcelas que saem da conta no mês (no mês 0, com as atrasadas). */
export function parcelasDoMes(lista: EmprestimoBase[], m: MesBase, i: number, hoje: Date): number {
  return lista.reduce((s, e) => s + cobradoNoMes(e, m.ano, m.mes, hoje, i === 0), 0);
}

/**
 * Quanto sobra no mês. `refs` são os contratos como estavam antes de qualquer
 * antecipação: é contra eles que se mede o salário que volta do consignado.
 */
export function fluxoDoMes(lista: EmprestimoBase[], refs: Map<string, EmprestimoBase>, m: MesBase, i: number, hoje: Date): number {
  const devolvido = lista.reduce((s, e) => s + devolvidoAoSalario(e, refs.get(e.id) ?? e, m.ano, m.mes, hoje), 0);
  return m.receitas + devolvido - m.despesas - parcelasDoMes(lista, m, i, hoje);
}

export interface MesSaldo {
  ano: number;
  mes: number;
  label: string;
  saldo: number;
  parcelas: number;
}

/** Saldo no fim de cada mês, com um pagamento feito hoje. */
export function serieSaldo(opts: {
  meses: MesBase[];
  saldoInicial: number;
  emprestimos: EmprestimoBase[];
  originais?: EmprestimoBase[];
  hoje: Date;
  pagoHoje?: number;
}): MesSaldo[] {
  const refs = new Map((opts.originais ?? opts.emprestimos).map((e) => [e.id, e]));
  let saldo = opts.saldoInicial - (opts.pagoHoje ?? 0);
  return opts.meses.map((m, i) => {
    saldo += fluxoDoMes(opts.emprestimos, refs, m, i, opts.hoje);
    return { ano: m.ano, mes: m.mes, label: m.label, saldo, parcelas: parcelasDoMes(opts.emprestimos, m, i, opts.hoje) };
  });
}

/**
 * Simula mês a mês. Em cada mês, o dinheiro livre é o quanto o saldo pode cair
 * sem que nenhum mês daqui para a frente fique abaixo da reserva. Esse dinheiro
 * vai para o empréstimo de juros mais alto: quita se der, senão antecipa as
 * últimas parcelas (é onde o desconto é maior). Quitar libera a parcela, e a
 * parcela liberada engorda o dinheiro livre dos meses seguintes.
 *
 * Ignorar o alívio das parcelas futuras ao medir o dinheiro livre é de
 * propósito: o plano nunca conta com uma folga que ainda não aconteceu.
 */
export function simularPlano(opts: {
  meses: MesBase[];
  saldoInicial: number;
  emprestimos: EmprestimoBase[];
  originais?: EmprestimoBase[]; // contratos antes da escolha de hoje, para o salário do consignado
  reserva: number;
  hoje: Date;
  minimoAcao?: number;
  diaDaAcao?: number;
}): Plano {
  const { meses, saldoInicial, reserva, hoje } = opts;
  const minimoAcao = opts.minimoAcao ?? 500;
  const diaDaAcao = opts.diaDaAcao ?? 15;
  const originais = opts.emprestimos;
  const estado = originais.map((e) => ({ ...e }));
  const refs = new Map((opts.originais ?? originais).map((e) => [e.id, e]));

  const parcelasConta = (lista: EmprestimoBase[], m: MesBase, i: number) => parcelasDoMes(lista, m, i, hoje);
  const fluxo = (lista: EmprestimoBase[], m: MesBase, i: number) => fluxoDoMes(lista, refs, m, i, hoje);

  // Sem plano: as parcelas como estão no contrato.
  const saldoSem: number[] = [];
  let acc = saldoInicial;
  meses.forEach((m, i) => { acc += fluxo(originais, m, i); saldoSem.push(acc); });

  const acoes: Acao[] = [];
  const linhas: LinhaPlano[] = [];
  let caixa = saldoInicial;

  meses.forEach((m, i) => {
    const dataAcao = i === 0 ? hoje : new Date(Date.UTC(m.ano, m.mes - 1, diaDaAcao));

    // Menor saldo daqui até o fim, sem nenhuma ação nova.
    let menor = Infinity;
    let s = caixa;
    for (let j = i; j < meses.length; j++) {
      s += fluxo(estado, meses[j], j);
      menor = Math.min(menor, s);
    }
    let livre = menor - reserva;
    let pagoNoMes = 0;

    while (livre >= minimoAcao) {
      const alvo = estado
        .filter((e) => abertasNaData(e, dataAcao, hoje).length > 0)
        .sort((a, b) => b.taxaMensal - a.taxaMensal)[0];
      if (!alvo) break;

      const ks = abertasNaData(alvo, dataAcao, hoje);
      const custo = custoQuitar(alvo, dataAcao, hoje);
      if (custo <= livre) {
        const eliminado = ks.reduce((t, k) => t + valorDaParcela(alvo, k), 0);
        acoes.push({
          tipo: "quitar",
          data: iso(dataAcao),
          emprestimoId: alvo.id,
          apelido: alvo.apelido,
          valor: custo,
          eliminado,
          economia: eliminado - custo,
          liberaPorMes: alvo.valorParcela,
          liberaNoCaixa: alvo.pagamento !== "fgts",
        });
        alvo.quitadoEm = dataAcao;
        livre -= custo;
        pagoNoMes += custo;
        continue;
      }

      // Antecipar: quantas das últimas cabem no dinheiro livre.
      let qtd = 0;
      let gasto = 0;
      for (let x = ks.length - 1; x >= 0; x--) {
        const vp = valorPresente(alvo, ks[x], dataAcao);
        if (gasto + vp > livre) break;
        gasto += vp;
        qtd++;
      }
      if (qtd === 0 || gasto < minimoAcao) break;
      const eliminado = ks.slice(ks.length - qtd).reduce((t, k) => t + valorDaParcela(alvo, k), 0);
      alvo.parcelasAntecipadas += qtd;
      acoes.push({
        tipo: "antecipar",
        data: iso(dataAcao),
        emprestimoId: alvo.id,
        apelido: alvo.apelido,
        valor: gasto,
        parcelas: qtd,
        eliminado,
        economia: eliminado - gasto,
        terminaEm: iso(vencimento(alvo, ultimaParcela(alvo))),
      });
      livre -= gasto;
      pagoNoMes += gasto;
      break; // o que sobrou não paga nem mais uma parcela
    }

    caixa += fluxo(estado, m, i) - pagoNoMes;
    linhas.push({
      ano: m.ano,
      mes: m.mes,
      label: m.label,
      saldoSem: saldoSem[i],
      saldoCom: caixa,
      parcelasSem: parcelasConta(originais, m, i),
      parcelasCom: parcelasConta(estado, m, i),
      pagoNoPlano: pagoNoMes,
    });
  });

  const fimDivida = (lista: EmprestimoBase[]) => {
    let fim: Date | null = null;
    for (const e of lista) {
      const ks = parcelasEmAberto(e, hoje);
      if (!ks.length) continue;
      const v = vencimento(e, ks[ks.length - 1]);
      if (!fim || v > fim) fim = v;
    }
    return fim ? iso(fim) : null;
  };

  const mesCheio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
  const parcelaHoje = originais.reduce((s, e) => {
    if (e.pagamento === "fgts") return s;
    const comConta = { ...e, pagamento: "conta" };
    return s + cobradoNoMes(comConta, mesCheio.getUTCFullYear(), mesCheio.getUTCMonth() + 1, hoje);
  }, 0);

  return {
    acoes,
    linhas,
    economiaTotal: acoes.reduce((s, a) => s + a.economia, 0),
    pagoTotal: acoes.reduce((s, a) => s + a.valor, 0),
    parcelaHoje,
    semDividaEm: fimDivida(estado),
    semDividaSemPlano: fimDivida(originais),
    fimDoHorizonte: {
      sem: saldoSem[saldoSem.length - 1] ?? saldoInicial,
      com: linhas[linhas.length - 1]?.saldoCom ?? saldoInicial,
    },
  };
}

/** Reserva sugerida: um mês do que sai em média, arredondado para cima no milhar. */
export function reservaSugerida(meses: MesBase[], parcelasMedias: number): number {
  const n = Math.min(12, meses.length) || 1;
  const media = meses.slice(0, n).reduce((s, m) => s + m.despesas, 0) / n + parcelasMedias;
  return Math.ceil(media / 1000) * 1000;
}

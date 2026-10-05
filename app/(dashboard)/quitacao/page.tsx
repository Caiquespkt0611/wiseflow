"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Check, CheckCircle2, Minus, Plus, Undo2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { useCoresGrafico } from "@/lib/cores-grafico";
import { useToast } from "@/components/ui/Toast";
import { Cabecalho } from "@/components/ui/Cabecalho";
import {
  aplicarEscolha,
  amortizar,
  custoQuitar,
  custoAntecipar,
  abertasNaData,
  valorDaParcela,
  vencimento,
  serieSaldo,
  simularPlano,
  type EmprestimoBase,
  type MesBase,
} from "@/lib/emprestimos";

interface Emprestimo extends EmprestimoBase {
  pagamento: "conta" | "folha" | "fgts";
  abertas: number;
  pagas: number;
  proximoVencimento: string | null;
  terminaEm: string | null;
  restante: number;
  atrasadas: number;
  antecipaveis: number;
}

interface Resposta {
  hoje: string;
  saldoBancario: number;
  config: { reserva: number; cartao: number };
  emprestimos: Emprestimo[];
  meses: MesBase[];
  mesesPlano: MesBase[];
  sugestoes: Record<string, { modo: "quitar" | "parcela"; valor: number }>;
}

type Modo = "parcela" | "prazo" | "quitar";
interface Escolha {
  modo: Modo;
  qtd: number; // parcelas do fim, no modo prazo
  valor: number; // reais, no modo parcela
}

const NADA: Escolha = { modo: "parcela", qtd: 0, valor: 0 };

/** O que uma escolha faz com um empréstimo, pago hoje. */
function efeito(e: Emprestimo, esc: Escolha, hoje: Date) {
  const ks = abertasNaData(e, hoje);
  const nominal = (qtd: number) => ks.slice(ks.length - qtd).reduce((s, k) => s + valorDaParcela(e, k), 0);
  const parcelaAgora = ks.length ? valorDaParcela(e, ks[0]) : 0;
  if (esc.modo === "quitar" && ks.length) {
    return { depois: aplicarEscolha(e, ks.length, hoje), pago: custoQuitar(e, hoje), somem: nominal(ks.length), parcelaAgora, parcelaDepois: 0, novoFim: null as Date | null, quitou: true };
  }
  if (esc.modo === "prazo" && esc.qtd > 0) {
    const qtd = Math.min(esc.qtd, ks.length);
    return {
      depois: aplicarEscolha(e, qtd, hoje),
      pago: custoAntecipar(e, qtd, hoje),
      somem: nominal(qtd),
      parcelaAgora,
      parcelaDepois: qtd >= ks.length ? 0 : parcelaAgora,
      novoFim: qtd < ks.length ? vencimento(e, ks[ks.length - qtd - 1]) : null,
      quitou: qtd >= ks.length,
    };
  }
  if (esc.modo === "parcela" && esc.valor > 0) {
    const r = amortizar(e, esc.valor, hoje);
    return { depois: r.emprestimo, pago: r.pago, somem: r.eliminado, parcelaAgora, parcelaDepois: r.parcelaDepois, novoFim: null, quitou: r.quitou };
  }
  return { depois: e as EmprestimoBase, pago: 0, somem: 0, parcelaAgora, parcelaDepois: parcelaAgora, novoFim: null, quitou: false };
}

const COMO_PAGA = {
  conta: "sai da conta",
  folha: "desconta no salário",
  fgts: "sai do FGTS",
} as const;

const dia = (d: Date | string) => new Date(typeof d === "string" ? d.slice(0, 10) + "T12:00:00" : d.toISOString().slice(0, 10) + "T12:00:00");
const dataBR = (d: Date | string) => format(dia(d), "dd/MM/yyyy");
const mesAno = (d: Date | string) => format(dia(d), "MMM/yy", { locale: ptBR }).replace(".", "");
const mesCurto = (l: { ano: number; mes: number }) => format(new Date(l.ano, l.mes - 1, 1), "MMM yy", { locale: ptBR }).replace(".", "");
const mesLongo = (l: { ano: number; mes: number }) => format(new Date(l.ano, l.mes - 1, 1), "MMMM", { locale: ptBR });
const compacto = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export default function QuitacaoPage() {
  const cores = useCoresGrafico();
  const { toast } = useToast();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [escolha, setEscolha] = useState<Record<string, Escolha>>({});
  const [gravando, setGravando] = useState(false);

  const buscar = useCallback(async () => {
    const res = await fetch("/api/quitacao");
    if (res.ok) setDados(await res.json());
  }, []);
  useEffect(() => { buscar(); }, [buscar]);
  useAoLancar(buscar);

  const hoje = useMemo(() => (dados ? new Date(dados.hoje) : new Date()), [dados]);
  const ativos = useMemo(() => (dados?.emprestimos ?? []).filter((e) => e.abertas > 0), [dados]);

  // Tudo o que a tela mostra sai daqui, recalculado a cada clique.
  const conta = useMemo(() => {
    if (!dados) return null;
    const efeitos = dados.emprestimos.map((e) => efeito(e, escolha[e.id] ?? NADA, hoje));
    const depois = efeitos.map((x) => x.depois);
    const pagoHoje = efeitos.reduce((s, x) => s + x.pago, 0);
    const somem = efeitos.reduce((s, x) => s + x.somem, 0);
    const base = { meses: dados.meses, saldoInicial: dados.saldoBancario, originais: dados.emprestimos, hoje };
    const sem = serieSaldo({ ...base, emprestimos: dados.emprestimos });
    const com = serieSaldo({ ...base, emprestimos: depois, pagoHoje });
    const menor = com.reduce((m, x) => (x.saldo < m.saldo ? x : m), com[0]);
    // Próximos passos: o mesmo plano, partindo do que foi escolhido hoje.
    const proximos = simularPlano({
      meses: dados.mesesPlano,
      saldoInicial: dados.saldoBancario - pagoHoje,
      emprestimos: depois,
      originais: dados.emprestimos,
      reserva: dados.config.reserva,
      hoje,
    }).acoes.slice(0, 5);
    return { pagoHoje, economia: somem - pagoHoje, sem, com, menor, proximos };
  }, [dados, escolha, hoje]);

  const registrar = async (e: Emprestimo, esc: Escolha) => {
    const x = efeito(e, esc, hoje);
    const corpo =
      esc.modo === "quitar" || x.quitou
        ? { acao: "quitar" }
        : esc.modo === "prazo"
          ? { acao: "antecipar", parcelas: Math.min(esc.qtd, e.antecipaveis) }
          : { acao: "amortizar", valor: esc.valor };
    const texto =
      corpo.acao === "quitar"
        ? `Registrar que o ${e.apelido} foi quitado hoje, por cerca de ${formatCurrency(x.pago)}?`
        : corpo.acao === "antecipar"
          ? `Registrar que as ${esc.qtd} últimas parcelas do ${e.apelido} foram antecipadas hoje, por cerca de ${formatCurrency(x.pago)}?`
          : `Registrar que você amortizou ${formatCurrency(esc.valor)} no ${e.apelido} e a parcela caiu para cerca de ${formatCurrency(x.parcelaDepois)}?`;
    if (!confirm(texto)) return;
    setGravando(true);
    const res = await fetch(`/api/emprestimos/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    setGravando(false);
    if (res.ok) {
      toast(corpo.acao === "quitar" ? `${e.apelido} quitado` : `${e.apelido} atualizado`);
      setEscolha((v) => ({ ...v, [e.id]: NADA }));
      buscar();
    } else toast("Não consegui gravar", "error");
  };

  const acao = async (id: string, corpo: object, ok: string) => {
    setGravando(true);
    const res = await fetch(`/api/emprestimos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    setGravando(false);
    if (res.ok) { toast(ok); buscar(); }
    else toast("Não consegui gravar", "error");
  };

  if (!dados || !conta) {
    return (
      <div className="max-w-5xl mx-auto grid gap-4" aria-busy>
        <div className="h-10 w-64 rounded-lg bg-tinta-100 animate-pulse" />
        <div className="h-48 rounded-3xl bg-tinta-100 animate-pulse" />
        <div className="h-96 rounded-2xl bg-tinta-100 animate-pulse" />
      </div>
    );
  }

  const { sem, com, menor } = conta;
  const escolheu = conta.pagoHoje > 0;
  const temSugestao = Object.keys(dados.sugestoes).length > 0;
  const mesAtual = com[0];
  const proximoMes = com[1] ?? com[0];
  const quitados = dados.emprestimos.filter((e) => e.abertas === 0);
  const reserva = dados.config.reserva;

  return (
    <div className="max-w-5xl mx-auto">
      <Cabecalho
        titulo="Quitar empréstimos"
        subtitulo="Escolha quanto antecipar em cada empréstimo e veja na hora quanto sobra no fim do mês. Nada é gravado até você dizer que pagou."
      >
        {temSugestao && (
          <button
            onClick={() =>
              setEscolha(
                Object.fromEntries(
                  Object.entries(dados.sugestoes).map(([id, sg]) => [id, { modo: sg.modo, qtd: 0, valor: Math.round(sg.valor) }])
                )
              )
            }
            className="px-3.5 py-2 rounded-lg bg-marca hover:bg-marca-forte text-white text-sm font-medium transition-colors"
          >
            Usar a sugestão
          </button>
        )}
        {escolheu && (
          <button
            onClick={() => setEscolha({})}
            className="px-3.5 py-2 rounded-lg bg-superficie ring-1 ring-tinta-200 text-sm font-medium text-tinta-800 hover:bg-tinta-100 transition-colors"
          >
            Limpar
          </button>
        )}
      </Cabecalho>

      {/* O resultado da escolha, em quatro números */}
      <section className="rounded-3xl bg-superficie ring-1 ring-tinta-200 p-2 sm:p-3 lg:sticky lg:top-4 lg:z-10 shadow-sm">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Você paga hoje" valor={formatCurrency(conta.pagoHoje)} />
          <Numero
            rotulo={`Sobra no fim de ${mesLongo(mesAtual)}`}
            valor={formatCurrency(mesAtual.saldo)}
            antes={escolheu ? formatCurrency(sem[0].saldo) : undefined}
            ruim={mesAtual.saldo < reserva}
          />
          <Numero
            rotulo={`Parcelas por mês, a partir de ${mesCurto(proximoMes)}`}
            valor={formatCurrency(proximoMes.parcelas)}
            antes={escolheu && sem[1] && sem[1].parcelas - proximoMes.parcelas > 0.5 ? formatCurrency(sem[1].parcelas) : undefined}
          />
          <Numero rotulo="Juros que deixa de pagar" valor={formatCurrency(conta.economia)} bom={conta.economia > 0} />
        </dl>
        <p
          className={cn(
            "mx-2 sm:mx-3 mb-1 mt-1 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
            menor.saldo < 0 ? "bg-saida-50 text-saida-700" : menor.saldo < reserva ? "bg-aviso-50 text-aviso-800" : "bg-marca-50/70 text-marca-800"
          )}
        >
          {menor.saldo < reserva ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          {menor.saldo < 0 ? (
            <span>Falta dinheiro: em {mesLongo(menor)} a conta fica negativa ({formatCurrency(menor.saldo)}). Antecipe menos.</span>
          ) : menor.saldo < reserva ? (
            <span>
              Fica apertado: em {mesLongo(menor)} a conta cai para {formatCurrency(menor.saldo)}, menos que um mês de gastos ({formatCurrency(reserva)}).
            </span>
          ) : (
            <span>
              Tranquilo: o mês mais apertado é {mesLongo(menor)}, com {formatCurrency(menor.saldo)} na conta, mais que um mês de gastos.
            </span>
          )}
        </p>
      </section>

      {/* Um controle por empréstimo */}
      <section className="mt-6">
        <h2 className="text-[15px] font-semibold text-tinta-900">Do juro mais caro para o mais barato</h2>
        <p className="text-xs text-tinta-500 mt-0.5 mb-4">
          Três jeitos de pagar antes: diminuir a parcela (o alívio vem já no mês seguinte), encurtar o prazo (a parcela fica igual e acaba antes) ou quitar.
        </p>
        <div className="grid gap-3">
          {ativos.map((e, i) => (
            <Controle
              key={e.id}
              e={e}
              hoje={hoje}
              maisCaro={i === 0}
              esc={escolha[e.id] ?? NADA}
              sugestao={dados.sugestoes[e.id]}
              gravando={gravando}
              onEsc={(v) => setEscolha((x) => ({ ...x, [e.id]: v }))}
              onRegistrar={(v) => registrar(e, v)}
              onPaguei={() => acao(e.id, { acao: "pagar" }, `Parcela do ${e.apelido} marcada como paga`)}
              onDesfazer={() => acao(e.id, { acao: "desfazer" }, "Pagamento desfeito")}
            />
          ))}
        </div>
      </section>

      {/* O futuro */}
      <section className="mt-6 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 mb-5">
          <div>
            <h2 className="text-[15px] font-semibold text-tinta-900">Quanto sobra no fim de cada mês</h2>
            <p className="text-xs text-tinta-500 mt-0.5">
              {escolheu ? "Antecipar tira dinheiro hoje, mas as parcelas que somem voltam para a conta todo mês." : "Escolha uma antecipação acima para comparar."}
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-600">
            <Legenda cor={cores.saldo} texto="Sem antecipar" />
            {escolheu && <Legenda cor={cores.simulado} texto="Com a sua escolha" tracejado />}
          </ul>
        </div>
        <div className="h-60 sm:h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={sem.map((s, i) => ({ rotulo: mesCurto(s), sem: s.saldo, com: com[i].saldo }))}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="semAntecipar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cores.saldo} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={cores.saldo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={cores.grade} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} width={64} />
              <Tooltip content={<Dica escolheu={escolheu} />} cursor={{ stroke: cores.eixo, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="sem" name="Sem antecipar" stroke={cores.saldo} strokeWidth={2} fill="url(#semAntecipar)" dot={false} />
              {escolheu && <Line type="monotone" dataKey="com" name="Com a sua escolha" stroke={cores.simulado} strokeWidth={2} strokeDasharray="6 4" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 -mx-5 sm:-mx-6 overflow-x-auto border-t border-tinta-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta-200 text-xs text-tinta-500">
                <th className="px-4 py-3 text-left font-medium">Mês</th>
                <th className="px-4 py-3 text-right font-medium">Parcelas no mês</th>
                <th className="px-4 py-3 text-right font-medium">Sobra sem antecipar</th>
                {escolheu && <th className="px-4 py-3 text-right font-medium">Sobra com a escolha</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-tinta-100">
              {sem.map((s, i) => (
                <tr key={s.label} className={cn("valor", i === 0 && "bg-marca-50/50")}>
                  <td className="px-4 py-3 text-tinta-900 whitespace-nowrap capitalize">{mesCurto(s)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {escolheu && s.parcelas - com[i].parcelas > 0.5 && (
                      <span className="text-tinta-400 line-through mr-2">{formatCurrency(s.parcelas)}</span>
                    )}
                    <span className="text-tinta-800">{formatCurrency(com[i].parcelas)}</span>
                  </td>
                  <td className={cn("px-4 py-3 text-right whitespace-nowrap", escolheu ? "text-tinta-500" : "font-semibold text-tinta-900")}>{formatCurrency(s.saldo)}</td>
                  {escolheu && (
                    <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap", com[i].saldo < 0 ? "text-saida-600" : com[i].saldo < reserva ? "text-aviso-700" : "text-tinta-900")}>
                      {formatCurrency(com[i].saldo)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sugestão para depois */}
      {conta.proximos.length > 0 && (
        <section className="mt-6 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-tinta-900">Quando sobrar dinheiro de novo</h2>
          <p className="text-xs text-tinta-500 mt-0.5 mb-4">Sugestão para os próximos meses, depois do que você escolheu acima. Muda sozinha a cada lançamento.</p>
          <ul className="divide-y divide-tinta-100">
            {conta.proximos.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                <span className="text-sm text-tinta-800">
                  <span className="inline-block w-16 text-tinta-500 capitalize">{a.data <= dados.hoje.slice(0, 10) ? "Hoje" : mesAno(a.data)}</span>
                  {a.tipo === "quitar"
                    ? `Quitar o ${a.apelido}`
                    : `Amortizar no ${a.apelido}: parcela de ${formatCurrency(a.parcelaAntes)} para ${formatCurrency(a.parcelaDepois)}`}
                </span>
                <span className="valor text-sm text-tinta-900">
                  {formatCurrency(a.valor)} <span className="text-xs text-marca-700">economiza {formatCurrency(a.economia)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quitados.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-tinta-600 mb-2">Quitados</h2>
          <ul className="rounded-2xl bg-superficie ring-1 ring-tinta-200 divide-y divide-tinta-100">
            {quitados.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-tinta-800">
                  <Check className="inline w-4 h-4 text-marca-600 mr-1.5 -mt-0.5" />
                  {e.apelido}
                  {e.quitadoEm && <span className="text-tinta-500"> · quitado em {dataBR(e.quitadoEm)}</span>}
                </span>
                {e.quitadoEm && (
                  <button
                    onClick={() => acao(e.id, { acao: "reabrir" }, `${e.apelido} reaberto`)}
                    disabled={gravando}
                    className="text-xs font-medium text-tinta-500 hover:text-tinta-800 flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Desfazer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-xs text-tinta-500">
        Os saldos são os mesmos da tela de Projeção. As sugestões são mais cautelosas: contam com pelo menos {formatCurrency(dados.config.cartao)} de cartão por mês
        (a média de agora), porque a compra futura ainda não foi lançada. O valor exato de antecipar está no app do banco e costuma bater com o daqui por poucos reais.
      </p>
    </div>
  );
}

function Numero({ rotulo, valor, antes, bom, ruim }: { rotulo: string; valor: string; antes?: string; bom?: boolean; ruim?: boolean }) {
  return (
    <div className="px-3 sm:px-4 py-3">
      <dt className="text-xs text-tinta-500">{rotulo}</dt>
      {antes && <dd className="valor text-xs text-tinta-400 line-through mt-1">{antes}</dd>}
      <dd className={cn("valor text-xl sm:text-2xl font-semibold tracking-tight", ruim ? "text-aviso-700" : bom ? "text-marca-700" : "text-tinta-900", !antes && "mt-1")}>
        {valor}
      </dd>
    </div>
  );
}

const MODOS: { modo: Modo; rotulo: string }[] = [
  { modo: "parcela", rotulo: "Diminuir a parcela" },
  { modo: "prazo", rotulo: "Encurtar o prazo" },
  { modo: "quitar", rotulo: "Quitar" },
];

function Controle({
  e,
  hoje,
  maisCaro,
  esc,
  sugestao,
  gravando,
  onEsc,
  onRegistrar,
  onPaguei,
  onDesfazer,
}: {
  e: Emprestimo;
  hoje: Date;
  maisCaro: boolean;
  esc: Escolha;
  sugestao?: { modo: "quitar" | "parcela"; valor: number };
  gravando: boolean;
  onEsc: (v: Escolha) => void;
  onRegistrar: (v: Escolha) => void;
  onPaguei: () => void;
  onDesfazer: () => void;
}) {
  const max = e.antecipaveis;
  const saldo = custoQuitar(e, hoje);
  const x = efeito(e, esc, hoje);
  const ativo = x.pago > 0;
  const ks = abertasNaData(e, hoje);
  const valorEm = (v: number) => Math.max(0, Math.min(Math.round(saldo), Math.round(v) || 0));
  const qtdEm = (q: number) => Math.max(0, Math.min(max, Math.round(q) || 0));
  const sugTexto = sugestao ? (sugestao.modo === "quitar" ? "quitar" : `amortizar ${formatCurrency(sugestao.valor)}`) : null;

  return (
    <article className={cn("rounded-2xl bg-superficie ring-1 p-4 sm:p-5", ativo ? "ring-marca-300" : "ring-tinta-200")}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold text-tinta-900">
            {e.apelido}
            <span className={cn("ml-2 align-middle text-[11px] font-medium px-1.5 py-0.5 rounded-md", maisCaro ? "bg-saida-50 text-saida-700" : "bg-tinta-100 text-tinta-600")}>
              {pct(e.taxaMensal)} ao mês{maisCaro && " · o mais caro"}
            </span>
          </h3>
          <p className="text-sm text-tinta-500 mt-0.5">
            {formatCurrency(x.parcelaAgora)} {e.periodicidade === "anual" ? "por ano" : "por mês"} · faltam {e.abertas} · termina em{" "}
            {e.terminaEm ? mesAno(e.terminaEm) : "—"} · {COMO_PAGA[e.pagamento]} · quitar hoje: {formatCurrency(saldo)}
          </p>
        </div>
        {sugestao && sugTexto && (
          <button
            onClick={() => onEsc({ modo: sugestao.modo, qtd: 0, valor: Math.round(sugestao.valor) })}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-marca-50 text-marca-800 ring-1 ring-marca-200 hover:bg-marca-100 transition-colors"
          >
            Sugestão: {sugTexto}
          </button>
        )}
      </header>

      {max > 0 && (
        <>
          <div role="tablist" className="mt-4 inline-flex rounded-lg bg-tinta-100 p-0.5">
            {MODOS.map((m) => (
              <button
                key={m.modo}
                role="tab"
                aria-selected={esc.modo === m.modo}
                onClick={() => onEsc({ ...esc, modo: m.modo })}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  esc.modo === m.modo ? "bg-superficie text-tinta-900 font-medium shadow-sm" : "text-tinta-600 hover:text-tinta-900"
                )}
              >
                {m.rotulo}
              </button>
            ))}
          </div>

          {esc.modo === "parcela" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-tinta-700">
                Pagar
                <span className="flex items-center rounded-lg ring-1 ring-tinta-200 bg-superficie pl-2.5">
                  <span className="text-tinta-500 text-sm">R$</span>
                  <input
                    value={esc.valor || ""}
                    onChange={(ev) => onEsc({ ...esc, valor: valorEm(Number(ev.target.value.replace(/\D/g, ""))) })}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Valor para amortizar no ${e.apelido}`}
                    className="valor w-24 px-2 py-1.5 text-base sm:text-sm font-semibold text-tinta-900 bg-transparent focus:outline-none"
                  />
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={Math.round(saldo)}
                step={100}
                value={esc.valor}
                onChange={(ev) => onEsc({ ...esc, valor: valorEm(Number(ev.target.value)) })}
                aria-label={`Valor para amortizar no ${e.apelido}`}
                className="w-full accent-[rgb(var(--marca-acao))]"
              />
            </div>
          )}

          {esc.modo === "prazo" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm text-tinta-700">Antecipar as últimas</span>
              <div className="flex items-center rounded-lg ring-1 ring-tinta-200 bg-superficie">
                <button onClick={() => onEsc({ ...esc, qtd: qtdEm(esc.qtd - 1) })} disabled={esc.qtd === 0} aria-label="Uma parcela a menos" className="p-2 text-tinta-500 hover:text-tinta-900 disabled:opacity-30">
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  value={esc.qtd}
                  onChange={(ev) => onEsc({ ...esc, qtd: qtdEm(Number(ev.target.value)) })}
                  inputMode="numeric"
                  aria-label={`Parcelas do ${e.apelido} a antecipar`}
                  className="valor w-12 text-center text-base sm:text-sm font-semibold text-tinta-900 bg-transparent focus:outline-none"
                />
                <button onClick={() => onEsc({ ...esc, qtd: qtdEm(esc.qtd + 1) })} disabled={esc.qtd >= max} aria-label="Uma parcela a mais" className="p-2 text-tinta-500 hover:text-tinta-900 disabled:opacity-30">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className="text-sm text-tinta-500">de {max} parcelas</span>
              <input
                type="range"
                min={0}
                max={max}
                value={esc.qtd}
                onChange={(ev) => onEsc({ ...esc, qtd: qtdEm(Number(ev.target.value)) })}
                aria-label={`Parcelas do ${e.apelido} a antecipar`}
                className="w-full accent-[rgb(var(--marca-acao))]"
              />
            </div>
          )}
        </>
      )}

      {ativo && (
        <div className="mt-3 rounded-xl bg-marca-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-tinta-800">
            Paga <strong className="valor font-semibold">{formatCurrency(x.pago)}</strong> hoje no lugar de{" "}
            <span className="valor">{formatCurrency(x.somem)}</span> ·{" "}
            <span className="valor text-marca-700 font-medium">economiza {formatCurrency(x.somem - x.pago)}</span>
            <span className="block text-tinta-600 mt-0.5">
              {x.quitou
                ? e.pagamento === "fgts"
                  ? "Quitado: o FGTS dos próximos anos fica livre."
                  : e.pagamento === "folha"
                    ? `Quitado: o salário volta a vir ${formatCurrency(x.parcelaAgora)} maior.`
                    : `Quitado: ${formatCurrency(x.parcelaAgora)} a menos saindo todo mês.`
                : esc.modo === "parcela"
                  ? `A parcela cai de ${formatCurrency(x.parcelaAgora)} para ${formatCurrency(x.parcelaDepois)}: ${formatCurrency(x.parcelaAgora - x.parcelaDepois)} a menos por mês, até ${e.terminaEm ? mesAno(e.terminaEm) : ""}.`
                  : `A parcela continua igual, mas termina em ${x.novoFim ? mesAno(x.novoFim) : ""} em vez de ${e.terminaEm ? mesAno(e.terminaEm) : ""}.`}
            </span>
          </p>
          <button
            onClick={() => onRegistrar(esc)}
            disabled={gravando}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-marca hover:bg-marca-forte text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" /> Já paguei isso no banco
          </button>
        </div>
      )}
      {esc.modo === "parcela" && ativo && !x.quitou && (
        <p className="mt-2 text-xs text-tinta-500">
          No Bradesco: Empréstimos › Amortização de saldo devedor › digite o valor. Se o banco perguntar, escolha reduzir o valor da parcela.
        </p>
      )}
      {ks.length === 0 && <p className="mt-3 text-sm text-tinta-500">Nenhuma parcela a vencer daqui para a frente.</p>}

      {e.pagamento === "conta" && e.proximoVencimento && (
        <footer className="mt-4 pt-3 border-t border-tinta-100 flex items-center justify-between gap-3 text-sm">
          <span className={e.atrasadas > 0 ? "text-saida-600 font-medium" : "text-tinta-600"}>
            {e.atrasadas > 0 ? "Parcela em aberto" : "Próxima parcela"} em {dataBR(e.proximoVencimento)}
          </span>
          <span className="flex items-center gap-1">
            {e.pagas > 0 && (
              <button onClick={onDesfazer} disabled={gravando} title="Desfazer último pagamento" aria-label="Desfazer último pagamento" className="p-1.5 rounded-lg text-tinta-400 hover:text-tinta-700 hover:bg-tinta-100">
                <Undo2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onPaguei} disabled={gravando} className="px-2.5 py-1 rounded-lg ring-1 ring-tinta-200 text-tinta-800 font-medium hover:bg-tinta-100 transition-colors">
              Paguei a parcela
            </button>
          </span>
        </footer>
      )}
    </article>
  );
}

function Legenda({ cor, texto, tracejado }: { cor: string; texto: string; tracejado?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="w-3.5 h-0.5"
        style={tracejado ? { backgroundImage: `linear-gradient(to right, ${cor} 60%, transparent 60%)`, backgroundSize: "5px 2px" } : { backgroundColor: cor }}
        aria-hidden
      />
      {texto}
    </li>
  );
}

function Dica({ active, payload, escolheu }: { active?: boolean; escolheu: boolean; payload?: { name: string; value: number; payload: { rotulo: string } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-superficie ring-1 ring-tinta-200 shadow-lg px-3 py-2.5 text-xs min-w-[190px]">
      <p className="font-medium text-tinta-900 capitalize mb-1">Fim de {payload[0].payload.rotulo}</p>
      {payload.map((p) => (
        <p key={p.name} className="valor flex justify-between gap-4 text-tinta-600">
          <span>{p.name}</span>
          <span className="text-tinta-900 font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
      {escolheu && payload.length > 1 && (
        <p className="valor flex justify-between gap-4 text-tinta-500 mt-1 pt-1 border-t border-tinta-100">
          <span>Diferença</span>
          <span>{formatCurrency(payload[1].value - payload[0].value)}</span>
        </p>
      )}
    </div>
  );
}

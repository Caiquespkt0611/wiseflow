"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Info, Undo2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { useCoresGrafico } from "@/lib/cores-grafico";
import { useToast } from "@/components/ui/Toast";
import { Cabecalho } from "@/components/ui/Cabecalho";
import type { Acao, Plano, LinhaPlano } from "@/lib/emprestimos";

interface Emprestimo {
  id: string;
  apelido: string;
  banco: string;
  contrato: string | null;
  modalidade: string;
  pagamento: "conta" | "folha" | "fgts";
  periodicidade: string;
  taxaMensal: number;
  cetMensal: number | null;
  taxaEstimada: boolean;
  parcelasTotal: number;
  parcelasAntecipadas: number;
  valorParcela: number;
  quitadoEm: string | null;
  observacao: string | null;
  abertas: number;
  pagas: number;
  proximoVencimento: string | null;
  proximoValor: number;
  terminaEm: string | null;
  restante: number;
  quitarHoje: number;
  atrasadas: number;
}

interface Resposta {
  hoje: string;
  saldoBancario: number;
  config: {
    reserva: number;
    reservaSugerida: number;
    cartao: number;
    cartaoSugerido: number;
    salvo: { reserva: number | null; cartao: number | null };
  };
  emprestimos: Emprestimo[];
  plano: Plano;
}

const PAGAMENTO = {
  conta: { rotulo: "Sai da conta", classe: "bg-saida-50 text-saida-700" },
  folha: { rotulo: "Desconta no salário", classe: "bg-aviso-50 text-aviso-800" },
  fgts: { rotulo: "Sai do FGTS", classe: "bg-tinta-100 text-tinta-600" },
} as const;

const dataBR = (iso: string) => format(new Date(iso.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy");
const diaMes = (iso: string) => format(new Date(iso.slice(0, 10) + "T12:00:00"), "d 'de' MMM", { locale: ptBR }).replace(".", "");
const mesAno = (iso: string) => format(new Date(iso.slice(0, 10) + "T12:00:00"), "MMM/yy", { locale: ptBR }).replace(".", "");
const mesCurto = (l: { ano: number; mes: number }) =>
  format(new Date(l.ano, l.mes - 1, 1), "MMM yy", { locale: ptBR }).replace(".", "");
const compacto = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const taxa = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export default function QuitacaoPage() {
  const cores = useCoresGrafico();
  const { toast } = useToast();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [reserva, setReserva] = useState("");
  const [cartao, setCartao] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const primeira = useRef(true);

  const buscar = useCallback(async (r?: string, c?: string) => {
    const q = new URLSearchParams();
    if (r) q.set("reserva", r);
    if (c) q.set("cartao", c);
    const res = await fetch(`/api/quitacao?${q}`);
    if (res.ok) {
      const json: Resposta = await res.json();
      setDados(json);
      if (primeira.current) {
        setReserva(String(Math.round(json.config.reserva)));
        setCartao(String(Math.round(json.config.cartao)));
        primeira.current = false;
      }
    }
    setCarregando(false);
  }, []);

  useEffect(() => { buscar(); }, [buscar]);
  const recarregar = useCallback(() => buscar(reserva, cartao), [buscar, reserva, cartao]);
  useAoLancar(recarregar);

  // Mexeu na reserva ou no cartão: refaz o plano sem gravar.
  useEffect(() => {
    if (primeira.current) return;
    const t = setTimeout(() => buscar(reserva, cartao), 350);
    return () => clearTimeout(t);
  }, [reserva, cartao, buscar]);

  const salvarConfig = async () => {
    const res = await fetch("/api/quitacao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservaMinima: reserva === "" ? null : Number(reserva),
        cartaoMensal: cartao === "" ? null : Number(cartao),
      }),
    });
    if (res.ok) { toast("Reserva e cartão salvos"); recarregar(); }
    else toast("Não consegui salvar", "error");
  };

  const agir = async (id: string, corpo: object, ok: string) => {
    setOcupado(id + JSON.stringify(corpo));
    const res = await fetch(`/api/emprestimos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    setOcupado(null);
    if (res.ok) { toast(ok); recarregar(); }
    else toast("Não consegui gravar", "error");
  };

  const fizAcao = (a: Acao) =>
    a.tipo === "quitar"
      ? agir(a.emprestimoId, { acao: "quitar" }, `${a.apelido} quitado. Atualize o saldo da conta.`)
      : agir(a.emprestimoId, { acao: "antecipar", parcelas: a.parcelas }, `${a.parcelas} parcelas antecipadas. Atualize o saldo da conta.`);

  if (carregando || !dados) {
    return (
      <div className="max-w-5xl mx-auto grid gap-4" aria-busy>
        <div className="h-10 w-64 rounded-lg bg-tinta-100 animate-pulse" />
        <div className="h-56 rounded-3xl bg-tinta-100 animate-pulse" />
        <div className="h-96 rounded-2xl bg-tinta-100 animate-pulse" />
      </div>
    );
  }

  const { plano, emprestimos, config } = dados;
  const ativos = emprestimos.filter((e) => e.abertas > 0);
  const quitados = emprestimos.filter((e) => e.abertas === 0);
  const restante = ativos.reduce((s, e) => s + e.restante, 0);
  const quitarTudo = ativos.reduce((s, e) => s + e.quitarHoje, 0);
  const ultimo = plano.linhas[plano.linhas.length - 1];
  const hojeIso = dados.hoje.slice(0, 10);

  const grupos = plano.acoes.reduce<{ data: string; acoes: Acao[] }[]>((g, a) => {
    const ult = g[g.length - 1];
    if (ult && ult.data === a.data) ult.acoes.push(a);
    else g.push({ data: a.data, acoes: [a] });
    return g;
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <Cabecalho
        titulo="Quitar empréstimos"
        subtitulo="Em que ordem e quando pagar para gastar menos com juros. O plano se refaz sozinho a cada lançamento, sem deixar a conta abaixo da reserva."
      />

      {/* O resultado do plano, antes de qualquer detalhe */}
      <section className="rounded-3xl bg-superficie ring-1 ring-tinta-200 overflow-hidden">
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <div className="p-6 sm:p-8 flex flex-col justify-between gap-5 bg-marca-50/60 lg:border-r border-b lg:border-b-0 border-tinta-200">
            <p className="text-sm text-tinta-600">Juros que deixam de pagar seguindo o plano</p>
            <p className="valor font-semibold tracking-tight leading-none text-[44px] sm:text-[56px] text-tinta-900">
              {formatCurrency(plano.economiaTotal)}
            </p>
            <p className="text-sm text-tinta-500">
              Antecipando {formatCurrency(plano.pagoTotal)} até {ultimo ? mesCurto(ultimo) : ""}, sem a conta ficar abaixo de{" "}
              {formatCurrency(config.reserva)}.
            </p>
          </div>
          <dl className="p-2 sm:p-3">
            <Linha rotulo="Parcelas por mês hoje" detalhe="conta e salário, sem o FGTS" valor={formatCurrency(plano.parcelaHoje)} />
            <Linha
              rotulo={`Saindo da conta em ${ultimo ? mesCurto(ultimo) : ""}`}
              detalhe={`sem o plano: ${formatCurrency(ultimo?.parcelasSem ?? 0)}`}
              valor={formatCurrency(ultimo?.parcelasCom ?? 0)}
              destaque
            />
            <Linha rotulo="Falta pagar, somando as parcelas" detalhe={`${ativos.length} contratos em aberto`} valor={formatCurrency(restante)} />
            <Linha rotulo="Para quitar tudo hoje" detalhe="com o desconto dos juros" valor={formatCurrency(quitarTudo)} />
          </dl>
        </div>
      </section>

      {/* O que muda o plano */}
      <section className="mt-4 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <label className="block">
            <span className="campo-rotulo">Reserva mínima na conta</span>
            <input value={reserva} onChange={(e) => setReserva(e.target.value)} type="number" inputMode="decimal" min={0} step={500} className="campo valor" />
            <span className="block text-xs text-tinta-500 mt-1">
              Sugestão: {formatCurrency(config.reservaSugerida)}, um mês do que sai
            </span>
          </label>
          <label className="block">
            <span className="campo-rotulo">Cartões por mês, no mínimo</span>
            <input value={cartao} onChange={(e) => setCartao(e.target.value)} type="number" inputMode="decimal" min={0} step={500} className="campo valor" />
            <span className="block text-xs text-tinta-500 mt-1">
              Sugestão: {formatCurrency(config.cartaoSugerido)}, a média dos próximos 3 meses
            </span>
          </label>
          <button onClick={salvarConfig} className="px-4 py-2.5 rounded-lg bg-superficie ring-1 ring-tinta-200 text-sm font-medium text-tinta-800 hover:bg-tinta-100 transition-colors sm:mb-5">
            Salvar como padrão
          </button>
        </div>
        <p className="mt-3 text-xs text-tinta-500 flex gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          O cartão lançado só tem compra já feita, então ele encolhe nos meses distantes. O mínimo evita que o plano conte com uma folga que não vai existir.
        </p>
      </section>

      {/* A agenda */}
      <section className="mt-4 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-tinta-900">O que fazer, em ordem</h2>
        <p className="text-xs text-tinta-500 mt-0.5 mb-5">
          Sempre o juro mais caro primeiro. Se dá para quitar, quita. Se não dá, antecipa as últimas parcelas, que são as que têm mais desconto.
        </p>

        {grupos.length === 0 ? (
          <p className="text-sm text-tinta-600 rounded-xl bg-tinta-50 px-4 py-3">
            Com essa reserva não sobra dinheiro para antecipar até {ultimo ? mesCurto(ultimo) : "o fim da projeção"}. Diminua a reserva ou corte gastos em{" "}
            <Link href="/economizar" className="text-marca-700 font-medium hover:underline underline-offset-4">Onde economizar</Link>.
          </p>
        ) : (
          <ol className="relative">
            {grupos.map((g, gi) => {
              const agora = g.data <= hojeIso;
              return (
                <li key={g.data} className="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] gap-x-4 pb-6 last:pb-0">
                  <div className="pt-0.5">
                    <p className={cn("text-sm font-semibold", agora ? "text-marca-700" : "text-tinta-900")}>{agora ? "Agora" : diaMes(g.data)}</p>
                    <p className="text-xs text-tinta-500">{agora ? diaMes(g.data) : format(new Date(g.data + "T12:00:00"), "yyyy")}</p>
                  </div>
                  <div className={cn("grid gap-3", gi < grupos.length - 1 && "pb-6 border-b border-tinta-100")}>
                    {g.acoes.map((a, i) => (
                      <PassoPlano key={i} acao={a} agora={agora} ocupado={ocupado !== null} onFeito={() => fizAcao(a)} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {grupos.length > 0 && (
          <p className="mt-5 text-xs text-tinta-500 rounded-xl bg-tinta-50 px-4 py-3">
            No app do Bradesco: Empréstimos › o contrato › Antecipar parcelas (ou Quitar). Escolha as últimas parcelas. O valor do banco deve bater com o daqui por
            poucos reais. Depois de pagar, toque em <strong className="font-medium text-tinta-700">Fiz isso</strong> e atualize o saldo em{" "}
            <Link href="/contas" className="text-marca-700 font-medium hover:underline underline-offset-4">Saldos das contas</Link>, senão o plano conta o mesmo dinheiro duas vezes.
          </p>
        )}
      </section>

      {/* Impacto na projeção */}
      <section className="mt-4 rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 mb-5">
          <div>
            <h2 className="text-[15px] font-semibold text-tinta-900">Saldo no fim de cada mês</h2>
            <p className="text-xs text-tinta-500 mt-0.5">Área: sem o plano. Linha: com o plano. O dinheiro sai antes, mas as parcelas param de sair.</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-600">
            <Legenda cor={cores.saldo} texto="Sem o plano" />
            <Legenda cor={cores.simulado} texto="Com o plano" tracejado />
            <Legenda cor={cores.eixo} texto="Reserva" tracejado />
          </ul>
        </div>
        <div className="h-64 sm:h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={plano.linhas.map((l) => ({ ...l, rotulo: mesCurto(l) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="semPlano" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cores.saldo} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={cores.saldo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={cores.grade} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} width={64} />
              <ReferenceLine y={config.reserva} stroke={cores.eixo} strokeDasharray="3 4" strokeOpacity={0.7} />
              <Tooltip content={<DicaSaldo />} cursor={{ stroke: cores.eixo, strokeOpacity: 0.3 }} />
              <Area type="monotone" dataKey="saldoSem" name="Sem o plano" stroke={cores.saldo} strokeWidth={2} fill="url(#semPlano)" dot={false} />
              <Line type="monotone" dataKey="saldoCom" name="Com o plano" stroke={cores.simulado} strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <h3 className="text-[15px] font-semibold text-tinta-900 mt-8">Parcelas que saem da conta por mês</h3>
        <p className="text-xs text-tinta-500 mt-0.5 mb-4">O que fica livre todo mês depois de cada quitação.</p>
        <div className="h-48 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plano.linhas.map((l) => ({ ...l, rotulo: mesCurto(l) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={cores.grade} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 11, fill: cores.eixo }} tickLine={false} axisLine={false} width={64} />
              <Tooltip content={<DicaParcelas />} cursor={{ fill: cores.grade, opacity: 0.6 }} />
              <Bar dataKey="parcelasSem" name="Sem o plano" fill={cores.contas} radius={[4, 4, 0, 0]} />
              <Bar dataKey="parcelasCom" name="Com o plano" fill={cores.entra} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 -mx-5 sm:-mx-6 overflow-x-auto border-t border-tinta-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta-200 text-xs text-tinta-500">
                <th className="px-4 py-3 text-left font-medium">Mês</th>
                <th className="px-4 py-3 text-right font-medium">Parcelas</th>
                <th className="px-4 py-3 text-right font-medium">Antecipado</th>
                <th className="px-4 py-3 text-right font-medium">Saldo sem o plano</th>
                <th className="px-4 py-3 text-right font-medium">Saldo com o plano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tinta-100">
              {plano.linhas.map((l, i) => (
                <tr key={l.label} className={cn("valor", i === 0 && "bg-marca-50/50")}>
                  <td className="px-4 py-3 text-tinta-900 whitespace-nowrap capitalize">{mesCurto(l)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {l.parcelasCom < l.parcelasSem - 0.5 && <span className="text-tinta-400 line-through mr-2">{formatCurrency(l.parcelasSem)}</span>}
                    <span className="text-tinta-800">{formatCurrency(l.parcelasCom)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-aviso-700 whitespace-nowrap">{l.pagoNoPlano > 0 ? formatCurrency(l.pagoNoPlano) : "—"}</td>
                  <td className="px-4 py-3 text-right text-tinta-500 whitespace-nowrap">{formatCurrency(l.saldoSem)}</td>
                  <td className={cn("px-4 py-3 text-right font-semibold whitespace-nowrap", l.saldoCom >= 0 ? "text-tinta-900" : "text-saida-600")}>
                    {formatCurrency(l.saldoCom)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Os contratos */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-tinta-900">Os empréstimos, do juro mais caro ao mais barato</h2>
        <p className="text-xs text-tinta-500 mt-0.5 mb-4">Lançados a partir dos contratos e prints de 04/10/2026.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {ativos.map((e) => (
            <CartaoEmprestimo
              key={e.id}
              e={e}
              ocupado={ocupado !== null}
              onPaguei={() => agir(e.id, { acao: "pagar" }, `Parcela do ${e.apelido} marcada como paga`)}
              onDesfazer={() => agir(e.id, { acao: "desfazer" }, "Pagamento desfeito")}
            />
          ))}
        </div>
        {quitados.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-tinta-600 mb-2">Quitados</h3>
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
                      onClick={() => agir(e.id, { acao: "reabrir" }, `${e.apelido} reaberto`)}
                      className="text-xs font-medium text-tinta-500 hover:text-tinta-800 flex items-center gap-1"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Desfazer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Linha({ rotulo, detalhe, valor, destaque }: { rotulo: string; detalhe?: string; valor: string; destaque?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 rounded-xl px-3 sm:px-4 py-3.5">
      <dt className="text-[15px] text-tinta-800">
        {rotulo}
        {detalhe && <span className="block text-xs text-tinta-500 mt-0.5">{detalhe}</span>}
      </dt>
      <dd className={cn("valor text-lg font-medium", destaque ? "text-marca-700" : "text-tinta-900")}>{valor}</dd>
    </div>
  );
}

function PassoPlano({ acao: a, agora, ocupado, onFeito }: { acao: Acao; agora: boolean; ocupado: boolean; onFeito: () => void }) {
  const titulo =
    a.tipo === "quitar" ? (
      <>Quitar o <strong className="font-semibold">{a.apelido}</strong></>
    ) : (
      <>
        Antecipar as {a.parcelas} últimas parcelas do <strong className="font-semibold">{a.apelido}</strong>
      </>
    );
  const efeito =
    a.tipo === "quitar"
      ? a.liberaNoCaixa
        ? `Libera ${formatCurrency(a.liberaPorMes)} por mês`
        : "Libera o FGTS dos próximos anos"
      : `Passa a terminar em ${mesAno(a.terminaEm)}`;

  return (
    <div className={cn("rounded-xl px-4 py-3.5 ring-1", agora ? "bg-marca-50/60 ring-marca-200" : "bg-superficie ring-tinta-200")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="text-[15px] text-tinta-900">{titulo}</p>
        <p className="valor text-[15px] font-semibold text-tinta-900">{formatCurrency(a.valor)}</p>
      </div>
      <p className="mt-1 text-sm text-tinta-600">
        Some {formatCurrency(a.eliminado)} em parcelas · economia de <span className="valor text-marca-700 font-medium">{formatCurrency(a.economia)}</span> · {efeito}
      </p>
      {agora && (
        <button
          onClick={onFeito}
          disabled={ocupado}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-marca hover:bg-marca-forte text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> Fiz isso
        </button>
      )}
    </div>
  );
}

function CartaoEmprestimo({ e, ocupado, onPaguei, onDesfazer }: { e: Emprestimo; ocupado: boolean; onPaguei: () => void; onDesfazer: () => void }) {
  const pg = PAGAMENTO[e.pagamento];
  const progresso = e.parcelasTotal ? e.pagas / e.parcelasTotal : 0;
  const economiaHoje = e.restante - e.quitarHoje;
  return (
    <article className="rounded-2xl bg-superficie ring-1 ring-tinta-200 p-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold text-tinta-900 truncate">{e.apelido}</h3>
          <p className="text-xs text-tinta-500 truncate">
            {e.modalidade} · {e.banco}
            {e.contrato && ` · ${e.contrato}`}
          </p>
        </div>
        <span className={cn("text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap", pg.classe)}>{pg.rotulo}</span>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-tinta-500">Juros</dt>
          <dd className="valor text-[15px] font-semibold text-tinta-900">
            {taxa(e.taxaMensal)} <span className="text-xs font-normal text-tinta-500">a.m.</span>
          </dd>
          {e.taxaEstimada ? (
            <dd className="text-[11px] text-aviso-700">calculada pelo print</dd>
          ) : (
            e.cetMensal && <dd className="text-[11px] text-tinta-500">CET {taxa(e.cetMensal)}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-tinta-500">{e.periodicidade === "anual" ? "Parcela anual" : "Parcela"}</dt>
          <dd className="valor text-[15px] font-semibold text-tinta-900">{formatCurrency(e.proximoValor || e.valorParcela)}</dd>
        </div>
        <div>
          <dt className="text-xs text-tinta-500">Termina</dt>
          <dd className="valor text-[15px] font-semibold text-tinta-900 capitalize">{e.terminaEm ? mesAno(e.terminaEm) : "—"}</dd>
        </div>
      </dl>

      <div>
        <div className="flex justify-between text-xs text-tinta-500 mb-1.5">
          <span>
            {e.pagas} de {e.parcelasTotal} pagas
            {e.parcelasAntecipadas > 0 && `, ${e.parcelasAntecipadas} antecipadas`}
          </span>
          <span>faltam {e.abertas}</span>
        </div>
        <div className="h-1.5 rounded-full bg-tinta-100 overflow-hidden">
          <div className="h-full bg-marca-500 rounded-full" style={{ width: `${Math.max(2, progresso * 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-tinta-50 px-3.5 py-3">
        <div>
          <p className="text-xs text-tinta-500">Falta pagar</p>
          <p className="valor text-sm font-medium text-tinta-900">{formatCurrency(e.restante)}</p>
        </div>
        <div>
          <p className="text-xs text-tinta-500">Quitar hoje</p>
          <p className="valor text-sm font-medium text-tinta-900">{formatCurrency(e.quitarHoje)}</p>
          {economiaHoje > 1 && <p className="valor text-[11px] text-marca-700">{formatCurrency(economiaHoje)} a menos</p>}
        </div>
      </div>

      {e.observacao && <p className="text-xs text-tinta-500">{e.observacao}</p>}

      {e.pagamento === "conta" && e.proximoVencimento && (
        <footer className="flex items-center justify-between gap-3 pt-3 border-t border-tinta-100">
          <p className="text-sm text-tinta-700">
            {e.atrasadas > 0 ? (
              <span className="text-saida-600 font-medium">Parcela de {dataBR(e.proximoVencimento)} em aberto</span>
            ) : (
              <>Próxima em {dataBR(e.proximoVencimento)}</>
            )}
          </p>
          <div className="flex items-center gap-1">
            {e.pagas > 0 && (
              <button onClick={onDesfazer} disabled={ocupado} aria-label="Desfazer último pagamento" title="Desfazer último pagamento" className="p-2 rounded-lg text-tinta-400 hover:text-tinta-700 hover:bg-tinta-100 disabled:opacity-50">
                <Undo2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onPaguei} disabled={ocupado} className="px-3 py-1.5 rounded-lg ring-1 ring-tinta-200 text-sm font-medium text-tinta-800 hover:bg-tinta-100 transition-colors disabled:opacity-50">
              Paguei
            </button>
          </div>
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

interface ItemDica {
  name: string;
  value: number;
  color?: string;
  payload: LinhaPlano & { rotulo: string };
}

function DicaSaldo({ active, payload }: { active?: boolean; payload?: ItemDica[] }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="rounded-xl bg-superficie ring-1 ring-tinta-200 shadow-lg px-3 py-2.5 text-xs min-w-[190px]">
      <p className="font-medium text-tinta-900 capitalize mb-1">Fim de {m.rotulo}</p>
      {payload.map((p) => (
        <p key={p.name} className="valor flex justify-between gap-4 text-tinta-600">
          <span>{p.name}</span>
          <span className="text-tinta-900 font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
      {m.pagoNoPlano > 0 && (
        <p className="valor flex justify-between gap-4 text-aviso-700 mt-1 pt-1 border-t border-tinta-100">
          <span>Antecipado no mês</span>
          <span>{formatCurrency(m.pagoNoPlano)}</span>
        </p>
      )}
    </div>
  );
}

function DicaParcelas({ active, payload }: { active?: boolean; payload?: ItemDica[] }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="rounded-xl bg-superficie ring-1 ring-tinta-200 shadow-lg px-3 py-2.5 text-xs min-w-[180px]">
      <p className="font-medium text-tinta-900 capitalize mb-1">{m.rotulo}</p>
      {payload.map((p) => (
        <p key={p.name} className="valor flex items-center justify-between gap-4 text-tinta-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="text-tinta-900 font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
      {m.parcelasSem - m.parcelasCom > 0.5 && (
        <p className="valor flex justify-between gap-4 text-marca-700 mt-1 pt-1 border-t border-tinta-100">
          <span>Livre no mês</span>
          <span>{formatCurrency(m.parcelasSem - m.parcelasCom)}</span>
        </p>
      )}
    </div>
  );
}

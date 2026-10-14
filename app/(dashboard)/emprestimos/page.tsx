"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Check, ChevronDown, Undo2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { useToast } from "@/components/ui/Toast";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { proximaEmAberto, ultimaParcela, valorDaParcela, vencimento, type EmprestimoBase } from "@/lib/emprestimos";

/**
 * Onde ficam os empréstimos: cada contrato com todas as parcelas, pagas e em
 * aberto. Os números vêm da mesma API da tela de quitação. O que sai do FGTS
 * aparece à parte, porque não sai do caixa.
 */

interface Emprestimo extends EmprestimoBase {
  pagamento: "conta" | "folha" | "fgts";
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
  emprestimos: Emprestimo[];
}

type Situacao = "paga" | "aberta" | "atrasada" | "antecipada" | "quitada";

const COMO_PAGA = {
  conta: "Sai da conta",
  folha: "Desconta no salário",
  fgts: "Sai do FGTS",
} as const;

const SITUACAO: Record<Situacao, { rotulo: string; classe: string }> = {
  paga: { rotulo: "Paga", classe: "text-marca-700 bg-marca-50" },
  aberta: { rotulo: "Em aberto", classe: "text-tinta-600 bg-tinta-100" },
  atrasada: { rotulo: "Atrasada", classe: "text-saida-700 bg-saida-50" },
  antecipada: { rotulo: "Antecipada", classe: "text-tinta-500 bg-tinta-100" },
  quitada: { rotulo: "Quitada", classe: "text-tinta-500 bg-tinta-100" },
};

const dia = (d: Date | string) => new Date(typeof d === "string" ? d.slice(0, 10) + "T12:00:00" : d.toISOString().slice(0, 10) + "T12:00:00");
const dataBR = (d: Date | string) => format(dia(d), "dd/MM/yyyy");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Todas as parcelas do contrato, com a situação de cada uma hoje. */
function parcelas(e: Emprestimo, hoje: Date) {
  const proxima = proximaEmAberto(e, hoje);
  const ultima = ultimaParcela(e);
  const quitado = e.quitadoEm ? new Date(e.quitadoEm) : null;
  return Array.from({ length: e.parcelasTotal }, (_, i) => {
    const k = i + 1;
    const venc = vencimento(e, k);
    let situacao: Situacao;
    if (k > ultima) situacao = "antecipada";
    else if (k < proxima) situacao = "paga";
    else if (quitado && venc >= quitado) situacao = "quitada";
    else situacao = venc < hoje ? "atrasada" : "aberta";
    return { k, venc, valor: valorDaParcela(e, k), situacao };
  });
}

export default function EmprestimosPage() {
  const { toast } = useToast();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  const buscar = useCallback(async () => {
    const res = await fetch("/api/quitacao");
    if (res.ok) setDados(await res.json());
  }, []);
  useEffect(() => { buscar(); }, [buscar]);
  useAoLancar(buscar);

  const hoje = useMemo(() => (dados ? new Date(dados.hoje) : new Date()), [dados]);

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

  if (!dados) {
    return (
      <div className="max-w-5xl mx-auto grid gap-4" aria-busy>
        <div className="h-10 w-64 rounded-lg bg-tinta-100 animate-pulse" />
        <div className="h-28 rounded-3xl bg-tinta-100 animate-pulse" />
        <div className="h-96 rounded-2xl bg-tinta-100 animate-pulse" />
      </div>
    );
  }

  const ativos = dados.emprestimos.filter((e) => e.abertas > 0).sort((a, b) => b.taxaMensal - a.taxaMensal);
  const doCaixa = ativos.filter((e) => e.pagamento !== "fgts");
  const doFgts = ativos.filter((e) => e.pagamento === "fgts");
  const quitados = dados.emprestimos.filter((e) => e.abertas === 0);
  const porMes = doCaixa.filter((e) => e.periodicidade === "mensal").reduce((s, e) => s + e.proximoValor, 0);
  const devendo = doCaixa.reduce((s, e) => s + e.restante, 0);
  const quitarTudo = doCaixa.reduce((s, e) => s + e.quitarHoje, 0);
  const fgtsRestante = doFgts.reduce((s, e) => s + e.restante, 0);

  const lista = (itens: Emprestimo[]) => (
    <div className="grid gap-3">
      {itens.map((e) => (
        <Contrato
          key={e.id}
          e={e}
          hoje={hoje}
          aberto={aberto === e.id}
          gravando={gravando}
          onAbrir={() => setAberto((v) => (v === e.id ? null : e.id))}
          onPaguei={() => acao(e.id, { acao: "pagar" }, `Parcela do ${e.apelido} marcada como paga`)}
          onDesfazer={() => acao(e.id, { acao: "desfazer" }, "Pagamento desfeito")}
        />
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Cabecalho
        titulo="Empréstimos"
        subtitulo="Cada contrato com todas as parcelas: as pagas, as que faltam e quando acaba. Para antecipar ou quitar, use a tela de quitação."
      >
        <Link
          href="/quitacao"
          className="px-3.5 py-2 rounded-lg bg-superficie ring-1 ring-tinta-200 text-sm font-medium text-tinta-800 hover:bg-tinta-100 transition-colors"
        >
          Quitar ou antecipar
        </Link>
      </Cabecalho>

      <section className="rounded-3xl bg-superficie ring-1 ring-tinta-200 p-2 sm:p-3 shadow-sm">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Parcelas por mês" valor={formatCurrency(porMes)} />
          <Numero rotulo="Ainda faltam pagar" valor={formatCurrency(devendo)} />
          <Numero rotulo="Para quitar tudo hoje" valor={formatCurrency(quitarTudo)} />
          <Numero rotulo="Pago pelo FGTS (fora do caixa)" valor={formatCurrency(fgtsRestante)} />
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-[15px] font-semibold text-tinta-900">Saem do seu dinheiro</h2>
        <p className="text-xs text-tinta-500 mt-0.5 mb-4">Do juro mais caro para o mais barato. Toque no contrato para ver as parcelas.</p>
        {doCaixa.length ? lista(doCaixa) : <p className="text-sm text-tinta-500">Nenhum empréstimo em aberto.</p>}
      </section>

      {doFgts.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold text-tinta-900">Pagos pelo FGTS</h2>
          <p className="text-xs text-tinta-500 mt-0.5 mb-4">
            Antecipação do saque-aniversário: o próprio FGTS paga todo ano. Não entram nas saídas, na projeção nem no painel.
          </p>
          {lista(doFgts)}
        </section>
      )}

      {quitados.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-tinta-600 mb-2">Quitados</h2>
          <ul className="rounded-2xl bg-superficie ring-1 ring-tinta-200 divide-y divide-tinta-100">
            {quitados.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm text-tinta-800">
                <Check className="inline w-4 h-4 text-marca-600 mr-1.5 -mt-0.5" />
                {e.apelido}
                {e.quitadoEm && <span className="text-tinta-500"> · quitado em {dataBR(e.quitadoEm)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="px-3 sm:px-4 py-3">
      <dt className="text-xs text-tinta-500">{rotulo}</dt>
      <dd className="valor mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-tinta-900">{valor}</dd>
    </div>
  );
}

function Contrato({
  e,
  hoje,
  aberto,
  gravando,
  onAbrir,
  onPaguei,
  onDesfazer,
}: {
  e: Emprestimo;
  hoje: Date;
  aberto: boolean;
  gravando: boolean;
  onAbrir: () => void;
  onPaguei: () => void;
  onDesfazer: () => void;
}) {
  const lista = parcelas(e, hoje);
  const total = ultimaParcela(e);
  const progresso = total ? (e.pagas / total) * 100 : 100;
  const anual = e.periodicidade === "anual";

  return (
    <article className="rounded-2xl bg-superficie ring-1 ring-tinta-200">
      <button onClick={onAbrir} aria-expanded={aberto} className="w-full text-left p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold text-tinta-900">{e.apelido}</h3>
            <p className="text-xs text-tinta-500 mt-0.5">
              {e.banco}
              {e.contrato ? ` · contrato ${e.contrato}` : ""} · {e.modalidade}
            </p>
          </div>
          <div className="text-right">
            <p className="valor text-[17px] font-semibold text-tinta-900">
              {formatCurrency(e.proximoValor)}
              <span className="text-xs font-normal text-tinta-500">{anual ? " /ano" : " /mês"}</span>
            </p>
            <p className="text-xs text-tinta-500">{COMO_PAGA[e.pagamento]}</p>
          </div>
        </div>

        <div className="mt-3 h-1.5 rounded-full bg-tinta-100 overflow-hidden">
          <div className="h-full rounded-full bg-marca" style={{ width: `${progresso}%` }} />
        </div>

        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <Dado rotulo="Pagas" valor={`${e.pagas} de ${total}`} />
          <Dado rotulo="Próxima" valor={e.proximoVencimento ? dataBR(e.proximoVencimento) : "—"} alerta={e.atrasadas > 0} />
          <Dado rotulo="Termina em" valor={e.terminaEm ? dataBR(e.terminaEm) : "—"} />
          <Dado rotulo="Juros" valor={`${pct(e.taxaMensal)} ao mês${e.taxaEstimada ? " (estimado)" : ""}`} />
        </dl>

        <p className="mt-3 flex items-center gap-1 text-xs font-medium text-marca-700">
          {aberto ? "Esconder parcelas" : `Ver as ${e.parcelasTotal} parcelas`}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", aberto && "rotate-180")} />
        </p>
      </button>

      {aberto && (
        <div className="border-t border-tinta-200">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 text-sm">
            <span className="text-tinta-600">
              Faltam <span className="valor font-medium text-tinta-900">{formatCurrency(e.restante)}</span>
              {e.pagamento !== "fgts" && (
                <>
                  {" "}· quitar hoje sai por cerca de <span className="valor font-medium text-tinta-900">{formatCurrency(e.quitarHoje)}</span>
                </>
              )}
            </span>
            {e.pagamento === "conta" && (
              <span className="flex items-center gap-2">
                {e.pagas > 0 && (
                  <button
                    onClick={onDesfazer}
                    disabled={gravando}
                    className="text-xs font-medium text-tinta-500 hover:text-tinta-800 flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Desfazer
                  </button>
                )}
                <button
                  onClick={onPaguei}
                  disabled={gravando || e.abertas === 0}
                  className="px-3 py-1.5 rounded-lg bg-marca hover:bg-marca-forte text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Paguei a próxima
                </button>
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto border-t border-tinta-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-superficie">
                <tr className="border-b border-tinta-200 text-xs text-tinta-500">
                  <th className="px-4 sm:px-5 py-2 text-left font-medium">Parcela</th>
                  <th className="px-4 py-2 text-left font-medium">Vencimento</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 sm:px-5 py-2 text-right font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-100">
                {lista.map((p) => (
                  <tr key={p.k} className={cn("valor", (p.situacao === "antecipada" || p.situacao === "quitada") && "text-tinta-400")}>
                    <td className="px-4 sm:px-5 py-2 whitespace-nowrap">
                      {p.k}/{e.parcelasTotal}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{dataBR(p.venc)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{formatCurrency(p.valor)}</td>
                    <td className="px-4 sm:px-5 py-2 text-right">
                      <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded-md", SITUACAO[p.situacao].classe)}>
                        {SITUACAO[p.situacao].rotulo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {e.observacao && <p className="px-4 sm:px-5 py-3 border-t border-tinta-100 text-xs text-tinta-500">{e.observacao}</p>}
        </div>
      )}
    </article>
  );
}

function Dado({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-tinta-500">{rotulo}</dt>
      <dd className={cn("valor", alerta ? "text-saida-700 font-medium" : "text-tinta-900")}>{valor}</dd>
    </div>
  );
}

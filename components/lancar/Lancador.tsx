"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check, X, Loader2, AlertTriangle, CornerDownLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency } from "@/lib/utils";
import { avisarLancamento } from "@/lib/eventos";
import { interpretar, ROTULO_TIPO, type Lancamento, type TipoLancamento } from "@/lib/interpretar";
import { Campo, ListaEditavel } from "@/components/ui/CampoLista";

/** Tipagem mínima da Web Speech API, que o TypeScript do DOM ainda não traz. */
interface ResultadoFala {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoFala {
  resultIndex: number;
  results: ArrayLike<ResultadoFala>;
}
interface EventoErroFala {
  error: string;
}
interface Reconhecimento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (evento: EventoFala) => void;
  onerror: (evento: EventoErroFala) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
type ConstrutorReconhecimento = new () => Reconhecimento;

declare global {
  interface Window {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  }
}

interface Opcoes {
  cartoes: string[];
  fontes: string[];
  categorias: string[];
  responsaveis: string[];
  responsavelPadrao: string;
}

const TIPOS: TipoLancamento[] = ["despesa_variavel", "despesa_fixa", "receita_variavel", "receita_fixa"];

const EXEMPLOS = [
  "Tênis de 450 reais em 3x no Nubank da Juliana",
  "Mercado 320 no Bradesco",
  "Academia 120 reais fixo",
  "Recebi 1500 de freela em 2x",
];

const ehVariavel = (t: TipoLancamento) => t === "despesa_variavel" || t === "receita_variavel";
const ehReceita = (t: TipoLancamento) => t === "receita_variavel" || t === "receita_fixa";

const inputClass =
  "campo";

/** Frase que diz em português onde o lançamento vai cair, para conferir de relance. */
function resumo(l: Lancamento): string {
  if (!l.valorTotal) return "Falta o valor.";
  const quando = l.data ? format(new Date(`${l.data}T12:00:00`), "d 'de' MMM", { locale: ptBR }) : "";
  if (l.tipo === "despesa_variavel") {
    const parcela = l.parcelasTotal > 1 ? `${l.parcelasTotal}x de ${formatCurrency(l.valorTotal / l.parcelasTotal)}` : formatCurrency(l.valorTotal);
    return `${parcela} no ${l.cartao || "cartão que faltou"}, primeira em ${quando}.`;
  }
  if (l.tipo === "receita_variavel") {
    const parcela = l.parcelasTotal > 1 ? `${l.parcelasTotal}x de ${formatCurrency(l.valorTotal / l.parcelasTotal)}` : formatCurrency(l.valorTotal);
    return `Entra ${parcela}${l.cartao ? ` via ${l.cartao}` : ""}, a partir de ${quando}.`;
  }
  if (l.tipo === "despesa_fixa") return `Sai ${formatCurrency(l.valorTotal)} todo mês, vence dia ${l.data.slice(8, 10)}.`;
  return `Entra ${formatCurrency(l.valorTotal)} todo mês, dia ${l.data.slice(8, 10)}.`;
}

export function Lancador({ autoFoco = false }: { autoFoco?: boolean }) {
  const { toast } = useToast();
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [suportaVoz, setSuportaVoz] = useState(false);
  const [texto, setTexto] = useState("");
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [interpretando, setInterpretando] = useState(false);
  const [historico, setHistorico] = useState<{ rotulo: string; valor: number; receita: boolean }[]>([]);

  const reconhecimentoRef = useRef<Reconhecimento | null>(null);
  const finalRef = useRef("");
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/lancar/opcoes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOpcoes(d))
      .catch(() => toast("Não consegui carregar cartões e categorias", "error"));

    setSuportaVoz(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
    if (autoFoco) campoRef.current?.focus();
    return () => reconhecimentoRef.current?.stop();
  }, [toast, autoFoco]);

  function interpretarLocal(fala: string, o: Opcoes): Lancamento {
    return interpretar(fala, {
      cartoes: o.cartoes,
      fontes: o.fontes,
      categorias: o.categorias,
      responsavelPadrao: o.responsavelPadrao,
    });
  }

  /** Tenta o Claude. Se a chave não estiver configurada ou a chamada falhar, usa o interpretador local. */
  async function interpretarTexto(fala: string) {
    if (!fala.trim() || !opcoes) return;
    const o = opcoes;

    setInterpretando(true);
    try {
      const resposta = await fetch("/api/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fala,
          cartoes: o.cartoes,
          fontes: o.fontes,
          categorias: o.categorias,
          responsaveis: o.responsaveis,
          hoje: format(new Date(), "yyyy-MM-dd"),
        }),
      });

      if (resposta.ok) {
        const bruto = await resposta.json();
        if (bruto && typeof bruto.tipo === "string" && ROTULO_TIPO[bruto.tipo as TipoLancamento]) {
          setLancamento({
            tipo: bruto.tipo,
            descricao: String(bruto.descricao ?? ""),
            valorTotal: typeof bruto.valorTotal === "number" ? bruto.valorTotal : null,
            parcelasTotal: Number(bruto.parcelasTotal) > 0 ? Number(bruto.parcelasTotal) : 1,
            cartao: String(bruto.cartao ?? ""),
            categoria: o.categorias.includes(bruto.categoria) ? bruto.categoria : String(bruto.categoria ?? "Outros"),
            responsavel: String(bruto.responsavel || o.responsavelPadrao),
            data: /^\d{4}-\d{2}-\d{2}$/.test(bruto.data) ? bruto.data : format(new Date(), "yyyy-MM-dd"),
            conferir: Array.isArray(bruto.conferir) ? bruto.conferir.map(String) : [],
            transcricao: fala,
          });
          return;
        }
      }
      setLancamento(interpretarLocal(fala, o));
    } catch {
      setLancamento(interpretarLocal(fala, o));
    } finally {
      setInterpretando(false);
    }
  }

  function comecar() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const rc = new SR();
    rc.lang = "pt-BR";
    rc.continuous = true;
    rc.interimResults = true;

    finalRef.current = "";
    setTexto("");
    setLancamento(null);

    rc.onresult = (evento: EventoFala) => {
      let parcial = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const trecho = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) finalRef.current += trecho + " ";
        else parcial += trecho;
      }
      setTexto((finalRef.current + parcial).trim());
    };

    rc.onerror = (evento: EventoErroFala) => {
      setOuvindo(false);
      if (evento.error === "not-allowed") toast("Libere o microfone no navegador ou digite a frase", "error");
    };

    rc.onend = () => {
      setOuvindo(false);
      interpretarTexto(finalRef.current.trim());
    };

    rc.start();
    reconhecimentoRef.current = rc;
    setOuvindo(true);
  }

  function parar() {
    reconhecimentoRef.current?.stop();
    setOuvindo(false);
  }

  async function lancar() {
    if (!lancamento || !lancamento.valorTotal) return;

    const corpo: Record<string, unknown> = {
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      valorTotal: lancamento.valorTotal,
      categoria: lancamento.categoria,
      responsavel: lancamento.responsavel,
      data: lancamento.data,
    };
    if (ehVariavel(lancamento.tipo)) corpo.parcelasTotal = lancamento.parcelasTotal;
    if (lancamento.tipo === "despesa_variavel") corpo.cartao = lancamento.cartao;
    if (lancamento.tipo === "receita_variavel") corpo.fonte = lancamento.cartao;
    if (lancamento.tipo === "receita_fixa") corpo.tipoReceita = lancamento.categoria;

    setSalvando(true);
    try {
      const resposta = await fetch("/api/lancar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!resposta.ok) throw new Error();

      setHistorico((h) => [
        { rotulo: `${lancamento.descricao}, ${ROTULO_TIPO[lancamento.tipo].toLowerCase()}`, valor: lancamento.valorTotal!, receita: ehReceita(lancamento.tipo) },
        ...h,
      ]);
      toast(`${lancamento.descricao} lançado`);
      avisarLancamento();
      setLancamento(null);
      setTexto("");
      campoRef.current?.focus();
    } catch {
      toast("Não consegui lançar. Confira os campos marcados", "error");
    } finally {
      setSalvando(false);
    }
  }

  const alterar = (campo: keyof Lancamento, valor: unknown) =>
    setLancamento((l) => (l ? { ...l, [campo]: valor, conferir: l.conferir.filter((c) => !c.startsWith(String(campo).slice(0, 4))) } : l));

  const precisaConferir = (campo: string) => lancamento?.conferir.includes(campo) ?? false;

  return (
    <div className="space-y-5">
      {/* Frase: digitada ou falada. Enter lê. */}
      <div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border bg-superficie pl-4 pr-2 py-2 transition-colors",
            ouvindo ? "border-saida-400 ring-4 ring-saida-500/10" : "border-tinta-200 focus-within:border-marca-500 focus-within:ring-4 focus-within:ring-marca-500/10"
          )}
        >
          <input
            ref={campoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && interpretarTexto(texto)}
            placeholder={ouvindo ? "Pode falar…" : "Mercado 320 no Bradesco"}
            aria-label="O que entrou ou saiu"
            className="flex-1 min-w-0 bg-transparent py-2 text-base text-tinta-900 placeholder:text-tinta-400 focus:outline-none"
          />
          {interpretando ? (
            <Loader2 className="w-5 h-5 m-2.5 animate-spin text-tinta-400" />
          ) : texto.trim() && !ouvindo ? (
            <button
              onClick={() => interpretarTexto(texto)}
              disabled={!opcoes}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-tinta-900 text-tinta-50 text-sm font-medium disabled:opacity-40"
            >
              Ler <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          ) : null}
          {suportaVoz && (
            <button
              onClick={ouvindo ? parar : comecar}
              disabled={!opcoes || interpretando}
              aria-label={ouvindo ? "Parar de ouvir" : "Falar"}
              className={cn(
                "w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40",
                ouvindo ? "bg-saida-500 text-white" : "bg-marca-50 text-marca-700 hover:bg-marca-100"
              )}
            >
              {ouvindo ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-tinta-500 min-h-[1rem]">
          {interpretando
            ? "Entendendo a frase…"
            : ouvindo
              ? "Ouvindo. Toque no quadrado quando terminar."
              : "Diga o que foi, o valor, em quantas vezes e onde. Você confere antes de gravar."}
        </p>
      </div>

      {!texto && !lancamento && (
        <div className="flex flex-wrap gap-1.5">
          {EXEMPLOS.map((e) => (
            <button
              key={e}
              onClick={() => { setTexto(e); campoRef.current?.focus(); }}
              className="text-xs text-tinta-600 bg-tinta-100 hover:bg-tinta-200 rounded-full px-3 py-1.5 transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Conferência */}
      {lancamento && opcoes && (
        <div className="rounded-2xl border border-tinta-200 bg-superficie p-4 sm:p-5 space-y-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-tinta-900">Confere antes de gravar</p>
              <p className={cn("text-sm mt-0.5", ehReceita(lancamento.tipo) ? "text-marca-700" : "text-saida-600")}>
                {resumo(lancamento)}
              </p>
            </div>
            <button onClick={() => setLancamento(null)} aria-label="Descartar" className="p-1.5 -m-1 hover:bg-tinta-100 rounded-lg">
              <X className="w-4 h-4 text-tinta-400" />
            </button>
          </div>

          {lancamento.conferir.length > 0 && (
            <div className="flex items-start gap-2 bg-aviso-50 text-aviso-800 rounded-xl px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Não tive certeza de: {lancamento.conferir.join(", ")}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1 p-1 bg-tinta-100 rounded-xl" role="radiogroup" aria-label="Tipo">
            {TIPOS.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={lancamento.tipo === t}
                onClick={() => alterar("tipo", t)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  lancamento.tipo === t ? "bg-superficie text-tinta-900 shadow-sm" : "text-tinta-500 hover:text-tinta-800"
                )}
              >
                {ROTULO_TIPO[t]}
              </button>
            ))}
          </div>

          <Campo rotulo="Descrição" alerta={precisaConferir("descrição")}>
            <input value={lancamento.descricao} onChange={(e) => alterar("descricao", e.target.value)} className={inputClass} />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor total" alerta={precisaConferir("valor")}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={lancamento.valorTotal ?? ""}
                onChange={(e) => alterar("valorTotal", e.target.value ? parseFloat(e.target.value) : null)}
                className={cn(inputClass, "valor")}
              />
            </Campo>

            {ehVariavel(lancamento.tipo) ? (
              <Campo rotulo="Parcelas">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={lancamento.parcelasTotal}
                  onChange={(e) => alterar("parcelasTotal", Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className={cn(inputClass, "valor")}
                />
              </Campo>
            ) : (
              <Campo rotulo={lancamento.tipo === "despesa_fixa" ? "Vencimento" : "Data"}>
                <input type="date" value={lancamento.data} onChange={(e) => alterar("data", e.target.value)} className={inputClass} />
              </Campo>
            )}
          </div>

          {lancamento.tipo === "despesa_variavel" && (
            <Campo rotulo="Cartão" alerta={precisaConferir("cartão")}>
              <ListaEditavel valor={lancamento.cartao} opcoes={opcoes.cartoes} aoMudar={(v) => alterar("cartao", v)} placeholder="Em qual cartão" />
            </Campo>
          )}

          {lancamento.tipo === "receita_variavel" && (
            <Campo rotulo="Fonte" alerta={precisaConferir("fonte")}>
              <ListaEditavel valor={lancamento.cartao} opcoes={opcoes.fontes} aoMudar={(v) => alterar("cartao", v)} placeholder="De onde vem" />
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Categoria" alerta={precisaConferir("categoria")}>
              <select value={lancamento.categoria} onChange={(e) => alterar("categoria", e.target.value)} className={inputClass}>
                {opcoes.categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Campo>

            {ehVariavel(lancamento.tipo) ? (
              <Campo rotulo="Primeira parcela">
                <input type="date" value={lancamento.data} onChange={(e) => alterar("data", e.target.value)} className={inputClass} />
              </Campo>
            ) : (
              <Campo rotulo="Responsável">
                <ListaEditavel valor={lancamento.responsavel} opcoes={opcoes.responsaveis} aoMudar={(v) => alterar("responsavel", v)} placeholder="Quem" />
              </Campo>
            )}
          </div>

          {ehVariavel(lancamento.tipo) && (
            <Campo rotulo="Responsável">
              <ListaEditavel valor={lancamento.responsavel} opcoes={opcoes.responsaveis} aoMudar={(v) => alterar("responsavel", v)} placeholder="Quem" />
            </Campo>
          )}

          <button
            onClick={lancar}
            disabled={salvando || !lancamento.valorTotal || !lancamento.descricao.trim()}
            className="w-full flex items-center justify-center gap-2 bg-marca hover:bg-marca-forte text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-40"
          >
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Lançar
          </button>
        </div>
      )}

      {historico.length > 0 && (
        <div>
          <p className="text-xs text-tinta-500 mb-2">Lançado agora</p>
          <ul className="divide-y divide-tinta-100 rounded-xl border border-tinta-200 bg-superficie">
            {historico.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="text-tinta-700 truncate">{h.rotulo}</span>
                <span className={cn("valor font-medium flex-shrink-0", h.receita ? "text-marca-700" : "text-tinta-900")}>
                  {formatCurrency(h.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

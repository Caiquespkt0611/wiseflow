"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check, X, Loader2, Keyboard, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn, formatCurrency } from "@/lib/utils";
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

const TIPOS: TipoLancamento[] = [
  "despesa_variavel",
  "despesa_fixa",
  "receita_variavel",
  "receita_fixa",
];

const EXEMPLOS = [
  "Tênis de 450 reais em 3x no Nubank da Juliana",
  "Mercado 320 no Bradesco",
  "Academia 120 reais fixo",
  "Recebi 1500 de freela em 2x",
];

export default function LancarPage() {
  const { toast } = useToast();
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [suportaVoz, setSuportaVoz] = useState(true);
  const [transcricao, setTranscricao] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState("");
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [interpretando, setInterpretando] = useState(false);
  const [historico, setHistorico] = useState<{ rotulo: string; valor: number }[]>([]);

  const reconhecimentoRef = useRef<Reconhecimento | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    fetch("/api/lancar/opcoes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOpcoes(d))
      .catch(() => toast("Não consegui carregar cartões e categorias", "error"));

    if (!(window.SpeechRecognition ?? window.webkitSpeechRecognition)) {
      setSuportaVoz(false);
      setDigitando(true);
    }
  }, [toast]);

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
            data: /^\d{4}-\d{2}-\d{2}$/.test(bruto.data) ? bruto.data : new Date().toISOString().slice(0, 10),
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
    setTranscricao("");
    setLancamento(null);

    rc.onresult = (evento: EventoFala) => {
      let parcial = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const trecho = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) finalRef.current += trecho + " ";
        else parcial += trecho;
      }
      setTranscricao((finalRef.current + parcial).trim());
    };

    rc.onerror = (evento: EventoErroFala) => {
      setOuvindo(false);
      if (evento.error === "not-allowed") {
        toast("Preciso da permissão do microfone", "error");
        setDigitando(true);
      }
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

    const variavel =
      lancamento.tipo === "despesa_variavel" || lancamento.tipo === "receita_variavel";

    const corpo: Record<string, unknown> = {
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      valorTotal: lancamento.valorTotal,
      categoria: lancamento.categoria,
      responsavel: lancamento.responsavel,
      data: lancamento.data,
    };
    if (variavel) corpo.parcelasTotal = lancamento.parcelasTotal;
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
        { rotulo: `${lancamento.descricao} · ${ROTULO_TIPO[lancamento.tipo]}`, valor: lancamento.valorTotal! },
        ...h,
      ]);
      toast(`${lancamento.descricao} lançado`);
      setLancamento(null);
      setTranscricao("");
      setTexto("");
    } catch {
      toast("Não consegui lançar. Confira os campos", "error");
    } finally {
      setSalvando(false);
    }
  }

  const alterar = (campo: keyof Lancamento, valor: unknown) =>
    setLancamento((l) => (l ? { ...l, [campo]: valor, conferir: l.conferir.filter((c) => !c.startsWith(String(campo).slice(0, 4))) } : l));

  const precisaConferir = (campo: string) => lancamento?.conferir.includes(campo) ?? false;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lançar por voz</h1>
        <p className="text-sm text-gray-500">
          Fale o que foi, o valor, as parcelas e se é fixo. Você confere antes de gravar.
        </p>
      </div>

      {/* Microfone */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-4">
        {suportaVoz && (
          <button
            onClick={ouvindo ? parar : comecar}
            disabled={!opcoes || interpretando}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40",
              ouvindo
                ? "bg-red-500 text-white scale-110 animate-pulse"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            )}
          >
            {ouvindo ? <Square className="w-8 h-8" /> : <Mic className="w-10 h-10" />}
          </button>
        )}

        <p className="text-sm text-gray-500 text-center min-h-[1.25rem]">
          {interpretando
            ? "Entendendo o que você falou..."
            : ouvindo
              ? "Ouvindo. Toque no quadrado quando terminar."
              : suportaVoz
                ? "Toque e fale"
                : "Este navegador não reconhece voz, digite abaixo"}
        </p>

        {transcricao && (
          <p className="w-full text-center text-gray-800 bg-gray-50 rounded-xl px-4 py-3 text-sm">
            {transcricao}
          </p>
        )}

        {!ouvindo && (
          <button
            onClick={() => setDigitando((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <Keyboard className="w-3 h-3" />
            {digitando ? "esconder o teclado" : "prefiro digitar"}
          </button>
        )}

        {digitando && (
          <div className="w-full flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && interpretarTexto(texto)}
              placeholder="Tênis de 450 reais em 3x no Nubank da Juliana"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => interpretarTexto(texto)}
              disabled={!opcoes || interpretando}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Ler
            </button>
          </div>
        )}

        {!transcricao && !lancamento && (
          <div className="w-full pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400 mb-2 text-center">Exemplos que funcionam</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {EXEMPLOS.map((e) => (
                <span key={e} className="text-xs text-gray-500 bg-gray-50 rounded-full px-2.5 py-1">
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Conferência */}
      {lancamento && opcoes && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Confere antes de gravar</h2>
            <button onClick={() => setLancamento(null)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {lancamento.conferir.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Não tive certeza de: {lancamento.conferir.join(", ")}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t}
                onClick={() => alterar("tipo", t)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                  lancamento.tipo === t
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                )}
              >
                {ROTULO_TIPO[t]}
              </button>
            ))}
          </div>

          <Campo rotulo="Descrição" alerta={precisaConferir("descrição")}>
            <input
              value={lancamento.descricao}
              onChange={(e) => alterar("descricao", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor total" alerta={precisaConferir("valor")}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={lancamento.valorTotal ?? ""}
                onChange={(e) => alterar("valorTotal", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </Campo>

            {(lancamento.tipo === "despesa_variavel" || lancamento.tipo === "receita_variavel") && (
              <Campo rotulo="Parcelas">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={lancamento.parcelasTotal}
                  onChange={(e) => alterar("parcelasTotal", Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </Campo>
            )}
          </div>

          {lancamento.valorTotal && lancamento.parcelasTotal > 1 &&
            (lancamento.tipo === "despesa_variavel" || lancamento.tipo === "receita_variavel") && (
              <p className="text-xs text-gray-500 -mt-1">
                {lancamento.parcelasTotal}x de {formatCurrency(lancamento.valorTotal / lancamento.parcelasTotal)}
              </p>
            )}

          {lancamento.tipo === "despesa_variavel" && (
            <Campo rotulo="Cartão" alerta={precisaConferir("cartão")}>
              <ListaEditavel
                valor={lancamento.cartao}
                opcoes={opcoes.cartoes}
                aoMudar={(v) => alterar("cartao", v)}
                placeholder="Em qual cartão"
              />
            </Campo>
          )}

          {lancamento.tipo === "receita_variavel" && (
            <Campo rotulo="Fonte" alerta={precisaConferir("fonte")}>
              <ListaEditavel
                valor={lancamento.cartao}
                opcoes={opcoes.fontes}
                aoMudar={(v) => alterar("cartao", v)}
                placeholder="De onde vem"
              />
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Categoria" alerta={precisaConferir("categoria")}>
              <select
                value={lancamento.categoria}
                onChange={(e) => alterar("categoria", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {opcoes.categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Data">
              <input
                type="date"
                value={lancamento.data}
                onChange={(e) => alterar("data", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </Campo>
          </div>

          <Campo rotulo="Responsável">
            <ListaEditavel
              valor={lancamento.responsavel}
              opcoes={opcoes.responsaveis}
              aoMudar={(v) => alterar("responsavel", v)}
              placeholder="Quem"
            />
          </Campo>

          <button
            onClick={lancar}
            disabled={salvando || !lancamento.valorTotal || !lancamento.descricao.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40"
          >
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Lançar
          </button>
        </div>
      )}

      {historico.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Lançado agora</h2>
          <ul className="space-y-2">
            {historico.map((h, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate mr-2">{h.rotulo}</span>
                <span className="font-medium text-gray-900 flex-shrink-0">{formatCurrency(h.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

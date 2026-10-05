"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Loader2, Check, X, AlertTriangle, Undo2, FileText,
  CheckCircle2, PlusCircle, HelpCircle, Ban,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Campo, ListaEditavel } from "@/components/ui/CampoLista";
import { cn, formatCurrency } from "@/lib/utils";
import { rotuloMes, type Confianca, type ItemFatura, type DespesaNoMes } from "@/lib/fatura";

interface Opcoes {
  cartoes: string[];
  fontes: string[];
  categorias: string[];
  responsaveis: string[];
  responsavelPadrao: string;
}

interface Pareado {
  item: ItemFatura;
  despesa: DespesaNoMes;
  confianca: Confianca;
}

interface Leitura {
  cartao: string;
  mesRef: string;
  totalLido: number;
  totalInformado: number | null;
  totalImpresso: number | null;
  diferenca: number | null;
  itensLidos: number;
  arquivos: string[];
  avisos: string[];
  jaTem: Pareado[];
  novos: ItemFatura[];
  sumiu: DespesaNoMes[];
  ignorados: ItemFatura[];
}

interface Novo {
  incluir: boolean;
  descricao: string;
  valorParcela: number;
  parcelaAtual: number;
  parcelasTotal: number;
  categoria: string;
  responsavel: string;
  dataCompra: string | null;
}

interface Importacao {
  id: string;
  cartao: string;
  mesRef: string;
  totalLido: number;
  totalInformado: number | null;
  itensLidos: number;
  criadas: number;
  conferidas: number;
  createdAt: string;
}

const ROTULO_CONFIANCA: Record<Confianca, string> = {
  alta: "parcela e valor batem",
  media: "valor e nome batem",
  baixa: "só o valor bate, confere",
};

/** Diferença aceitável entre a soma lida e o total da fatura. */
const FOLGA_TOTAL = 0.05;

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Passa toda imagem por um canvas antes de enviar. Resolve três coisas de uma vez:
 * o HEIC do iPhone que a API não aceita, o limite de tamanho do request e o custo
 * de token de uma foto de 12 megapixels que ninguém precisa ler inteira.
 */
async function prepararArquivo(arquivo: File): Promise<File> {
  if (arquivo.type === "application/pdf") return arquivo;

  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8)
  );
  if (!blob) throw new Error("imagem");

  const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], nome, { type: "image/jpeg" });
}

export default function FaturaPage() {
  const { toast } = useToast();
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [cartao, setCartao] = useState("");
  const [mesRef, setMesRef] = useState(mesAtual);
  const [total, setTotal] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [lendo, setLendo] = useState(false);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [novos, setNovos] = useState<Novo[]>([]);
  const [marcados, setMarcados] = useState<boolean[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [insistindo, setInsistindo] = useState(false);
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const entradaRef = useRef<HTMLInputElement>(null);

  const carregarImportacoes = useCallback(() => {
    fetch("/api/fatura")
      .then((r) => (r.ok ? r.json() : []))
      .then(setImportacoes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/lancar/opcoes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Opcoes | null) => {
        if (!d) return;
        setOpcoes(d);
        setCartao((c) => c || d.cartoes[0] || "");
      })
      .catch(() => toast("Não consegui carregar os cartões", "error"));
    carregarImportacoes();
  }, [toast, carregarImportacoes]);

  async function escolher(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    try {
      const preparados = await Promise.all(Array.from(lista).slice(0, 8).map(prepararArquivo));
      setArquivos(preparados);
      setLeitura(null);
    } catch {
      toast("Não consegui abrir um dos arquivos. Tente PDF ou JPEG", "error");
    }
  }

  async function ler() {
    if (!cartao.trim() || arquivos.length === 0 || !opcoes) return;

    const corpo = new FormData();
    corpo.append("cartao", cartao.trim());
    corpo.append("mesRef", mesRef);
    if (total.trim()) corpo.append("totalInformado", total.replace(",", "."));
    arquivos.forEach((a) => corpo.append("arquivos", a));

    setLendo(true);
    setInsistindo(false);
    try {
      const resposta = await fetch("/api/fatura/ler", { method: "POST", body: corpo });
      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        if (erro.error === "sem_chave") {
          toast("A leitura de fatura precisa da chave da Anthropic configurada", "error");
        } else if (erro.error === "arquivo_grande") {
          toast("Arquivo grande demais. Mande a fatura em partes", "error");
        } else if (erro.error === "tipo_nao_aceito") {
          toast("Só leio PDF, JPEG, PNG e WebP", "error");
        } else {
          toast("Não consegui ler a fatura", "error");
        }
        return;
      }

      const dados: Leitura = await resposta.json();
      setLeitura(dados);
      setNovos(
        dados.novos.map((n) => ({
          incluir: true,
          descricao: n.descricao,
          valorParcela: n.valor,
          parcelaAtual: n.parcelaAtual ?? 1,
          parcelasTotal: n.parcelasTotal ?? 1,
          categoria: opcoes.categorias.includes(n.categoria) ? n.categoria : "Outros",
          responsavel: opcoes.responsavelPadrao,
          dataCompra: n.dataCompra,
        }))
      );
      setMarcados(dados.jaTem.map(() => true));
    } catch {
      toast("Não consegui ler a fatura", "error");
    } finally {
      setLendo(false);
    }
  }

  const divergente =
    leitura?.diferenca !== null && leitura !== null && Math.abs(leitura.diferenca!) > FOLGA_TOTAL;

  async function confirmar() {
    if (!leitura) return;
    if (divergente && !insistindo) {
      setInsistindo(true);
      return;
    }

    const criar = novos
      .filter((n) => n.incluir && n.descricao.trim() && n.valorParcela > 0)
      .map((n) => ({
        descricao: n.descricao.trim(),
        valorParcela: n.valorParcela,
        parcelaAtual: Math.min(n.parcelaAtual, n.parcelasTotal),
        parcelasTotal: n.parcelasTotal,
        categoria: n.categoria,
        responsavel: n.responsavel,
        dataCompra: n.dataCompra,
      }));
    const conferir = leitura.jaTem.filter((_, i) => marcados[i]).map((p) => p.despesa.id);

    if (criar.length === 0 && conferir.length === 0) {
      toast("Não sobrou nada para gravar", "error");
      return;
    }

    setSalvando(true);
    try {
      const resposta = await fetch("/api/fatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartao: leitura.cartao,
          mesRef: leitura.mesRef,
          totalInformado: leitura.totalInformado,
          totalLido: leitura.totalLido,
          itensLidos: leitura.itensLidos,
          arquivos: leitura.arquivos,
          criar,
          conferir,
        }),
      });
      if (!resposta.ok) throw new Error();

      toast(
        criar.length > 0
          ? `${criar.length} lançamento${criar.length > 1 ? "s" : ""} novo${criar.length > 1 ? "s" : ""}, ${conferir.length} conferido${conferir.length > 1 ? "s" : ""}`
          : `${conferir.length} despesa${conferir.length > 1 ? "s" : ""} conferida${conferir.length > 1 ? "s" : ""}`
      );
      limpar();
      carregarImportacoes();
    } catch {
      toast("Não consegui gravar a importação", "error");
    } finally {
      setSalvando(false);
    }
  }

  function limpar() {
    setLeitura(null);
    setNovos([]);
    setMarcados([]);
    setArquivos([]);
    setTotal("");
    setInsistindo(false);
    if (entradaRef.current) entradaRef.current.value = "";
  }

  async function desfazer(id: string) {
    if (!confirm("Desfaz esta importação? O que ela criou some e o que ela conferiu volta a ficar sem conferência.")) return;
    try {
      const resposta = await fetch(`/api/fatura/${id}`, { method: "DELETE" });
      if (!resposta.ok) throw new Error();
      const dados = await resposta.json();
      toast(`Importação desfeita. ${dados.apagadas} lançamento(s) apagado(s)`);
      carregarImportacoes();
    } catch {
      toast("Não consegui desfazer", "error");
    }
  }

  const alterarNovo = (i: number, campo: keyof Novo, valor: unknown) =>
    setNovos((lista) => lista.map((n, j) => (j === i ? { ...n, [campo]: valor } : n)));

  const totalNovos = novos
    .filter((n) => n.incluir)
    .reduce((soma, n) => soma + n.valorParcela, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Cabecalho
        titulo="Importar fatura"
        subtitulo="Suba o PDF ou o print, diga o cartão e o mês. O que já está lançado só é conferido; o que faltou é criado."
      />

      {/* Envio */}
      <div className="bg-superficie rounded-2xl ring-1 ring-tinta-200 p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Campo rotulo="Cartão">
            <ListaEditavel
              valor={cartao}
              opcoes={opcoes?.cartoes ?? []}
              aoMudar={setCartao}
              placeholder="Qual cartão"
            />
          </Campo>

          <Campo rotulo="Mês da fatura">
            <input
              type="month"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
              className="campo"
            />
          </Campo>

          <Campo rotulo="Total da fatura">
            <input
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="opcional, mas confere a leitura"
              className="campo"
            />
          </Campo>
        </div>

        <div>
          <input
            ref={entradaRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={(e) => escolher(e.target.files)}
            className="hidden"
            id="arquivos-fatura"
          />
          <label
            htmlFor="arquivos-fatura"
            className="flex items-center justify-center gap-2 border-2 border-dashed border-tinta-200 rounded-xl px-4 py-6 text-sm text-tinta-500 cursor-pointer hover:border-marca-400 hover:text-marca-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {arquivos.length === 0
              ? "Escolher o PDF ou os prints da fatura"
              : `${arquivos.length} arquivo${arquivos.length > 1 ? "s" : ""} pronto${arquivos.length > 1 ? "s" : ""}`}
          </label>

          {arquivos.length > 0 && (
            <ul className="mt-2 space-y-1">
              {arquivos.map((a) => (
                <li key={a.name} className="flex items-center gap-2 text-xs text-tinta-500">
                  <FileText className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{a.name}</span>
                  <span className="text-tinta-300">{(a.size / 1024 / 1024).toFixed(1)} MB</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-tinta-400">
            Fatura comprida cabe em vários prints. Mande todos de uma vez, eu leio como uma fatura só.
          </p>
        </div>

        <button
          onClick={ler}
          disabled={lendo || arquivos.length === 0 || !cartao.trim()}
          className="w-full flex items-center justify-center gap-2 bg-tinta-900 hover:bg-tinta-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40"
        >
          {lendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          {lendo ? "Lendo a fatura..." : "Ler a fatura"}
        </button>
      </div>

      {leitura && (
        <>
          {/* Conferência do total */}
          <div
            className={cn(
              "rounded-2xl border p-5",
              divergente ? "bg-aviso-50 border-aviso-200" : "bg-superficie border-tinta-100 shadow-sm"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-tinta-500">
                  {leitura.cartao}, {rotuloMes(leitura.mesRef)}, {leitura.itensLidos} linhas lidas
                </p>
                <p className="text-xl font-bold text-tinta-900 mt-1">
                  {formatCurrency(leitura.totalLido)}
                </p>
                {leitura.diferenca !== null && (
                  <p className={cn("text-xs mt-1", divergente ? "text-aviso-700" : "text-marca-600")}>
                    {divergente
                      ? `Difere em ${formatCurrency(Math.abs(leitura.diferenca))} do total da fatura. Faltou página ou algum valor saiu errado.`
                      : "Bate com o total da fatura."}
                  </p>
                )}
                {leitura.diferenca === null && (
                  <p className="text-xs text-tinta-400 mt-1">
                    Sem o total da fatura eu não tenho como saber se li tudo.
                  </p>
                )}
              </div>
              <button onClick={limpar} className="p-1 hover:bg-white/60 rounded-lg flex-shrink-0">
                <X className="w-4 h-4 text-tinta-400" />
              </button>
            </div>

            {leitura.avisos.length > 0 && (
              <ul className="mt-3 space-y-1">
                {leitura.avisos.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-aviso-800">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Novos */}
          <Bloco
            icone={<PlusCircle className="w-4 h-4 text-marca-600" />}
            titulo="Novos"
            resumo={`${novos.filter((n) => n.incluir).length} de ${novos.length}, ${formatCurrency(totalNovos)}`}
            vazio="Nada novo nesta fatura. Tudo já estava lançado."
            temItens={novos.length > 0}
          >
            <div className="space-y-3">
              {novos.map((n, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-3 space-y-3",
                    n.incluir ? "border-tinta-200" : "border-tinta-100 bg-tinta-50 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={n.incluir}
                      onChange={(e) => alterarNovo(i, "incluir", e.target.checked)}
                      className="w-4 h-4 accent-marca-500 flex-shrink-0"
                    />
                    <input
                      value={n.descricao}
                      onChange={(e) => alterarNovo(i, "descricao", e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 border border-tinta-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-marca-500"
                    />
                    <span className="text-sm font-semibold text-tinta-900 flex-shrink-0">
                      {formatCurrency(n.valorParcela)}
                    </span>
                  </div>

                  {n.incluir && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6">
                      <Campo rotulo="Valor da parcela">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={n.valorParcela}
                          onChange={(e) => alterarNovo(i, "valorParcela", parseFloat(e.target.value) || 0)}
                          className="campo"
                        />
                      </Campo>
                      <Campo rotulo="Parcela">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={n.parcelaAtual}
                            onChange={(e) => alterarNovo(i, "parcelaAtual", Math.max(1, parseInt(e.target.value || "1", 10)))}
                            className="campo"
                          />
                          <span className="text-tinta-400 text-xs">de</span>
                          <input
                            type="number"
                            min={1}
                            value={n.parcelasTotal}
                            onChange={(e) => alterarNovo(i, "parcelasTotal", Math.max(1, parseInt(e.target.value || "1", 10)))}
                            className="campo"
                          />
                        </div>
                      </Campo>
                      <Campo rotulo="Categoria">
                        <select
                          value={n.categoria}
                          onChange={(e) => alterarNovo(i, "categoria", e.target.value)}
                          className="campo"
                        >
                          {(opcoes?.categorias ?? []).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </Campo>
                      <Campo rotulo="Responsável">
                        <ListaEditavel
                          valor={n.responsavel}
                          opcoes={opcoes?.responsaveis ?? []}
                          aoMudar={(v) => alterarNovo(i, "responsavel", v)}
                          placeholder="Quem"
                        />
                      </Campo>
                      {n.parcelasTotal > 1 && (
                        <p className="col-span-2 sm:col-span-4 text-xs text-tinta-500">
                          Entra como {n.parcelasTotal}x de {formatCurrency(n.valorParcela)}, na{" "}
                          {n.parcelaAtual}ª parcela. Vai aparecer por mais{" "}
                          {Math.max(0, n.parcelasTotal - n.parcelaAtual)} mês(es).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Bloco>

          {/* Já tem */}
          <Bloco
            icone={<CheckCircle2 className="w-4 h-4 text-tinta-500" />}
            titulo="Já estava lançado"
            resumo={`${marcados.filter(Boolean).length} de ${leitura.jaTem.length}`}
            vazio="Nenhum item da fatura casou com o que já estava lançado."
            temItens={leitura.jaTem.length > 0}
          >
            <ul className="space-y-2">
              {leitura.jaTem.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={marcados[i] ?? false}
                    onChange={(e) =>
                      setMarcados((m) => m.map((v, j) => (j === i ? e.target.checked : v)))
                    }
                    className="w-4 h-4 accent-marca-500 mt-0.5 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-tinta-800 truncate">
                      {p.despesa.descricao}
                      <span className="text-tinta-400"> ← {p.item.descricao}</span>
                    </p>
                    <p className="text-xs text-tinta-400">
                      parcela {p.despesa.parcelaNoMes}/{p.despesa.parcelasTotal},{" "}
                      <span className={cn(p.confianca === "baixa" && "text-aviso-600")}>
                        {ROTULO_CONFIANCA[p.confianca]}
                      </span>
                    </p>
                  </div>
                  <span className="text-tinta-900 font-medium flex-shrink-0">
                    {formatCurrency(p.despesa.valorParcela)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-tinta-400">
              Nada aqui é criado de novo. O visto só marca a despesa como conferida por esta fatura.
            </p>
          </Bloco>

          {/* Sumiu */}
          <Bloco
            icone={<HelpCircle className="w-4 h-4 text-aviso-600" />}
            titulo="Estava previsto e não veio"
            resumo={`${leitura.sumiu.length}`}
            vazio="Tudo que estava previsto apareceu na fatura."
            temItens={leitura.sumiu.length > 0}
          >
            <ul className="space-y-2">
              {leitura.sumiu.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="min-w-0">
                    <p className="text-tinta-800 truncate">{d.descricao}</p>
                    <p className="text-xs text-tinta-400">
                      parcela {d.parcelaNoMes}/{d.parcelasTotal}
                    </p>
                  </div>
                  <span className="text-tinta-500 flex-shrink-0">{formatCurrency(d.valorParcela)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-tinta-400">
              Pode ser compra cancelada, estorno ou parcelamento que acabou. Eu não mexo em nada
              disso: resolva em Despesas Variáveis se for o caso.
            </p>
          </Bloco>

          {/* Ignorados */}
          {leitura.ignorados.length > 0 && (
            <Bloco
              icone={<Ban className="w-4 h-4 text-tinta-400" />}
              titulo="Fora da conta"
              resumo={`${leitura.ignorados.length}`}
              vazio=""
              temItens
            >
              <ul className="space-y-1">
                {leitura.ignorados.map((i, k) => (
                  <li key={k} className="flex items-center justify-between text-xs text-tinta-500 gap-2">
                    <span className="truncate">{i.descricao}, {i.linha}</span>
                    <span className="flex-shrink-0">{formatCurrency(i.valor)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-tinta-400">
                Pagamento da fatura anterior e estorno não viram despesa, mas contam na soma que
                confere com o total.
              </p>
            </Bloco>
          )}

          <div className="sticky bottom-4">
            <button
              onClick={confirmar}
              disabled={salvando}
              className={cn(
                "w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-40",
                insistindo
                  ? "bg-aviso-500 hover:bg-aviso-600 text-white"
                  : "bg-marca hover:bg-marca-forte text-white"
              )}
            >
              {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {insistindo
                ? "A soma não bate. Gravar mesmo assim?"
                : `Gravar ${novos.filter((n) => n.incluir).length} novo(s) e conferir ${marcados.filter(Boolean).length}`}
            </button>
          </div>
        </>
      )}

      {/* Histórico */}
      {importacoes.length > 0 && (
        <div className="bg-superficie rounded-2xl ring-1 ring-tinta-200 p-5">
          <h2 className="text-sm font-semibold text-tinta-900 mb-3">Faturas importadas</h2>
          <ul className="space-y-3">
            {importacoes.map((imp) => (
              <li key={imp.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-tinta-800 truncate">
                    {imp.cartao}, {rotuloMes(imp.mesRef)}
                  </p>
                  <p className="text-xs text-tinta-400">
                    {formatCurrency(imp.totalLido)}, {imp.criadas} criada(s), {imp.conferidas} conferida(s)
                  </p>
                </div>
                <button
                  onClick={() => desfazer(imp.id)}
                  className="flex items-center gap-1 text-xs text-tinta-400 hover:text-saida-600 flex-shrink-0"
                >
                  <Undo2 className="w-3 h-3" />
                  desfazer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Bloco({
  icone,
  titulo,
  resumo,
  vazio,
  temItens,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  resumo: string;
  vazio: string;
  temItens: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-superficie rounded-2xl ring-1 ring-tinta-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 font-semibold text-tinta-900 text-sm">
          {icone}
          {titulo}
        </h2>
        <span className="text-xs text-tinta-400">{resumo}</span>
      </div>
      {temItens ? children : <p className="text-sm text-tinta-400">{vazio}</p>}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, CalendarX, X, RotateCcw } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { useToast } from "@/components/ui/Toast";
import { ReceitaForm, ReceitaPayload } from "@/components/forms/ReceitaForm";
import { confirmadaNoMes, formatCurrency, formatDate } from "@/lib/utils";
import { useAoLancar } from "@/lib/eventos";
import { sortList, type SortState } from "@/components/ui/SortTh";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Linha, BotaoIcone, BotaoExcluir } from "@/components/ui/Linha";
import { BarraBusca } from "@/components/ui/BarraBusca";
import { Vazio } from "@/components/ui/Vazio";

interface Receita {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  responsavel: string;
  recorrente: boolean;
  parcelada: boolean;
  mesesTotal: number | null;
  excecoes: string[];
  ativa: boolean;
  confirmadaAte: string | null;
}

type RecorrenciaOpt = "unica" | "recorrente" | "parcelada";

function getRecorrencia(item: Receita): RecorrenciaOpt {
  if (item.parcelada) return "parcelada";
  if (item.recorrente) return "recorrente";
  return "unica";
}

function getProximasExcecoes(item: Receita): string[] {
  if (!item.recorrente || !item.excecoes?.length) return [];
  const hoje = format(new Date(), "yyyy-MM");
  return item.excecoes.filter((e) => e >= hoje).sort();
}

export default function ReceitasPage() {
  const [items, setItems] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<Receita | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipModal, setSkipModal] = useState<Receita | null>(null);
  const [skipMes, setSkipMes] = useState("");
  const [filtro, setFiltro] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [feriasConfirm, setFeriasConfirm] = useState<ReceitaPayload | null>(null);
  const [date, setDate] = useState(new Date());
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const { toast } = useToast();

  const mes = date.getMonth() + 1;
  const ano = date.getFullYear();
  const mesKey = `${ano}-${String(mes).padStart(2, "0")}`;
  const fim = new Date(ano, mes, 0, 23, 59, 59);
  const now = new Date();
  const isCurrentMonth = now.getMonth() + 1 === mes && now.getFullYear() === ano;
  const mesLabel = format(date, "MMM/yy", { locale: ptBR });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/receitas");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAoLancar(fetchData);

  const isActiveInMonth = (item: Receita): boolean => {
    if (!item.ativa) return false;
    const data = new Date(item.data);
    if (item.parcelada && item.mesesTotal) {
      const diffMeses = (ano - data.getUTCFullYear()) * 12 + (mes - 1 - data.getUTCMonth());
      return diffMeses >= 0 && diffMeses < item.mesesTotal;
    }
    if (item.recorrente) {
      if (data > fim) return false;
      if ((item.excecoes ?? []).includes(mesKey)) return false;
      return true;
    }
    // one-time: check if data is in selected month
    return data.getUTCFullYear() === ano && data.getUTCMonth() + 1 === mes;
  };

  const isRecebidaInMonth = (item: Receita): boolean => {
    if (!item.confirmadaAte) return false;
    // A parcelada não avança a data ao receber; só nela o mês de confirmadaAte vale.
    if (item.parcelada) {
      const c = new Date(item.confirmadaAte);
      return c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes;
    }
    return confirmadaNoMes(item.data, item.confirmadaAte, mes, ano);
  };

  const getParcelaAtualForMonth = (item: Receita): number => {
    const d = new Date(item.data);
    const diff = (ano - d.getUTCFullYear()) * 12 + (mes - 1 - d.getUTCMonth());
    return Math.min(Math.max(diff + 1, 1), item.mesesTotal ?? 1);
  };

  const handleCreate = async (data: ReceitaPayload) => {
    if (data.tipo === "Férias") {
      setFeriasConfirm(data);
      setModal(null);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/receitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); toast("Receita criada"); }
    else toast("Erro ao criar receita", "error");
  };

  const handleFeriasConfirm = async () => {
    if (!feriasConfirm) return;
    setSaving(true);

    const res = await fetch("/api/receitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feriasConfirm),
    });

    if (res.ok) {
      const feriasStart = new Date(feriasConfirm.data);
      const feriasEnd = new Date(feriasStart);
      feriasEnd.setUTCDate(feriasEnd.getUTCDate() + 35);

      const salarios = items.filter(
        (i) => i.recorrente && i.ativa && (i.tipo === "Salário" || i.tipo === "Adiantamento")
      );

      for (const salario of salarios) {
        const salarioDay = new Date(salario.data).getUTCDate();
        const newExcecoes = [...(salario.excecoes ?? [])];

        // First occurrence of this salary on or after férias start
        let checkDate = new Date(Date.UTC(feriasStart.getUTCFullYear(), feriasStart.getUTCMonth(), salarioDay));
        if (checkDate < feriasStart) {
          checkDate = new Date(Date.UTC(checkDate.getUTCFullYear(), checkDate.getUTCMonth() + 1, salarioDay));
        }

        // Suppress every occurrence that falls within the 35-day vacation window
        while (checkDate <= feriasEnd) {
          const excKey = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, "0")}`;
          if (!newExcecoes.includes(excKey)) newExcecoes.push(excKey);
          checkDate = new Date(Date.UTC(checkDate.getUTCFullYear(), checkDate.getUTCMonth() + 1, salarioDay));
        }

        if (newExcecoes.length > (salario.excecoes ?? []).length) {
          await fetch(`/api/receitas/${salario.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ excecoes: newExcecoes }),
          });
        }
      }

      setFeriasConfirm(null);
      fetchData();
      toast("Férias registradas");
    } else {
      toast("Erro ao registrar férias", "error");
    }
    setSaving(false);
  };

  const handleEdit = async (data: ReceitaPayload) => {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/receitas/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); setSelected(null); fetchData(); toast("Receita atualizada"); }
    else toast("Erro ao atualizar receita", "error");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta receita?")) return;
    const res = await fetch(`/api/receitas/${id}`, { method: "DELETE" });
    if (res.ok) { fetchData(); toast("Receita excluída"); }
    else toast("Erro ao excluir receita", "error");
  };

  const handleReceber = async (item: Receita) => {
    setLoadingActionId(item.id);
    const confirmadaAte = format(new Date(), "yyyy-MM-dd");
    if (item.parcelada) {
      const isLast = getParcelaAtualForMonth(item) >= (item.mesesTotal ?? 1);
      const payload = isLast ? { confirmadaAte, ativa: false } : { confirmadaAte };
      const res = await fetch(`/api/receitas/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLoadingActionId(null);
      if (res.ok) { fetchData(); toast("Recebimento confirmado"); }
      else toast("Erro ao confirmar recebimento", "error");
      return;
    }
    const d = new Date(item.data);
    const proxData = addMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
    const payload = item.recorrente
      ? { data: format(proxData, "yyyy-MM-dd"), confirmadaAte }
      : { data: format(proxData, "yyyy-MM-dd"), ativa: false, confirmadaAte };
    const res = await fetch(`/api/receitas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Recebimento confirmado"); }
    else toast("Erro ao confirmar recebimento", "error");
  };

  const handleReverterReceita = async (item: Receita) => {
    setLoadingActionId(item.id);
    const payload: Record<string, unknown> = { confirmadaAte: null };
    if (!item.parcelada) {
      const d = new Date(item.data);
      const prevData = subMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
      payload.data = format(prevData, "yyyy-MM-dd");
    }
    if (!item.ativa) {
      payload.ativa = true;
    }
    const res = await fetch(`/api/receitas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoadingActionId(null);
    if (res.ok) { fetchData(); toast("Recebimento desfeito"); }
    else toast("Erro ao desfazer recebimento", "error");
  };

  const handlePularMes = async () => {
    if (!skipModal || !skipMes) return;
    const existing = skipModal.excecoes ?? [];
    if (existing.includes(skipMes)) {
      setSkipModal(null);
      setSkipMes("");
      return;
    }
    const res = await fetch(`/api/receitas/${skipModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excecoes: [...existing, skipMes] }),
    });
    setSkipModal(null);
    setSkipMes("");
    if (res.ok) { fetchData(); toast("Mês pulado"); }
    else toast("Erro ao pular mês", "error");
  };

  const handleRemoverExcecao = async (item: Receita, mesKeyExc: string) => {
    const updated = (item.excecoes ?? []).filter((e) => e !== mesKeyExc);
    const res = await fetch(`/api/receitas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excecoes: updated }),
    });
    if (res.ok) fetchData();
  };

  const openEdit = (item: Receita) => {
    setSelected(item);
    setModal("edit");
  };

  const defaultEditValues = selected
    ? {
        descricao: selected.descricao,
        tipo: selected.tipo,
        valor: selected.valor,
        data: selected.data.slice(0, 10),
        responsavel: selected.responsavel,
        recorrencia: getRecorrencia(selected),
        mesesTotal: selected.mesesTotal ?? undefined,
        ativa: selected.ativa,
      }
    : undefined;

  const sorters: Partial<Record<string, (i: Receita) => string | number>> = {
    descricao: (i) => i.descricao.toLowerCase(),
    tipo: (i) => i.tipo.toLowerCase(),
    responsavel: (i) => i.responsavel.toLowerCase(),
    data: (i) => i.data,
    valor: (i) => i.valor,
  };

  const filtrar = (list: Receita[]) =>
    sortList(
      filtro
        ? list.filter(
            (i) =>
              i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
              i.tipo.toLowerCase().includes(filtro.toLowerCase()) ||
              i.responsavel.toLowerCase().includes(filtro.toLowerCase())
          )
        : list,
      sort,
      sorters
    );

  const ativos = items.filter(isActiveInMonth);
  const confirmadasFora = items.filter((i) => !isActiveInMonth(i) && isRecebidaInMonth(i));

  const pendentes = filtrar(ativos.filter((i) => !isRecebidaInMonth(i)));
  const recebidas = filtrar([...ativos.filter(isRecebidaInMonth), ...confirmadasFora]);

  const isEmpty = pendentes.length === 0 && recebidas.length === 0;

  const totalPendente = pendentes.reduce((sum, i) => sum + i.valor, 0);

  const detalhe = (item: Receita) => {
    const partes = [item.tipo, item.responsavel, `dia ${formatDate(item.data).slice(0, 2)}`];
    if (item.recorrente) partes.unshift("Todo mês");
    if (item.parcelada && item.mesesTotal) partes.unshift(`Mês ${getParcelaAtualForMonth(item)} de ${item.mesesTotal}`);
    if (!item.recorrente && !item.parcelada) partes.unshift(`Só em ${formatDate(item.data).slice(0, 5)}`);
    return partes.join(", ");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Cabecalho
        titulo="Receitas fixas"
        subtitulo={
          loading ? undefined : (
            <>
              Falta receber em {mesLabel}: <span className="valor font-medium text-marca-700">{formatCurrency(totalPendente)}</span>
            </>
          )
        }
      >
        <MonthSelector date={date} onChange={setDate} />
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-marca hover:bg-marca-forte text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova receita fixa
        </button>
      </Cabecalho>

      {loading ? (
        <div className="space-y-3" aria-busy>
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-tinta-100 animate-pulse" />)}
        </div>
      ) : items.filter((i) => i.ativa).length === 0 ? (
        <Vazio texto="Nenhuma receita fixa ainda. Salário, aluguel recebido, pensão." acao="Lançar a primeira" />
      ) : (
        <>
          <BarraBusca
            valor={filtro}
            aoMudar={setFiltro}
            placeholder="Buscar receita, tipo ou pessoa"
            sort={sort}
            aoOrdenar={setSort}
            ordens={[
              { rotulo: "Por data", key: "data", dir: "asc" },
              { rotulo: "Maior valor", key: "valor", dir: "desc" },
              { rotulo: "Nome", key: "descricao", dir: "asc" },
            ]}
          />

          {isEmpty ? (
            <p className="py-10 text-center text-sm text-tinta-500">Nenhuma receita fixa em {mesLabel}{filtro ? " com essa busca" : ""}.</p>
          ) : (
            <div className="space-y-3">
              {pendentes.length > 0 && (
                <section className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
                  {pendentes.map((item) => {
                    const proximasExcecoes = getProximasExcecoes(item);
                    return (
                      <div key={item.id}>
                        <Linha
                          titulo={item.descricao}
                          aoAbrir={() => openEdit(item)}
                          detalhe={detalhe(item)}
                          valor={formatCurrency(item.valor)}
                          valorClasse="text-marca-700"
                          acoes={
                            <>
                              {isCurrentMonth && (
                                <BotaoIcone rotulo="Marcar como recebida" onClick={() => handleReceber(item)} disabled={loadingActionId === item.id}>
                                  <CheckCircle2 className="w-[18px] h-[18px]" />
                                </BotaoIcone>
                              )}
                              {item.recorrente && isCurrentMonth && (
                                <BotaoIcone rotulo="Pular um mês" onClick={() => { setSkipModal(item); setSkipMes(""); }}>
                                  <CalendarX className="w-4 h-4" />
                                </BotaoIcone>
                              )}
                              <BotaoIcone rotulo="Editar" soComputador onClick={() => openEdit(item)}>
                                <Pencil className="w-4 h-4" />
                              </BotaoIcone>
                              <BotaoIcone rotulo="Excluir" perigo soComputador onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </BotaoIcone>
                            </>
                          }
                        />
                        {proximasExcecoes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 px-4 sm:px-5 pb-3 -mt-1">
                            {proximasExcecoes.map((exc) => {
                              const [excAno, excMes] = exc.split("-");
                              const label = format(new Date(Number(excAno), Number(excMes) - 1, 1), "MMM/yy", { locale: ptBR });
                              return (
                                <span key={exc} className="inline-flex items-center gap-1 text-xs bg-aviso-50 text-aviso-800 pl-2 pr-1 py-0.5 rounded-md">
                                  Não entra em {label}
                                  <button
                                    onClick={() => handleRemoverExcecao(item, exc)}
                                    aria-label={`Voltar a contar ${label}`}
                                    title="Voltar a contar este mês"
                                    className="p-0.5 rounded hover:bg-aviso-100"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {recebidas.length > 0 && (
                <section>
                  <h2 className="px-1 mb-2 text-xs font-medium text-tinta-500">Recebidas em {mesLabel}</h2>
                  <div className="rounded-2xl bg-superficie ring-1 ring-tinta-200 overflow-hidden divide-y divide-tinta-100">
                    {recebidas.map((item) => (
                      <Linha
                        key={item.id}
                        apagada
                        titulo={item.descricao}
                        aoAbrir={() => openEdit(item)}
                        detalhe={`Recebida, ${item.tipo}, ${item.responsavel}`}
                        valor={formatCurrency(item.valor)}
                        acoes={
                          <>
                            <BotaoIcone rotulo="Desfazer recebimento" onClick={() => handleReverterReceita(item)} disabled={loadingActionId === item.id}>
                              <RotateCcw className="w-4 h-4" />
                            </BotaoIcone>
                            <BotaoIcone rotulo="Editar" soComputador onClick={() => openEdit(item)}>
                              <Pencil className="w-4 h-4" />
                            </BotaoIcone>
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}

      {modal === "create" && (
        <Modal title="Nova receita fixa" onClose={() => setModal(null)}>
          <ReceitaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar receita fixa" onClose={() => { setModal(null); setSelected(null); }}>
          <ReceitaForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
          <BotaoExcluir onClick={() => { handleDelete(selected.id); setModal(null); setSelected(null); }} />
        </Modal>
      )}

      {feriasConfirm && (
        <Modal title="Registrar férias" onClose={() => setFeriasConfirm(null)}>
          <div className="space-y-4">
            <div className="bg-aviso-50 border border-aviso-200 rounded-xl p-4 text-sm text-aviso-800">
              <p className="font-semibold mb-2">Atenção: impacto nas receitas recorrentes</p>
              <p>Ao confirmar, o sistema irá registrar as férias e <strong>suprimir automaticamente</strong> todos os vencimentos de Salário e Adiantamento que caírem dentro dos <strong>35 dias seguintes</strong> à data de início das férias.</p>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                <li>Ex: férias em 01/out → janela vai até 05/nov → suprime adiantamento (20/out) e salário (05/nov).</li>
                <li>Se um vencimento cair antes do início das férias, o próximo mês é verificado.</li>
              </ul>
              <p className="mt-2 text-xs text-aviso-600">Você pode desfazer qualquer exceção manualmente na lista de receitas.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFeriasConfirm(null)}
                className="flex-1 border border-tinta-300 text-tinta-700 text-sm font-medium py-2.5 rounded-lg hover:bg-tinta-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFeriasConfirm}
                disabled={saving}
                className="flex-1 bg-marca hover:bg-marca-forte disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {saving ? "Aplicando..." : "Confirmar e registrar férias"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {skipModal && (
        <Modal title="Pular mês" onClose={() => setSkipModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-tinta-600">
              Em qual mês <strong>{skipModal.descricao}</strong> não vai entrar?
            </p>
            <input
              type="month"
              value={skipMes}
              onChange={(e) => setSkipMes(e.target.value)}
              className="w-full bg-superficie border border-tinta-200 rounded-lg px-3 py-2.5 text-sm text-tinta-900 focus:outline-none focus:ring-2 focus:ring-marca-500"
              min={format(new Date(), "yyyy-MM")}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSkipModal(null)}
                className="flex-1 border border-tinta-300 text-tinta-700 text-sm font-medium py-2 rounded-lg hover:bg-tinta-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePularMes}
                disabled={!skipMes}
                className="flex-1 bg-marca hover:bg-marca-forte disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Pular este mês
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

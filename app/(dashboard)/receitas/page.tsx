"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle2, CalendarX, X, Search, RotateCcw } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { ReceitaForm, ReceitaPayload } from "@/components/forms/ReceitaForm";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SortTh, nextSort, sortList, type SortState } from "@/components/ui/SortTh";

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
    const c = new Date(item.confirmadaAte);
    return c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes;
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
    if (res.ok) { setModal(null); fetchData(); }
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
    if (res.ok) { setModal(null); setSelected(null); fetchData(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta receita?")) return;
    await fetch(`/api/receitas/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleReceber = async (item: Receita) => {
    const confirmadaAte = format(new Date(), "yyyy-MM-dd");
    if (item.parcelada) {
      const isLast = getParcelaAtualForMonth(item) >= (item.mesesTotal ?? 1);
      const payload = isLast ? { confirmadaAte, ativa: false } : { confirmadaAte };
      await fetch(`/api/receitas/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      fetchData();
      return;
    }
    const d = new Date(item.data);
    const proxData = addMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
    const payload = item.recorrente
      ? { data: format(proxData, "yyyy-MM-dd"), confirmadaAte }
      : { data: format(proxData, "yyyy-MM-dd"), ativa: false, confirmadaAte };
    await fetch(`/api/receitas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    fetchData();
  };

  const handleReverterReceita = async (item: Receita) => {
    const payload: Record<string, unknown> = { confirmadaAte: null };
    if (!item.parcelada) {
      const d = new Date(item.data);
      const prevData = subMonths(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 1);
      payload.data = format(prevData, "yyyy-MM-dd");
    }
    if (!item.ativa) {
      payload.ativa = true;
    }
    await fetch(`/api/receitas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    fetchData();
  };

  const handlePularMes = async () => {
    if (!skipModal || !skipMes) return;
    const existing = skipModal.excecoes ?? [];
    if (existing.includes(skipMes)) {
      setSkipModal(null);
      setSkipMes("");
      return;
    }
    await fetch(`/api/receitas/${skipModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excecoes: [...existing, skipMes] }),
    });
    setSkipModal(null);
    setSkipMes("");
    fetchData();
  };

  const handleRemoverExcecao = async (item: Receita, mesKeyExc: string) => {
    const updated = (item.excecoes ?? []).filter((e) => e !== mesKeyExc);
    await fetch(`/api/receitas/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excecoes: updated }),
    });
    fetchData();
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Receitas Fixas</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthSelector date={date} onChange={setDate} />
          <button
            onClick={() => setModal("create")}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Receita Fixa
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.filter((i) => i.ativa).length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma receita cadastrada</div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição, tipo ou responsável..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {isEmpty ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nenhuma receita fixa em {mesLabel}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <SortTh label="Descrição" col="descricao" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Tipo" col="tipo" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Responsável" col="responsavel" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Data" col="data" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <SortTh label="Valor" col="valor" sort={sort} onSort={(c) => setSort(nextSort(sort, c))} />
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendentes.map((item) => {
                      const proximasExcecoes = getProximasExcecoes(item);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.tipo}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.data)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-emerald-600">{formatCurrency(item.valor)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {item.recorrente && (
                                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full w-fit">
                                  <RefreshCw className="w-3 h-3" /> Recorrente
                                </span>
                              )}
                              {item.parcelada && item.mesesTotal && (
                                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full w-fit">
                                  Mês {getParcelaAtualForMonth(item)}/{item.mesesTotal}
                                </span>
                              )}
                              {proximasExcecoes.map((exc) => {
                                const [excAno, excMes] = exc.split("-");
                                const label = format(new Date(Number(excAno), Number(excMes) - 1, 1), "MMM/yy", { locale: ptBR });
                                return (
                                  <span key={exc} className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full w-fit">
                                    <CalendarX className="w-3 h-3" />
                                    Pulado {label}
                                    <button onClick={() => handleRemoverExcecao(item, exc)} className="ml-0.5 hover:text-orange-800" title="Desfazer">
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {isCurrentMonth && (
                                <button onClick={() => handleReceber(item)} title="Confirmar recebimento" className="p-1.5 hover:bg-emerald-50 rounded-lg group">
                                  <CheckCircle2 className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                </button>
                              )}
                              {item.recorrente && isCurrentMonth && (
                                <button onClick={() => { setSkipModal(item); setSkipMes(""); }} title="Pular mês" className="p-1.5 hover:bg-orange-50 rounded-lg group">
                                  <CalendarX className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                </button>
                              )}
                              <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <Pencil className="w-4 h-4 text-gray-500" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {recebidas.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={7} className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 uppercase tracking-wide">
                            Recebidas em {mesLabel}
                          </td>
                        </tr>
                        {recebidas.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 opacity-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 line-through">{item.descricao}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.tipo}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.data)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-400">{formatCurrency(item.valor)}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Recebida</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleReverterReceita(item)}
                                  title="Desfazer recebimento"
                                  className="p-1.5 hover:bg-orange-50 rounded-lg group"
                                >
                                  <RotateCcw className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors" />
                                </button>
                                <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                  <Pencil className="w-4 h-4 text-gray-400" />
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-4 h-4 text-red-300" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modal === "create" && (
        <Modal title="Nova Receita Fixa" onClose={() => setModal(null)}>
          <ReceitaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Receita" onClose={() => { setModal(null); setSelected(null); }}>
          <ReceitaForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
        </Modal>
      )}

      {feriasConfirm && (
        <Modal title="Confirmar registro de Férias" onClose={() => setFeriasConfirm(null)}>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-2">Atenção: impacto nas receitas recorrentes</p>
              <p>Ao confirmar, o sistema irá registrar as férias e <strong>suprimir automaticamente</strong> todos os vencimentos de Salário e Adiantamento que caírem dentro dos <strong>35 dias seguintes</strong> à data de início das férias.</p>
              <ul className="mt-2 space-y-1 list-disc pl-4">
                <li>Ex: férias em 01/out → janela vai até 05/nov → suprime adiantamento (20/out) e salário (05/nov).</li>
                <li>Se um vencimento cair antes do início das férias, o próximo mês é verificado.</li>
              </ul>
              <p className="mt-2 text-xs text-amber-600">Você pode desfazer qualquer exceção manualmente na lista de receitas.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFeriasConfirm(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleFeriasConfirm}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
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
            <p className="text-sm text-gray-600">
              Selecione o mês que <strong>{skipModal.descricao}</strong> não será recebido:
            </p>
            <input
              type="month"
              value={skipMes}
              onChange={(e) => setSkipMes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min={format(new Date(), "yyyy-MM")}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSkipModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePularMes}
                disabled={!skipMes}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

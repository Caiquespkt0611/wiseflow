"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle2, CalendarX, X, Search } from "lucide-react";
import { format, addMonths, differenceInCalendarMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Modal } from "@/components/ui/Modal";
import { ReceitaForm, ReceitaPayload } from "@/components/forms/ReceitaForm";
import { formatCurrency, formatDate } from "@/lib/utils";

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
}

type RecorrenciaOpt = "unica" | "recorrente" | "parcelada";

function getRecorrencia(item: Receita): RecorrenciaOpt {
  if (item.parcelada) return "parcelada";
  if (item.recorrente) return "recorrente";
  return "unica";
}

function getParcelaAtual(item: Receita): number {
  const dataInicio = new Date(item.data);
  const today = new Date();
  const diff = differenceInCalendarMonths(today, dataInicio);
  return Math.min(Math.max(diff + 1, 1), item.mesesTotal ?? 1);
}

function isParceladaAtiva(item: Receita): boolean {
  if (!item.parcelada || !item.mesesTotal) return false;
  const dataFim = addMonths(new Date(item.data), item.mesesTotal);
  return new Date() < dataFim;
}

function isItemAtivo(item: Receita): boolean {
  if (!item.ativa) return false;
  if (item.parcelada) return isParceladaAtiva(item);
  return true;
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/receitas");
    if (res.ok) {
      const all: Receita[] = await res.json();
      setItems(all.filter(isItemAtivo));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: ReceitaPayload) => {
    setSaving(true);
    const res = await fetch("/api/receitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) { setModal(null); fetchData(); }
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
    if (item.recorrente) {
      const proxData = addMonths(new Date(item.data), 1);
      await fetch(`/api/receitas/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: format(proxData, "yyyy-MM-dd") }),
      });
    } else {
      await fetch(`/api/receitas/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa: false }),
      });
    }
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

  const handleRemoverExcecao = async (item: Receita, mesKey: string) => {
    const updated = (item.excecoes ?? []).filter((e) => e !== mesKey);
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
        data: format(new Date(selected.data), "yyyy-MM-dd"),
        responsavel: selected.responsavel,
        recorrencia: getRecorrencia(selected),
        mesesTotal: selected.mesesTotal ?? undefined,
        ativa: selected.ativa,
      }
    : undefined;

  const itemsFiltrados = filtro
    ? items.filter(
        (i) =>
          i.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
          i.tipo.toLowerCase().includes(filtro.toLowerCase()) ||
          i.responsavel.toLowerCase().includes(filtro.toLowerCase())
      )
    : items;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Receita
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : items.length === 0 ? (
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Descrição", "Tipo", "Responsável", "Data", "Valor", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                      Nenhum resultado encontrado
                    </td>
                  </tr>
                ) : itemsFiltrados.map((item) => {
                  const proximasExcecoes = getProximasExcecoes(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.descricao}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.tipo}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.responsavel}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.data)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                        {formatCurrency(item.valor)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {item.recorrente && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full w-fit">
                              <RefreshCw className="w-3 h-3" /> Recorrente
                            </span>
                          )}
                          {item.parcelada && item.mesesTotal && (
                            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full w-fit">
                              Mês {getParcelaAtual(item)}/{item.mesesTotal}
                            </span>
                          )}
                          {proximasExcecoes.map((mesKey) => {
                            const [ano, mes] = mesKey.split("-");
                            const label = format(new Date(Number(ano), Number(mes) - 1, 1), "MMM/yy", { locale: ptBR });
                            return (
                              <span key={mesKey} className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full w-fit">
                                <CalendarX className="w-3 h-3" />
                                Pulado {label}
                                <button
                                  onClick={() => handleRemoverExcecao(item, mesKey)}
                                  className="ml-0.5 hover:text-orange-800"
                                  title="Desfazer"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!item.parcelada && (
                            <button
                              onClick={() => handleReceber(item)}
                              title="Confirmar recebimento"
                              className="p-1.5 hover:bg-emerald-50 rounded-lg group"
                            >
                              <CheckCircle2 className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                            </button>
                          )}
                          {item.recorrente && (
                            <button
                              onClick={() => { setSkipModal(item); setSkipMes(""); }}
                              title="Pular mês"
                              className="p-1.5 hover:bg-orange-50 rounded-lg group"
                            >
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
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {modal === "create" && (
        <Modal title="Nova Receita" onClose={() => setModal(null)}>
          <ReceitaForm onSubmit={handleCreate} loading={saving} />
        </Modal>
      )}
      {modal === "edit" && selected && (
        <Modal title="Editar Receita" onClose={() => { setModal(null); setSelected(null); }}>
          <ReceitaForm defaultValues={defaultEditValues} onSubmit={handleEdit} loading={saving} />
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

import type { Receita, ReceitaVariavel, DespesaFixa, DespesaVariavel, Emprestimo } from "@prisma/client";
import { cobradoNoMes, type MesBase } from "@/lib/emprestimos";

export interface DadosProjecao {
  receitas: Receita[];
  receitasVariaveis: ReceitaVariavel[];
  despesasFixas: DespesaFixa[];
  despesasVariaveis: DespesaVariavel[];
  emprestimos: Emprestimo[];
}

export interface MesProjetado {
  mes: number;
  ano: number;
  label: string;
  isAtual: boolean;
  totalReceitas: number;
  totalDespesas: number;
  totalFixas: number; // contas do mês + parcelas de empréstimo
  totalEmprestimos: number;
  totalVariaveis: number;
  previsaoMes: number;
  previsaoAcumulada: number;
}

/** Mês a mês, do mês base em diante. É a conta da tela de Projeção. */
export function projetar(dados: DadosProjecao, saldoBancario: number, mesBase: number, anoBase: number, totalMeses: number, hoje: Date): MesProjetado[] {
  const { receitas, receitasVariaveis, despesasFixas, despesasVariaveis, emprestimos } = dados;
  const projecao: MesProjetado[] = [];
  let previsaoAcumulada = saldoBancario;

  for (let i = 0; i < totalMeses; i++) {
    let mes = mesBase + i;
    let ano = anoBase;
    while (mes > 12) { mes -= 12; ano += 1; }

    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));

    const mesKey = `${ano}-${String(mes).padStart(2, "0")}`;

    const totalReceitasFixas = receitas
      .filter((r) => {
        if (r.parcelada && r.mesesTotal) {
          // A parcelada não avança a data ao receber; a recebida no mês sai por confirmadaAte,
          // senão ela conta de novo em cima do saldo bancário que já a inclui.
          if (r.confirmadaAte) {
            const c = new Date(r.confirmadaAte);
            if (c.getUTCFullYear() === ano && c.getUTCMonth() + 1 === mes) return false;
          }
          const dataInicio = new Date(r.data);
          const diffMeses =
            (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
          return diffMeses >= 0 && diffMeses < r.mesesTotal;
        }
        if (r.recorrente) {
          if (new Date(r.data) > fim) return false;
          if ((r.excecoes as string[])?.includes(mesKey)) return false;
          return true;
        }
        const data = new Date(r.data);
        return data >= inicio && data <= fim;
      })
      .reduce((sum, r) => sum + r.valor, 0);

    const totalReceitasVar = receitasVariaveis.reduce((sum, r) => {
      const dataInicio = new Date(r.dataInicio);
      const diffMeses = (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
      const parcelaAtualCalc = r.parcelaAtual + diffMeses;
      // parcelaAtual é a próxima parcela NÃO paga; parcelas abaixo dela já foram quitadas.
      if (parcelaAtualCalc >= r.parcelaAtual && parcelaAtualCalc <= r.parcelasTotal) {
        return sum + r.valorParcela;
      }
      return sum;
    }, 0);

    const totalReceitas = totalReceitasFixas + totalReceitasVar;

    // Fixas: só conta se dataInicio já chegou neste mês E o próximo vencimento não passou deste mês.
    // Compara mês com mês em UTC, igual ao painel: comparar com "fim do mês" no fuso do servidor
    // fazia a conta paga que volta em 1º do mês seguinte contar de novo neste mês.
    const totalContas = despesasFixas
      .filter((d) => {
        const ini = new Date(d.dataInicio);
        if (ini.getUTCFullYear() > ano || (ini.getUTCFullYear() === ano && ini.getUTCMonth() + 1 > mes)) return false;
        if (!d.dataProximoVencimento) return true;
        const prox = new Date(d.dataProximoVencimento);
        return prox.getUTCFullYear() * 12 + prox.getUTCMonth() + 1 <= ano * 12 + mes;
      })
      .reduce((sum, d) => sum + d.valor, 0);

    // Parcela de empréstimo que sai da conta. No mês atual entra também a de
    // mês anterior ainda não marcada como paga, como as contas do mês.
    const totalEmprestimos = emprestimos.reduce((s, e) => s + cobradoNoMes(e, ano, mes, hoje, i === 0), 0);

    const totalVariaveis = despesasVariaveis.reduce((sum, d) => {
      const dataInicio = new Date(d.dataInicio);
      const diffMeses =
        (ano - dataInicio.getUTCFullYear()) * 12 + (mes - 1 - dataInicio.getUTCMonth());
      const parcelaAtualCalc = d.parcelaAtual + diffMeses;
      // parcelaAtual é a próxima parcela NÃO paga; parcelas abaixo dela já foram quitadas.
      if (parcelaAtualCalc >= d.parcelaAtual && parcelaAtualCalc <= d.parcelasTotal) {
        return sum + d.valorParcela;
      }
      return sum;
    }, 0);

    const totalFixas = totalContas + totalEmprestimos;
    const totalDespesas = totalFixas + totalVariaveis;
    const previsaoMes = totalReceitas - totalDespesas;
    previsaoAcumulada += previsaoMes;

    projecao.push({
      mes,
      ano,
      label: `${String(mes).padStart(2, "0")}/${ano}`,
      isAtual: i === 0,
      totalReceitas,
      totalDespesas,
      totalFixas,
      totalEmprestimos,
      totalVariaveis,
      previsaoMes,
      previsaoAcumulada,
    });
  }

  return projecao;
}

/**
 * Os meses sem os empréstimos, que é a base onde o plano encaixa as parcelas.
 * O cartão lançado só tem compra já feita, então ele míngua nos meses distantes
 * (R$ 10 mil hoje, R$ 1,6 mil em 2028). O plano usaria essa folga, que não
 * existe. Por isso o cartão de cada mês nunca fica abaixo do piso.
 */
export function mesesBase(projecao: MesProjetado[], pisoCartao = 0): MesBase[] {
  return projecao.map((m) => ({
    ano: m.ano,
    mes: m.mes,
    label: m.label,
    receitas: m.totalReceitas,
    despesas: m.totalFixas - m.totalEmprestimos + Math.max(m.totalVariaveis, pisoCartao),
  }));
}

/** Piso sugerido: média do cartão nos três primeiros meses, arredondada na centena. */
export function cartaoSugerido(projecao: MesProjetado[]): number {
  const tres = projecao.slice(0, 3);
  if (!tres.length) return 0;
  return Math.round(tres.reduce((s, m) => s + m.totalVariaveis, 0) / tres.length / 100) * 100;
}

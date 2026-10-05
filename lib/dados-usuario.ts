import { prisma } from "@/lib/prisma";

/** Tudo o que a projeção precisa de um usuário, numa ida só ao banco. */
export async function carregarDados(userId: string) {
  const [receitas, despesasFixas, despesasVariaveis, receitasVariaveis, contasBancarias, emprestimos] = await Promise.all([
    prisma.receita.findMany({ where: { userId, ativa: true } }),
    prisma.despesaFixa.findMany({ where: { userId, ativa: true } }),
    prisma.despesaVariavel.findMany({ where: { userId } }),
    prisma.receitaVariavel.findMany({ where: { userId } }),
    prisma.contaBancaria.findMany({ where: { userId } }),
    prisma.emprestimo.findMany({ where: { userId }, orderBy: { taxaMensal: "desc" } }),
  ]);
  return {
    dados: { receitas, despesasFixas, despesasVariaveis, receitasVariaveis, emprestimos },
    saldoBancario: contasBancarias.reduce((s, c) => s + c.saldo, 0),
  };
}

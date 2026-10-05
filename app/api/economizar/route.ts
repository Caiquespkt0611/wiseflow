import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { carregarDados } from "@/lib/dados-usuario";
import { analisarGastos } from "@/lib/economia";
import { hojeUTC } from "@/lib/emprestimos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { dados } = await carregarDados(session.user.id);
  return NextResponse.json(
    analisarGastos({
      despesasVariaveis: dados.despesasVariaveis,
      despesasFixas: dados.despesasFixas,
      receitasVariaveis: dados.receitasVariaveis,
      hoje: hojeUTC(),
    })
  );
}

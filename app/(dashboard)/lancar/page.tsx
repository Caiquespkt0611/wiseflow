"use client";

import { Lancador } from "@/components/lancar/Lancador";
import { Cabecalho } from "@/components/ui/Cabecalho";

export default function LancarPage() {
  return (
    <div className="max-w-xl mx-auto">
      <Cabecalho titulo="Lançar" subtitulo="Fale ou digite como você contaria para alguém. Dá para abrir isto de qualquer tela pelo botão Lançar." />
      <Lancador autoFoco />
    </div>
  );
}

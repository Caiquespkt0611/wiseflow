import { cn } from "@/lib/utils";

/**
 * Uma linha de lista que cabe no celular: o que é e os detalhes à esquerda,
 * o valor e as ações à direita. Substitui as tabelas largas que cortavam na tela pequena.
 */
export function Linha({
  titulo,
  detalhe,
  valor,
  valorClasse,
  acoes,
  apagada,
  aoAbrir,
  className,
}: {
  titulo: React.ReactNode;
  detalhe?: React.ReactNode;
  valor?: React.ReactNode;
  valorClasse?: string;
  acoes?: React.ReactNode;
  apagada?: boolean;
  /** Tocar no texto abre a edição. No celular é o caminho principal, já que os ícones somem. */
  aoAbrir?: () => void;
  className?: string;
}) {
  const texto = (
    <>
      <p className={cn("text-[15px] truncate", apagada ? "text-tinta-500 line-through decoration-tinta-300" : "text-tinta-900")}>{titulo}</p>
      {detalhe && <p className="text-xs text-tinta-500 mt-0.5 truncate">{detalhe}</p>}
    </>
  );
  return (
    <div className={cn("flex items-center gap-3 px-4 sm:px-5 py-3", apagada && "text-tinta-400", className)}>
      {aoAbrir ? (
        <button onClick={aoAbrir} className="min-w-0 flex-1 text-left -my-1 py-1 rounded-md">
          {texto}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{texto}</div>
      )}
      {valor !== undefined && (
        <span className={cn("valor text-[15px] font-medium flex-shrink-0", apagada ? "text-tinta-400" : "text-tinta-900", valorClasse)}>{valor}</span>
      )}
      {acoes && <div className="flex items-center flex-shrink-0 -mr-1.5">{acoes}</div>}
    </div>
  );
}

/** Botão de ícone das linhas: sempre com nome para leitor de tela e área de toque de 36px. */
export function BotaoIcone({
  rotulo,
  onClick,
  disabled,
  perigo,
  soComputador,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  perigo?: boolean;
  /** Some no celular, onde a linha inteira já abre a edição. */
  soComputador?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "w-9 h-9 items-center justify-center rounded-lg text-tinta-400 transition-colors disabled:opacity-40",
        soComputador ? "hidden sm:flex" : "flex",
        perigo ? "hover:bg-saida-50 hover:text-saida-600" : "hover:bg-tinta-100 hover:text-tinta-800"
      )}
    >
      {children}
    </button>
  );
}

/** Excluir dentro da janela de edição: no celular é onde ele mora. */
export function BotaoExcluir({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-3 w-full py-2.5 rounded-lg text-sm font-medium text-saida-600 hover:bg-saida-50 transition-colors">
      Excluir
    </button>
  );
}

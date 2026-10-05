/** Título de página igual em todas as telas: título, uma linha de apoio e as ações à direita. */
export function Cabecalho({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-tinta-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-tinta-500 max-w-prose">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

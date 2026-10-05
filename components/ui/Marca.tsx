import Link from "next/link";

/** Três barras subindo: o saldo ao longo dos meses, que é o que o app mostra. */
export function SimboloMarca({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="13" width="5" height="9" rx="1.5" className="fill-marca-300" />
      <rect x="9.5" y="8" width="5" height="14" rx="1.5" className="fill-marca-500" />
      <rect x="17" y="2" width="5" height="20" rx="1.5" className="fill-marca" />
    </svg>
  );
}

export function Marca({ href }: { href?: string }) {
  const conteudo = (
    <>
      <SimboloMarca />
      <span className="text-[17px] font-semibold tracking-tight">WiseFlow</span>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-2 text-tinta-900">{conteudo}</Link>
  ) : (
    <div className="flex items-center gap-2 text-tinta-900">{conteudo}</div>
  );
}

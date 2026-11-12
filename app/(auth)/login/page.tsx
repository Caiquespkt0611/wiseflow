"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Marca } from "@/components/ui/Marca";
import { CenaPainel } from "@/components/entrada/CenaPainel";

const schema = z.object({
  email: z.string().email("Confira o e-mail"),
  password: z.string().min(1, "Digite a senha"),
});

type FormData = z.infer<typeof schema>;

/** Cada palavra entra separada (--p é a ordem). */
function Palavras({ texto, inicio, verde = false }: { texto: string; inicio: number; verde?: boolean }) {
  return (
    <>
      {texto.split(" ").map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className={`entrada-palavra ${verde ? "entrada-degrade" : ""}`} style={{ "--p": inicio + i } as React.CSSProperties}>
            {w}
          </span>
        </span>
      ))}
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  // Lido no efeito, não com useSearchParams: assim a página de login continua estática no build.
  const [cadastroOk, setCadastroOk] = useState(false);
  useEffect(() => setCadastroOk(new URLSearchParams(window.location.search).get("cadastro") === "ok"), []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("E-mail ou senha não conferem. Confira e tente de novo.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="tema-claro entrada relative min-h-[100dvh] overflow-hidden bg-[#f5f8f4] text-tinta-900">
      {/* brilhos e linhas de luz, como o site da InnovAdapt, em verde */}
      <div className="entrada-fundo" aria-hidden>
        <span className="entrada-orbe" style={{ background: "radial-gradient(closest-side, #1F9A62, transparent)", width: 640, height: 640, left: -200, top: -220, opacity: 0.28 }} />
        <span className="entrada-orbe" style={{ background: "radial-gradient(closest-side, #0DA2B8, transparent)", width: 560, height: 560, right: -160, top: 60, opacity: 0.22, animationDelay: "-5s" }} />
        <span className="entrada-orbe" style={{ background: "radial-gradient(closest-side, #8FD3A8, transparent)", width: 520, height: 520, left: "38%", bottom: -260, opacity: 0.35, animationDelay: "-9s" }} />
        <svg className="entrada-linhas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="entrada-traco" x1="0" x2="1">
              <stop offset="0" stopColor="#0DA2B8" stopOpacity="0" />
              <stop offset=".5" stopColor="#1F7A52" stopOpacity="0.5" />
              <stop offset="1" stopColor="#3FB68B" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path stroke="url(#entrada-traco)" d="M-40 160 C 380 40, 820 400, 1480 200" />
          <path stroke="url(#entrada-traco)" d="M-40 560 C 420 440, 900 760, 1480 500" />
          <path stroke="url(#entrada-traco)" d="M-40 860 C 500 760, 1000 980, 1480 820" />
        </svg>
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-5 py-7 sm:px-10 sm:py-9">
        <div className="mx-auto w-full max-w-[1240px]">
          <Marca />
        </div>

        <main className="flex flex-1 items-center">
          <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 py-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-16 xl:gap-24">
            <section>
              <h1 className="text-[38px] font-bold leading-[1] tracking-[-0.045em] sm:text-[52px] lg:text-[58px] text-balance">
                <span className="sr-only">Quanto sobra no fim do mês, antes de o mês acabar.</span>
                <span aria-hidden>
                  <Palavras texto="Quanto sobra no fim do mês," inicio={0} />{" "}
                  <Palavras texto="antes de o mês acabar." inicio={6} verde />
                </span>
              </h1>
              <p className="entrada-depois mt-5 max-w-[26rem] text-[17px] leading-relaxed text-tinta-600" style={{ "--d": "0.55s" } as React.CSSProperties}>
                O saldo, as contas que vencem e os empréstimos, com a conta feita para você.
              </p>

              <div className="entrada-depois entrada-cartao mt-8 p-6 sm:p-7" style={{ "--d": "0.7s" } as React.CSSProperties}>
                {cadastroOk && !error && (
                  <p className="mb-5 rounded-lg bg-marca-50 px-3 py-2.5 text-sm text-marca-800">Conta criada. Agora é só entrar.</p>
                )}
                {error && (
                  <p role="alert" className="mb-5 rounded-lg bg-saida-50 px-3 py-2.5 text-sm text-saida-700">
                    {error}
                  </p>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="campo-rotulo">E-mail</label>
                    <input {...register("email")} id="email" type="email" autoComplete="email" className="campo entrada-campo" placeholder="seu@email.com" />
                    {errors.email && <p className="mt-1 text-xs text-saida-600">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="senha" className="campo-rotulo">Senha</label>
                    <input {...register("password")} id="senha" type="password" autoComplete="current-password" className="campo entrada-campo" />
                    {errors.password && <p className="mt-1 text-xs text-saida-600">{errors.password.message}</p>}
                  </div>

                  <button type="submit" disabled={loading} className="entrada-botao w-full rounded-xl py-3.5 font-semibold text-white disabled:opacity-60">
                    {loading ? "Entrando…" : "Entrar"}
                  </button>
                </form>

                <p className="mt-5 text-sm text-tinta-500">
                  Primeira vez?{" "}
                  <Link href="/cadastro" className="font-semibold text-marca-700 underline-offset-4 hover:underline">
                    Criar conta
                  </Link>
                </p>
              </div>
            </section>

            <div className="hidden lg:block">
              <CenaPainel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

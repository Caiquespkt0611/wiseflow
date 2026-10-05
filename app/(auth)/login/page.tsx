"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Marca } from "@/components/ui/Marca";

const schema = z.object({
  email: z.string().email("Confira o e-mail"),
  password: z.string().min(1, "Digite a senha"),
});

type FormData = z.infer<typeof schema>;

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
    <div className="min-h-[100dvh] bg-tinta-50 flex flex-col px-5 py-8 sm:py-12">
      <Marca />
      <main className="flex-1 flex items-center">
        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-[32px] sm:text-[40px] leading-[1.08] font-semibold tracking-tight text-tinta-900 text-balance">
            Quanto sobra no fim do mês, antes de o mês acabar.
          </h1>
          <p className="text-tinta-500 mt-3 mb-8">Entre para ver as contas da casa.</p>

          {cadastroOk && !error && (
            <p className="bg-marca-50 text-marca-800 text-sm px-3 py-2.5 rounded-lg mb-5">Conta criada. Agora é só entrar.</p>
          )}
          {error && (
            <p role="alert" className="bg-saida-50 text-saida-700 text-sm px-3 py-2.5 rounded-lg mb-5">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="campo-rotulo">E-mail</label>
              <input {...register("email")} id="email" type="email" autoComplete="email" className="campo" placeholder="seu@email.com" />
              {errors.email && <p className="text-saida-600 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="senha" className="campo-rotulo">Senha</label>
              <input {...register("password")} id="senha" type="password" autoComplete="current-password" className="campo" />
              {errors.password && <p className="text-saida-600 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-marca hover:bg-marca-forte disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="text-sm text-tinta-500 mt-6">
            Primeira vez?{" "}
            <Link href="/cadastro" className="text-marca-700 font-medium hover:underline underline-offset-4">
              Criar conta
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

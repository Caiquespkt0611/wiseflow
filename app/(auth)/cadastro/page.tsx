"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Marca } from "@/components/ui/Marca";

const schema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function CadastroPage() {
  const router = useRouter();
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
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Erro ao criar conta");
    } else {
      router.push("/login?cadastro=ok");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-tinta-50 flex flex-col px-5 py-8 sm:py-12">
      <Marca />
      <main className="flex-1 flex items-center">
      <div className="w-full max-w-sm mx-auto">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-tinta-900 mb-8">
          Criar conta
        </h1>

        {error && (
          <div className="bg-saida-50 text-saida-600 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="campo-rotulo">
              Nome
            </label>
            <input
              {...register("nome")}
              className="campo"
              placeholder="Seu nome"
            />
            {errors.nome && (
              <p className="text-saida-500 text-xs mt-1">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label className="campo-rotulo">
              Email
            </label>
            <input
              {...register("email")}
              type="email"
              className="campo"
              placeholder="seu@email.com"
            />
            {errors.email && (
              <p className="text-saida-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="campo-rotulo">
              Senha
            </label>
            <input
              {...register("password")}
              type="password"
              className="campo"
              placeholder="Mínimo 6 caracteres"
            />
            {errors.password && (
              <p className="text-saida-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-marca hover:bg-marca-forte disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-tinta-500 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-marca-700 font-medium hover:underline underline-offset-4">
            Entrar
          </Link>
        </p>
      </div>
      </main>
    </div>
  );
}

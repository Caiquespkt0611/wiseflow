import type { Config } from "tailwindcss";

/**
 * As cores vêm de variáveis CSS (app/globals.css) para o modo escuro trocar
 * tudo de uma vez, sem `dark:` espalhado pelas telas.
 *   tinta    neutros: 50 é o fundo da página, 900 é o texto principal
 *   marca    verde-pinho: ação principal, item ativo, dinheiro que entra
 *   saida    tijolo: dinheiro que sai, erro, excluir
 *   aviso    ocre: vence logo, conferir
 */
const escala = (nome: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, `rgb(var(--${nome}-${n}) / <alpha-value>)`])
  );

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        superficie: "rgb(var(--superficie) / <alpha-value>)",
        tinta: escala("tinta"),
        marca: {
          ...escala("marca"),
          DEFAULT: "rgb(var(--marca-acao) / <alpha-value>)",
          forte: "rgb(var(--marca-acao-forte) / <alpha-value>)",
        },
        saida: escala("saida"),
        aviso: escala("aviso"),
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "sobe-folha": { from: { transform: "translateY(16px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
        "abre-modal": { from: { transform: "scale(0.96)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
        "fundo-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "sobe-folha": "sobe-folha 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "abre-modal": "abre-modal 200ms ease-out",
        "fundo-in": "fundo-in 160ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;

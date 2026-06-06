export const CATEGORIAS = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Streaming",
  "Educação",
  "Tecnologia",
  "Vestuário",
  "Lazer",
  "Finanças",
  "Pets",
  "Plano de Celular",
  "Beleza",
  "Empréstimo",
  "Receitas de Terceiros",
  "Investimento",
  "Negócios",
  "Outros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

// Colors by rank: red (highest) → orange → amber → lime → green → teal → blue → ...
export const CATEGORIA_COLORS_BY_RANK = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#d97706", // amber-600
  "#0ea5e9", // sky-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
  "#a1a1aa", // zinc-400 (fallback)
];

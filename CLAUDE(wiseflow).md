# CLAUDE.md

> **CEREBRO:** `/Users/caiqueoliveira/Documents/MEUS PROJETOS/TUDO DA EMPRESA/CEREBRO/projetos/wiseflow/`
> Leia `contexto.md` para status atual e melhorias anotadas no Obsidian.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Start dev server on http://localhost:3000

# Build
npm run build         # Runs prisma generate && next build

# Lint
npm run lint          # ESLint via Next.js

# Database
npm run db:generate   # Generate Prisma client after schema changes
npm run db:migrate    # Run migrations interactively
npm run db:push       # Push schema changes without migration files
npm run db:studio     # Open Prisma Studio GUI
```

## Architecture

**WiseFlow** is a personal finance management app built with Next.js 14 App Router, Prisma + PostgreSQL (Supabase), and NextAuth.js (credentials/JWT).

### Route Groups

- `app/(auth)/` — public pages: login and registration
- `app/(dashboard)/` — protected pages, all behind NextAuth middleware
- `app/api/` — REST API routes; every route validates the session before any DB operation

### Key Financial Modules

| Route | Purpose |
|---|---|
| `/dashboard` | KPI cards, donut charts by category and card, month navigation |
| `/receitas` | Fixed/recurring income; handles one-time, recurring, installment, and vacation exception logic |
| `/receitas-variaveis` | Multi-installment income (e.g., bonus in N parcels) |
| `/despesas-fixas` | Monthly bills; marks paid and auto-advances due date |
| `/despesas-variaveis` | Credit card purchases in installments, grouped by card |
| `/contas` | Bank account balances used in projection |
| `/projecao` | 12-month forward-looking balance forecast |

### Data Flow

All pages are client components (`"use client"`) that fetch from the API routes. The API routes use Prisma with a singleton client (`lib/prisma.ts`) configured with a PostgreSQL pool adapter (max 1 connection) for serverless compatibility.

### Dashboard Calculation Engine (`app/api/dashboard/route.ts`)

The most complex part of the codebase. For a given month it:
1. Filters recurring/one-time/installment items by month using offset from `dataInicio`
2. Applies vacation exceptions — a 35-day window that suppresses salary/advance entries
3. Accumulates balance projections forward through prior months when navigating to future months
4. Returns KPIs, charts data, and itemized lists in a single response

### Installment Math

Used in `ReceitaVariavel` and `DespesaVariavel`. The parcel that applies to a given month is derived from `dataInicio` + parcel offset. All date math uses UTC to avoid timezone shift bugs (a recurring fix in the history — always use `Date.UTC` or parse with UTC methods).

### Alert Engine (`app/api/alertas/route.ts`)

Calculates items due within the next 60 days and returns them color-coded by urgency. The Sidebar polls this and displays the alerts.

### Auth

NextAuth configured in `lib/auth.ts` with a CredentialsProvider. JWT callbacks enrich the token with `user.id` and `name`. Middleware at `middleware.ts` protects all dashboard routes.

### Prisma Schema Models

- **User** — email/password (bcrypt), name
- **ContaBancaria** — bank account with `saldo`
- **Receita** — fixed income; fields `recorrente`, `parcelada`, `mesesTotal`, `excecoes` (JSON), `ativa`
- **ReceitaVariavel** — installment income; `parcelaAtual`, `parcelasTotal`, `valorParcela`, `dataInicio`
- **DespesaFixa** — bills; `dataProximoVencimento` advances on confirmation
- **DespesaVariavel** — card purchases; `cartao`, `parcelaAtual`, `parcelasTotal`, `dataInicio`

All models have `userId` and cascade-delete on user removal.

### Shared Patterns

- Forms use **React Hook Form + Zod** (`lib/` schemas); resolvers bridge both
- **Toast** notifications via a context provider wrapping the dashboard layout — always use toasts for user feedback, never `alert()`
- **MonthSelector** component drives month state; passed as query param `?mes=YYYY-MM` to API routes
- Currency formatting and shared utilities live in `lib/utils.ts`
- Category definitions and color palette are in `lib/categories.ts`
- `clsx` + `tailwind-merge` via a `cn()` helper for conditional class merging

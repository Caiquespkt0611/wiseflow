/**
 * Fecha a porta da API REST do Supabase no WiseFlow.
 *
 * O que o advisor achou em 25/08/2026 (`supabase db advisors`): cinco tabelas
 * — contas_bancarias, despesas_fixas, despesas_variaveis, receitas e users —
 * com uma policy `service_full_access_*` valendo para QUALQUER papel, com
 * `USING (true)` e `WITH CHECK (true)`. O nome diz service, o efeito é geral.
 *
 * Isso importa porque o Supabase publica o schema `public` como API REST
 * alcançável com a anon key. Policy liberada para todos + grant padrão do
 * Supabase = qualquer um com a chave lê e escreve conta bancária e usuário.
 *
 * O app não precisa dessas policies. Ele conecta como `postgres`, que tem
 * BYPASSRLS: o RLS nunca se aplicou a ele. As policies só serviam ao anon.
 *
 * A correção não as apaga — aponta cada uma para `service_role`, que era a
 * intenção do nome. E revoga os grants de anon/authenticated, que é o que de
 * fato fecha a porta.
 *
 * Idempotente. Rodar: node scripts/fechar-rls.mjs
 */
// `pg` direto em vez do Prisma: isto é SQL de administração, e o Prisma 7 exige
// um adapter só para chegar no $queryRaw. O app usa o mesmo `pg` (lib/prisma.ts).
import pg from 'pg'

if (!process.env.DATABASE_URL) process.loadEnvFile('.env')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente — rode na raiz do projeto')

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const consultar = async (sql) => (await db.query(sql)).rows
const executar = (sql) => db.query(sql)
const PUBLICOS = ['anon', 'authenticated']

async function main() {
  // Trava: mexer em policy só é seguro se o papel do app ignora RLS. Se um dia
  // o WiseFlow passar a conectar com papel restrito (como a Gestão faz), este
  // script apagaria o acesso dele às tabelas sem avisar.
  const [{ papel, bypassa }] = await consultar(
    `SELECT current_user AS papel, rolbypassrls AS bypassa
       FROM pg_roles WHERE rolname = current_user`,
  )
  console.log(`conectado como ${papel} · ignora RLS: ${bypassa}`)
  if (!bypassa) {
    throw new Error(
      `o papel ${papel} NÃO ignora RLS. Fechar as policies deixaria o app cego. ` +
        `Crie uma policy para ele antes, como em gestao-innovadapt/scripts/ativar-rls.ts`,
    )
  }

  // 1. policy geral vira policy de service_role
  const permissivas = await consultar(
    `SELECT c.relname AS tabela, p.polname AS policy
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND p.polroles = '{0}'`, // {0} = PUBLIC, todos os papéis
  )
  for (const { tabela, policy } of permissivas) {
    await executar(
      `ALTER POLICY "${policy}" ON public."${tabela}" TO service_role`,
    )
    console.log(`ok: policy "${policy}" em ${tabela} agora vale só para service_role`)
  }
  if (permissivas.length === 0) console.log('ok: nenhuma policy valendo para todos os papéis')

  // 1b. tabela com RLS e sem policy nenhuma fica invisível até para o
  // service_role. Não é risco — é inconsistência, e inconsistência vira ruído
  // na próxima varredura. Dá a ela a mesma policy que as outras cinco têm.
  const semPolicy = await consultar(
    `SELECT c.relname AS tabela
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)`,
  )
  for (const { tabela } of semPolicy) {
    await executar(
      `CREATE POLICY service_full_access_${tabela} ON public."${tabela}"
         FOR ALL TO service_role USING (true) WITH CHECK (true)`,
    )
    console.log(`ok: ${tabela} ganhou policy de service_role`)
  }

  // 2. RLS ligado em tudo — tabela sem RLS é a porta escancarada
  const tabelas = await consultar(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  )
  for (const { tablename } of tabelas) {
    await executar(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`)
    await executar(
      `REVOKE ALL ON public."${tablename}" FROM ${PUBLICOS.join(', ')}`,
    )
  }
  console.log(`ok: RLS ligado e grants revogados em ${tabelas.length} tabelas`)

  // 3. sequences, funções e o que ainda nem existe
  await executar(
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${PUBLICOS.join(', ')}`,
  )
  await executar(
    `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${PUBLICOS.join(', ')}`,
  )
  for (const tipo of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) {
    await executar(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ${tipo} FROM ${PUBLICOS.join(', ')}`,
    )
  }
  console.log('ok: sequences, funções e default privileges fechados')

  // 4. prova
  const abertas = await consultar(
    `SELECT c.relname,
            has_table_privilege('anon', c.oid, 'SELECT') AS anon,
            has_table_privilege('authenticated', c.oid, 'SELECT') AS auth
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  )
  const vazando = abertas.filter((t) => t.anon || t.auth)
  console.log(
    vazando.length === 0
      ? `\nFechado: anon e authenticated não leem nenhuma das ${abertas.length} tabelas.`
      : `\nAINDA ABERTAS: ${vazando.map((t) => t.relname).join(', ')}`,
  )
  if (vazando.length) process.exit(1)
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1) }).finally(() => db.end())

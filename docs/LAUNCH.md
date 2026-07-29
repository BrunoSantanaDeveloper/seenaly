# Seenaly — Checklist de lançamento

Ações que dependem do operador (contas externas, segredos, decisões comerciais).
O estado do banco e dos gaps foi levantado em 2026-07-16; atualize este arquivo
conforme os itens forem concluídos.

## 1. Banco de dados (bloqueia tudo — fazer primeiro)

O banco live está com as migrations **0000–0011 aplicadas e 0012–0024 ausentes**
(diagnóstico, criativos, experimentos, funil, admin, notificações, help/blog,
backups e Organic Growth inteiros não existem no Supabase).

1. **Corrigir a senha do `DATABASE_URL`** em `apps/web/.env` — a atual é
   rejeitada (`password authentication failed`). Use a connection string do
   **Transaction Pooler** (porta 6543): Supabase → Connect → Transaction pooler.
   Se não lembrar a senha: Settings → Database → Reset database password.
2. Aplicar as migrations que faltam (idempotente, mostra o que está aplicado):

   ```bash
   npm run db:migrate -- --dry-run   # confere
   npm run db:migrate                # aplica + recarrega o cache do PostgREST
   ```

3. Seed dos planos mock + mover a org real para o Pro com créditos de beta:

   ```bash
   npm run db:seed-plans -- --org=613988dd-7aec-42dc-ae94-bb62210e39a8 --to=pro --credits=500
   ```

4. Tornar-se superadmin — **o PRIMEIRO** sai no SQL editor do Supabase (a
   migration 0035 tira essa coluna das mãos do cliente: nenhuma sessão do
   navegador consegue mais gravá-la, nem na própria linha):

   ```sql
   update public.profiles set is_superadmin = true
   where id = '754aca45-65cc-486f-92cb-13e1ead60670';
   ```

   Do segundo em diante, use o botão **Make superadmin** em
   `/admin/organizations` → aba Users (server action com service role,
   auditada; não dá para mexer na própria conta, para ninguém se trancar
   fora). Precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente.

## 2. Billing (mock por enquanto — decisão de 2026-07-16)

- Os planos Free/Pro/Scale são linhas reais em `plans` com preços de vitrine
  (R$ 0 / R$ 197 / R$ 497) e `organic_growth` nos pagos; edite em `/admin/billing`.
- **Sem provider de pagamento**: o checkout mostra um aviso localizado e o
  botão fica desabilitado (`plans-grid.tsx`). Quando a conta Stripe (ou Asaas)
  existir: preencher `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (ou
  `ASAAS_*`), criar os preços no provider e gravar os IDs em
  `plans.provider_refs` — o aviso some sozinho (ele lê a lista de providers
  configurados).

### Política de créditos (2026-07-19) — resolvida

O diagnóstico custa 5 créditos e a classificação do Organic 1. Sem crédito, a
jornada morre no "primeiro diagnóstico". Duas alavancas, ambas em `plans.limits`
(editáveis em `/admin/billing`, semeadas por `npm run db:seed-plans`):

- **Boas-vindas (Free):** `limits.welcome_credits = 25` (≈5 diagnósticos).
  Concedido UMA vez na criação da org pela migration `0025` (função
  `grant_welcome_credits`, chamada pelo trigger `handle_new_organization`).
- **Mensais (Pro/Scale):** `limits.credits_monthly = 500 / 1500`. Concedidos por
  mês pelo cron Inngest `billing-monthly-credits` (`packages/billing/src/jobs.ts`);
  sem chaves Inngest, o operador roda `npm run db:grant-credits` (idempotente por
  org+mês). Planos `recurring` NÃO recebem crédito por webhook (isso só vale para
  planos `kind=credits`) — é este cron/atalho que os abastece.
- **Caso a caso (suporte):** `/admin/organizations` → **Manage** na org mostra o
  saldo e permite ajuste manual (positivo repõe, negativo estorna) e troca de
  plano — RPCs `admin_grant_credits` / `admin_set_org_plan` da migration 0035,
  só superadmin, gravadas no ledger como `adjustment` com o operador em
  `created_by` e auditadas em `audit_events`. Trocar de plano NÃO concede
  crédito nem tira suspensão: as duas decisões continuam explícitas.

## 3. E-mail — Resend

Preencher em `apps/web/.env` (e na Vercel): `RESEND_API_KEY`, `EMAIL_FROM`,
`CONTACT_FORM_TO`. Sem isso: convite de membro degrada para "copiar link"
(funciona), formulário de contato mostra aviso de não configurado. E-mails de
auth (confirmação/reset) são do Supabase, independem do Resend.

## 4. Jobs — Inngest

Preencher `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (app em `/api/inngest`).
Sem eles: sync diário do Meta Ads e backup noturno **não rodam** (há fallback
inline apenas para execuções manuais).

## 5. Meta app review (trilha B) — iniciar JÁ (prazo externo de semanas)

- Trilha A (testável antes): system-user token via `/settings/connections`.
- Trilha B: criar app na Meta, solicitar `ads_read` (+ escopos de Insights),
  passar pelo app review. Só depois o OAuth self-service funciona.
- Pendência de produto da Fase 1: validar o sync com token real. A **tela de
  conferência** já existe (2026-07-19): `/settings/connections` mostra contagem
  de campanhas/anúncios, último dia sincronizado e os totais de 7 dias para
  comparar com o Gerenciador (`data-check-card.tsx`).

## 5b. Observabilidade — PostHog + Sentry (2026-07-19)

Ambos são no-op sem as chaves; ligar preenchendo em `apps/web/.env` (e na Vercel):

- **PostHog** (funil de ativação): `NEXT_PUBLIC_POSTHOG_KEY` (+ opcional
  `NEXT_PUBLIC_POSTHOG_HOST`). Só então o `ANALYTICS_PROVIDER` (`lib/analytics.ts`)
  liga e o banner de consentimento aparece; o SDK só carrega após o aceite.
  Eventos de ativação já instrumentados: `product_created`,
  `diagnosis_generated`, `experiment_registered`, `feedback_recorded`.
- **Sentry** (erros em produção): `SENTRY_DSN` (server) e
  `NEXT_PUBLIC_SENTRY_DSN` (client), lidos por `instrumentation.ts` /
  `instrumentation-client.ts` / `app/global-error.tsx`. Upload de sourcemaps
  ainda NÃO está configurado (sem auth token) — stack traces vêm minificados até
  lá; o objetivo agora é apenas enxergar os erros do beta.

## 6. Legal (antes de cobrar)

`/legal/terms` e `/legal/privacy` são placeholders do template (chaves
`terms-*`/`privacy-*` no namespace `marketing`). Substituir por texto revisado
por advogado (LGPD: base legal, cookies, DPA, exclusão de dados). O aceite
versionado pode usar `packages/audit` (consent terms).

## 7. Divergência do template (re-aplicar após `/update-from-template`)

`packages/knowledge/src/embeddings.ts` usa `gemini-embedding-001`
(`outputDimensionality: 768`) porque o Google aposentou `text-embedding-004`.
Se um merge do template reverter, re-aplicar (ou subir o fix no template).

## Migrations e scripts (atualizado 2026-07-19)

- Migrations vão até **`0026`**. Aplicar as pendentes com `npm run db:migrate`
  (marcadores: `grant_welcome_credits` na 0025, `diagnosis_feedback` na 0026).
- `npm run db:seed-plans` — planos + limits (welcome/monthly credits) + move a
  org e concede créditos de beta.
- `npm run db:grant-credits` — concede os créditos mensais dos planos pagos
  (fallback do cron Inngest; idempotente por org+mês).
- `npm run db:sync-assistants` — re-sincroniza a linha `diagnosis-engine` a
  partir do prompt canônico da migration `0012`. **Rodar após QUALQUER edição do
  prompt/config em 0012** (o INSERT da 0012 não roda live). Substitui os scripts
  temporários usados antes.

## Follow-ups conhecidos (fora do escopo do lançamento beta)

CI (GitHub Actions), testes do motor/entitlements, rate-limit nas actions de IA,
análise tag×performance da biblioteca de criativos (a ponte anúncio↔criativo já
alimenta o briefing; a análise agregada ainda precisa de dados Meta reais).

Resolvidos em 2026-07-19 (antes eram follow-ups): créditos de boas-vindas +
mensais, lembrete de `next_review` + nudge pós-experimento, feedback de utilidade
no diagnóstico core, observabilidade (PostHog+Sentry), taxonomia slug-canônica do
criativo/produto, tela de conferência dos dados Meta.

Formulários (auditoria 2026-07-17; máscaras/autofill/senha/taxonomias resolvidos):
- Datas de funil/experimentos usam `<input type="date">` nativo; migrar para
  MUI X Date Pickers Pro (range de período, formato pt-BR garantido).

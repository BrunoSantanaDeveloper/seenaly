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

4. Tornar-se superadmin (uma vez, no SQL editor do Supabase):

   ```sql
   update public.profiles set is_superadmin = true
   where id = '754aca45-65cc-486f-92cb-13e1ead60670';
   ```

## 2. Billing (mock por enquanto — decisão de 2026-07-16)

- Os planos Free/Pro/Scale são linhas reais em `plans` com preços de vitrine
  (R$ 0 / R$ 197 / R$ 497) e `organic_growth` nos pagos; edite em `/admin/billing`.
- **Sem provider de pagamento**: o checkout mostra um aviso localizado e o
  botão fica desabilitado (`plans-grid.tsx`). Quando a conta Stripe (ou Asaas)
  existir: preencher `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (ou
  `ASAAS_*`), criar os preços no provider e gravar os IDs em
  `plans.provider_refs` — o aviso some sozinho (ele lê a lista de providers
  configurados).
- Gap conhecido: planos `recurring` não concedem créditos automaticamente
  (créditos só entram via webhook de planos kind=`credits` ou grant manual em
  `credit_transactions`). Decidir a política de créditos mensais antes do
  lançamento pago.

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
- Pendências de produto da Fase 1: validar o sync com token real + tela de
  conferência dos dados sincronizados.

## 6. Legal (antes de cobrar)

`/legal/terms` e `/legal/privacy` são placeholders do template (chaves
`terms-*`/`privacy-*` no namespace `marketing`). Substituir por texto revisado
por advogado (LGPD: base legal, cookies, DPA, exclusão de dados). O aceite
versionado pode usar `packages/audit` (consent terms).

## 7. Divergência do template (re-aplicar após `/update-from-template`)

`packages/knowledge/src/embeddings.ts` usa `gemini-embedding-001`
(`outputDimensionality: 768`) porque o Google aposentou `text-embedding-004`.
Se um merge do template reverter, re-aplicar (ou subir o fix no template).

## Follow-ups conhecidos (fora do escopo do lançamento beta)

CI (GitHub Actions), testes do motor/entitlements, observabilidade
(Sentry/PostHog), rate-limit nas actions de IA, feedback de utilidade no
diagnóstico core, análise tag×performance da biblioteca de criativos
(precisa de dados Meta reais).

Formulários (auditoria 2026-07-17; máscaras/autofill/senha já resolvidos):
- Taxonomias de texto livre do criativo (`format`, `proofType`, `emotion`,
  `visualStyle`, `funnelStage`) e `conversionType`/`funnelStage` do produto
  precisam do design slug-canônico + label localizado (como o módulo Organic)
  antes de virarem autocomplete — strings traduzidas como valor envenenariam
  a comparabilidade entre idiomas.
- Datas de funil/experimentos usam `<input type="date">` nativo; migrar para
  MUI X Date Pickers Pro (range de período, formato pt-BR garantido).

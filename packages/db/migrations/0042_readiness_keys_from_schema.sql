-- ============================================================
-- 0042_readiness_keys_from_schema: a lista de chaves sai do prompt.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_keys_from_schema
--
-- O defeito: o mesmo fato — quais chaves de checklist existem — estava escrito
-- em três lugares, e só UM deles é fonte da verdade (READINESS_ITEM_KEYS, no
-- código). O prompt enumerava 20 nomes e fechava com "NUNCA invente uma chave
-- fora dessa lista". A migração 0034 acrescentou quatro chaves de ativação
-- (signupFrictionLow, activationDefined, trialToPaidTracked, upgradePathClear)
-- e não tocou no prompt. Resultado: o briefing do modelo trial-first EXIGE
-- essas chaves e o prompt as PROÍBE — duas instruções autoritativas em
-- conflito, resolvidas de forma não determinística a cada geração.
--
-- Consequência medida (não é hipótese): quando o motor obedece o prompt e
-- omite related_items, resolvableItems() cai no fallback por dimensão e a
-- finding herda o GRUPO INTEIRO. Uma finding sobre "trial → pagante não é
-- medido" passa a exigir os 4 itens de ativação; findingResolution só a
-- considera resolvida quando os quatro assentam. O usuário conserta
-- exatamente o que foi pedido e o item continua pendente — e o "X/N" e as
-- tiles do plano herdam o erro. É a imprecisão que o próprio prompt proíbe
-- ("liste apenas pixelInstalled, não o grupo inteiro").
--
-- A correção estrutural está no código e já shipou junto desta migração:
--   1. `related_items` virou ENUM no JSON Schema, GERADO de READINESS_ITEM_KEYS
--      e escopado pelo modelo de funil (lib/readiness/schema.ts) — imposto pelo
--      provedor, não pedido em prosa, e um negócio de venda direta não recebe
--      sequer a possibilidade de emitir chave de ativação;
--   2. o bloco do checklist do briefing passou a carregar a chave ao lado do
--      rótulo (lib/readiness/brief.ts), então o motor lê os nomes válidos do
--      próprio dado que recebe.
--
-- Esta migração faz a terceira parte: APAGA a cópia em prosa. Não é mais um
-- patch da lista — é a remoção da duplicata que causa a deriva. É o mesmo
-- desenho que o motor de plano criativo (0033) já usa: "use EXATAMENTE os
-- slugs canônicos permitidos pelo schema. Nunca invente slug."
-- ============================================================

create function public.apply_readiness_keys_from_schema()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update public.assistants
  set system_prompt = replace(
    system_prompt,
    'As chaves válidas são exatamente estas: pixelInstalled, capiInstalled, conversionEventTested, analyticsInstalled, pageHasProof, pageMobileTested, pageFast, hasGuarantee, paymentPix, paymentCard, checkoutShort, abandonedRecovery, seoBasics, indexable, sitemapRobots, structuredData, socialProfiles, organicContent, emailCapture, emailFollowup. Omita related_items quando a finding não corresponder a nenhum item (dimensões oferta e midia não têm itens de checklist). NUNCA invente uma chave fora dessa lista.',
    'As chaves válidas são as que aparecem entre crases ao lado de cada item no bloco do checklist deste briefing — e somente essas; o schema da resposta impõe o conjunto, então uma chave inventada é rejeitada antes de chegar ao usuário. Omita related_items quando a finding não corresponder a nenhum item (dimensões oferta e midia não têm itens de checklist).'
  )
  where slug = 'readiness-engine';
  get diagnostics n = row_count;

  -- VERIFICAÇÃO (mesma razão de 0041): replace() que não casa é no-op
  -- silencioso — o marcador ficaria gravado e o prompt continuaria proibindo
  -- as chaves de ativação para sempre.
  select count(*) into n
  from public.assistants
  where slug = 'readiness-engine'
    and system_prompt like '%aparecem entre crases ao lado de cada item%'
    and system_prompt not like '%NUNCA invente uma chave fora dessa lista%'
    and system_prompt not like '%pixelInstalled, capiInstalled, conversionEventTested%';

  if n <> 1 then
    raise exception
      'A lista de chaves NÃO saiu do prompt do readiness-engine (% linha(s) conformes). O texto no banco diverge de 0028+0041 — provavelmente editado em /admin/ai. Ajuste o alvo de replace() ao texto vivo antes de reaplicar.', n;
  end if;

  return n;
end;
$$;

revoke execute on function public.apply_readiness_keys_from_schema() from public, anon, authenticated;

select public.apply_readiness_keys_from_schema();

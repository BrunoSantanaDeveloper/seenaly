-- ============================================================
-- 0047_creative_plan_organic_native: hipóteses são CONTEÚDO NATIVO, não peça
-- publicitária.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_creative_plan_organic_native
--
-- Caso real (Medchina AI, 2026-08-05): o Plano de Teste Criativo devolveu
-- hipóteses cujos ganchos eram slogans de anúncio — "Chega de prontuários de
-- MTC bagunçados e incompletos!" — para peças que, por contrato, existem para
-- ser publicadas ORGANICAMENTE antes de qualquer gasto em mídia. O usuário
-- (dono do produto) resumiu o efeito: "posts do tipo propaganda passam direto
-- pela visão do cliente".
--
-- A causa era anterior ao prompt e foi corrigida junto: as cinco perguntas de
-- recuperação (lib/creative-plan/brief.ts) eram TODAS sobre doutrina de
-- anúncio pago, então o motor recuperava doutrina de anúncio e escrevia
-- anúncio. Três perguntas orgânico-nativas entraram lá, e quatro documentos
-- novos entraram no corpus growth-playbook (distribuicao-organica-sinais,
-- pilares-conteudo-mix, cadencia-consistencia-formatos,
-- conteudo-nativo-vs-anuncio).
--
-- Esta migração fecha o lado do prompt. Sem ela o vazamento volta: o motor tem
-- meta-ads-docs na recuperação e escorrega naturalmente para a forma de
-- anúncio, que é o que aquele corpus inteiro documenta.
-- ============================================================

create function public.apply_creative_plan_organic_native()
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
    'CAVEAT DE TRANSFERÊNCIA (inviolável, repita-o no campo transfer_caveat com suas palavras): sinal orgânico mede interesse de uma audiência morna (seguidores + descoberta); o anúncio pago mede conversão em audiência fria. Um gancho que vence organicamente NÃO está garantido no pago — ele apenas se torna a hipótese com mais evidência para testar primeiro. Nunca prometa resultado pago a partir de sinal orgânico.',
    'CAVEAT DE TRANSFERÊNCIA (inviolável, repita-o no campo transfer_caveat com suas palavras): sinal orgânico mede interesse de uma audiência morna (seguidores + descoberta); o anúncio pago mede conversão em audiência fria. Um gancho que vence organicamente NÃO está garantido no pago — ele apenas se torna a hipótese com mais evidência para testar primeiro. Nunca prometa resultado pago a partir de sinal orgânico.

CONTEÚDO NATIVO, NUNCA PEÇA PUBLICITÁRIA (regra de forma, inviolável): estas hipóteses vão ser publicadas ORGANICAMENTE, no feed, onde ninguém pediu para ver uma oferta. Conteúdo com forma de anúncio é filtrado pela audiência antes de ser avaliado e distribuído para menos gente — então uma hipótese escrita como anúncio não testa o ângulo, testa a rejeição ao formato, e a evidência volta inútil. Consequências obrigatórias para cada hipótese:
- O GANCHO é a abertura de um conteúdo, não um slogan. É PROIBIDO gancho em forma de propaganda: "Chega de [dor]!", "Cansado de [dor]?", "A solução definitiva para...", "Conheça o [produto]", promessa com preço, desconto, urgência ou contagem regressiva. Um gancho nativo abre uma história, um erro comum, uma demonstração, um bastidor ou uma pergunta específica do dia a dia de quem assiste.
- A PEÇA precisa reter, ensinar ou provar alguma coisa que teria valor mesmo se a venda não existisse no final. Se o conteúdo só faz sentido porque existe um produto para vender, ele ainda é anúncio.
- O CTA é proporcional à etapa do funil: em descoberta/educação, o pedido é salvar, comentar ou compartilhar — NUNCA comprar. CTA de compra pertence ao anúncio pago, não ao teste orgânico.
- O prompt_brief deve descrever a peça nessa forma nativa (história, tutorial, erro comum, bastidor, demonstração, estudo de caso, depoimento), nunca um roteiro de comercial.
- O success_criterion deve olhar primeiro para sinais de distribuição orgânica (retenção, salvamentos, compartilhamentos, comentários) relativos à própria conta — não para cliques ou vendas, que são a régua do pago.
Quando o produto for árido ou técnico, a saída correta NÃO é apelar para a forma publicitária: é achar o ângulo nativo (o erro que o público comete, o bastidor do ofício, a comparação honesta, o caso real) que carrega a mesma promessa.'
  )
  where slug = 'creative-plan-engine'
    -- Idempotence: the anchor paragraph survives the replace (it is a prefix of
    -- the new text), so a re-run would duplicate the rule without this guard.
    and system_prompt not like '%CONTEÚDO NATIVO, NUNCA PEÇA PUBLICITÁRIA%';
  get diagnostics n = row_count;

  -- VERIFICAÇÃO (padrão de 0041–0045): replace() que não casa é no-op
  -- silencioso. Exigimos exatamente UMA ocorrência da regra nova — zero
  -- significa que o texto vivo divergiu (editado em /admin/ai) e o alvo do
  -- replace precisa ser reajustado; duas significa aplicação duplicada.
  select count(*) into n
  from public.assistants
  where slug = 'creative-plan-engine'
    and (length(system_prompt) - length(replace(system_prompt, 'CONTEÚDO NATIVO, NUNCA PEÇA PUBLICITÁRIA', '')))
        = length('CONTEÚDO NATIVO, NUNCA PEÇA PUBLICITÁRIA')
    and system_prompt like '%É PROIBIDO gancho em forma de propaganda%'
    and system_prompt like '%CTA de compra pertence ao anúncio pago%';

  if n <> 1 then
    raise exception
      'A regra "conteúdo nativo, nunca peça publicitária" NÃO foi aplicada ao creative-plan-engine (% linha(s) conformes). O prompt no banco diverge do alvo do replace() — provavelmente editado em /admin/ai. Ajuste o alvo ao texto vivo antes de reaplicar.', n;
  end if;

  return n;
end;
$$;

revoke execute on function public.apply_creative_plan_organic_native() from public, anon, authenticated;

select public.apply_creative_plan_organic_native();

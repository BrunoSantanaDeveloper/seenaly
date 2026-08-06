-- ============================================================
-- 0045_readiness_declaration_never_blocks: declaração não vira bloqueador.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_declaration_never_blocks
--
-- Caso real (Medchina AI, 2026-08-05): o usuário marcou no checklist
-- pixel_installed, conversion_event_tested e capi_installed — o avaliador
-- determinístico (sinais locais) reportou ZERO bloqueadores — e ainda assim o
-- motor devolveu verdict="nao_pronto" com blocking=["Mensuração de conversão e
-- CAPI não verificadas"] e uma finding "critico" na mensuração. O único
-- fundamento era "declarado, mas não verificado".
--
-- Isso quebra o contrato em dois pontos que o prompt já afirmava:
--   * "declarado, NÃO verificado — trate como afirmação... e leve isso para a
--     CONFIANÇA" — o destino do ceticismo é confidence, não blocking;
--   * "Ser 'não ideal' não é bloqueador".
-- E cria um beco sem saída de produto: itens de tier "declarado" (CAPI, evento
-- testado) são INVISÍVEIS a qualquer scan por definição. Se a declaração não
-- basta, não existe ação no app que remova o bloqueador — o usuário fica preso
-- num loop com tudo marcado e o veredito parado em "nao_pronto".
--
-- A regra nova fecha o buraco sem desdentar o motor: bloqueadores legítimos
-- continuam sendo os dos sinais locais e fatos que o próprio briefing comprova
-- (a economia não fecha, o scan CONTESTOU uma declaração). Só o ceticismo puro
-- sobre declaração é rebaixado para confidence + missing_data + "atencao".
-- ============================================================

create function public.apply_readiness_declaration_never_blocks()
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
    'BLOQUEADORES: o campo blocking lista SOMENTE o que torna o gasto em anúncio previsivelmente desperdiçado — tipicamente: não há como medir conversão, não há página, não há como receber pagamento, ou a economia não fecha (CAC alvo incompatível com o ticket/margem). Ser "não ideal" não é bloqueador. Se não houver nenhum, devolva lista vazia — e nesse caso o verdict NÃO pode ser "nao_pronto".',
    'BLOQUEADORES: o campo blocking lista SOMENTE o que torna o gasto em anúncio previsivelmente desperdiçado — tipicamente: não há como medir conversão, não há página, não há como receber pagamento, ou a economia não fecha (CAC alvo incompatível com o ticket/margem). Ser "não ideal" não é bloqueador. Se não houver nenhum, devolva lista vazia — e nesse caso o verdict NÃO pode ser "nao_pronto".

DECLARAÇÃO NUNCA VIRA BLOQUEADOR: um item marcado no checklist é a afirmação de um fato pelo usuário. Quando você não consegue verificá-lo (CAPI, evento testado, meios de pagamento — tudo que é invisível ao scan), o ceticismo vai para confidence e para missing_data, NUNCA para blocking — e a finding correspondente é no máximo "atencao", nunca "critico". É PROIBIDO criar um bloqueador (ou uma finding "critico") cujo único fundamento é "declarado, mas não verificado": se a única pendência é comprovar algo que o usuário afirmou, o verdict não pode ser "nao_pronto" por causa disso. Bloqueadores legítimos são os apontados pelos sinais locais (calculados deterministicamente e já exibidos ao usuário) e fatos que o próprio briefing comprova — a economia que não fecha, uma declaração que o scan CONTESTOU. Recomendar a comprovação (ex.: ferramenta de Teste de Eventos do Gerenciador de Eventos) continua certo — como ação de um achado "atencao", com o pedido em missing_data, não como bloqueador.'
  )
  where slug = 'readiness-engine'
    -- Idempotence: the anchor paragraph survives the replace (it is a prefix of
    -- the new text), so a re-run would duplicate the rule without this guard.
    and system_prompt not like '%DECLARAÇÃO NUNCA VIRA BLOQUEADOR%';
  get diagnostics n = row_count;

  -- VERIFICAÇÃO (padrão de 0041–0044): replace() que não casa é no-op
  -- silencioso. Exigimos exatamente UMA ocorrência da regra nova — zero
  -- significa que o texto vivo divergiu (editado em /admin/ai) e o alvo do
  -- replace precisa ser reajustado; duas significa aplicação duplicada.
  select count(*) into n
  from public.assistants
  where slug = 'readiness-engine'
    and (length(system_prompt) - length(replace(system_prompt, 'DECLARAÇÃO NUNCA VIRA BLOQUEADOR', '')))
        = length('DECLARAÇÃO NUNCA VIRA BLOQUEADOR')
    and system_prompt like '%no máximo "atencao", nunca "critico"%'
    and system_prompt like '%uma declaração que o scan CONTESTOU%';

  if n <> 1 then
    raise exception
      'A regra "declaração nunca vira bloqueador" NÃO foi aplicada ao readiness-engine (% linha(s) conformes). O prompt no banco diverge do alvo do replace() — provavelmente editado em /admin/ai. Ajuste o alvo ao texto vivo antes de reaplicar.', n;
  end if;

  return n;
end;
$$;

revoke execute on function public.apply_readiness_declaration_never_blocks() from public, anon, authenticated;

select public.apply_readiness_declaration_never_blocks();

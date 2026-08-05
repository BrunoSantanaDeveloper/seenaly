-- ============================================================
-- 0044_readiness_stage_is_when: `stage` é QUANDO custa dinheiro, não onde.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_stage_is_when
--
-- A 0043 obrigou toda finding a dizer onde a correção mora, e funcionou em
-- quase tudo: a chave interna parou de vazar, "não declara" virou "não foi
-- confirmada", o momento de decisão passou a incluir a conversão para pagante
-- e o `where` chegou a apontar "próximo aos cards dos planos Assistente e Pro".
--
-- Falhou num ponto, por culpa do texto do contrato. A descrição de `stage`
-- começava com "EM QUE ETAPA da jornada declarada A CORREÇÃO ACONTECE" e só
-- depois dizia "escolha pela etapa onde o problema CUSTA dinheiro". As duas
-- frases pedem coisas diferentes, e o modelo obedeceu à primeira: um achado
-- inteiramente sobre risco percebido no momento de ASSINAR (assinatura mensal
-- de R$199/R$299, sem política de reembolso declarada) recebeu stage=`pagina`,
-- porque é numa página que o texto seria escrito.
--
-- O enum também não ajuda sozinho: ele mistura momentos (`cadastro`,
-- `upgrade`, `pos_venda`) com superfícies (`pagina`, `anuncio`), então
-- "página" parece resposta legítima para "onde". Com `where` já respondendo
-- qual tela, `stage` precisa responder explicitamente QUANDO o dinheiro é
-- ganho ou perdido — e o contraste entre os dois campos precisa estar escrito,
-- não subentendido.
--
-- Segundo ajuste, do mesmo veredito: o motor hesitou em prosa em vez de pedir
-- o que faltava. O `where` dizia "página de destino" e o critério de sucesso
-- dizia "a página de destino OU a página de planos/preços". Esse "ou" é a
-- confissão de que ele não sabe qual tela existe — e a 0043 já manda pedir a
-- url em missing_data nesse caso. Faltava proibir a saída pelo "ou".
-- ============================================================

create function public.apply_readiness_stage_is_when()
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
    'ONDE A CORREÇÃO ACONTECE (obrigatório em toda finding): preencha `stage` com a etapa da jornada declarada em que o problema CUSTA dinheiro — não a primeira que parecer relacionada. Um argumento sobre risco de pagar pertence ao momento em que se paga, não a um cadastro gratuito. E preencha `where` com a TELA e o ponto dela, concreto o bastante para a pessoa ir até lá e conferir ("card do plano Pro na página de planos, abaixo do preço"). É PROIBIDO responder apenas "na sua página" ou "no seu site" quando o negócio tem mais de uma superfície: isso é o mesmo que não responder.',
    'DOIS CAMPOS, DUAS PERGUNTAS DIFERENTES (obrigatórios em toda finding) — responder a mesma coisa nos dois desperdiça um deles:

`stage` responde QUANDO este problema custa dinheiro: o momento da jornada declarada em que a receita é ganha ou perdida por causa dele. NÃO é a tela onde o texto vai ser escrito.

`where` responde EM QUE TELA e em que ponto dela a correção aparece, concreto o bastante para a pessoa ir até lá e conferir ("card do plano Pro na página de planos, abaixo do preço").

O exemplo que separa os dois: um aviso de garantia exibido na página de planos, cujo efeito é reduzir o risco de ASSINAR, tem stage=`upgrade` e where=`página de planos`. Marcar stage=`pagina` aí é erro — a página é a superfície, não o momento em que o dinheiro se decide. Pergunte-se sempre: "em que ponto da jornada este problema faz o dinheiro entrar ou não entrar?" — essa é a etapa.

É PROIBIDO responder `where` apenas com "na sua página" ou "no seu site" quando o negócio tem mais de uma superfície: isso é o mesmo que não responder. E é PROIBIDO hesitar entre duas telas com um "ou" ("na página de destino ou na página de planos") — esse "ou" é a confissão de que você não sabe qual existe. Nesse caso escolha a mais provável, diga em `where` que é uma suposição, e PEÇA A URL da outra em missing_data. O mesmo vale para o critério de sucesso: ele nomeia UMA tela.'
  )
  where slug = 'readiness-engine';
  get diagnostics n = row_count;

  -- VERIFICAÇÃO (padrão de 0041–0043): replace() que não casa é no-op
  -- silencioso — o marcador ficaria gravado e o contrato seguiria ambíguo.
  select count(*) into n
  from public.assistants
  where slug = 'readiness-engine'
    and system_prompt like '%DOIS CAMPOS, DUAS PERGUNTAS DIFERENTES%'
    and system_prompt like '%tem stage=`upgrade` e where=`página de planos`%'
    and system_prompt like '%esse "ou" é a confissão de que você não sabe qual existe%'
    and system_prompt not like '%ONDE A CORREÇÃO ACONTECE%';

  if n <> 1 then
    raise exception
      'O contrato stage/where NÃO foi corrigido no readiness-engine (% linha(s) conformes). O prompt no banco diverge de 0043 — provavelmente editado em /admin/ai. Ajuste o alvo de replace() ao texto vivo antes de reaplicar.', n;
  end if;

  return n;
end;
$$;

revoke execute on function public.apply_readiness_stage_is_when() from public, anon, authenticated;

select public.apply_readiness_stage_is_when();

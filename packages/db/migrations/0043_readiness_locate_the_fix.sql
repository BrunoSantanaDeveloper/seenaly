-- ============================================================
-- 0043_readiness_locate_the_fix: dizer ONDE, e não vazar a chave interna.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_locate_the_fix
--
-- Dois defeitos vistos no MESMO veredito real (produto trial-first, SaaS):
--
-- 1) VAZAMENTO DA CHAVE — regressão da 0042. Ao mandar a chave ao lado do
--    rótulo no bloco do checklist, o modelo copiou a linha inteira do briefing
--    para dentro da evidência mostrada ao usuário:
--      "Garantia declarada na oferta `hasGuarantee` (NÃO CONFIRMADO)"
--    A chave é insumo de `related_items`, nunca texto de produto. O briefing já
--    passou a marcar o token com o campo a que ele pertence
--    ("[related_items: hasGuarantee]"); esta é a segunda tranca.
--
-- 2) O ACHADO NÃO DIZIA ONDE. A ação foi "adicione uma garantia clara à sua
--    oferta, como 'teste por 14 dias sem compromisso', e exiba-a na página de
--    destino" — enquanto o herói do site JÁ dizia "14 dias grátis, sem cartão ·
--    cancele quando quiser". O que de fato faltava estava em OUTRA tela: os
--    planos pagos (R$199/R$299) não declaram reembolso nem cancelamento.
--    Dimensão certa, superfície errada — e nada na saída obrigava o motor a se
--    comprometer com uma superfície.
--
--    O mesmo achado ainda argumentou aversão à perda ("medo de perder o
--    dinheiro") sobre o CADASTRO, onde não há dinheiro em jogo. O schema agora
--    exige `stage` (enum gerado do modelo de funil declarado) e `where`
--    (localizador concreto), então escolher `cadastro` ao lado desse argumento
--    fica visivelmente errado — para o modelo que escreve e para quem lê.
--
-- Três regras entram no prompt. A terceira é a que fecha a causa raiz: o motor
-- afirmou um fato de página sem nunca ter lido a página (a única fonte de
-- evidência era product_context) enquanto o próprio critério de sucesso que ele
-- escreveu era "a garantia estar visível na página de destino".
-- ============================================================

create function public.apply_readiness_locate_the_fix()
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
    'PRIORIZAÇÃO — é aqui que você entrega valor de verdade.',
    'ONDE A CORREÇÃO ACONTECE (obrigatório em toda finding): preencha `stage` com a etapa da jornada declarada em que o problema CUSTA dinheiro — não a primeira que parecer relacionada. Um argumento sobre risco de pagar pertence ao momento em que se paga, não a um cadastro gratuito. E preencha `where` com a TELA e o ponto dela, concreto o bastante para a pessoa ir até lá e conferir ("card do plano Pro na página de planos, abaixo do preço"). É PROIBIDO responder apenas "na sua página" ou "no seu site" quando o negócio tem mais de uma superfície: isso é o mesmo que não responder.

VOCÊ SÓ CONHECE AS TELAS QUE LHE CONTARAM. O contexto do produto traz UMA url (a página de destino). Se a correção pertence a outra tela — planos, checkout, cadastro, área logada — diga isso em `where` e PEÇA A URL em missing_data. Nunca invente uma localização, e nunca empurre para a página de destino uma correção que mora em outro lugar só porque é a única url que você tem.

NÃO CONCLUA SOBRE O QUE NÃO FOI LIDO: se o critério de sucesso que você escreveu é um fato observável numa tela (um texto visível, um selo, um botão) e não há evidência de scan daquela tela, você NÃO pode afirmar que o fato está ausente. Diga que não foi confirmado e peça a leitura em missing_data. Um checkbox não marcado é ausência de confirmação, jamais prova de ausência.

AS CHAVES DO CHECKLIST SÃO INSUMO INTERNO. Elas aparecem no briefing marcadas como "[related_items: nomeDaChave]" e servem EXCLUSIVAMENTE para preencher o campo related_items. NUNCA escreva uma chave em texto que o usuário lê — nem em finding, nem em evidence.statement, nem em recommended_action, nem em success_criterion. Ao citar um item do checklist na prosa, use o rótulo em português ("Garantia declarada na oferta"), nunca o identificador.

PRIORIZAÇÃO — é aqui que você entrega valor de verdade.'
  )
  where slug = 'readiness-engine';
  get diagnostics n = row_count;

  -- VERIFICAÇÃO (padrão de 0041/0042): replace() que não casa é no-op
  -- silencioso — o marcador ficaria gravado e o prompt seguiria sem as regras.
  select count(*) into n
  from public.assistants
  where slug = 'readiness-engine'
    and system_prompt like '%ONDE A CORREÇÃO ACONTECE%'
    and system_prompt like '%VOCÊ SÓ CONHECE AS TELAS QUE LHE CONTARAM%'
    and system_prompt like '%NÃO CONCLUA SOBRE O QUE NÃO FOI LIDO%'
    and system_prompt like '%AS CHAVES DO CHECKLIST SÃO INSUMO INTERNO%';

  if n <> 1 then
    raise exception
      'As regras de localização NÃO foram aplicadas ao readiness-engine (% linha(s) conformes). O prompt no banco diverge de 0028+0041+0042 — provavelmente editado em /admin/ai. Ajuste o alvo de replace() ao texto vivo antes de reaplicar.', n;
  end if;

  return n;
end;
$$;

revoke execute on function public.apply_readiness_locate_the_fix() from public, anon, authenticated;

select public.apply_readiness_locate_the_fix();

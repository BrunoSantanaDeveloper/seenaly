-- ============================================================
-- 0041_readiness_scope_boundary: Prontidão audita ESTRUTURA, não mídia.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_scope_boundary
--
-- O defeito, visto num veredito real: a dimensão `funil` recomendou "configure
-- públicos de remarketing na Meta para cada estágio do funil de trial" a um
-- usuário que ainda não gastou um real. O modelo obedeceu à especificação — a
-- dimensão `funil` listava "remarketing" e o checklist tinha o item
-- `remarketingAudience` (0028). A especificação é que estava errada, por dois
-- invariantes do produto:
--
--  1. MATURIDADE — "valor nunca fica atrás de uma conta Meta conectada". Um
--     público de remarketing mora dentro do Business Manager e só existe
--     depois de tráfego acumulado. Pedi-lo ANTES do primeiro gasto é pedir o
--     impossível: não há visitantes para formar o público.
--  2. PRONTIDÃO = ESTRUTURA — o motor é apontado para a estrutura que o
--     NEGÓCIO possui, não para operação de mídia. Captura de e-mail e régua de
--     follow-up são estrutura (existem com zero Meta); público de remarketing
--     não é.
--
-- O vazamento era sintoma de uma fase que faltava: entre "sua estrutura está
-- pronta" (fase 7/8) e "vamos analisar suas campanhas" (fase 3, que exige
-- gasto para ler) não havia nada dizendo COMO gastar os primeiros reais. Essa
-- é a fase 9 (Plano de Lançamento, especificada em docs/PRODUCT.md). Esta
-- migração faz a metade barata e imediata: para de pedir o impossível hoje.
--
-- Três correções de conteúdo + a regra que impede a volta do vazamento (o
-- motor tem as docs da Meta na recuperação e puxa mecânica de plataforma
-- naturalmente, então descrever a dimensão sem proibir explicitamente não
-- basta).
--
-- Coluna `remarketing_audience` é derrubada junto: o item sai do checklist, e
-- manter a coluna deixaria um campo que nada escreve e nada lê.
-- ============================================================

-- SECURITY INVOKER on purpose (mesmo raciocínio de 0037): o runner executa
-- como postgres; uma sessão autenticada que chegasse aqui via RPC não tem
-- UPDATE em assistants, então a chamada falharia em vez de abrir privilégio.
create function public.apply_readiness_scope_boundary()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  -- 1. `funil` audita o funil PRÓPRIO. Remarketing sai.
  update public.assistants
  set system_prompt = replace(
    system_prompt,
    '- funil — captura de contato, follow-up, remarketing, o caminho até a venda está conectado;',
    '- funil — captura de contato, follow-up e o caminho até a venda estão conectados. Audite SOMENTE o que o negócio possui (formulário, lista, régua de e-mail, páginas intermediárias): público de remarketing, exclusões e segmentação de audiência são configuração DENTRO do Gerenciador de Anúncios e não pertencem a esta auditoria;'
  )
  where slug = 'readiness-engine';
  get diagnostics n = row_count;

  -- 2. `midia` audita cobertura criativa. A estrutura da 1ª campanha sai.
  update public.assistants
  set system_prompt = replace(
    system_prompt,
    '- midia — criativos e estrutura mínima para a primeira campanha.',
    '- midia — cobertura mínima de criativos por ângulo antes da primeira campanha. A ESTRUTURA da campanha (objetivo, conjuntos, orçamento, lance, segmentação) NÃO é auditada aqui: é prescrição de plataforma, depende de números que só existem depois desta auditoria e pertence ao Plano de Lançamento.'
  )
  where slug = 'readiness-engine';

  -- 3. A chave sai da lista permitida de related_items.
  update public.assistants
  set system_prompt = replace(
    system_prompt,
    'emailCapture, emailFollowup, remarketingAudience.',
    'emailCapture, emailFollowup.'
  )
  where slug = 'readiness-engine';

  -- 4. A regra que impede o vazamento de voltar. Ancorada no argumento que
  --    o modelo consegue verificar sozinho (não há tráfego para formar
  --    público), porque proibição sem razão o motor contorna.
  update public.assistants
  set system_prompt = replace(
    system_prompt,
    'PRIORIZAÇÃO — é aqui que você entrega valor de verdade.',
    'LIMITE DE ESCOPO (inviolável): você audita a ESTRUTURA QUE O NEGÓCIO POSSUI — oferta, página, checkout, mensuração, funil próprio, descoberta. Você NUNCA prescreve configuração dentro do Gerenciador de Anúncios: públicos e exclusões, estrutura de campanha, número de conjuntos, objetivo, orçamento, lance, segmentação e cronograma de veiculação estão FORA desta auditoria. Isso não é omissão, é SEQUÊNCIA: essas decisões dependem de números que só existem depois desta auditoria (qual evento de conversão realmente dispara, qual CAC alvo a economia sustenta) e são o trabalho da etapa seguinte da jornada, o Plano de Lançamento. Recomendar "crie um público de remarketing" a quem ainda não gastou um real é pedir o impossível — não há tráfego acumulado para formar esse público. Se um achado depender de configuração na plataforma, recomende a ESTRUTURA que precisa existir antes (o evento medido, a página, a lista) e diga que o passo seguinte cuida do resto.

PRIORIZAÇÃO — é aqui que você entrega valor de verdade.'
  )
  where slug = 'readiness-engine';

  -- VERIFICAÇÃO — `replace()` que não casa é um NO-OP SILENCIOSO: a migração
  -- reportaria sucesso, o marcador ficaria gravado e o prompt continuaria
  -- pedindo o impossível para sempre. É a mesma classe de falha que a 0037
  -- documenta (arquivo pulado em silêncio), então aqui ela grita.
  select count(*) into n
  from public.assistants
  where slug = 'readiness-engine'
    and system_prompt like '%LIMITE DE ESCOPO (inviolável)%'
    and system_prompt like '%não pertencem a esta auditoria;%'
    and system_prompt like '%pertence ao Plano de Lançamento.%'
    and system_prompt not like '%remarketingAudience%'
    and system_prompt not like '%follow-up, remarketing,%';

  if n <> 1 then
    raise exception
      'A fronteira de escopo NÃO foi aplicada ao readiness-engine (% linha(s) conformes). O prompt no banco diverge do texto de 0028 — provavelmente editado em /admin/ai. Ajuste os alvos de replace() ao texto vivo antes de reaplicar.', n;
  end if;

  return n;
end;
$$;

revoke execute on function public.apply_readiness_scope_boundary() from public, anon, authenticated;

select public.apply_readiness_scope_boundary();

-- O item saiu do checklist; a coluna não teria mais escritor nem leitor.
alter table public.product_readiness drop column if exists remarketing_audience;

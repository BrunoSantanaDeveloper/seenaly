"""Gera docs/meta_ads/md/INDEX.md (estilo llms.txt) a partir de metadata.json.

Uma linha por documento: - [titulo](arquivo.md): descricao
Agrupado por topico. Rode depois de convert.py.
"""
import json
import re
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
OUT = DOCS / "md"
METADATA = json.loads((Path(__file__).resolve().parent / "metadata.json").read_text(encoding="utf-8"))

GROUPS = [
    ("API de Conversões (CAPI)", [
        "api-conversao", "como-usar-api", "parameters", "boas-praticas-api-conversao",
        "boas-praticas-melhorar-anuncios-api",
        "monitorar-api-conversao", "detalhes-eventos-servidor",
        "comparar-opcoes-configuracoes-api", "como-preparar-empresa-para-api",
        "como-decidir-conjunto-dados", "conjunto-dados", "cases-api-conversao"]),
    ("Pixel da Meta e eventos", [
        "meta-pixel", "boas-praticas-configuracao-pixel", "eventos-padrao-pixel",
        "eventos-padrao-site", "eventos-app", "eventos-chats-whatsapp",
        "conversion-traking", "conversoes-offline", "conversoes-personalizadas-web",
        "configurar-maximizacao-conversoes"]),
    ("Gerenciador de Anúncios, Gerenciador de Eventos e relatórios", [
        "gerenciador-anuncio", "gerenciador-eventos", "gerenciador-fase-aprendizado",
        "gerenciador-aprendizado-limitado", "gerenciador-edicoes-significativas",
        "gerenciador-eventos-otimizacao", "gerenciador-consolidacao",
        "gerenciador-volume-anuncios", "gerenciador-limites-campanhas",
        "gerenciador-limites-pagina", "gerenciador-relatorios",
        "relatorio-de-anuncios", "diferenca-entre-contagem-eventos",
        "veiculacao-anuncio", "amostragem-dados", "metricas-estimativas",
        "metricas-anuncio-carrossel", "tamanho-estimado-publico",
        "relatorio-orcamento-campanha", "testes-incremento"]),
    ("Advantage+ e públicos", [
        "advantage+", "advantage-controles-publico",
        "advantage-criar-campanha", "controle-publico-posicionamento",
        "como-alcancar-novos-publicos", "advantage-plus-shopping-campaigns",
        "meta-advantage-plus-budget", "configurar-orcamento-advantage",
        "meta-advantage-plus-creative", "criativo-advantage+",
        "meta-advantage-plus-placements", "posicionamentos-advantage+"]),
    ("Cursos Meta Blueprint", [
        "meta-performance-5", "meta-performance-5-intro", "meta-performance-5-simplificar",
        "meta-performance-5-automatizar", "meta-performance-5-criativo",
        "meta-performance-5-dados", "meta-performance-5-resultados",
        "meta-performance-5-conclusao", "advantage-plus-shopping-course",
        "align-ad-creative-to-your-business-goals", "fb-ig-reels-behind-scenes",
        "instagram-attract-customers"]),
    ("Criativos e formatos de anúncio", [
        "anuncios-imagens", "photo-ad-format", "anuncios-videos", "effective-reels-ads",
        "boas-praticas-anuncio-carrossel", "anuncios-colecao", "anuncios-textos",
        "anuncios-atrativos", "boas-praticas-anuncios-envolventes", "dicas-anuncios",
        "criative-diversification", "fadiga-criativo"]),
    ("Otimização, lances, regras de valor e pontuação de oportunidade", [
        "estrategias-de-lance", "meta-desempenho", "meta-custo-resultado",
        "boas-praticas-roas", "requisitos-maximizar-conversoes",
        "regras-de-valor", "regras-valor-sobre",
        "regras-valor-configurar", "regras-valor-campanha", "regras-valor-relatorios",
        "pontuacao-oportunidade", "gerenciador-pontuacao-oportunidade",
        "pontuacao-oportunidade-2", "pontuacao-oportunidade-criacao",
        "tipos-recomendacao-pontuacao-opotunidade", "opportunity-score",
        "otimizar-campanhas-mensagens"]),
    ("Cases e notícias", [
        "cases", "meta-advantage-case", "artigos"]),
    ("Políticas, restrições e cobrança", [
        "restricoes", "restricoes-sobre", "restricoes-violacoes", "restricoes-em-analise",
        "restricoes-rejeitados", "restricoes-padroes-pub", "restricoes-padroes-com",
        "restricoes-conteudo", "restricoes-comercio", "impostos-brasil"]),
]

HEADER = """\
# Documentação Meta Ads — Índice

> Base de conhecimento em pt-BR capturada da Central de Ajuda da Meta, Meta Blueprint
> e políticas oficiais, otimizada para consumo por IA. Cada arquivo tem frontmatter YAML
> com `description`, `tags` (em inglês) e `related` (outros arquivos do diretório).

Como usar este índice: localize o documento pela descrição abaixo e leia apenas os
arquivos relevantes para a tarefa. Os nomes de parâmetros, eventos e payloads aparecem
nos textos exatamente como na API (em inglês). Imagens informativas estão em `assets/`
com referência inline nos documentos.
"""


def title_of(stem: str) -> str:
    meta = METADATA[stem]
    if meta.get("title"):
        return meta["title"]
    body = (OUT / f"{stem}.md").read_text(encoding="utf-8")
    m = re.search(r"^# (.+)$", body, re.M)
    return m.group(1).strip() if m else stem


def main():
    listed = [s for _, stems in GROUPS for s in stems]
    missing = set(METADATA) - set(listed)
    extra = set(listed) - set(METADATA)
    if missing or extra:
        raise SystemExit(f"grupos desatualizados — faltando: {missing} | sobrando: {extra}")

    lines = [HEADER]
    for group, stems in GROUPS:
        lines.append(f"\n## {group}\n")
        for stem in stems:
            desc = METADATA[stem]["description"]
            lines.append(f"- [{title_of(stem)}]({stem}.md): {desc}")
    (OUT / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"INDEX.md gerado com {len(listed)} documentos em {len(GROUPS)} grupos")


if __name__ == "__main__":
    main()

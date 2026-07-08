"""Verifica que nenhum conteudo textual foi perdido na conversao HTML -> MD.

Extrai o texto visivel de cada HTML (excluindo style/script/head, nav-links e
footer — remocoes intencionais) e confere, token a token, que tudo aparece no
MD gerado, na mesma ordem. Reporta segmentos ausentes.

Uso:  python verify.py [arquivo.html ...]   (sem args verifica todos)
"""
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from convert import (DOCS, OUT, TreeBuilder, skipped,
                     slug_stem, strip_noise)


def html_text(node) -> str:
    out = []
    for c in node.children:
        if isinstance(c, str):
            out.append(c)
            continue
        if skipped(c):
            continue
        out.append(html_text(c))
        # separa blocos para nao colar palavras
        out.append(" ")
    return "".join(out)


MD_SYNTAX = re.compile(r"!\[[^\]]*\]\([^)]*\)"     # imagens
                       r"|\]\([^)]*\)", re.M)      # url de links (mantem o texto)


def tokens(text: str):
    """Sequencias de palavras, sem pontuacao: a verificacao compara conteudo
    textual; variacoes de espacamento/pontuacao entre HTML e MD sao ruido."""
    text = text.replace("<br>", " ")
    text = MD_SYNTAX.sub(" ", text)
    return re.findall(r"\w+", text)


def check(html_path: Path):
    md_path = OUT / (slug_stem(html_path.stem) + ".md")
    if not md_path.exists():
        return [("ARQUIVO MD AUSENTE", "")]
    tb = TreeBuilder()
    tb.feed(html_path.read_text(encoding="utf-8-sig", errors="replace"))
    src = tokens(strip_noise(re.sub(r"\s+", " ", html_text(tb.root))))
    dst = tokens(md_path.read_text(encoding="utf-8"))

    sm = SequenceMatcher(a=src, b=dst, autojunk=False)
    missing = []
    for op, i1, i2, _j1, _j2 in sm.get_opcodes():
        if op in ("delete", "replace"):
            seg = src[i1:i2]
            # ignora residuos de pontuacao/1 token curto sem conteudo
            if len(seg) == 1 and len(seg[0]) <= 2 and not seg[0].isalnum():
                continue
            missing.append(" ".join(seg)[:160])
    return missing


def main():
    files = [DOCS / a for a in sys.argv[1:]] or sorted(DOCS.glob("*.html"))
    files = [f for f in files if f.stem.upper() != "INDEX"]  # INDEX.md vem de build_index.py
    total_bad = 0
    for f in files:
        missing = check(f)
        if missing:
            total_bad += 1
            print(f"\n== {f.name}: {len(missing)} segmento(s) ausente(s)")
            for m in missing[:10]:
                print(f"   - {m!r}")
            if len(missing) > 10:
                print(f"   ... e mais {len(missing) - 10}")
    print(f"\n{len(files)} arquivos verificados, {total_bad} com conteudo ausente.")
    sys.exit(1 if total_bad else 0)


if __name__ == "__main__":
    main()

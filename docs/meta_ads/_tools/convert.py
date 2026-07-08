"""Converte os HTMLs de docs/meta_ads para Markdown limpo em docs/meta_ads/md/.

Uso:  python convert.py [arquivo.html ...]   (sem args converte todos)

Regras:
  - remove <style>, nav-links, footer e imagens decorativas
  - imagens informativas viram ![alt](assets/arquivo) via assets/_images_map.json
    (inclui as pendentes de download manual — o link fica pronto para quando o
    arquivo for anexado)
  - .note/.warning viram blockquote; .badge vira **[texto]**
  - links .html internos viram .md
  - tabelas HTML viram tabelas Markdown
"""
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

DOCS = Path(__file__).resolve().parent.parent
OUT = DOCS / "md"
ASSETS = DOCS / "assets"

_map = json.loads((ASSETS / "_images_map.json").read_text(encoding="utf-8"))
IMG_MAP = {**_map["downloaded"], **_map.get("pending", {})}

# metadados de enriquecimento por arquivo (fases 1-6); ver metadata.json
_meta_path = Path(__file__).resolve().parent / "metadata.json"
METADATA = json.loads(_meta_path.read_text(encoding="utf-8")) if _meta_path.exists() else {}

DATE_RE = re.compile(r"(?:Extra[ií]do|Extra&iacute;do|Extra&#237;do|Organizado em)[^0-9<]*(\d{2})/(\d{2})/(\d{4})")

BLOCK_TAGS = {"div", "p", "ul", "ol", "li", "table", "thead", "tbody", "tr",
              "h1", "h2", "h3", "h4", "h5", "h6", "pre", "figure", "figcaption",
              "blockquote", "section", "article", "header", "hr",
              "html", "body", "main", "nav", "aside"}
SKIP_TAGS = {"style", "script", "head", "title", "meta", "link", "noscript", "button"}
# _3ofr: widget de feedback "Have a moment?" das capturas da Central de Ajuda do FB
# _3wmi/_3wmj: rodape "Voltar a pagina inicial"; _9rpr: links curados de suporte
SKIP_CLASSES = {"nav-links", "footer", "_3ofr", "_3wmi", "_3wmj", "_9rpr"}
# GBMRelatedLinkContent: coluna lateral das capturas do FB com avisos da conta do usuario
# left-sidenav: menu de navegacao lateral da Central de Ajuda do FB
SKIP_IDS = {"GBMRelatedLinkContent", "left-sidenav"}


def skipped(node) -> bool:
    """Elemento intencionalmente descartado (compartilhado com verify.py)."""
    return (node.tag in SKIP_TAGS or bool(node.classes & SKIP_CLASSES)
            or node.attrs.get("id", "") in SKIP_IDS)
NOTE_CLASSES = {"note", "warning", "info-box", "support-note"}
VOID_TAGS = {"img", "br", "hr", "meta", "link", "input"}

# ruidos de captura conhecidos (toasts/avisos de UI sem relacao com o conteudo);
# removidos do MD e ignorados pelo verify
KNOWN_NOISE = [
    "Não foi possível realizar a cobrança na sua forma de pagamento porque "
    "ocorreu um problema com a forma de pagamento ou o valor. Para finalizar o "
    "pagamento, atualize as informações do cartão ou adicione uma nova forma de pagamento.",
    "Essa informação foi útil? Sim Não",
    "Tópicos de suporte comuns",
]

# casa cada ruido com qualquer espacamento/quebra de linha entre as palavras
_NOISE_RES = [re.compile(r"\s+".join(re.escape(w) for w in n.split())) for n in KNOWN_NOISE]


def strip_noise(text: str) -> str:
    for rx in _NOISE_RES:
        text = rx.sub(" ", text)
    return text


def slug_stem(stem: str) -> str:
    """Normaliza nome de arquivo: sem acento, sem underscore, minusculo."""
    if stem.upper() == "INDEX":
        return "INDEX"
    s = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    return s.replace("_", "-").lower()


def rewrite_href(href: str) -> str:
    if href.endswith(".html") and not href.startswith("http"):
        return slug_stem(href[:-5]) + ".md"
    return href


def img_key(src: str) -> str:
    src = src.replace("&amp;", "&")
    p = urlparse(src)
    if p.path.endswith("/"):
        return src
    return p.netloc + p.path


class Node:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.parent = parent
        self.children = []  # Node ou str

    @property
    def classes(self):
        return set(self.attrs.get("class", "").split())


def has_block_descendant(node) -> bool:
    for c in node.children:
        if isinstance(c, str):
            continue
        if c.tag in BLOCK_TAGS or has_block_descendant(c):
            return True
    return False


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID_TAGS:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        # sobe ate fechar a tag correspondente (tolera HTML mal aninhado)
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if data:
            self.cur.children.append(data)


class MdRenderer:
    def __init__(self):
        self.parts = []

    # ---------- inline ----------
    def inline_one(self, c) -> str:
        """Renderiza um filho (str ou Node inline) como markdown inline."""
        if isinstance(c, str):
            return re.sub(r"\s+", " ", c)
        if skipped(c):
            return ""
        if c.tag == "code":
            txt = self.text_of(c).strip()
            return f"`{txt}`" if txt else ""
        if c.tag in ("strong", "b"):
            txt = self.inline(c).strip()
            return f"**{txt}**" if txt else ""
        if c.tag in ("em", "i"):
            txt = self.inline(c).strip()
            return f"*{txt}*" if txt else ""
        if c.tag == "a":
            txt = self.inline(c).strip()
            href = rewrite_href(c.attrs.get("href", ""))
            return f"[{txt}]({href})" if txt else ""
        if c.tag == "span" and "badge" in c.classes:
            txt = self.text_of(c).strip()
            return f" **[{txt}]**" if txt else ""
        if c.tag == "img":
            return self.render_img(c)
        if c.tag == "br":
            return "<br>"
        return self.inline(c)

    def inline(self, node) -> str:
        return "".join(self.inline_one(c) for c in node.children)

    def text_of(self, node) -> str:
        out = []
        for c in node.children:
            if isinstance(c, str):
                out.append(c)
            elif not skipped(c):
                out.append(self.text_of(c))
                out.append(" ")  # evita colar textos de elementos adjacentes
        return re.sub(r"\s+", " ", "".join(out)).strip()

    def render_img(self, node) -> str:
        src = node.attrs.get("src", "")
        # imagem local ja salva em assets/: passa direto, com o alt do HTML
        if src.startswith("assets/"):
            alt = node.attrs.get("alt", "").strip()
            return f"![{alt}]({src})"
        entry = IMG_MAP.get(img_key(src))
        if not entry or entry.get("decorative"):
            return ""  # decorativa ou nao mapeada: descarta
        # alt do HTML ou legenda descritiva do mapa (desc)
        alt = node.attrs.get("alt", "").strip() or entry.get("desc", "")
        return f"![{alt}](assets/{entry['file']})"

    def emit(self, text):
        if text is not None and text.strip():
            self.parts.append(text.rstrip())

    # ---------- blocks ----------
    def is_inline_child(self, c) -> bool:
        """Filho que pode ser rendido dentro de um paragrafo corrente."""
        if isinstance(c, str):
            return True
        if skipped(c):
            return True  # vira string vazia
        if c.tag == "a" and has_block_descendant(c):
            return False  # cartao de link (a > div): rende como item de lista
        if c.tag not in BLOCK_TAGS:
            return True
        # div sem blocos internos (ex.: param-name-wrap) conta como inline
        if c.tag == "div" and not (c.classes & NOTE_CLASSES) and not has_block_descendant(c):
            return True
        return False

    def block(self, node, indent=0, quote=False):
        prefix = ("> " if quote else "") + ("  " * indent)
        buf = []

        def flush():
            txt = re.sub(r"\s+", " ", "".join(buf)).strip()
            buf.clear()
            if txt:
                self.emit(prefix + txt)

        for c in node.children:
            if self.is_inline_child(c):
                buf.append(self.inline_one(c) if not isinstance(c, str)
                           else re.sub(r"\s+", " ", c))
                continue
            flush()
            if skipped(c):
                continue
            tag, cls = c.tag, c.classes
            if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
                self.emit(prefix + "#" * int(tag[1]) + " " + self.inline(c).strip())
            elif tag == "p":
                txt = self.inline(c).strip()
                if not txt:
                    continue
                if cls & NOTE_CLASSES:
                    self.emit("> " + txt)
                else:
                    self.emit(prefix + txt)
            elif tag in ("ul", "ol"):
                self.render_list(c, indent, quote)
            elif tag == "table":
                self.render_table(c, quote)
            elif tag == "pre":
                code = self.raw_text(c).strip("\n")
                if quote:
                    body = f"```\n{code}\n```".replace("\n", "\n> ")
                    self.parts.append("> " + body)
                else:
                    self.parts.append(f"```\n{code}\n```")
            elif tag == "figcaption":
                txt = self.inline(c).strip()
                if txt:
                    self.emit(prefix + f"*{txt}*")
            elif tag == "hr":
                self.emit(prefix + "---")
            elif tag == "blockquote":
                self.block(c, indent, quote=True)
            elif tag == "a":
                href = rewrite_href(c.attrs.get("href", ""))
                txt = " — ".join(self.block_texts(c))
                if txt:
                    self.emit(prefix + f"- [{txt}]({href})")
            elif tag == "div" and cls & NOTE_CLASSES:
                self.block(c, 0, quote=True)
            else:  # div generica, figure, section, ...
                self.block(c, indent, quote)
        flush()

    def render_list(self, node, indent, quote):
        ordered = node.tag == "ol"
        i = 0
        prefix = ("> " if quote else "") + ("  " * indent)
        for c in node.children:
            if isinstance(c, str):
                t = re.sub(r"\s+", " ", c).strip()
                if t:
                    self.emit(prefix + t)
                continue
            if c.tag != "li":
                # bloco irmao de <li> (HTML tolerado por navegadores): rende normal
                wrapper = Node("root")
                wrapper.children = [c]
                self.block(wrapper, indent, quote)
                continue
            i += 1
            marker = f"{i}. " if ordered else "- "
            # segmenta filhos do li em runs inline e blocos, preservando ordem
            first_line, blocks, buf = None, [], []

            def flush_li():
                nonlocal first_line
                txt = re.sub(r"\s+", " ", "".join(buf)).strip()
                buf.clear()
                if not txt:
                    return
                if first_line is None:
                    first_line = txt
                else:
                    blocks.append(("text", txt))

            for lc in c.children:
                if self.is_inline_child(lc):
                    buf.append(self.inline_one(lc) if not isinstance(lc, str)
                               else re.sub(r"\s+", " ", lc))
                else:
                    flush_li()
                    blocks.append(("node", lc))
            flush_li()

            self.emit(prefix + marker + (first_line or ""))
            for kind, b in blocks:
                if kind == "text":
                    self.emit(prefix + "  " + b)
                elif b.tag in ("ul", "ol"):
                    self.render_list(b, indent + 1, quote)
                else:
                    wrapper = Node("root")
                    wrapper.children = [b]
                    self.block(wrapper, indent + 1, quote)

    def block_texts(self, node):
        """Textos das folhas de bloco de um cartao (a > divs aninhadas)."""
        out, buf = [], []

        def flush():
            txt = re.sub(r"\s+", " ", "".join(buf)).strip()
            buf.clear()
            if txt:
                out.append(txt)

        for c in node.children:
            if isinstance(c, str):
                buf.append(c)
            elif c.tag in SKIP_TAGS or c.classes & SKIP_CLASSES:
                continue
            elif c.tag in BLOCK_TAGS and has_block_descendant(c):
                flush()
                out.extend(self.block_texts(c))
            elif c.tag in BLOCK_TAGS:
                flush()
                txt = self.text_of(c).strip()
                if txt:
                    out.append(txt)
            else:
                buf.append(self.text_of(c))
                buf.append(" ")
        flush()
        return out

    def render_table(self, node, quote):
        rows = []

        def collect(n):
            for c in n.children:
                if isinstance(c, str):
                    continue
                if c.tag == "tr":
                    cells = [self.inline(cell).strip().replace("|", "\\|")
                             for cell in c.children
                             if not isinstance(cell, str) and cell.tag in ("td", "th")]
                    if cells:
                        rows.append(cells)
                else:
                    collect(c)

        collect(node)
        if not rows:
            return
        ncols = max(len(r) for r in rows)
        rows = [r + [""] * (ncols - len(r)) for r in rows]
        q = "> " if quote else ""
        lines = [q + "| " + " | ".join(rows[0]) + " |",
                 q + "|" + "|".join([" --- "] * ncols) + "|"]
        for r in rows[1:]:
            lines.append(q + "| " + " | ".join(r) + " |")
        self.parts.append("\n".join(lines))

    def raw_text(self, node) -> str:
        out = []
        for c in node.children:
            if isinstance(c, str):
                out.append(c)
            else:
                out.append(self.raw_text(c))
        return "".join(out)


def frontmatter(stem: str, html: str, md: str) -> str:
    meta = METADATA.get(stem)
    if not meta:
        return ""
    m = re.search(r"^# (.+)$", md, re.M)
    title = meta.get("title") or (m.group(1).strip() if m else stem)

    def q(s):  # valores YAML sempre entre aspas (podem conter ':')
        return '"' + s.replace('"', '\\"') + '"'

    lines = ["---", f"title: {q(title)}", f"description: {q(meta['description'])}"]
    if meta.get("tags"):
        lines.append("tags: [" + ", ".join(meta["tags"]) + "]")
    if meta.get("related"):
        lines.append("related: [" + ", ".join(meta["related"]) + "]")
    d = DATE_RE.search(html)
    if d:
        lines.append(f"captured: {d.group(3)}-{d.group(2)}-{d.group(1)}")
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def convert(path: Path) -> str:
    html = path.read_text(encoding="utf-8-sig", errors="replace")
    tb = TreeBuilder()
    tb.feed(html)
    r = MdRenderer()
    r.block(tb.root)
    md = strip_noise("\n\n".join(r.parts))
    md = re.sub(r"\n{3,}", "\n\n", md)
    md = md.strip() + "\n"
    return frontmatter(slug_stem(path.stem), html, md) + md


def main():
    OUT.mkdir(exist_ok=True)
    files = [DOCS / a for a in sys.argv[1:]] or sorted(DOCS.glob("*.html"))
    # INDEX.md e gerado por build_index.py a partir dos frontmatters
    files = [f for f in files if f.stem.upper() != "INDEX"]
    for f in files:
        md = convert(f)
        out = OUT / (slug_stem(f.stem) + ".md")
        out.write_text(md, encoding="utf-8")
        print(f"{f.name} -> md/{out.name}  ({len(md)//1024} KB)")

    # arquivos sem entrada no metadata.json = novos, ainda nao enriquecidos
    novos = sorted(slug_stem(f.stem) for f in sorted(DOCS.glob("*.html"))
                   if f.stem.upper() != "INDEX" and slug_stem(f.stem) not in METADATA)
    if novos:
        print(f"\nNOVOS (sem metadata/frontmatter, pendentes de enriquecimento): {len(novos)}")
        for s in novos:
            print(f"  - {s}")


if __name__ == "__main__":
    main()

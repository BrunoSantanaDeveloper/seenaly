"""Baixa (incrementalmente) as imagens remotas dos HTMLs para assets/.

Uso:  python download_images.py

- Ignora chaves ja presentes em assets/_images_map.json (downloaded/pending).
- Decorativas (alt terminando em Icon/Logo, alt vazio com width<=60, ou icones
  genericos conhecidos) sao registradas com decorative=true (o convert.py descarta).
- Informativas sao baixadas; falhas vao para assets/_PENDENTES.md com o nome de
  arquivo exato que o usuario deve usar ao anexar manualmente.

Depois de rodar: python convert.py (para os MDs referenciarem os arquivos locais).
"""
import hashlib
import json
import re
import unicodedata
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

DOCS = Path(__file__).resolve().parent.parent
ASSETS = DOCS / "assets"
MAP = ASSETS / "_images_map.json"

IMG_RE = re.compile(r"<img\b[^>]*>", re.I)
ATTR_RE = re.compile(r'([a-zA-Z-]+)\s*=\s*"([^"]*)"')
EXT_BY_TYPE = {"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
               "image/svg+xml": ".svg", "image/webp": ".webp"}

# icones genericos conhecidos (usados como marcadores/bullets nas capturas)
KNOWN_DECORATIVE_PATHS = {
    "scontent.fgyn22-1.fna.fbcdn.net/v/t39.8562-6/146597050_455534749152435_1802453867954835002_n.svg",
}


def norm_key(src: str) -> str:
    src = src.replace("&amp;", "&")
    p = urlparse(src)
    if p.path.endswith("/"):
        return src
    return p.netloc + p.path


def slugify(text: str, maxlen: int = 60) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:maxlen].rstrip("-")


def is_decorative(key: str, alt: str, width: str) -> bool:
    a = alt.strip()
    if urlparse("//" + key).netloc + urlparse("//" + key).path in KNOWN_DECORATIVE_PATHS or key in KNOWN_DECORATIVE_PATHS:
        return True
    if a.endswith("Icon") or a.endswith("Logo"):
        return True
    if not a:
        try:
            if width and int(width) <= 60:
                return True
        except ValueError:
            pass
    return False


def main():
    data = json.loads(MAP.read_text(encoding="utf-8"))
    data.setdefault("pending", {})
    known = set(data["downloaded"]) | set(data["pending"])

    instances, counters = {}, {}
    for f in sorted(DOCS.glob("*.html")):
        html = f.read_text(encoding="utf-8-sig", errors="replace")
        for tag in IMG_RE.findall(html):
            attrs = dict(ATTR_RE.findall(tag))
            src = attrs.get("src", "").replace("&amp;", "&")
            if not src.startswith("http"):
                continue
            key = norm_key(src)
            if key in known or key in instances:
                if key in instances:
                    instances[key]["sources"].append(f.name)
                    if attrs.get("alt", "").strip() and not instances[key]["alt"]:
                        instances[key]["alt"] = attrs.get("alt", "").strip()
                continue
            instances[key] = {"src": src, "alt": attrs.get("alt", "").strip(),
                              "width": attrs.get("width", ""), "sources": [f.name]}

    if not instances:
        print("Nenhuma imagem nova encontrada.")
        return

    downloaded = failed = decorative = 0
    pend_lines = []
    for key, inst in instances.items():
        if is_decorative(key, inst["alt"], inst["width"]):
            data["downloaded"][key] = {"file": "", "alt": inst["alt"],
                                       "sources": sorted(set(inst["sources"])),
                                       "decorative": True}
            decorative += 1
            continue
        base = slugify(inst["alt"])
        if not base:
            stem = Path(inst["sources"][0]).stem
            counters[stem] = counters.get(stem, 0) + 1
            base = f"{stem}-{counters[stem]:02d}"
        suffix = hashlib.sha1(key.encode()).hexdigest()[:6]
        req = urllib.request.Request(inst["src"], headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                ctype = resp.headers.get("Content-Type", "").split(";")[0].strip()
            if ctype not in EXT_BY_TYPE or len(body) < 200:
                raise ValueError(f"resposta nao parece imagem ({ctype}, {len(body)}B)")
            name = f"{base}-{suffix}{EXT_BY_TYPE[ctype]}"
            (ASSETS / name).write_bytes(body)
            data["downloaded"][key] = {"file": name, "alt": inst["alt"],
                                       "sources": sorted(set(inst["sources"]))}
            downloaded += 1
            print(f"  OK  {name} ({len(body)//1024} KB) <- {inst['sources'][0]}")
        except Exception as e:
            # extensao provavel pela URL; usuario anexa com esse nome
            ext = Path(urlparse(inst["src"]).path).suffix.lower() or ".png"
            ext = {".jpeg": ".jpg"}.get(ext, ext if ext in EXT_BY_TYPE.values() else ".png")
            name = f"{base}-{suffix}{ext}"
            data["pending"][key] = {"file": name, "alt": inst["alt"],
                                    "sources": sorted(set(inst["sources"]))}
            failed += 1
            pend_lines.append(f"- [ ] **`{name}`** (em {', '.join(sorted(set(inst['sources'])))})\n  - URL: {inst['src']}\n  - erro: {str(e)[:100]}")
            print(f"  FALHOU  {name} <- {inst['sources'][0]}: {str(e)[:90]}")

    MAP.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    if pend_lines:
        (ASSETS / "_PENDENTES.md").write_text(
            "# Imagens pendentes de download manual\n\n"
            "Salve cada imagem nesta pasta (docs/meta_ads/assets/) exatamente com o nome indicado.\n\n"
            + "\n".join(pend_lines) + "\n", encoding="utf-8")
    print(f"\nBaixadas: {downloaded} | Decorativas: {decorative} | Falharam (pendentes): {failed}")
    if failed:
        print("Lista para anexo manual: assets/_PENDENTES.md")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Converte as fontes de leitura (assets/fonts, assets/content) para WOFF2.

Subconjunto: latim (com acentos), grego e pontuação. O hebraico usa a fonte do
sistema. Fontes variáveis continuam variáveis. Se fontTools/brotli não estiverem
instalados, copia os TTF originais (funciona, porém maiores):
    python3 -m pip install fonttools brotli
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

PWA = Path(__file__).resolve().parents[1]
ROOT = PWA.parent
OUT = PWA / "public" / "fonts"
INFO = PWA / "src" / "generated" / "fonts.json"

FONTS = {
    "EBGaramond": ROOT / "assets/content/EBGaramond.ttf",
    "Lora": ROOT / "assets/fonts/Lora.ttf",
    "SourceSerif4": ROOT / "assets/fonts/SourceSerif4.ttf",
    "NotoSerif": ROOT / "assets/fonts/NotoSerif.ttf",
    "LibreBaskerville": ROOT / "assets/fonts/LibreBaskerville.ttf",
    "CrimsonPro": ROOT / "assets/fonts/CrimsonPro.ttf",
    "Merriweather": ROOT / "assets/fonts/Merriweather.ttf",
    "CormorantGaramond": ROOT / "assets/fonts/CormorantGaramond.ttf",
    "Spectral": ROOT / "assets/fonts/Spectral.ttf",
    "Bitter": ROOT / "assets/fonts/Bitter.ttf",
    "AtkinsonHyperlegible": ROOT / "assets/fonts/AtkinsonHyperlegible.ttf",
    "Lexend": ROOT / "assets/fonts/Lexend.ttf",
    "NotoSans": ROOT / "assets/fonts/NotoSans.ttf",
}
UNICODES = (
    "U+0000-024F,U+0259,U+02B0-02FF,U+0300-036F,U+0370-03FF,U+1E00-1EFF,U+1F00-1FFF,"
    "U+2000-206F,U+20AC,U+2100-214F,U+2190-21FF,U+2212,U+2215,U+FB00-FB06"
)


def write_info(fmt: str) -> None:
    INFO.parent.mkdir(parents=True, exist_ok=True)
    INFO.write_text('{"format": "%s"}\n' % fmt)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        from fontTools import subset  # type: ignore
        import brotli  # type: ignore  # noqa: F401
    except ImportError:
        print("fontTools/brotli ausentes: copiando TTF sem compressão.")
        for name, source in FONTS.items():
            shutil.copy2(source, OUT / f"{name}.ttf")
        write_info("ttf")
        return 0
    total_in = total_out = 0
    for name, source in FONTS.items():
        target = OUT / f"{name}.woff2"
        if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
            total_in += source.stat().st_size
            total_out += target.stat().st_size
            continue
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        options.glyph_names = False
        font = subset.load_font(str(source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
        subsetter.subset(font)
        subset.save_font(font, str(target), options)
        total_in += source.stat().st_size
        total_out += target.stat().st_size
        print(f"{name}: {source.stat().st_size / 1e6:.2f} MB → {target.stat().st_size / 1e6:.2f} MB")
    write_info("woff2")
    print(f"Fontes: {total_in / 1e6:.1f} MB → {total_out / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

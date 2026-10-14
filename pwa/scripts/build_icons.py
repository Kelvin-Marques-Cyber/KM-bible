#!/usr/bin/env python3
"""Ícones da PWA com o MESMO desenho do aplicativo Android (scripts/icon.py).

Gera: icon-192/512 (any), maskable-192/512 (zona segura de 80%), apple-touch-icon 180,
favicon 32/48 e ícones dos atalhos. Desenho vetorial em alta resolução, reduzido com Lanczos.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
GREEN = "#2f4d3d"


def book(size: int, scale: float = 1.0, background: str = GREEN) -> Image.Image:
    """Desenha o livro com marcador; scale < 1 encolhe o desenho para a zona segura."""
    big = size * 4
    image = Image.new("RGB", (big, big), background)
    draw = ImageDraw.Draw(image)
    offset = big * (1 - scale) / 2

    def p(x: float, y: float) -> tuple[float, float]:
        return (offset + big * scale * x, offset + big * scale * y)

    u = big * scale
    draw.rounded_rectangle((*p(0.18, 0.17), *p(0.82, 0.82)), radius=u * 0.045, fill="#e4d4aa")
    draw.rectangle((*p(0.22, 0.17), *p(0.28, 0.82)), fill="#bc985d")
    draw.line((*p(0.43, 0.30), *p(0.65, 0.30)), fill=GREEN, width=max(2, int(u * 0.025)))
    draw.line((*p(0.43, 0.40), *p(0.69, 0.40)), fill=GREEN, width=max(2, int(u * 0.016)))
    draw.line((*p(0.43, 0.49), *p(0.69, 0.49)), fill=GREEN, width=max(2, int(u * 0.016)))
    draw.polygon([p(0.52, 0.62), p(0.65, 0.62), p(0.65, 0.92), p(0.585, 0.84), p(0.52, 0.92)], fill="#8e4736")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        book(size).save(OUT / f"icon-{size}.png", optimize=True)
        # Ícones adaptáveis do Android recortam até 20% das bordas.
        book(size, scale=0.78).save(OUT / f"maskable-{size}.png", optimize=True)
    book(180, scale=0.86).save(OUT / "apple-touch-icon.png", optimize=True)
    for size in (32, 48):
        book(size).save(OUT / f"favicon-{size}.png", optimize=True)
    print("Ícones gerados em", OUT)


if __name__ == "__main__":
    main()

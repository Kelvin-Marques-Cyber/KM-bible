#!/usr/bin/env python3
"""Ilustrações editoriais originais, vetoriais e offline, para 30 tradições.

Não são fotografias nem representações fiéis de um lugar/rito específico.
O texto alternativo e a legenda deixam clara essa distinção.
"""
from __future__ import annotations

import hashlib
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VISUALS = [
    ("#17364a", "#e8cba2", "#8fb8b1"),
    ("#3b2a39", "#efd5ad", "#bd9294"),
    ("#243a34", "#e1ceaf", "#a9b28c"),
    ("#3d3144", "#e2c7a4", "#a8a0c3"),
    ("#293d4e", "#e6d4ad", "#b4bbc4"),
]


def architecture(kind: str, ink: str, gold: str) -> str:
    base = f'<path d="M138 423H1062V452H138Z" fill="{ink}" opacity=".7"/>'
    column = lambda x: f'<rect x="{x}" y="253" width="32" height="170" rx="4" fill="{gold}"/><path d="M{x-6} 253h44v12h-44zM{x-8} 405h48v15h-48z" fill="{ink}"/>'
    if kind == "basilica":
        return base + (
            f'<path d="M300 250h600v175H300z" fill="{ink}"/><path d="M480 241a120 120 0 0 1 240 0Z" fill="{gold}"/>'
            f'<rect x="584" y="140" width="32" height="96" fill="{gold}"/>'
            f'<path d="M400 248l200-96 200 96Z" fill="{gold}" stroke="{ink}" stroke-width="10"/>'
            + ''.join(column(x) for x in (347, 448, 550, 651, 752, 843))
        )
    if kind == "orthodox":
        return base + (
            f'<path d="M315 294h570v132H315z" fill="{ink}"/>'
            + ''.join(
                f'<path d="M{x-70} 295Q{x-94} 258 {x} {v}Q{x+94} 258 {x+70} 295Z" fill="{gold}"/>'
                f'<path d="M{x} {v-25}v-45m-14 14h28" stroke="{ink}" stroke-width="10"/>'
                for x,v in ((390,182),(600,123),(810,182))
            )
            + ''.join(column(x) for x in (360, 480, 690, 810))
        )
    if kind == "mosque":
        return base + (
            f'<path d="M304 302h592v124H304z" fill="{ink}"/>'
            f'<path d="M416 297a184 174 0 0 1 368 0Z" fill="{gold}"/>'
            f'<path d="M597 121v-30" stroke="{ink}" stroke-width="11"/>'
            + ''.join(f'<path d="M{x} 130h60v295h-60zM{x-10} 128h80l-40-90Z" fill="{ink}"/>' for x in (218,922))
            + ''.join(f'<path d="M{x} 420v-100a32 32 0 0 1 64 0v100Z" fill="{gold}"' for x in (370,500,630,760))
        )
    if kind in ("chapel", "cathedral", "hall"):
        tower = f'<path d="M310 145h115v280H310Z" fill="{gold}"/><path d="M300 150l68-86 68 86Z" fill="{ink}"/>'
        church = f'<path d="M400 275h480v150H400Z" fill="{ink}"/><path d="M380 279l260-130 260 130Z" fill="{gold}"/>'
        crosses = f'<path d="M364 63v-42m-15 14h30" stroke="{gold}" stroke-width="11"/>' if kind != "hall" else ""
        windows = ''.join(f'<path d="M{x} 400v-91a25 25 0 0 1 50 0v91Z" fill="{gold}"' for x in (510,635,760))
        return base + (tower + church + windows + crosses)
    if kind == "synagogue":
        return base + (
            f'<path d="M260 265h680v165H260z" fill="{ink}"/><path d="M245 265l355-135 355 135Z" fill="{gold}"/>'
            + ''.join(f'<path d="M{x} 406V318a26 26 0 0 1 52 0v88Z" fill="{gold}"' for x in (340,462,684,810))
            + '<circle cx="600" cy="220" r="42" fill="#f2e6cf" opacity=".76"/>'
        )
    if kind == "temple":
        return base + (
            f'<path d="M295 300h610v129H295Z" fill="{ink}"/>'
            f'<path d="M430 300L500 82h200l70 218Z" fill="{gold}"/>'
            + ''.join(f'<path d="M{x} {h}h{w}v22h-{w}Z" fill="{ink}" opacity=".7"/>' for x,h,w in ((459,110,282),(447,160,306),(429,216,342),(406,275,388)))
            + ''.join(column(x) for x in (316, 373, 799, 856))
        )
    if kind in ("stupa","pagoda"):
        if kind == "stupa":
            return base + (
                f'<path d="M340 385a260 230 0 0 1 520 0Z" fill="{gold}"/>'
                f'<path d="M486 160h228v42H486zM547 112h106v48H547z" fill="{ink}"/>'
                f'<path d="M600 112V63" stroke="{gold}" stroke-width="11"/>'
                + ''.join(f'<path d="M{x} 388h{w}v28h-{w}Z" fill="{ink}"' for x,w in ((280,640),(240,720)))
            )
        return base + ''.join(
            f'<path d="M{x} {y}h{w}v{h}h-{w}Z" fill="{ink}"/>'
            f'<path d="M{x-28} {y}l{w//2+28}-60 {w//2+28} 60Z" fill="{gold}"/>'
            for x,y,w,h in ((350,348,500,80),(405,268,390,70),(455,192,290,64))
        )
    if kind == "torii":
        return base + (
            f'<rect x="365" y="188" width="42" height="240" fill="{ink}"/><rect x="797" y="188" width="42" height="240" fill="{ink}"/>'
            f'<path d="M253 154q347 62 694 0v31q-345 67-694 0Z" fill="{gold}"/>'
            f'<path d="M320 219h570v28H320Z" fill="{ink}"/>'
        )
    if kind == "fire":
        return base + (
            f'<path d="M330 410h540v25H330Z" fill="{ink}"/>'
            f'<path d="M455 410q-55-110 62-200-12 95 72 103Q550 210 650 106q-18 143 76 203 49 42 9 101Z" fill="{gold}"/>'
            f'<path d="M544 410q-25-64 60-131-2 67 40 131Z" fill="{ink}"/>'
        )
    if kind == "lotus":
        return base + (
            ''.join(f'<ellipse cx="600" cy="326" rx="67" ry="176" transform="rotate({deg} 600 326)" fill="{gold}" opacity=".8"/>' for deg in (-72,-40,0,40,72))
            + '<circle cx="600" cy="370" r="65" fill="#faf0d9"/>'
        )
    if kind == "forest":
        return base + ''.join(
            f'<path d="M{x} {425}V{v}" stroke="{ink}" stroke-width="26"/>'
            f'<path d="M{x-64} {v+70}L{x} {v-160}L{x+64} {v+70}Z" fill="{gold}"/>'
            for x,v in ((270,255),(475,180),(705,225),(920,260))
        )
    if kind == "mountain":
        return base + f'<path d="M160 425L396 150l125 177 120-152 365 250Z" fill="{ink}"/><path d="M530 426L749 232l182 194Z" fill="{gold}"/><path d="M550 388l260-147 90 147" fill="none" stroke="{ink}" stroke-width="10"/>'
    if kind == "observatory":
        return base + (
            f'<path d="M390 300a210 200 0 0 1 420 0Z" fill="{gold}"/>'
            f'<path d="M355 295h490v130H355Z" fill="{ink}"/>'
            f'<path d="M610 120l165-82" stroke="{ink}" stroke-width="24"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="5" fill="{gold}"/>' for x,y in ((262,95),(910,70),(815,140),(350,185)))
        )
    if kind == "library":
        return base + (
            ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{gold if i%2 else ink}"/>' for i,(x,y,w,h) in enumerate(((290,225,60,195),(360,200,66,220),(438,236,75,184),(525,160,64,260),(602,210,85,210),(699,186,61,234),(776,236,68,184))))
            + f'<path d="M260 420h650v24H260Z" fill="{ink}"/>'
        )
    if kind == "community":
        return base + (
            f'<path d="M220 305l380-190 380 190Z" fill="{gold}"/>'
            f'<path d="M278 306h644v122H278Z" fill="{ink}"/>'
            + ''.join(f'<path d="M{x} 405v-55a26 26 0 0 1 52 0v55Z" fill="{gold}"' for x in (360,500,645,790))
        )
    return base


def illustration(target: str, profile: dict) -> str:
    digest = hashlib.sha256(target.encode()).digest()
    dark, sand, accent = VISUALS[digest[0] % len(VISUALS)]
    name, caption, kind = profile["visual"]
    title = html.escape(name)
    subtitle = html.escape(caption)
    building = architecture(kind, dark, sand)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">Ilustração editorial, não fotografia. {subtitle}</desc>
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{dark}"/><stop offset="1" stop-color="{accent}"/></linearGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{sand}"/><stop offset="1" stop-color="#d5b58b"/></linearGradient></defs>
<rect width="1200" height="675" fill="url(#sky)"/>
<circle cx="980" cy="115" r="95" fill="{sand}" opacity=".13"/>
<path d="M0 420Q250 345 490 418T1200 396V675H0Z" fill="url(#ground)"/>
<path d="M0 472Q350 442 590 476T1200 450" fill="none" stroke="{dark}" stroke-width="8" opacity=".23"/>
<g transform="translate(0 17)" opacity=".98">{building}</g>
<path d="M62 535H1138" stroke="{dark}" opacity=".3" stroke-width="2"/>
<text x="75" y="583" font-size="23" font-family="serif" fill="{dark}" letter-spacing="2">BÍBLIA REFORMADA · ATLAS DE TRADIÇÕES</text>
<text x="75" y="627" font-size="36" font-family="serif" fill="{dark}">{title}</text>
</svg>'''

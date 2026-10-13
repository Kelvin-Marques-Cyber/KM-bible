#!/usr/bin/env python3
"""Corrige APRESENTAÇÃO do texto já extraído das Confissões, sem paráfrases.

Preserva a edição portuguesa, separa título/notas, remove cabeçalhos/páginas
do PDF, junta quebras tipográficas e retira o índice/apêndice colado no fim.
A edição original permanece no PDF junto aos assets para conferência.
Idempotente: os livros formatados não são reformatados numa nova compilação.
"""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "agostinho"
PAGE_HEADER = re.compile(r"^Santo Agostinho\s*[–—-]\s*Confiss(?:ões|oes)\.?$", re.I)
NUMBER = re.compile(r"^\d{1,3}$")
NOTE = re.compile(r"^(\d{1,3})\s+(.+\S)$")
TITLE_END = re.compile(r"[.!?][”\"']?\s*$")
SPLIT = re.compile(r"\n[ \t]*\n")
SUPERSCRIPT = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def join_wrapped(lines: list[str], *, paragraphs: bool = True) -> str:
    assembled = []
    for fragment in lines:
        part = fragment.strip()
        if not part:
            continue
        if not assembled:
            assembled.append(part)
            continue
        previous = assembled[-1]
        # Hífen no fim da linha impressa: 'cri-' + 'ação' -> 'criação'.
        if previous.endswith("-") and re.match(r"^[a-zà-ÿ]", part):
            assembled[-1] = previous[:-1] + part
        elif paragraphs and re.search(r"[.!?][\"”']?$", previous) and re.match(
            r"^[A-ZÀ-Ý“\"']", part
        ):
            assembled.append("\n\n" + part)
        else:
            assembled.append(" " + part)
    return re.sub(r"[ \t]{2,}", " ", "".join(
        value if value.startswith((" ", "\n")) or i == 0 else " " + value
        for i, value in enumerate(assembled)
    )).strip()


def normalize(chapter: dict, book_number: int) -> dict:
    if chapter.get("layout_version") == 2:
        return chapter
    raw = chapter.get("body", "")
    lines = raw.splitlines()
    # O capítulo XIII.38 continha índice geral e páginas publicitárias da
    # edição após o fim do texto original. Nenhum trecho anterior ao índice é
    # cortado, nem há remoção de material doutrinário dentro dos 278 capítulos.
    if book_number == 13 and chapter["chapter"] == 38:
        for i, line in enumerate(lines):
            if line.strip().casefold() == "índice" and any(
                "CONFISSÕES" in x.upper()
                for x in lines[i + 1:i + 9]
            ):
                lines = lines[:i]
                break
    nonempty = [i for i, x in enumerate(lines) if x.strip()]
    if not nonempty:
        raise ValueError("Capítulo vazio.")
    start = nonempty[0]
    title_parts = []
    pos = start
    while pos < len(lines) and len(" ".join(title_parts)) < 150:
        item = lines[pos].strip()
        pos += 1
        if not item:
            if title_parts and TITLE_END.search(title_parts[-1]):
                break
            continue
        title_parts.append(item)
        if TITLE_END.search(item):
            break
    title = join_wrapped(title_parts, paragraphs=False)
    if not title or len(title) > 180:
        raise ValueError(f"Título ilegível: livro {book_number}, cap. {chapter['chapter']}")
    text_lines: list[str] = []
    notes: list[dict] = []
    active = None

    def flush_note():
        nonlocal active
        if active:
            active["text"] = join_wrapped(active.pop("lines"), paragraphs=False)
            if active["text"]:
                notes.append(active)
        active = None

    for i in range(pos, len(lines)):
        line = lines[i].strip()
        if not line or line == "_______" or re.fullmatch(r"_+", line):
            if line.startswith("_"):
                flush_note()
            continue
        if PAGE_HEADER.fullmatch(line):
            flush_note()
            continue
        if NUMBER.fullmatch(line):
            # Página isolada, não um numeral do conteúdo.
            next_nonempty = next((x.strip() for x in lines[i + 1:] if x.strip()), "")
            if PAGE_HEADER.fullmatch(next_nonempty) or (int(line) > 100 and (
                active is not None or book_number == 13
            )):
                flush_note()
                continue
        note = NOTE.match(line)
        if note and len(note.group(2)) >= 8:
            flush_note()
            active = {"number": int(note.group(1)), "lines": [note.group(2)]}
            continue
        if active is not None:
            active["lines"].append(line)
        else:
            text_lines.append(line)
    flush_note()
    body = join_wrapped(text_lines)
    # Preserva referências numéricas da tradução, agora elevadas à linha
    # tipográfica (em vez de 'mim?8' e 'Senhor730').
    for n in sorted({x["number"] for x in notes}, key=lambda x: -len(str(x))):
        body = re.sub(
            rf"(?<=[A-Za-zÀ-ÿ?!.,;:\]\)])(?<!\d){n}(?!\d)",
            str(n).translate(SUPERSCRIPT),
            body,
        )
    if len(body) < 250:
        raise ValueError(f"Corpo curto: livro {book_number}, cap. {chapter['chapter']}")
    return {
        "chapter": chapter["chapter"],
        "title": title,
        "body": body,
        "footnotes": notes,
        "layout_version": 2,
    }


def main():
    manifest = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))
    if len(manifest["chapterCounts"]) != 13 or manifest["chapterCount"] != 278:
        raise SystemExit("Índice de Agostinho inválido.")
    total = 0
    for book in range(1, 14):
        path = ASSETS / f"{book}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("book") != book:
            raise SystemExit(f"Livro incorreto no JSON {book}.")
        if len(data["chapters"]) != manifest["chapterCounts"][book - 1]:
            raise SystemExit(f"Faltam capítulos no livro {book}.")
        changed = []
        for ch in data["chapters"]:
            changed.append(normalize(ch, book))
        # Prepara inteiramente o livro antes de substituir seu arquivo.
        data["chapters"] = changed
        data["layout_version"] = 2
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
        total += len(changed)
    assert total == 278
    final = json.loads((ASSETS / "13.json").read_text())["chapters"][-1]
    if "Solus Ágape" in final["body"] or "\nÍndice" in final["body"]:
        raise SystemExit("Índice da edição ainda presente no último capítulo.")
    print(f"Agostinho: {total} capítulos revisados (títulos, parágrafos, notas e rodapés).")


if __name__ == "__main__":
    main()

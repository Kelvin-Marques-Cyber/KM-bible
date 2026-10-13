#!/usr/bin/env python3
"""Formata a transcrição integral de Agostinho para leitura, sem paráfrase.

Separação de títulos por bloco tipográfico (não exige pontuação final).
Remoção de cabeçalhos e números de página. Notas extraídas sem misturar
o corpo com o rodapé. O PDF original é mantido para conferência.
A escrita é atômica: erros não sobrescrevem os JSONs dos livros.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "agostinho"
PAGE_HEADER = re.compile(r"^Santo Agostinho\s*[–—-]\s*Confiss(?:ões|oes)\.?$", re.I)
PAGE_NUMBER = re.compile(r"^\d{1,3}$")
FOOTNOTE_START = re.compile(r"^(\d{1,3})\s+(\S.+)$")
PAGE_SEPARATOR = re.compile(r"^_{3,}$")
SUPERSCRIPT = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def join_lines(lines: list[str], *, paragraphs: bool = True) -> str:
    """Reconecta linhas quebradas pelo PDF sem reescrever nenhuma palavra."""
    text = ""
    previous = ""
    for line in lines:
        piece = line.strip()
        if not piece:
            continue
        if not text:
            text = piece
        elif text.endswith("-") and re.match(r"^[a-zà-ÿ]", piece):
            text = text[:-1] + piece
        elif paragraphs and re.search(r'[.!?]["”’]?(?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?$', previous) \
                and re.match(r'^[A-ZÀ-Ý“"‘]', piece):
            text += "\n\n" + piece
        else:
            text += " " + piece
        previous = piece
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def split_title(lines: list[str], book: int, chapter: int) -> tuple[str, int]:
    """O título ocupa um bloco separado por linha vazia; pode terminar sem ponto.

    Exemplos na edição:
    Livro III.1: 'Amores impuros'
    Livro III.3: 'O estudante de retórica e os "demolidores"'
    Livro XIII.2: duas linhas terminando em 'de Deus.'
    """
    cursor = 0
    while cursor < len(lines) and not lines[cursor].strip():
        cursor += 1
    start = cursor
    while cursor < len(lines) and lines[cursor].strip():
        cursor += 1
    items = lines[start:cursor]
    title = join_lines(items, paragraphs=False)

    # Em títulos excepcionalmente divididos por linhas em branco, não
    # engolir o corpo: recuar e manter ao menos a primeira linha como título.
    if not title or len(title) > 185:
        if start < len(lines) and 2 < len(lines[start].strip()) <= 185:
            title, cursor = lines[start].strip(), start + 1
        else:
            raise ValueError(f"Título ilegível: livro {book}, cap. {chapter}")
    if len(title) < 3:
        raise ValueError(f"Título curto: livro {book}, cap. {chapter}")
    return title, cursor


def normalize(chapter: dict, book_number: int) -> dict:
    if chapter.get("layout_version") == 3:
        return chapter
    if chapter.get("layout_version") == 2:
        # Evita editar novamente arquivos formatados por versões anteriores.
        return chapter
    chapter_number = chapter["chapter"]
    original = str(chapter.get("body", ""))
    lines = original.splitlines()

    # O final do Livro XIII.38 inclui o sumário do volume e divulgação da
    # editora, que não fazem parte do texto agostiniano.
    if (book_number, chapter_number) == (13, 38):
        for i, line in enumerate(lines):
            if line.strip().casefold() == "índice" and any(
                "CONFISSÕES" in following.upper()
                for following in lines[i + 1:i + 12]
            ):
                lines = lines[:i]
                break

    title, pos = split_title(lines, book_number, chapter_number)
    body_lines = []
    notes = []
    active_note = None
    expecting_number = False

    def flush_note():
        nonlocal active_note
        if active_note:
            text = join_lines(active_note.pop("lines"), paragraphs=False)
            if text:
                notes.append({"number": active_note["number"], "text": text})
        active_note = None

    for i in range(pos, len(lines)):
        line = lines[i].strip()
        if not line:
            continue
        if PAGE_SEPARATOR.fullmatch(line):
            flush_note()
            continue
        if PAGE_HEADER.fullmatch(line):
            flush_note()
            continue

        # Números de página são impressos em uma linha isolada, usualmente
        # seguidos imediatamente por "Santo Agostinho – Confissões.".
        if PAGE_NUMBER.fullmatch(line):
            next_nonempty = next(
                (candidate.strip() for candidate in lines[i+1:] if candidate.strip()),
                ""
            )
            if PAGE_HEADER.fullmatch(next_nonempty) or active_note is not None \
                    or book_number == 13 and int(line) >= 590:
                flush_note()
                continue
        match = FOOTNOTE_START.fullmatch(line)
        if match and len(match.group(2)) >= 8:
            # Uma nota começa no rodapé. Continua apenas até a página seguinte
            # (marcada por número/cabeçalho) ou o próximo item.
            flush_note()
            active_note = {"number": int(match.group(1)),
                           "lines": [match.group(2)]}
            continue
        if active_note is not None:
            active_note["lines"].append(line)
        else:
            body_lines.append(line)
    flush_note()

    body = join_lines(body_lines)
    for note in notes:
        number = str(note["number"])
        body = re.sub(
            rf"(?<=[A-Za-zÀ-ÿ?!.,;:\])])(?<!\d){number}(?!\d)",
            number.translate(SUPERSCRIPT),
            body,
        )

    if len(body) < 220:
        raise ValueError(
            f"Texto curto após separar notas: livro {book_number}, "
            f"cap. {chapter_number}: {len(body)} caracteres"
        )
    return {"chapter": chapter_number, "title": title, "body": body,
            "footnotes": notes, "layout_version": 3}


def main():
    manifest = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))
    counts = manifest.get("chapterCounts", [])
    if len(counts) != 13 or manifest.get("chapterCount") != 278:
        raise SystemExit("Manifest de Agostinho inválido.")
    books = []
    all_chapters = 0
    for number, expected in enumerate(counts, 1):
        filename = ASSETS / f"{number}.json"
        book = json.loads(filename.read_text(encoding="utf-8"))
        if book["book"] != number or len(book["chapters"]) != expected:
            raise SystemExit(f"Estrutura inválida no livro {number}")
        revised = [normalize(ch, number) for ch in book["chapters"]]
        book["chapters"] = revised
        book["layout_version"] = 3
        books.append((filename, book))
        all_chapters += len(revised)
    if all_chapters != 278:
        raise SystemExit(f"Capítulos incompletos: {all_chapters}")
    last = books[-1][1]["chapters"][-1]
    if len(last["body"]) >= 8000 or "Solus Ágape" in last["body"]:
        raise SystemExit("Índice/publicidade indevidamente incluídos em XIII.38")
    for filename, book in books:
        temp = filename.with_suffix(".json.tmp")
        temp.write_text(
            json.dumps(book, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        os.replace(temp, filename)
    print(f"Agostinho: normalização concluída em {all_chapters} capítulos.")


if __name__ == "__main__":
    main()

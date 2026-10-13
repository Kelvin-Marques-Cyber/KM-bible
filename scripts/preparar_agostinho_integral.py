#!/usr/bin/env python3
"""Converte a edicao integral autorizada de Confissoes em 278 capitulos para leitura offline.
Fonte: Solus Agape / Valdemar Teodoro Editor (2024), trad. J. Oliveira Santos e
A. Ambrosio de Pina, revisao de E. L. de Souza Campos.
Pagina de creditos declara: toda copia e divulgacao sao permitidas, citada a fonte.
Nao inventa, resume ou reescreve textos. Falha se houver capitulos faltando.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "agostinho"
BOOK_COUNTS = (20, 10, 12, 16, 14, 16, 21, 12, 13, 43, 31, 32, 38)
PDF_ID = "1jAn29V941tuMit03nVCWdt7F9ku3nBFK"
EDITION = "https://www.solusagape.com.br/obras-milenares/confiss%C3%B5es"

ROMAN = re.compile(r"^[IVXLCDM]+$", re.I)
BOOK_LINE = re.compile(
    r"^\s*(?:LIVRO|LIBRO)\s+(?P<num>[IVXLCDM]+|\d{1,2}|PRIMEIRO|SEGUNDO|"
    r"TERCEIRO|QUARTO|QUINTO|SEXTO|S[EÉ]TIMO|OITAVO|NONO|"
    r"D[EÉ]CIMO[- ]TERCEIRO|D[EÉ]CIMO[- ]SEGUNDO|D[EÉ]CIMO[- ]PRIMEIRO|D[EÉ]CIMO)"
    r"(?:\b|[.:\s—–-])", re.I)
CHAPTER_LINE = re.compile(
    r"^\s*(?:CAP[IÍ]TULO|CAP\.)\s*(?P<num>[IVXLCDM]+|\d{1,2})"
    r"(?:\b|[.:\s—–-])", re.I)
ORDINALS = {
    "PRIMEIRO": 1, "SEGUNDO": 2, "TERCEIRO": 3, "QUARTO": 4,
    "QUINTO": 5, "SEXTO": 6, "SÉTIMO": 7, "SETIMO": 7,
    "OITAVO": 8, "NONO": 9, "DÉCIMO": 10, "DECIMO": 10,
    "DÉCIMO-PRIMEIRO": 11, "DÉCIMO PRIMEIRO": 11,
    "DÉCIMO-SEGUNDO": 12, "DÉCIMO SEGUNDO": 12,
    "DÉCIMO-TERCEIRO": 13, "DÉCIMO TERCEIRO": 13,
}
def number(value):
    v = value.strip().upper()
    if v in ORDINALS:
        return ORDINALS[v]
    if v.isdecimal():
        return int(v)
    if not ROMAN.fullmatch(v):
        raise ValueError("Numero romano invalido: " + v)
    values = dict(I=1, V=5, X=10, L=50, C=100, D=500, M=1000)
    total = 0
    for i, ch in enumerate(v):
        k = values[ch]
        total += -k if i + 1 < len(v) and k < values[v[i+1]] else k
    return total

def cleaned(text):
    lines = []
    for raw in text.replace("\u00ad", "").splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        # Numero da pagina, quando impresso sozinho.
        # Remove apenas numeros decorados por tracos (cabecalhos de pagina).
        # "01" ou "1" podem ser os titulos reais dos capitulos.
        if re.fullmatch(r"[-—–]+\s*\d{1,3}\s*[-—–]+", line):
            continue
        lines.append(line)
    return lines

def pdf_lines(path):
    import fitz
    with fitz.open(path) as doc:
        if len(doc) < 30:
            raise ValueError("PDF curto demais para as Confissoes integrais.")
        pages = [page.get_text("text", sort=True) for page in doc]
    text = "\n\n".join(pages)
    if len(text) < 300_000:
        raise ValueError("PDF sem texto digital suficiente; OCR nao sera inventado.")
    return cleaned(text)

def positions(lines, pattern):
    found = []
    for i, text in enumerate(lines):
        m = pattern.match(text)
        if m:
            n = number(m.group("num"))
            found.append((i, n))
    return found

def chapters_from_book(lines, index, book_count):
    chapters = positions(lines, CHAPTER_LINE)
    if not chapters:
        # Algumas edicoes imprimem apenas algarismos romanos em linha isolada,
        # seguidos de um titulo breve. So aceitar quando a sequencia for completa.
        chapters = []
        for i, line in enumerate(lines):
            if re.fullmatch(r"(?:[IVXLCDM]+|\d{1,2})[.)]?", line, re.I):
                n = number(line.rstrip(".)"))
                if 1 <= n <= book_count:
                    chapters.append((i, n))
    # Titulos de sumario repetidos sao descartados escolhendo a sequencia
    # de 1..N que contem mais texto, com minimo razoavel por capitulo.
    possible = []
    for start in range(len(chapters)):
        if chapters[start][1] != 1:
            continue
        seq = [chapters[start]]
        for pos, n in chapters[start+1:]:
            if n == len(seq) + 1:
                seq.append((pos, n))
                if n == book_count:
                    break
            elif n == 1:
                break
        if len(seq) == book_count:
            score = sum(
                max(0, seq[i+1][0]-seq[i][0])
                for i in range(len(seq)-1)
            )
            possible.append((score, seq))
    if not possible:
        raise ValueError(
            f"Livro {index}: cabecalhos de capitulos incompletos: "
            f"{[n for _, n in chapters[:55]]}; esperado 1..{book_count}"
        )
    seq = max(possible, key=lambda pair: pair[0])[1]
    result = []
    for i, (start, n) in enumerate(seq):
        finish = seq[i+1][0] if i+1 < len(seq) else len(lines)
        body = "\n".join(lines[start+1:finish]).strip()
        # Evita publicar titulo de sumario como se fosse capitulo integral.
        if len(body) < 300:
            raise ValueError(
                f"Livro {index} capitulo {n} extracao curta ({len(body)} caracteres)"
            )
        result.append({"chapter": n, "body": body})
    return result

def extract(pdf):
    all_lines = pdf_lines(pdf)
    headers = positions(all_lines, BOOK_LINE)
    # Procura as sequencias de 13 livros. Escolhe os cabecalhos com
    # mais texto entre eles, ignorando o indice inicial de capitulos.
    candidates = []
    for i, (start, n) in enumerate(headers):
        if n != 1:
            continue
        chain = [(start, 1)]
        for pos, number_ in headers[i+1:]:
            if number_ == chain[-1][1] + 1:
                chain.append((pos, number_))
                if len(chain) == 13:
                    break
            elif number_ == 1:
                break
        if len(chain) == 13:
            candidates.append(chain)
    if not candidates:
        raise ValueError("Os 13 cabecalhos LIVRO I..XIII nao foram encontrados.")
    errors = []
    for chain in sorted(candidates, key=lambda xs: xs[-1][0]-xs[0][0], reverse=True):
        try:
            result = []
            for i, (start, booknum) in enumerate(chain):
                end = chain[i+1][0] if i+1 < 13 else len(all_lines)
                section = all_lines[start+1:end]
                parsed = chapters_from_book(section, booknum, BOOK_COUNTS[i])
                result.append({"book": booknum, "chapters": parsed})
            if len(result) == 13 and sum(len(b["chapters"]) for b in result) == 278:
                return result
        except ValueError as exc:
            errors.append(str(exc))
    raise ValueError("Nao foi possivel separar os 278 capitulos integralmente. "
                     + "; ".join(errors[:3]))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    pdf = args.pdf or ROOT / ".cache" / "agostinho" / "confissoes-solus-agape.pdf"
    if args.download and (not pdf.exists() or pdf.stat().st_size < 100_000):
        import gdown
        pdf.parent.mkdir(parents=True, exist_ok=True)
        print("Baixando edicao integral autorizada de Solus Agape...", flush=True)
        fetched = gdown.download(id=PDF_ID, output=str(pdf), quiet=False)
        if not fetched:
            sys.exit("Nao foi possivel baixar a edicao PDF do Google Drive. "
                     "Baixe-a manualmente no site Solus Agape e use --pdf ARQUIVO.pdf")
    if not pdf.exists() or pdf.read_bytes()[:4] != b"%PDF":
        sys.exit(f"PDF nao encontrado ou invalido: {pdf}")
    try:
        books = extract(pdf)
    except ValueError as exc:
        sys.exit("ERRO DE VALIDACAO: " + str(exc))
    # Grava somente se TODOS os 278 capitulos forem aprovados.
    for book in books:
        for chapter in book["chapters"]:
            if len(chapter["body"]) < 300:
                sys.exit("Capitulo de texto incompleto; nenhuma saida sera publicada.")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "id": "AugustineConfessionsFullPt",
        "language": "pt-BR",
        "status": "integral",
        "title": "Confissoes — Santo Agostinho",
        "author": "Agostinho de Hipona",
        "translator": "J. Oliveira Santos, S.J.; A. Ambrosio de Pina, S.J.",
        "revision": "E. L. de Souza Campos",
        "edition": "Valdemar Teodoro Editor (2024) / Solus Agape",
        "license": "Reproducao e divulgacao autorizadas com atribuicao, conforme creditos da edicao",
        "source": EDITION,
        "chapterCounts": list(BOOK_COUNTS),
        "bookCount": 13,
        "chapterCount": 278,
    }
    import hashlib
    manifest["pdf_sha256"] = hashlib.sha256(pdf.read_bytes()).hexdigest()
    for entry in books:
        file = OUT / f"{entry['book']}.json"
        file.write_text(
            json.dumps(entry, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8"
        )
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"OK: 13 livros / 278 capitulos originais extraidos em {OUT}.")

if __name__ == "__main__":
    main()

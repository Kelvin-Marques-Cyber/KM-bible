#!/usr/bin/env python3
"""Tradução offline rápida dos comentários de João Calvino para pt-BR.

Usa o MESMO modelo Argos Translate EN→PT do script traduzir_comentarios_ptbr.py,
mas chama o CTranslate2 diretamente, em lotes, com divisão de frases por regex.
O script original (stanza + uma frase por vez) levava ~45 s por comentário;
este processa centenas de frases por segundo e pode ser retomado a qualquer
momento (grava a cada lote).

Regras preservadas do pipeline original:
- grava em assets/content/portuguese.sqlite, tabela translations;
- status "Tradução automática de estudo — revisão necessária";
- nunca registra texto vazio, idêntico ao inglês ou com o marcador "⁇";
- trechos em grego/hebraico são preservados sem tradução.

Uso:
  python3 -m venv .venv-traducao && .venv-traducao/bin/pip install argostranslate
  .venv-traducao/bin/python scripts/traduzir_calvino_rapido.py [--limit N] [--threads 4]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "assets" / "content"
PACKAGE = ROOT / "assets" / "bundled" / "CalvinCommentaries.biblepkg"
STATUS = "Tradução automática de estudo — revisão necessária"
SOURCE = "Argos Translate EN→PT (CTranslate2, lotes); original no módulo de origem"

# Abreviações comuns no texto inglês do século XIX que não encerram frase.
ABBREVIATIONS = (
    "Rev", "Mr", "Mrs", "Dr", "St", "ch", "chap", "ver", "vv", "v", "viz", "i.e", "e.g", "etc", "cf", "ib",
    "ibid", "vol", "p", "pp", "M.A", "D.D", "Gen", "Ex", "Lev", "Num", "Deut", "Ps", "Isa", "Jer", "Ezek",
    "Matt", "Rom", "Cor", "Gal", "Eph", "Phil", "Col", "Thess", "Tim", "Heb", "Jas", "Pet", "Rev", "No", "lib",
)
ABBR = re.compile(r"\b(?:%s)\.$" % "|".join(re.escape(a) for a in ABBREVIATIONS), re.I)
SENTENCE_END = re.compile(r"(?<=[.!?;:])[\"'”’)\]]*\s+(?=[\"'“‘(\[]?[A-Z0-9])")
FOREIGN = re.compile(r"[Ͱ-Ͽἀ-῿֐-׿יִ-ﭏ][̀-ͯͰ-Ͽἀ-῿֐-׿יִ-ﭏ\s.,;:'’]*")


def find_model() -> Path:
    base = Path.home() / ".local" / "share" / "argos-translate" / "packages"
    found = sorted(base.glob("translate-en_pt*"))
    if found:
        return found[-1]
    from argostranslate import package  # type: ignore

    package.update_package_index()
    chosen = next((x for x in package.get_available_packages() if x.from_code == "en" and x.to_code == "pt"), None)
    if chosen is None:
        raise SystemExit("Modelo EN→PT indisponível no índice Argos.")
    package.install_from_path(chosen.download())
    found = sorted(base.glob("translate-en_pt*"))
    if not found:
        raise SystemExit("Falha ao instalar o modelo EN→PT.")
    return found[-1]


def split_sentences(paragraph: str) -> list[str]:
    pieces: list[str] = []
    start = 0
    for match in SENTENCE_END.finditer(paragraph):
        candidate = paragraph[start:match.start()].rstrip()
        if ABBR.search(candidate):
            continue
        pieces.append(paragraph[start:match.end()])
        start = match.end()
    pieces.append(paragraph[start:])
    # Frases muito longas: quebra em vírgulas para não estourar o modelo.
    result: list[str] = []
    for piece in pieces:
        while len(piece) > 600:
            cut = max(piece.rfind(", ", 0, 500), piece.rfind("; ", 0, 500))
            if cut < 200:
                cut = piece.rfind(" ", 0, 500)
            if cut < 100:
                break
            result.append(piece[: cut + 1])
            piece = piece[cut + 1:]
        result.append(piece)
    return [p for p in result if p]


class Engine:
    def __init__(self, threads: int, beam: int):
        import ctranslate2  # type: ignore
        import sentencepiece  # type: ignore

        model = find_model()
        self.sp = sentencepiece.SentencePieceProcessor(model_file=str(model / "sentencepiece.model"))
        self.translator = ctranslate2.Translator(
            str(model / "model"), device="cpu", compute_type="int8", inter_threads=1, intra_threads=threads
        )
        self.beam = beam

    def translate(self, sentences: list[str]) -> list[str]:
        if not sentences:
            return []
        tokens = [self.sp.encode(s, out_type=str) for s in sentences]
        output = self.translator.translate_batch(
            tokens,
            beam_size=self.beam,
            max_batch_size=48,
            batch_type="examples",
            max_decoding_length=400,
            replace_unknowns=True,
        )
        # Como no Argos: junta as peças e troca o marcador "▁" do SentencePiece por espaço.
        return ["".join(item.hypotheses[0]).replace("\u2581", " ").strip() for item in output]


def protect(sentence: str) -> tuple[str, list[str]]:
    """Substitui trechos gregos/hebraicos por marcadores numéricos estáveis."""
    kept: list[str] = []

    def hold(match: re.Match) -> str:
        text = match.group(0).rstrip(" .,;:")
        tail = match.group(0)[len(text):]
        kept.append(text)
        return f" {7000 + len(kept) - 1} " + tail

    return FOREIGN.sub(hold, sentence), kept


def restore(text: str, kept: list[str]) -> str:
    for i, original in enumerate(kept):
        text = re.sub(rf"\b{7000 + i}\b", original, text, count=1)
    return text


def translate_body(engine: Engine, body: str) -> str:
    parts = re.split(r"(\n\s*\n)", body)
    jobs: list[tuple[int, int, str, list[str], str]] = []  # (part, index, texto protegido, guardados, espaço)
    rebuilt: list[list[str]] = []
    for p_index, part in enumerate(parts):
        if not part.strip() or re.fullmatch(r"\n\s*\n", part):
            rebuilt.append([part])
            continue
        sentences = split_sentences(part)
        rebuilt.append([""] * len(sentences))
        for s_index, sentence in enumerate(sentences):
            spacing = sentence[len(sentence.rstrip()):]
            protected, kept = protect(sentence.strip())
            if not re.search(r"[A-Za-z]{2,}", protected):
                rebuilt[p_index][s_index] = sentence
                continue
            jobs.append((p_index, s_index, protected, kept, spacing))
    translated = engine.translate([j[2] for j in jobs])
    for (p_index, s_index, _, kept, spacing), text in zip(jobs, translated):
        rebuilt[p_index][s_index] = restore(text, kept) + (spacing or " ")
    result = "".join("".join(items) for items in rebuilt)
    result = result.replace("⁇", "").replace(" ,", ",").replace(" .", ".")
    return re.sub(r"[ \t]{2,}", " ", result).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--beam", type=int, default=1, help="1 = guloso (mais rápido)")
    parser.add_argument("--batch", type=int, default=24, help="comentários por lote gravado")
    args = parser.parse_args()
    with zipfile.ZipFile(PACKAGE) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("id") != "CalvinCommentaries":
            raise SystemExit("Pacote inesperado.")
        rows = json.loads(archive.read("data.json"))
    database = CONTENT / "portuguese.sqlite"
    conn = sqlite3.connect(database)
    done = {
        row[0]
        for row in conn.execute(
            "SELECT id FROM translations WHERE type='commentary' AND id LIKE 'CalvinCommentaries:%' "
            "AND length(trim(body))>0 AND body NOT LIKE '%⁇%'"
        )
    }
    pending = [
        ("CalvinCommentaries:" + str(r["id"]), str(r.get("title") or "Comentário de João Calvino"), str(r.get("body") or ""))
        for r in rows
        if str(r.get("body") or "").strip() and "CalvinCommentaries:" + str(r["id"]) not in done
    ]
    if args.limit:
        pending = pending[: args.limit]
    total_chars = sum(len(b) for _, _, b in pending)
    print(f"Pendentes: {len(pending)} comentários ({total_chars / 1e6:.1f} M caracteres); já traduzidos: {len(done)}", flush=True)
    engine = Engine(args.threads, args.beam)
    started = time.time()
    processed_chars = 0
    for start in range(0, len(pending), args.batch):
        batch = pending[start:start + args.batch]
        results = []
        for cid, title, body in batch:
            translated = translate_body(engine, body)
            processed_chars += len(body)
            if not translated or "⁇" in translated or (len(body) >= 100 and translated.strip() == body.strip()):
                continue
            results.append((cid, title, translated))
        conn.executemany(
            """INSERT INTO translations (type,id,title,gloss,body,status,source)
               VALUES ('commentary',?,?,'',?,?,?)
               ON CONFLICT(type,id) DO UPDATE SET title=excluded.title, body=excluded.body,
                 status=excluded.status, source=excluded.source""",
            [(cid, title, body, STATUS, SOURCE) for cid, title, body in results],
        )
        conn.commit()
        elapsed = time.time() - started
        rate = processed_chars / max(elapsed, 1)
        remaining = (total_chars - processed_chars) / max(rate, 1)
        print(
            f"{min(start + args.batch, len(pending))}/{len(pending)} · {rate / 1000:.1f} mil caracteres/s · "
            f"restante ~{remaining / 60:.0f} min",
            flush=True,
        )
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    counts = dict(conn.execute("SELECT type,count(*) FROM translations GROUP BY type"))
    calvin = conn.execute(
        "SELECT count(*) FROM translations WHERE type='commentary' AND id LIKE 'CalvinCommentaries:%' AND length(trim(body))>0"
    ).fetchone()[0]
    conn.close()
    digest = hashlib.sha256(database.read_bytes()).hexdigest()
    (CONTENT / "portuguese.sha256").write_text(digest + "\n", encoding="utf-8")
    (CONTENT / "portuguese-coverage.json").write_text(
        json.dumps(
            {
                "records": counts,
                "calvin_translated": calvin,
                "sha256": digest,
                "review": "Tradução automática de estudo; revisão especializada pendente",
                "scope": "Somente entradas realmente traduzidas; originais preservados",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Calvino traduzido: {calvin} entradas. SHA256 atualizada.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

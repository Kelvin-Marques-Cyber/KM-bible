#!/usr/bin/env python3
"""Gera os pacotes estaticos da PWA a partir do acervo do repositorio.

Entrada (somente leitura): assets/content/*.sqlite, assets/content/*.json,
assets/bundled/*.biblepkg, assets/3d e assets/agostinho.
Saida: pwa/public/data/v1 (dados fragmentados, carregados sob demanda) e
pwa/src/generated/catalog.json (indice pequeno incorporado ao aplicativo).

Principios:
- Nada de centenas de MB na abertura: cada livro, capitulo ou balde de indice
  e um arquivo pequeno, baixado somente quando a tela precisa dele.
- Cada pacote recebe um hash de conteudo; o aplicativo usa ?v=<hash> e o
  service worker descarta automaticamente versoes antigas do cache.
- Conteudo pessoal/protegido (assets/private, ARA) nunca e lido aqui.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import sys
import time
import unicodedata
import zipfile
from collections import defaultdict
from pathlib import Path

PWA = Path(__file__).resolve().parents[1]
ROOT = PWA.parent
ASSETS = ROOT / "assets"
CONTENT = ASSETS / "content"
OUT = PWA / "public" / "data" / "v1"
GENERATED = PWA / "src" / "generated"
FORMAT = 1

# ---------------------------------------------------------------- utilidades


def db(name: str) -> sqlite3.Connection:
    # immutable=1: nunca aplica journals antigos (connections.sqlite-journal
    # truncaria o banco) e nunca escreve nos bancos do repositorio.
    path = CONTENT / f"{name}.sqlite"
    connection = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def ref_key(ref: str) -> int:
    b, c, v = (int(x) for x in ref.split(":"))
    return b * 1_000_000 + c * 1000 + v


def valid_ref(ref: object) -> bool:
    if not isinstance(ref, str):
        return False
    parts = ref.split(":")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        return False
    b, c, v = (int(p) for p in parts)
    return 1 <= b <= 66 and 1 <= c <= 150 and 1 <= v <= 176


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if not unicodedata.category(ch).startswith("M")).lower()


TOKEN = re.compile(r"[^\W_]+")


def tokens(text: str) -> list[str]:
    return [t for t in TOKEN.findall(fold(text)) if len(t) <= 40 and not (t.isdigit() and len(t) > 4)]


def fnv1a(text: str) -> int:
    h = 0x811C9DC5
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def shard_of(token: str, shards: int) -> int:
    return fnv1a(token[:2]) % shards


MT_MARK = re.compile(r"\s*⁇\s*")


def clean_title(text: str | None) -> str:
    # O tradutor automatico usado no acervo pt-BR marcou caracteres que nao
    # conseguiu gerar com "⁇". Em titulos, era sempre um separador.
    return MT_MARK.sub(" · ", text or "").strip()


def clean_body(text: str | None) -> str:
    return re.sub(r" ⁇ ", " — ", text or "")


def snippet(text: str, limit: int = 200) -> str:
    plain = re.sub(r"[#*_>`\[\]]", "", text or "")
    plain = re.sub(r"\s+", " ", plain).strip()
    return plain if len(plain) <= limit else plain[: plain.rfind(" ", 0, limit) if " " in plain[:limit] else limit] + "…"


def jloads(text: str | None, fallback):
    try:
        value = json.loads(text) if text else fallback
        return value if isinstance(value, type(fallback)) else fallback
    except (TypeError, ValueError):
        return fallback


class Pack:
    """Conjunto de arquivos que compartilham um hash de versao."""

    def __init__(self, path: str):
        self.path = path.strip("/")
        self.files: dict[str, bytes] = {}

    def put(self, name: str, value) -> None:
        if isinstance(value, (bytes, bytearray)):
            data = bytes(value)
        elif isinstance(value, str):
            data = value.encode("utf-8")
        else:
            data = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.files[name] = data

    def write(self) -> dict:
        digest = hashlib.sha256()
        total = 0
        for name in sorted(self.files):
            digest.update(name.encode())
            digest.update(b"\0")
            digest.update(self.files[name])
            target = OUT / self.path / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(self.files[name])
            total += len(self.files[name])
        STATS.append((self.path, len(self.files), total))
        return {"path": self.path, "hash": digest.hexdigest()[:10], "bytes": total, "files": len(self.files)}


STATS: list[tuple[str, int, int]] = []

# ------------------------------------------------------------ modulos/licencas


def package_files() -> list[tuple[Path, dict, list]]:
    result = []
    for item in json.loads((ASSETS / "bundled" / "modules.json").read_text()):
        path = ASSETS / "bundled" / item["file"]
        with zipfile.ZipFile(path) as archive:
            manifest = json.loads(archive.read("manifest.json"))
            # Mesmo criterio do aplicativo: hashes do manifesto precisam conferir.
            for name, expected in manifest.get("files", {}).items():
                if hashlib.sha256(archive.read(name)).hexdigest() != expected:
                    raise SystemExit(f"Integridade invalida em {path.name}: {name}")
            records = json.loads(archive.read("verses.json" if manifest["kind"] == "bible" else "data.json"))
        if manifest["id"] != item["id"]:
            raise SystemExit(f"Identificador inconsistente em {path.name}")
        result.append((path, manifest, records))
    return result


ENGLISH_JOINED = re.compile(r"(?<=[a-z])(?=[A-Z])")


def build() -> dict:
    started = time.time()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    GENERATED.mkdir(parents=True, exist_ok=True)

    catalogue = db("catalogue")
    library = db("library")
    lexicon = db("lexicon")
    connections = db("connections")
    portuguese = db("portuguese")
    topics_db = db("topics")
    packages = package_files()

    translations: dict[tuple[str, str], sqlite3.Row] = {
        (row["type"], row["id"]): row for row in portuguese.execute("SELECT * FROM translations")
    }

    modules: dict[str, dict] = {}
    licenses = Pack("licenses")

    def register(mid: str, title, kind, language, version, author, license_, license_text, source,
                 installed: bool, metadata: dict, origin: str) -> dict:
        licenses.put(f"{mid}.txt", license_text or "")
        entry = {
            "id": mid, "title": title, "kind": kind, "language": language, "version": version,
            "author": author, "license": license_, "source": source, "installed": installed,
            "builtin": True, "metadata": metadata, "origin": origin,
        }
        modules[mid] = entry
        return entry

    for row in catalogue.execute("SELECT * FROM content_modules"):
        register(row["id"], row["title"], row["kind"], row["language"], row["version"], row["author"],
                 row["license"], row["license_text"], row["source"], row["installed"] == 1,
                 jloads(row["metadata"], {}), "catalogue")
    for path, manifest, records in packages:
        register(manifest["id"], manifest["title"], manifest["kind"], manifest["language"], manifest["version"],
                 manifest["author"], manifest["license"], manifest["license_text"], manifest["source"], True,
                 manifest.get("metadata") or {}, "package")
        modules[manifest["id"]]["package"] = path.name

    # ------------------------------------------------------------------ Biblias
    bible_rows: dict[str, list[tuple[str, str, dict]]] = defaultdict(list)
    for row in catalogue.execute("SELECT translation,reference,text,metadata FROM verses ORDER BY translation,book,chapter,verse"):
        if row["translation"].upper() == "ARA":
            continue  # Licença da ARA não é distribuída pela PWA pública.
        bible_rows[row["translation"]].append((row["reference"], row["text"], jloads(row["metadata"], {})))
    for _, manifest, records in packages:
        if manifest["kind"] != "bible" or manifest["id"].upper() == "ARA":
            continue
        rows = []
        for record in records:
            if valid_ref(record.get("reference")) and isinstance(record.get("text"), str) and record["text"]:
                rows.append((record["reference"], record["text"], record.get("metadata") or {}))
        rows.sort(key=lambda r: ref_key(r[0]))
        bible_rows[manifest["id"]] = rows

    repaired = {}
    for mid in ("Darby", "ASV"):
        count = 0
        fixed = []
        for ref, text, meta in bible_rows.get(mid, []):
            new = ENGLISH_JOINED.sub(" ", text)
            count += new != text
            fixed.append((ref, new, meta))
        if mid in bible_rows:
            bible_rows[mid] = fixed
            repaired[mid] = count
            modules[mid]["metadata"]["text_repair"] = (
                f"{count} versículos com palavras coladas na conversão SWORD receberam espaço entre "
                "letra minúscula e maiúscula (ex.: 'AndGod' → 'And God'). Nenhuma palavra foi alterada.")

    bibles = {}
    for mid, rows in bible_rows.items():
        pack = Pack(f"bible/{mid}")
        books: dict[int, dict[int, list]] = defaultdict(lambda: defaultdict(list))
        for ref, text, meta in rows:
            b, c, v = (int(x) for x in ref.split(":"))
            verse = [v, text]
            compact = {}
            if isinstance(meta.get("heading"), str) and meta["heading"]:
                compact["h"] = meta["heading"]
            if meta.get("red_ranges"):
                compact["r"] = meta["red_ranges"]
            if meta.get("paragraph") is True:
                compact["p"] = 1
            if compact:
                verse.append(compact)
            books[b][c].append(verse)
        chapters = {}
        for b, chapter_map in books.items():
            last = max(chapter_map)
            pack.put(f"{b}.json", {"b": b, "c": [chapter_map.get(c, []) for c in range(1, last + 1)]})
            chapters[str(b)] = [len(chapter_map.get(c, [])) for c in range(1, last + 1)]
        info = pack.write()
        info["chapters"] = chapters
        info["verses"] = len(rows)
        bibles[mid] = info
        modules[mid]["installed"] = True

    # -------------------------------------------------------------- Comentarios
    commentary_records: dict[str, list[dict]] = defaultdict(list)
    for row in library.execute("SELECT * FROM commentary_entries ORDER BY module_id,start_key"):
        commentary_records[row["module_id"]].append({
            "id": row["id"], "s": row["start_key"], "e": row["end_key"], "ref": row["reference"],
            "end": row["end_reference"], "title": row["title"], "body": row["body"], "kind": row["kind"],
            "bib": row["bibliography"],
        })
    for _, manifest, records in packages:
        if manifest["kind"] != "commentary":
            continue
        mid = manifest["id"]
        for record in records:
            start = record.get("reference")
            end = record.get("end_reference") or start
            if not (valid_ref(start) and valid_ref(end)) or not isinstance(record.get("body"), str):
                continue
            commentary_records[mid].append({
                "id": f"{mid}:{record['id']}", "s": ref_key(start), "e": ref_key(end), "ref": start, "end": end,
                "title": record.get("title") or start, "body": record["body"],
                "kind": record.get("commentary_kind") or "exegesis",
                "bib": record.get("bibliography") or manifest["title"],
            })

    commentaries = {}
    for mid, records in commentary_records.items():
        records.sort(key=lambda r: (r["s"], r["e"]))
        default_bib = max(set(r["bib"] for r in records), key=[r["bib"] for r in records].count)
        rows = []
        for r in records:
            pt = translations.get(("commentary", r["id"]))
            item = [r["id"], r["s"], r["e"], r["title"], r["body"], r["kind"]]
            item.append(r["bib"] if r["bib"] != default_bib else 0)
            if pt is not None:
                item += [clean_title(pt["title"]), clean_body(pt["body"]), pt["status"]]
            rows.append(item)
        total = sum(len(json.dumps(x, ensure_ascii=False)) for x in rows)
        by_book: dict[int, list] = defaultdict(list)
        for item in rows:
            first, last = item[1] // 1_000_000, item[2] // 1_000_000
            for b in range(first, last + 1):
                by_book[b].append(item)
        largest = max(sum(len(json.dumps(x, ensure_ascii=False)) for x in v) for v in by_book.values())
        pack = Pack(f"comm/{mid}")
        if total < 350_000:
            shard = "module"
            pack.put("all.json", rows)
        elif largest < 450_000:
            shard = "book"
            for b, items in by_book.items():
                pack.put(f"{b}.json", items)
        else:
            shard = "chapter"
            counts = {str(b): len(v) for b, v in bibles["BLN4"]["chapters"].items()}
            for b, items in by_book.items():
                chapter_count = int(counts.get(str(b), 0)) or 150
                buckets: dict[int, list] = defaultdict(list)
                for item in items:
                    start_b, start_c = item[1] // 1_000_000, item[1] // 1000 % 1000
                    end_b, end_c = item[2] // 1_000_000, item[2] // 1000 % 1000
                    lo = start_c if start_b == b else 1
                    hi = end_c if end_b == b else chapter_count
                    for c in range(lo, min(hi, 150) + 1):
                        buckets[c].append(item)
                for c in range(1, chapter_count + 1):
                    pack.put(f"{b}/{c}.json", buckets.get(c, []))
        info = pack.write()
        info.update({"shard": shard, "books": sorted(by_book), "entries": len(rows), "bibliography": default_bib,
                     "translated": sum(1 for r in rows if len(r) > 7)})
        commentaries[mid] = info

    # ---------------------------------------------------- Referencias cruzadas
    xref = Pack("xref")
    kinds: list[str] = []
    provenances: list[str] = []
    per_chapter: dict[tuple[int, int], dict[int, list]] = defaultdict(lambda: defaultdict(list))
    for row in connections.execute("SELECT * FROM cross_references ORDER BY source,priority DESC,target"):
        if not (valid_ref(row["source"]) and valid_ref(row["target"])):
            continue
        b, c, v = (int(x) for x in row["source"].split(":"))
        if row["kind"] not in kinds:
            kinds.append(row["kind"])
        if row["provenance"] not in provenances:
            provenances.append(row["provenance"])
        end = row["end_reference"] if row["end_reference"] != row["target"] else 0
        per_chapter[(b, c)][v].append([row["target"], end, row["priority"], kinds.index(row["kind"]),
                                       provenances.index(row["provenance"])])
    for (b, c), verses in per_chapter.items():
        xref.put(f"{b}/{c}.json", {str(v): items for v, items in verses.items()})
    xref_info = xref.write()
    xref_info.update({"kinds": kinds, "provenances": provenances,
                      "chapters": sorted(f"{b}:{c}" for b, c in per_chapter)})
    xref_meta = {row["key"]: jloads(row["value"], row["value"]) if row["value"].startswith(("{", "[", '"')) else row["value"]
                 for row in connections.execute("SELECT * FROM metadata")}
    xref_info["metadata"] = xref_meta

    # ------------------------------------------------------- Lexico e original
    lexemes = {}
    for row in lexicon.execute("SELECT * FROM lexemes"):
        lexemes[row["id"]] = row
    lex_pt = {key[1]: row for key, row in translations.items() if key[0] == "lexeme"}

    def lex_bucket(lid: str) -> str:
        m = re.match(r"^([A-Za-z]+)(\d+)", lid)
        if not m:
            return "x"
        return f"{m.group(1).upper()}{int(m.group(2)) // 250}"

    lex_pack = Pack("lexicon")
    buckets: dict[str, dict] = defaultdict(dict)
    lex_list = []
    for lid, row in lexemes.items():
        pt = lex_pt.get(lid)
        item = [row["lemma"], row["transliteration"], (row["gloss"] or "").strip(), row["definition"] or "",
                row["language"], row["source"]]
        if pt is not None:
            item += [clean_body(pt["gloss"]).strip(), clean_body(pt["body"]), pt["status"]]
        buckets[lex_bucket(lid)][lid] = item
        lex_list.append([lid, row["lemma"], row["transliteration"],
                         (clean_body(pt["gloss"]).strip() if pt is not None and (pt["gloss"] or "").strip() else (row["gloss"] or "").strip())[:80]])
    for name, items in buckets.items():
        lex_pack.put(f"l/{name}.json", items)
    lex_list.sort(key=lambda x: (x[0][0], int(re.sub(r"\D", "", x[0]) or 0)))
    lex_pack.put("list.json", lex_list)

    editions: list[str] = []
    word_modules: list[str] = []
    words_by_chapter: dict[tuple[int, int], dict[int, list]] = defaultdict(lambda: defaultdict(list))
    occurrences: dict[str, list] = defaultdict(list)
    frequency: dict[str, int] = defaultdict(int)
    surfaces: dict[str, list] = {}
    morphs: dict[str, list] = defaultdict(list)
    morph_count: dict[str, int] = defaultdict(int)
    for row in lexicon.execute("SELECT * FROM words ORDER BY edition,reference,position"):
        if not valid_ref(row["reference"]):
            continue
        if row["edition"] not in editions:
            editions.append(row["edition"])
        if row["module_id"] not in word_modules:
            word_modules.append(row["module_id"])
        b, c, v = (int(x) for x in row["reference"].split(":"))
        lid = row["lexeme"] or ""
        lexeme = lexemes.get(lid)
        pt = lex_pt.get(lid)
        gloss = (clean_body(pt["gloss"]).strip() if pt is not None and (pt["gloss"] or "").strip() else "")
        ed = editions.index(row["edition"])
        words_by_chapter[(b, c)][v].append([
            row["position"], row["surface"], lid, row["morphology"] or "", ed,
            word_modules.index(row["module_id"]), lexeme["transliteration"] if lexeme is not None else "", gloss,
        ])
        if lid:
            frequency[lid] += 1
            if len(occurrences[lid]) < 200:
                occurrences[lid].append([ed, row["reference"], row["surface"], row["morphology"] or ""])
        surface_key = row["surface"]
        entry = surfaces.get(surface_key)
        if entry is None:
            surfaces[surface_key] = [fold(surface_key), lid, 1]
        else:
            entry[2] += 1
        morph = row["morphology"] or ""
        morph_count[morph] += 1
        if len(morphs[morph]) < 60:
            morphs[morph].append([ed, row["reference"], row["surface"], lid])

    words_pack = Pack("words")
    for (b, c), verses in words_by_chapter.items():
        words_pack.put(f"{b}/{c}.json", {str(v): sorted(items, key=lambda w: (w[4], w[0])) for v, items in verses.items()})
    words_info = words_pack.write()
    words_info.update({"editions": editions, "modules": word_modules,
                       "chapters": sorted(f"{b}:{c}" for b, c in words_by_chapter)})

    occ_buckets: dict[str, dict] = defaultdict(dict)
    for lid in set(frequency) | set(occurrences):
        occ_buckets[lex_bucket(lid)][lid] = [frequency.get(lid, 0), occurrences.get(lid, [])]
    for name, items in occ_buckets.items():
        lex_pack.put(f"o/{name}.json", items)
    surface_list = sorted(([s, folded, lid, n] for s, (folded, lid, n) in surfaces.items()), key=lambda x: -x[3])
    lex_pack.put("surfaces.json", surface_list)
    lex_pack.put("morphs.json", sorted(([m, n] for m, n in morph_count.items()), key=lambda x: -x[1]))
    morph_buckets: dict[int, dict] = defaultdict(dict)
    for morph, items in morphs.items():
        morph_buckets[fnv1a(morph) % 32][morph] = items
    for name, items in morph_buckets.items():
        lex_pack.put(f"m/{name}.json", items)
    lex_info = lex_pack.write()
    lex_info.update({"lexemes": len(lexemes), "words": sum(frequency.values()), "translated": len(lex_pt)})

    # ------------------------------------------------------------------- Temas
    torrey_pt = {}
    dart = (ROOT / "lib" / "torrey_titles_pt.dart").read_text(encoding="utf-8")
    for match in re.finditer(r"^\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)',?\s*$", dart, re.M):
        torrey_pt[match.group(1).replace("\\'", "'")] = match.group(2).replace("\\'", "'")
    topic_rows = list(topics_db.execute("SELECT * FROM topics"))
    topic_title = {}
    for row in topic_rows:
        topic_title[row["id"]] = torrey_pt.get(row["original_title"]) or clean_title(row["title"])
    order = sorted(topic_rows, key=lambda r: fold(topic_title[r["id"]]))
    topic_index = {row["id"]: i for i, row in enumerate(order)}
    topic_pack = Pack("topics")
    topic_pack.put("index.json", [[row["id"], topic_title[row["id"]], row["original_title"]] for row in order])
    bodies: dict[int, dict] = defaultdict(dict)
    refs: dict[str, list[str]] = defaultdict(list)
    verse_topics: dict[int, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    for row in topics_db.execute("SELECT topic_id,reference FROM topic_verses"):
        if valid_ref(row["reference"]) and row["topic_id"] in topic_index:
            refs[row["topic_id"]].append(row["reference"])
            b = int(row["reference"].split(":")[0])
            verse_topics[b][row["reference"][len(str(b)) + 1:]].append(topic_index[row["topic_id"]])
    for row in order:
        i = topic_index[row["id"]]
        bodies[i // 40][row["id"]] = [clean_body(row["body"]), row["source"], row["original_body"], row["review_status"],
                                     sorted(refs.get(row["id"], []), key=ref_key)]
    for name, items in bodies.items():
        topic_pack.put(f"t/{name}.json", items)
    for b, verses in verse_topics.items():
        topic_pack.put(f"v/{b}.json", {k: sorted(set(v)) for k, v in verses.items()})
    topics_info = topic_pack.write()
    topics_info.update({"topics": len(order), "links": sum(len(v) for v in refs.values()),
                        "metadata": {row["key"]: jloads(row["value"], row["value"]) if str(row["value"]).startswith(("[", "{", '"')) else row["value"]
                                     for row in topics_db.execute("SELECT * FROM metadata")}})

    # --------------------------------------------------------------- Documentos
    models = json.loads((ASSETS / "3d" / "models.json").read_text(encoding="utf-8"))
    safe_names = {}
    for model in models:
        original = model["file"]
        ascii_name = unicodedata.normalize("NFKD", original).encode("ascii", "ignore").decode()
        ascii_name = re.sub(r"[^A-Za-z0-9_.-]", "_", ascii_name)
        safe_names[original] = ascii_name
        model["file"] = ascii_name

    documents: dict[str, list[list]] = defaultdict(list)

    def add_document(mid, did, kind, title, body, reference, metadata):
        pt = translations.get(("document", did))
        item = [did, kind, title or "", body or "", reference or "", metadata or {}]
        if pt is not None:
            item += [clean_title(pt["title"]), clean_body(pt["body"]), pt["status"]]
        documents[mid].append(item)

    for row in catalogue.execute("SELECT * FROM documents WHERE module_id!='APP-3D' ORDER BY id"):
        add_document(row["module_id"], row["id"], row["kind"], row["title"], row["body"], row["reference"],
                     jloads(row["metadata"], {}))
    for model in models:
        mid = f"model:{model['id']}"
        refs_ = model.get("references") or []
        body = f"{model['description']}\n{model['certainty']}\n{' · '.join(refs_)}"
        add_document("APP-3D", mid, "model_index", model["title"], body, refs_[0] if refs_ else "",
                     {"model_id": model["id"], "references": refs_})
    for _, manifest, records in packages:
        kind = manifest["kind"]
        if kind in ("bible", "commentary", "lexicon"):
            continue
        mid = manifest["id"]
        for record in records:
            metadata = dict(record.get("metadata") or {})
            if kind in ("atlas", "model"):
                metadata.update(record)
            add_document(mid, f"{mid}:{record['id']}", kind, record.get("title") or manifest["title"],
                         record.get("body") or "", record.get("reference") or "", metadata)
    doc_pack = Pack("docs")
    doc_info = {}
    for mid, items in documents.items():
        if mid in ("WCF", "WSC", "WLC"):
            items.sort(key=lambda d: int(d[5].get("number") or 0))
        doc_pack.put(f"{mid}.json", items)
        doc_info[mid] = {"count": len(items), "kinds": sorted(set(d[1] for d in items))}
    docs_info = doc_pack.write()
    docs_info["modules"] = doc_info

    # Introducoes por livro (metadata.scope == 'book'), usadas no estudo conectado.
    book_intros = defaultdict(list)
    for mid, items in documents.items():
        for d in items:
            if d[5].get("scope") == "book" and isinstance(d[5].get("book"), int):
                book_intros[str(d[5]["book"])].append([mid, d[0], d[2]])

    # ------------------------------------------------------------------ Estudos
    studies = {}
    for row in catalogue.execute("SELECT * FROM studies"):
        studies[row["id"]] = {k: row[k] for k in row.keys()}
        studies[row["id"]]["refs"] = jloads(row["refs"], [])
        studies[row["id"]]["sources"] = jloads(row["sources"], [])
    expansion = json.loads((CONTENT / "editorial-expansion.json").read_text(encoding="utf-8"))
    for record in expansion["studies"]:
        studies[record["id"]] = {k: record.get(k) for k in
                                 ("id", "level", "topic", "target", "title", "exposition", "response", "strongest", "rejoinder", "refs", "sources")}
    study_list = sorted(studies.values(), key=lambda s: (s["level"] or 0, fold(s["title"] or "")))
    misc = Pack("misc")
    misc.put("studies.json", [[s["id"], s["level"], s["topic"], s["target"], s["title"], s["exposition"], s["response"],
                               s["strongest"], s["rejoinder"], s["refs"] or [], s["sources"] or []] for s in study_list])
    for name in ("context", "land", "relations", "book-backgrounds", "model-scenes", "religion-curricula",
                 "agostinho-confissoes-facil", "confessional-guides"):
        misc.put(f"{name}.json", json.loads((CONTENT / f"{name}.json").read_text(encoding="utf-8")))
    misc.put("models.json", models)
    misc_info = misc.write()

    # ------------------------------------------------- Agostinho (texto integral)
    augustine = None
    aug_dir = ASSETS / "agostinho"
    if (aug_dir / "manifest.json").is_file():
        manifest = json.loads((aug_dir / "manifest.json").read_text(encoding="utf-8"))
        if manifest.get("chapterCount") == 278 and len(manifest.get("chapterCounts", [])) == 13:
            pack = Pack("agostinho")
            pack.put("manifest.json", manifest)
            for n in range(1, 14):
                book = json.loads((aug_dir / f"{n}.json").read_text(encoding="utf-8"))
                assert len(book["chapters"]) == manifest["chapterCounts"][n - 1]
                pack.put(f"{n}.json", book)
            augustine = pack.write()

    # ----------------------------------------------------------------------- 3D
    models_dir = OUT / "3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    model_hash = hashlib.sha256()
    model_bytes = 0
    for original, safe in sorted(safe_names.items()):
        data = (ASSETS / "3d" / original).read_bytes()
        (models_dir / safe).write_bytes(data)
        model_hash.update(safe.encode() + hashlib.sha256(data).digest())
        model_bytes += len(data)
    (models_dir / "previews").mkdir(exist_ok=True)
    for preview in (ASSETS / "3d" / "previews").glob("*.jpg"):
        shutil.copy2(preview, models_dir / "previews" / preview.name)
    viewer = (ASSETS / "3d" / "viewer_immersive.html").read_text(encoding="utf-8")
    viewer = patch_viewer(viewer)
    (models_dir / "viewer.html").write_text(viewer, encoding="utf-8")
    model_hash.update(viewer.encode())
    STATS.append(("3d", len(safe_names) + 1, model_bytes))
    three_d = {"path": "3d", "hash": model_hash.hexdigest()[:10], "bytes": model_bytes, "files": len(safe_names),
               "sizes": {safe: (ASSETS / "3d" / original).stat().st_size for original, safe in safe_names.items()}}

    # ------------------------------------------------------- Indices de pesquisa
    search = {}
    general = []  # [categoria, id, titulo, trecho, fonte, referencia]
    general_text = []
    for item in order:
        body = clean_body(item["body"])
        general.append(["topic", item["id"], topic_title[item["id"]], snippet(body), item["source"][:80], ""])
        general_text.append(f"{topic_title[item['id']]} {body}")
    for mid, items in documents.items():
        for d in items:
            title = d[6] if len(d) > 6 and mid not in ("WCF", "WSC", "WLC") else d[2]
            body = d[7] if len(d) > 7 else d[3]
            general.append([d[1], d[0], title, snippet(body), mid, d[4]])
            general_text.append(" ".join([d[2], d[3]] + ([d[6], d[7]] if len(d) > 7 else [])))
    for s in study_list:
        general.append(["studies", s["id"], s["title"], snippet(s["response"] or ""), "Apologética reformada", ""])
        general_text.append(" ".join(filter(None, [s["title"], s["exposition"], s["response"]])))
    for lid, row in lexemes.items():
        pt = lex_pt.get(lid)
        gloss = clean_body(pt["gloss"]).strip() if pt is not None and (pt["gloss"] or "").strip() else (row["gloss"] or "").strip()
        general.append(["lexicon", lid, f"{lid} · {row['lemma']}", gloss[:160], row["source"], ""])
        general_text.append(" ".join(filter(None, [lid, row["lemma"], row["transliteration"], row["gloss"], row["definition"],
                                                   pt["gloss"] if pt is not None else "", pt["body"] if pt is not None else ""])))
    search["general"] = build_index("search/general", general, general_text, shards=256)

    comm_records = []
    comm_text = []
    for mid, records in commentary_records.items():
        for r in records:
            pt = translations.get(("commentary", r["id"]))
            title = clean_title(pt["title"]) if pt is not None and (pt["title"] or "").strip() else r["title"]
            body = clean_body(pt["body"]) if pt is not None else r["body"]
            comm_records.append(["commentary", r["id"], title, snippet(body), mid, r["ref"]])
            comm_text.append(" ".join([r["title"] or "", r["body"] or ""] + ([pt["title"] or "", pt["body"] or ""] if pt is not None else [])))
    search["commentary"] = build_index("search/comm", comm_records, comm_text, shards=512)

    licenses_info = licenses.write()

    catalog = {
        "format": FORMAT,
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "modules": sorted(modules.values(), key=lambda m: (0 if m["id"] == "ARA" else 1 if m["id"] == "BLN4" else 2, fold(m["title"]))),
        "licenses": {"path": licenses_info["path"], "hash": licenses_info["hash"]},
        "bibles": bibles,
        "commentaries": commentaries,
        "xref": xref_info,
        "words": words_info,
        "lexicon": lex_info,
        "topics": topics_info,
        "docs": docs_info,
        "bookIntros": book_intros,
        "misc": misc_info,
        "agostinho": augustine,
        "models3d": three_d,
        "search": search,
        "repairs": repaired,
    }
    (OUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (GENERATED / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(s[2] for s in STATS)
    files = sum(s[1] for s in STATS)
    print(f"Dados gerados em {time.time() - started:.1f}s: {files} arquivos, {total / 1e6:.1f} MB")
    for path, count, size in sorted(STATS, key=lambda s: -s[2])[:25]:
        print(f"  {size / 1e6:8.2f} MB  {count:6d} arquivos  {path}")
    return catalog


def build_index(path: str, records: list[list], texts: list[str], shards: int) -> dict:
    pack = Pack(path)
    postings: dict[int, dict[str, list[int]]] = defaultdict(dict)
    for index, text in enumerate(texts):
        for token in set(tokens(text)):
            postings[shard_of(token, shards)].setdefault(token, []).append(index)
    for shard, table in postings.items():
        encoded = {}
        for token, ids in table.items():
            previous = 0
            deltas = []
            for value in ids:
                deltas.append(value - previous)
                previous = value
            encoded[token] = deltas
        pack.put(f"p/{shard}.json", encoded)
    chunk = 1000
    for start in range(0, len(records), chunk):
        pack.put(f"r/{start // chunk}.json", records[start:start + chunk])
    info = pack.write()
    info.update({"shards": shards, "records": len(records), "chunk": chunk})
    return info


def patch_viewer(source: str) -> str:
    """Visualizador 3D original + carregamento de modelos importados e movimento reduzido."""
    extra = """
<script>
window.addEventListener('message',function(event){
  if(event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
  if(event.data.channel!=='biblia3d'||event.data.name!=='buffer'||!(event.data.value instanceof ArrayBuffer))return;
  try{setup(event.data.value);tellFlutter('ready')}catch(e){tellFlutter('Falha no modelo 3D: '+e)}
});
if(new URLSearchParams(location.search).get('reduced')==='1'){try{reduceMotion(true)}catch(_){}}
</script>"""
    if "</body>" not in source:
        raise SystemExit("viewer_immersive.html inesperado")
    return source.replace("</body>", extra + "</body>", 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    if (ASSETS / "private").exists():
        # A pasta privada nunca e lida; esta verificacao apenas documenta a regra.
        pass
    build()


if __name__ == "__main__":
    sys.exit(main())
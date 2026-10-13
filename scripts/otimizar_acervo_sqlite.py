#!/usr/bin/env python3
"""Prepara indices FTS5 sem duplicar o texto original.

Substitui FTS com conteudo copiado por FTS "external content", reconstruindo
os indices e instalando gatilhos para futuras importacoes. Executar ANTES do
Flutter build (Android e Web). NAO modifica personal.sqlite, ARA ou anotações.
"""
from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "content"
SPECS = {
    "catalogue": ("verse_search", "verses",
                  ("translation", "reference", "text"), ("translation", "reference"),
                  "unicode61 remove_diacritics 2"),
    "library": ("commentary_search", "commentary_entries",
                ("id", "module_id", "title", "body"), ("id", "module_id"),
                "unicode61 remove_diacritics 2"),
    "lexicon": ("lexical_search", "lexemes",
                ("id", "lemma", "transliteration", "gloss", "definition"), ("id",),
                "unicode61 remove_diacritics 2"),
    "portuguese": ("translation_search", "translations",
                   ("type", "id", "title", "gloss", "body"), ("type", "id"),
                   "unicode61 remove_diacritics 2"),
}


def prepare(name: str) -> None:
    path = ROOT / (name + ".sqlite")
    if not path.is_file():
        raise SystemExit(f"Banco ausente: {path}")
    index, content, columns, unindexed, tokenizer = SPECS[name]
    db = sqlite3.connect(path)
    try:
        old = db.execute("SELECT sql FROM sqlite_master WHERE name=?", (index,)).fetchone()
        if not old:
            raise SystemExit(f"Indice esperado nao existe: {index} em {name}")
        if f"content='{content}'" not in old[0]:
            # O FTS de vocabulário depende do índice de versículos.
            if name == "catalogue":
                db.execute("DROP TABLE IF EXISTS verse_vocab")
            db.execute(f"DROP TABLE {index}")
            terms = ",".join(f"{column} UNINDEXED" if column in unindexed else column
                             for column in columns)
            db.execute(f"CREATE VIRTUAL TABLE {index} USING fts5("
                       f"{terms},content='{content}',content_rowid='rowid',"
                       f"tokenize='{tokenizer}')")
            db.execute(f"INSERT INTO {index}({index}) VALUES('rebuild')")
            if name == "catalogue":
                db.execute("CREATE VIRTUAL TABLE verse_vocab USING fts5vocab(verse_search,'row')")
        vals = ",".join(columns)
        new_values = ",".join(f"new.{v}" for v in columns)
        old_values = ",".join(f"old.{v}" for v in columns)
        # Triggers no proprio banco de origem, sincronizados pelo SQLite.
        trigger_prefix = f"optimized_{index}"
        db.executescript(f"""
CREATE TRIGGER IF NOT EXISTS {trigger_prefix}_ai AFTER INSERT ON {content}
BEGIN
  INSERT INTO {index}(rowid,{vals}) VALUES(new.rowid,{new_values});
END;
CREATE TRIGGER IF NOT EXISTS {trigger_prefix}_ad AFTER DELETE ON {content}
BEGIN
  INSERT INTO {index}({index},rowid,{vals})
  VALUES('delete',old.rowid,{old_values});
END;
CREATE TRIGGER IF NOT EXISTS {trigger_prefix}_au AFTER UPDATE ON {content}
BEGIN
  INSERT INTO {index}({index},rowid,{vals})
  VALUES('delete',old.rowid,{old_values});
  INSERT INTO {index}(rowid,{vals}) VALUES(new.rowid,{new_values});
END;
""")
        db.commit()
        db.execute(f"INSERT INTO {index}({index}) VALUES('optimize')")
        db.commit()
        db.execute("VACUUM")
        result = db.execute("PRAGMA integrity_check").fetchone()[0]
        if result != "ok":
            raise RuntimeError(f"Integridade SQLite invalida: {name}: {result}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        (ROOT / (name + ".sha256")).write_text(digest + "\n")
        print(f"{name}: {path.stat().st_size / 1e6:.1f} MB — integridade OK")
    finally:
        db.close()


if __name__ == "__main__":
    for database in SPECS:
        prepare(database)
    print("Indices FTS5 compactados. Verifique licencas antes de publicar.")

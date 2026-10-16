"""Testes do pré-build sem gerar nem alterar o acervo do repositório."""
import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ensure_content import missing_content


class ContentPreflightTests(unittest.TestCase):
    def test_clone_without_generated_files_is_incomplete(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            p = root / "assets/content/apologetica-editorial.json"
            p.parent.mkdir(parents=True)
            p.write_text(json.dumps({"profiles": {
                f"target_{n}": {"axes": ["specific subject"]}
                for n in range(30)
            }}), encoding="utf-8")
            missing = missing_content(root)
            self.assertIn("dossiê ausente: target_0", missing)
            self.assertIn("Confissões de Agostinho: 13 livros/278 capítulos", missing)

    def test_fully_prepared_valid_data_does_not_regenerate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            assets = root / "assets"
            profiles = {f"target_{n}": {"axes": [f"subject {n}"]} for n in range(30)}
            p = assets / "content/apologetica-editorial.json"
            p.parent.mkdir(parents=True)
            p.write_text(json.dumps({"profiles": profiles}), encoding="utf-8")
            reformada = assets / "apologetica_reformada"
            reformada.mkdir()
            for n in range(30):
                (reformada / f"target_{n}.md").write_text(
                    f"subject {n}\n" + "Conteúdo editorial revisado. " * 300,
                    encoding="utf-8"
                )
            aug = assets / "agostinho"
            aug.mkdir()
            chapters = [20, 10, 12, 16, 19, 16, 21, 12, 38, 43, 29, 32, 10]
            self.assertEqual(sum(chapters), 278)
            (aug / "manifest.json").write_text(
                json.dumps({"chapterCount": 278, "chapterCounts": chapters}), encoding="utf-8"
            )
            for n, count in enumerate(chapters, 1):
                (aug / f"{n}.json").write_text(
                    json.dumps({"book": n, "chapters": [{}] * count}), encoding="utf-8"
                )
            self.assertEqual(missing_content(root), [])
            (reformada / "target_7.md").write_text("incompleto", encoding="utf-8")
            self.assertIn("dossiê incompleto: target_7", missing_content(root))


if __name__ == "__main__":
    unittest.main()

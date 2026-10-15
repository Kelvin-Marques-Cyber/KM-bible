#!/usr/bin/env python3
"""Reescreve dossiês presbiterianos com eixos próprios por tradição.

Os 30 perfis e seus 240 contrastes autorais estão em
assets/content/apologetica-editorial.json. A explicação da tradição é
extraída do panorama impessoal editorial existente, SEM transformá-lo em
declaração confessional. Textos do estudo já atribuídos às fontes são usados
como contraponto. Nenhum trecho é atribuído falsamente a uma fonte primária.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "content"
BASE = ASSETS / "apologetica"
OUT = ASSETS / "apologetica_reformada"
EXTRA = ASSETS / "apologetica_extra"
TOPICS = (
    ("origins", "História, identidade e a alegação de continuidade", "CFW 1 e 25",
     "Atos 17:11; Gálatas 1:8-9"),
    ("sacred_texts", "Autoridade, textos e critérios de interpretação", "CFW 1",
     "2 Timóteo 3:16-17; Atos 17:11"),
    ("ultimate_reality", "Deus, realidade última e linguagem teológica", "CFW 2 e 8",
     "João 1:1-18; Colossenses 1:15-20"),
    ("human_condition", "Pessoa humana, culpa e restauração", "CFW 4 e 6",
     "Gênesis 1:26-27; Romanos 3:23"),
    ("salvation", "Graça, reconciliação e finalidade da vida", "CFW 8 e 11-13",
     "Efésios 2:8-10; Romanos 3:21-26"),
    ("worship", "Culto, ritos e mediação", "CFW 21 e 27-29",
     "João 4:23-24; 1 Timóteo 2:5"),
    ("morality", "Ética, justiça e vida comunitária", "CFW 16 e 19",
     "Miquéias 6:8; Tiago 2:14-17"),
    ("afterlife", "Morte, ressurreição e esperança futura", "CFW 32 e 33",
     "1 Coríntios 15:12-22; Hebreus 9:27"),
)


def read_json(filename: Path):
    return json.loads(filename.read_text(encoding="utf-8"))


def baseline_sections(text: str) -> list[str]:
    """Pega oito capítulos reais já existentes; não recompõe a doutrina alheia."""
    sections = re.split(r"\n## (?!#)", text)
    if len(sections) < 9:
        raise ValueError("Panorama sem oito capítulos documentados")
    return [s.strip() for s in sections[1:9]]


def sources(study: dict) -> str:
    seen = set()
    links = []
    for source in study.get("sources", []):
        if not isinstance(source, dict):
            continue
        url = str(source.get("url") or "")
        if not url.startswith(("https://", "http://")) or url in seen:
            continue
        seen.add(url)
        title = str(source.get("title") or "Fonte documental").replace("[", "").replace("]", "")
        links.append(f"- [{title}]({url})")
        if len(links) == 2:
            break
    return "\n".join(links)


def main() -> None:
    profiles = read_json(SOURCE / "apologetica-editorial.json")["profiles"]
    courses = read_json(SOURCE / "religion-curricula.json")
    originals = read_json(SOURCE / "studies.json")
    expansion = read_json(SOURCE / "editorial-expansion.json")["studies"]
    studies = {item["id"]: item for item in originals + expansion}
    lookup = {course["target"]: course for course in courses}
    if len(profiles) != 30 or len(set(profiles)) != 30:
        raise SystemExit("São necessários exatamente 30 perfis editoriais distintos.")

    OUT.mkdir(parents=True, exist_ok=True)
    counts = {}
    fingerprints = set()
    for target, profile in profiles.items():
        baseline = BASE / f"{target}.md"
        if not baseline.is_file():
            raise SystemExit(f"Panorama original não encontrado: {target}")
        sections = baseline_sections(baseline.read_text(encoding="utf-8"))
        axes = profile["axes"]
        if len(axes) != 8 or len(set(axes)) != 8:
            raise SystemExit(f"Oito eixos distintos são obrigatórios: {target}")
        name = lookup.get(target, {}).get("name") or profile["visual"][0]
        lessons = lookup.get(target, {}).get("lessons") or []
        if lessons and len(lessons) != 8:
            raise SystemExit(f"Currículo incompleto: {target}")
        chapters = [
            f"# {name} — argumentação presbiteriana aprofundada",
            "",
            "> Leitura confessional reformada, identificada como tal. Não é texto oficial "
            "da tradição analisada. As descrições abaixo provêm dos panoramas editoriais "
            "com fontes e devem ser verificadas nas publicações representativas.",
            "",
            "## O problema teológico específico",
            "",
            profile["lead"].strip(),
            "",
            "A avaliação distingue afirmações documentadas, a resposta proposta pela "
            "teologia presbiteriana e objeções que merecem análise. Referências bíblicas "
            "e capítulos da Confissão de Fé de Westminster são pontos de leitura, "
            "não prova de que o interlocutor partilhe da autoridade desses textos.",
        ]
        for i, ((topic, section_title, confession, biblical), axis) in enumerate(zip(TOPICS, axes)):
            lesson = studies.get(lessons[i], {}) if lessons else {}
            if lesson and lesson.get("topic") != topic:
                raise SystemExit(f"Tema de curso fora de ordem: {target}:{topic}")
            # O próprio panorama impessoal apresenta argumentos e termos
            # diferentes por tradição; NÃO recuperamos o suplemento genérico.
            baseline_body = sections[i]
            body = baseline_body.split("\n", 1)[1].strip() if "\n" in baseline_body else baseline_body
            # Nações afro-brasileiras e tradições indígenas não têm currículo
            # uniforme. Mantemos todo o segmento detalhado e não inventamos
            # fontes primárias que o arquivo não contém.
            if lesson:
                sentences = re.split(r"(?<=[.!?])\s+(?=[A-ZÀ-Ý])", body)
                description = " ".join(sentences[:8])
                # Os panoramas de referência têm cerca de 800 caracteres por
                # tópico; respeitar ao menos 540 evita resumos vazios.
                if len(description) < 540:
                    description = body
                # Resposta editorial existente: só a primeira formulação, não
                # os exercícios repetidos depois dos subtítulos.
                response = str(lesson.get("response", "")).split("\n\n**", 1)[0].strip()
                objection = str(lesson.get("strongest", "")).strip()
                citation = sources(lesson)
            else:
                description = body
                response = ""
                objection = ""
                citation = ""
            chapters.extend([
                "", f"## {i + 1}. {section_title}", "",
                f"### O argumento na tradição estudada",
                "",
                description,
                "",
                "### A questão que uma leitura presbiteriana precisa enfrentar",
                "",
                axis.strip(),
                "",
            ])
            if response:
                chapters.extend([
                    "### O argumento bíblico e confessional",
                    "",
                    response,
                    "",
                    f"**Texto para confronto:** {biblical}. **Referência confessional:** {confession}. "
                    "Esses textos devem ser lidos integralmente, com atenção à exegese "
                    "e à objeção formulada na tradição estudada.",
                    "",
                ])
            else:
                chapters.extend([
                    "### Critério de avaliação confessional",
                    "",
                    f"Para examinar esse ponto sem reduzir uma comunidade a um estereótipo, "
                    f"confronte a questão concreta acima com {biblical} e {confession}. "
                    "A discordância presbiteriana refere-se às proposições demonstráveis, "
                    "não à dignidade dos praticantes, nem autoriza o uso de cerimônias "
                    "reservadas ou conhecimentos transmitidos sob confiança.",
                    "",
                ])
            if objection and i in (1, 4, 6):
                chapters.extend(["### Objeção que não pode ser ignorada", "", objection, ""])
            if citation:
                chapters.extend(["**Fontes e documentos que contextualizam a discussão:**", "", citation, ""])
            chapters.extend([
                f"**Pergunta para debate:** se a posição for interpretada nos termos "
                f"apresentados neste capítulo, que evidência textual e histórica seria "
                f"suficiente para sustentar — ou corrigir — a divergência entre ela e "
                f"a leitura presbiteriana em {topic.replace('_', ' ')}?",
                "",
            ])
        chapters.extend([
            "## Conclusão: convergências, diferenças e responsabilidade pastoral",
            "",
            f"O diálogo com {name} deve ser fiel à sua história e ao conteúdo que "
            f"seus representantes realmente sustentam. Neste dossiê, a primeira "
            f"questão decisiva é: {axes[0][0].lower() + axes[0][1:]} "
            f"A segunda não pode ser separada da esperança final: "
            f"{axes[-1][0].lower() + axes[-1][1:]}",
            "",
            "Uma convicção confessional não precisa simular neutralidade; precisa, "
            "porém, assumir claramente a origem dos seus critérios. O leitor deve "
            "conferir as fontes citadas, reconhecer o que a outra tradição aceita "
            "ou rejeita e conservar a liberdade de consciência e o respeito por "
            "pessoas de qualquer religião ou de nenhuma.",
            "",
        ])
        text = "\n".join(chapters).strip() + "\n"
        if len(text) < 7000:
            raise SystemExit(f"Dossiê de {target} abaixo de 7.000 caracteres: {len(text)}")
        if text.count("\n## ") < 10:
            raise SystemExit(f"Dossiê de {target} não tem estrutura completa.")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        if digest in fingerprints:
            raise SystemExit(f"Dossiê duplicado: {target}")
        fingerprints.add(digest)
        (OUT / f"{target}.md").write_text(text, encoding="utf-8")
        counts[target] = len(text)
    extra_index = EXTRA / "index.json"
    if extra_index.exists():
        original_index = read_json(extra_index)
        for item in original_index.get("profiles", []):
            if item["target"] in counts:
                item["reformed_addition"] = counts[item["target"]]
        extra_index.write_text(json.dumps(original_index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Dossiês específicos: {len(counts)} tradições; menor {min(counts.values())} "
          f"caracteres, maior {max(counts.values())}; 240 eixos distintos.")


if __name__ == "__main__":
    main()

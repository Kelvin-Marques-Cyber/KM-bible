#!/usr/bin/env python3
"""Gera panoramas imparciais extensos, a partir do acervo editorial auditavel.

Cada tradicao recebe >= 5000 caracteres, em UTF-8 e pt-BR.
Nao copia textos de sites externos nem atribui textos editoriais a fontes antigas.
Exposicoes dos curriculos foram escritas pelo projeto, com atribuição das fontes.
Não adiciona refutacao reformada aos panoramas imparciais.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "content"
DEST = ROOT / "assets" / "apologetica"
MIN_CHARS = 5000

TOPICS = [
    ("origins", "Formação histórica e diversidade interna"),
    ("sacred_texts", "Fontes, tradições orais e autoridade"),
    ("ultimate_reality", "Compreensão do sagrado e da realidade"),
    ("human_condition", "A pessoa humana e seus desafios"),
    ("salvation", "Transformação, libertação e finalidade da vida"),
    ("worship", "Práticas, ritos, símbolos e comunidade"),
    ("morality", "Ética, convivência e responsabilidade"),
    ("afterlife", "Morte, continuidade e horizontes de esperança"),
]
GUIDE = {
    "origins": (
        "A história desta tradição deve ser reconstruída a partir de seus próprios marcos, "
        "do contexto social e das transformações documentadas. Uma origem religiosa pode envolver "
        "muitas comunidades e movimentos, em vez de um único fundador ou data. Para compreender "
        "o assunto, compare relatos internos, estudos históricos e situações concretas. "
        "Identifique o período e a comunidade a que cada afirmação se refere; diferenças "
        "regionais e reorganizações posteriores não devem ser projetadas sobre os primeiros praticantes."
    ),
    "sacred_texts": (
        "O estudo das fontes começa pela pergunta sobre quem transmite e interpreta os ensinamentos. "
        "Além de escritos, algumas tradições reconhecem narrativas orais, práticas rituais, "
        "ensinamentos comunitários e testemunhos de mestres. É essencial distinguir texto original, "
        "tradução moderna, comentário e recepção histórica. Uma citação isolada raramente substitui "
        "a leitura de seu gênero, contexto, idioma, público e interpretação pela comunidade de origem. "
        "Quando não há um cânon comum, não se deve inventar um livro normativo para todo o grupo."
    ),
    "ultimate_reality": (
        "As palavras Deus, espírito, divindade, natureza, princípio e realidade última não têm "
        "automaticamente o mesmo significado em sistemas diferentes. A descrição deve preservar "
        "as categorias próprias da tradição e registrar variações internas. Pergunte se determinada "
        "afirmação descreve uma pessoa divina, uma pluralidade de poderes, uma realidade impessoal "
        "ou um uso simbólico da linguagem. O vocabulário cristão pode ajudar na comparação, mas "
        "não deve substituir a autodescrição da comunidade nem apagar desacordos filosóficos."
    ),
    "human_condition": (
        "Como um grupo entende nascimento, identidade, sofrimento, responsabilidade e relações "
        "humanas depende de sua história e de seu vocabulário religioso. Não traduza automaticamente "
        "seus conceitos para pecado original, karma ou ignorância, pois essas expressões pertencem "
        "a sistemas diferentes. Observe a relação entre o indivíduo, a comunidade, os ancestrais, "
        "a natureza e as obrigações recíprocas quando elas forem efetivamente reconhecidas. "
        "Distinguir uma prescrição doutrinária da prática observada evita transformar um ideal em "
        "retrato uniforme da experiência de todos os participantes."
    ),
    "salvation": (
        "A pergunta pela finalidade da vida precisa ser formulada de modo apropriado: nem toda "
        "tradição ensina um conceito equivalente à salvação cristã. Em alguns contextos, o objetivo "
        "pode ser libertação, sabedoria, reparação, equilíbrio, comunhão ou continuidade da vida. "
        "Descreva como os participantes nomeiam o bem esperado, por quais práticas o buscam e se "
        "existem diferentes caminhos reconhecidos. Depois, investigue como as escolas internas "
        "discordam sobre a relação entre ação, graça, conhecimento, transformação e pertencimento."
    ),
    "worship": (
        "Práticas religiosas devem ser entendidas com atenção ao lugar, à liderança, ao calendário, "
        "à linguagem e aos participantes. Um gesto externo semelhante pode ter sentidos diferentes "
        "em duas comunidades, e nem toda corrente considera necessários os mesmos ritos. Observe "
        "quem explica os símbolos, quais limites de participação existem e o que pode ser divulgado "
        "publicamente. A descrição não deve reduzir a vida comunitária a curiosidades, nem afirmar "
        "que uma prática local seja universal. Quando uma cerimônia é reservada, respeite sua "
        "confidencialidade e utilize apenas fontes publicadas legitimamente."
    ),
    "morality": (
        "A dimensão ética inclui ensinamentos formais e decisões concretas em famílias, trabalho "
        "e relações sociais. Diferencie princípios, normas comunitárias, interpretações de lideranças "
        "e condutas individuais. A presença de abusos ou conflitos históricos não elimina a obrigação "
        "de descrever os ideais proclamados; da mesma forma, um ideal não prova que todos o cumpram. "
        "Pergunte de onde vem a autoridade moral, como são resolvidos desacordos e como diferentes "
        "grupos abordam responsabilidade, justiça, compaixão e convivência plural."
    ),
    "afterlife": (
        "Nem todos os sistemas possuem uma doutrina detalhada ou consensual sobre o estado após "
        "a morte. Algumas comunidades conservam narrativas diversas sobre ancestralidade, "
        "ressurreição, renascimento, continuidade espiritual ou memória comunitária. "
        "Quando os dados forem insuficientes, informe a limitação em vez de preencher lacunas "
        "com crenças de outra tradição. Distinga esperança religiosa, símbolo ritual e explicação "
        "filosófica. Uma comparação responsável descreve o que uma fonte efetivamente afirma "
        "e identifica quando não existe consenso entre seus intérpretes."
    ),
}
SPECIAL = {
    "umbanda": {
        "name": "Umbanda",
        "intro": (
            "A Umbanda é uma família de expressões religiosas brasileiras, formada por "
            "encontros e debates entre matrizes africanas, indígenas, católicas e espíritas. "
            "Não é possível atribuir a todas as casas uma única teologia, linha de trabalho "
            "ou interpretação das entidades. Este panorama é uma síntese editorial de acesso "
            "público, não um texto sagrado, nem uma declaração oficial de todos os terreiros."
        ),
        "topics": [
            "Narrativas de formação frequentemente se referem ao início do século XX, mas pesquisadores e praticantes reconhecem antecedentes variados e processos locais. As histórias de fundação cumprem papéis identitários distintos. Para estudar uma comunidade, registre a localidade, a trajetória da casa, seus responsáveis e as fontes utilizadas, evitando falar da Umbanda como se fosse uma instituição centralizada.",
            "Em muitas casas, a transmissão de saberes acontece por vivência, fala, canto, memória ritual e orientação de lideranças. Há livros umbandistas, mas não existe um único cânon imposto a todas as correntes. Um texto publicado por determinado autor não pode ser automaticamente transformado na doutrina oficial de qualquer terreiro; até os nomes e explicações de linhas espirituais variam.",
            "Muitos praticantes falam de Deus, orixás, guias e entidades espirituais, mas a relação entre esses conceitos varia conforme a linha da casa. Algumas interpretações privilegiam categorias próximas do espiritismo; outras enfatizam as matrizes afro-brasileiras e suas particularidades. Não se deve confundir orixá, entidade e espírito desencarnado como se fossem sinônimos sempre equivalentes.",
            "A vida humana pode ser compreendida em relação à ancestralidade, ao cuidado comunitário e à busca de equilíbrio. Algumas casas dão destaque à evolução espiritual, enquanto outras explicam sofrimento e responsabilidade de modo diferente. Uma apresentação fiel verifica a posição do terreiro estudado, sem atribuir a todos um sistema único de dívida espiritual ou destino pessoal.",
            "Entre as finalidades frequentemente evocadas estão caridade, orientação, acolhimento, cura e equilíbrio, mas esses termos ganham sentidos próprios em cada comunidade. Não é adequado traduzir tais finalidades automaticamente por justificação, salvação ou mérito em linguagem protestante. A questão correta é como a própria casa explica o crescimento pessoal e a relação com o sagrado.",
            "Giras, cantos, defumações, pontos e atendimentos podem integrar a experiência de algumas casas, sem representar um roteiro obrigatório universal. Os nomes das entidades, os instrumentos e as regras internas podem ser diferentes. A explicação respeitosa de um rito exige ouvir seus praticantes, observar restrições de divulgação e evitar generalizações provenientes de vídeos descontextualizados.",
            "Caridade, solidariedade e respeito estão presentes em muitas apresentações públicas da Umbanda. Entretanto, a forma de viver esses valores pode depender da casa, de seu contexto histórico e de suas relações com a vizinhança. Ao estudar práticas morais, diferencie doutrina afirmada, serviço comunitário, respostas à intolerância e decisões particulares que não representam o conjunto.",
            "Algumas correntes apresentam continuidade espiritual, desenvolvimento após a morte e vínculos com ancestrais, mas a linguagem e a ênfase não são idênticas em todas elas. Uma pesquisa cuidadosa pergunta o que determinada casa ensina e evita atribuir a todos os umbandistas uma sequência única de etapas após a morte. O silêncio de uma fonte não deve ser preenchido com doutrina alheia."
        ],
        "sources":[
            ("Universidade Federal de Santa Catarina — estudo de vivência umbandista no Ceará",
             "https://periodicos.ufsc.br/index.php/emtese/article/view/94168"),
            ("Revista Estudos Avançados (USP) — Candomblé e Umbanda no Brasil",
             "https://revistas.usp.br/eav/pt_BR/article/view/10033"),
            ("Universidade de São Paulo — pluralidade da Umbanda",
             "https://repositorio.usp.br/item/002928619"),
        ],
    },
    "candomble": {
        "name": "Candomblé",
        "intro": (
            "Candomblé designa tradições de matriz africana organizadas historicamente "
            "no Brasil, com comunidades, nações e heranças rituais diversas. "
            "Termos empregados numa casa de tradição ketu podem não corresponder "
            "perfeitamente aos usados numa comunidade de outra nação. "
            "Este panorama é uma descrição editorial inicial; não substitui a palavra "
            "de sacerdotes e sacerdotisas nem torna públicos saberes reservados."
        ),
        "topics": [
            "A formação dos candomblés está ligada à diáspora africana e à reconstrução de vínculos culturais em condições históricas de violência e resistência. As nações e linhagens preservam repertórios próprios. Uma narrativa sobre a história de um terreiro não deve ser universalizada; a trajetória regional, os fundadores e a transmissão de autoridade precisam ser identificados documentalmente.",
            "O conhecimento pode circular por cantos, narrativas, aprendizagem prática, idiomas rituais e orientação de mais velhos. Não existe um livro único que substitua essas formas de transmissão em todas as nações. Publicações acadêmicas ou populares ajudam na pesquisa, mas não conferem autorização para revelar práticas reservadas. Cada citação deve registrar nação, casa e contexto quando conhecidos.",
            "Orixás, voduns e inquices são categorias associadas a tradições e nações distintas, sem equivalência automática entre todos os nomes. A compreensão da relação entre divindade, natureza, ancestralidade e comunidade não pode ser reduzida a esquemas de outra religião. A pesquisa deve distinguir vocabulários e interpretações internos, e tratar com cuidado traduções de termos ritualísticos.",
            "A pessoa e sua trajetória são frequentemente compreendidas no contexto de vínculos, obrigações, iniciação, comunidade e continuidade histórica. Essas relações não devem ser convertidas por simples analogia em pecado original ou mérito individual. As formas concretas de cuidado, orientação e pertencimento variam e precisam ser apresentadas com base em fontes vinculadas às comunidades descritas.",
            "Equilíbrio, pertencimento, vínculo com o sagrado e manutenção da vida comunitária podem orientar práticas em determinados terreiros. Não é correto supor que exista uma doutrina universal de salvação semelhante à de igrejas cristãs. Para cada fonte, investigue o modo como os praticantes descrevem obrigações, amadurecimento, ancestralidade e relação com as divindades de sua tradição.",
            "Ritos iniciáticos, cantos, dança, alimentos e elementos do espaço sagrado possuem significados específicos e nem sempre públicos. Expor detalhes reservados sem autorização da comunidade é inadequado. O respeito ao terreiro inclui reconhecer que a vivência ritual não pode ser reconstruída apenas por fotografias, transcrições ou descrições retiradas do ambiente que lhes dá sentido.",
            "Ética comunitária, respeito aos mais velhos, transmissão de responsabilidades e cuidado mútuo podem integrar a vida de terreiros. Não há uma autoridade central que unifique todas as decisões locais. A experiência do racismo e da intolerância também faz parte da história social das comunidades, mas não deve reduzir uma tradição religiosa apenas à condição de vítima ou resistência.",
            "Sobre morte e continuidade, há conhecimentos e narrativas relacionados a ancestralidade e memória, porém seus sentidos dependem da nação e da casa. Não se deve impor uma escatologia única aos vários candomblés nem divulgar ensinamentos rituais reservados. O material público pode indicar categorias para pesquisa, mas não substituir a orientação de representantes da comunidade específica."
        ],
        "sources":[
            ("Universidade Federal da Paraíba — relações entre Maracatu e religiões afro-brasileiras",
             "https://periodicos.ufpb.br/index.php/dr/article/view/32971"),
            ("USP — pesquisa de Reginaldo Prandi sobre Candomblé e Umbanda",
             "https://revistas.usp.br/eav/pt_BR/article/view/10033"),
            ("IPHAN — patrimônios imateriais e transmissão comunitária",
             "https://www.gov.br/iphan/pt-br/patrimonio-cultural/patrimonio-imaterial"),
        ],
    },
    "indigenous_traditions": {
        "name": "Tradições religiosas de povos indígenas",
        "intro": (
            "A expressão tradições indígenas reúne povos e contextos muito diferentes. "
            "Não existe religião indígena brasileira única, nem livro, conselho ou fundador "
            "comum a todos. Estudos responsáveis começam identificando o povo, "
            "a língua, o território e os próprios autores indígenas. "
            "Esta apresentação é um roteiro de diversidade, não uma doutrina única "
            "atribuível a centenas de sociedades."
        ),
        "topics": [
            "A história de cada povo precede em muitos casos a formação do Estado brasileiro. Contato, deslocamentos, missões religiosas e transformações territoriais afetam sua memória histórica, mas não anulam sua agência. Ao estudar origens, busque narrativas produzidas por pessoas do povo em questão e diferencie tradição ancestral de relatos escritos por agentes externos em épocas coloniais.",
            "Conhecimentos e narrativas podem circular por línguas, cantos, histórias, aprendizagem e práticas coletivas, com regras próprias de acesso. A escrita acadêmica não substitui a autoria indígena. Certos materiais devem permanecer restritos à comunidade. Ao citar uma fonte, identifique quem a registrou, a autorização de divulgação e o contexto, evitando tratar uma narrativa como válida para todos os povos.",
            "Cosmologias indígenas podem articular seres, lugares, relações, ancestrais e ambiente de maneiras diversas. A palavra espírito usada em tradução portuguesa não descreve automaticamente as mesmas categorias em todas as línguas. Alguns povos apresentam narrativas de criadores ou transformadores; outros possuem estruturas diferentes. Para entender uma cosmologia, é preciso investigar seu vocabulário próprio.",
            "A pessoa frequentemente é descrita por meio de relações sociais, história familiar, território e conhecimentos compartilhados, mas cada povo possui suas concepções. Não é adequado projetar a ideia ocidental de indivíduo isolado sobre toda experiência indígena. Também é importante reconhecer que pessoas indígenas podem participar de tradições cristãs ou outras religiões sem perder sua identidade étnica.",
            "Equilíbrio, proteção, cura e continuidade da vida podem aparecer em diferentes sistemas, porém não são conceitos universais. A pesquisa deve perguntar diretamente à comunidade qual finalidade atribui às práticas e relações. Não se deve presumir que todos os povos aceitam uma doutrina de libertação, salvação ou renascimento. Distinga categorias locais e relatos de observadores externos.",
            "Rituais, festas, narrativas, relações com paisagens e saberes de especialistas podem variar amplamente. Algumas práticas são abertas, outras são restritas por regras culturais. Fotografias ou vídeos divulgados sem contexto não explicam o significado da experiência. Consulte fontes produzidas pelos próprios povos e respeite eventuais restrições de uso de nomes, imagens e cantos.",
            "A convivência pode envolver reciprocidade, cuidado coletivo, partilha, responsabilidade com os mais velhos e vínculos com lugares, dependendo da sociedade estudada. São inadequadas generalizações românticas que apresentem todo povo indígena como moralmente uniforme ou sempre em harmonia absoluta. Os critérios de organização e decisão devem ser descritos com suas referências históricas específicas.",
            "Concepções sobre morte, ancestralidade e continuidade podem ser muito diferentes entre povos e inclusive entre narrativas de uma mesma comunidade. A ausência de documentação publicada não autoriza inventar uma doutrina coletiva. Algumas concepções são transmitidas em situações ritualizadas ou reservadas. A apresentação pública deve limitar-se a informações que os próprios detentores do conhecimento autorizem."
        ],
        "sources":[
            ("ISA — Quem são os povos indígenas no Brasil",
             "https://pib.socioambiental.org/pt/Quem_s%C3%A3o"),
            ("ISA — Modos de vida",
             "https://pib.socioambiental.org/pt/Modos_de_vida"),
            ("IPHAN — conceito de patrimônio imaterial",
             "https://www.gov.br/iphan/pt-br/patrimonio-cultural/patrimonio-imaterial"),
        ],
    },
}


def clean_exposition(text: str) -> str:
    s = str(text or "").split("**Roteiro de aprofundamento:**", 1)[0]
    return s.strip()


def escape_md(text: str) -> str:
    return text.strip()


def as_source(entry) -> tuple[str, str] | None:
    if not isinstance(entry, dict):
        return None
    url = str(entry.get("url") or "").strip()
    if not url.startswith(("https://", "http://")):
        return None
    return str(entry.get("title") or url).strip(), url


def generate(*, preserve_existing: bool = False) -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    curricula = json.loads((SOURCE / "religion-curricula.json").read_text())
    expansions = json.loads((SOURCE / "editorial-expansion.json").read_text())["studies"]
    originals = json.loads((SOURCE / "studies.json").read_text())
    studies = {str(s["id"]): s for s in originals + expansions}
    index = []
    for course in curricula:
        target = course["target"]
        name = course["name"]
        lessons = [studies[k] for k in course["lessons"] if k in studies]
        if len(lessons) < 8:
            raise SystemExit(f"Currículo incompleto ({target}): {len(lessons)} lições")
        headings = [
            "# " + name + " — panorama impessoal aprofundado",
            "",
            "**Natureza:** panorama editorial em português. Não é escritura original, tradução oficial, "
            "nem uma declaração adotada por todas as comunidades. A exposição apresenta como uma "
            "tradição pode descrever seus próprios conceitos, sem refutação reformada.",
            "",
            clean_exposition(course.get("scope", "")),
            "",
            "Este acervo distingue história, doutrina, práticas e diversidade interna. "
            "As fontes indicadas permitem conferir o conteúdo; sua presença não confere "
            "autorização para copiar ou traduzir integralmente livros de terceiros. "
            "Termos semelhantes entre religiões não significam identidade de crença. "
            "Cada seção deve ser interpretada levando em conta a comunidade e a edição "
            "documental efetivamente descritas.",
        ]
        sources = []
        seen = set()
        for (topic, label), study in zip(TOPICS, lessons):
            if study["topic"] != topic:
                raise SystemExit(f"Ordem incorreta do currículo {target}: {study['topic']} != {topic}")
            headings.extend([
                "",
                "## " + label,
                "",
                clean_exposition(study.get("exposition")),
                "",
                GUIDE[topic],
            ])
            for item in study.get("sources") or []:
                src = as_source(item)
                if src and src[1] not in seen:
                    seen.add(src[1])
                    sources.append(src)
        headings.extend(["", "## Fontes para conferência", ""])
        for title, url in sources:
            headings.append(f"- [{title}]({url})")
        headings.extend(["", "**Limite editorial:** este panorama reúne sínteses de estudo; não "
                         "se apresenta como transcrição literal de fontes religiosas. "
                         "Para o texto original, acesse as edições identificadas acima."])
        body = "\n".join(headings)
        if len(body) < MIN_CHARS:
            raise SystemExit(f"Texto insuficiente para {target}: {len(body)} caracteres")
        path = DEST / (target + ".md")
        if preserve_existing and path.is_file():
            body = path.read_text(encoding="utf-8").rstrip()
        else:
            path.write_text(body + "\n", encoding="utf-8")
        index.append({"id": target, "title": name, "characters": len(body),
                      "topics": len(lessons), "sources": len(sources),
                      "type": "editorial_impessoal", "file": path.name})
    for target, item in SPECIAL.items():
        if len(item["topics"]) != 8:
            raise SystemExit(f"Faltando tema específico: {target}")
        blocks = [
            "# " + item["name"] + " — panorama impessoal aprofundado",
            "", "**Natureza:** síntese de estudo editorial; não é texto religioso original nem "
            "declaração de autoridade central. Sua diversidade exige fontes locais.",
            "", item["intro"],
        ]
        for (topic, label), base in zip(TOPICS, item["topics"]):
            blocks.extend(["", "## " + label, "", base, "", GUIDE[topic]])
        blocks.extend(["", "## Fontes para aprofundamento", ""])
        for title, url in item["sources"]:
            blocks.append(f"- [{title}]({url})")
        blocks.extend(["", "**Limite editorial:** não atribuir toda essa descrição a uma única "
                       "comunidade. Ao publicar uma tradução ou transcrição de terceiros, verificar "
                       "permissões e atribuir corretamente a autoria."])
        body = "\n".join(blocks)
        if len(body) < MIN_CHARS:
            raise SystemExit(f"Texto insuficiente para {target}: {len(body)} caracteres")
        path = DEST / (target + ".md")
        if preserve_existing and path.is_file():
            body = path.read_text(encoding="utf-8").rstrip()
        else:
            path.write_text(body + "\n", encoding="utf-8")
        index.append({"id": target, "title": item["name"], "characters": len(body),
                      "topics": 8, "sources": len(item["sources"]),
                      "type": "editorial_impessoal", "file": path.name})
    (DEST / "index.json").write_text(json.dumps({
        "scope": "apologetica_impessoal",
        "min_characters": MIN_CHARS,
        "disclaimer": "Sínteses editoriais, não transcrições integrais de terceiros.",
        "profiles": index,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Panoramas impessoais: {len(index)}; mínimo efetivo: "
          f"{min(e['characters'] for e in index)} caracteres")
    if len(index) != 30:
        raise SystemExit(f"Esperados 30 perfis incluindo perspectivas sem currículo: {len(index)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preserve-existing", action="store_true",
                        help="Mantém os textos revisados e atualiza apenas o índice.")
    generate(preserve_existing=parser.parse_args().preserve_existing)

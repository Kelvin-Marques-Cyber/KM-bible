#!/usr/bin/env python3
"""Expande a APOL0GÉTICA do KM-bible sem substituir as fontes existentes.

Gera 30 suplementos impessoais >= 7000 caracteres ADICIONAIS e
30 dossiês confessionais reformados >= 3000 caracteres cada.
Bases: estudos PT-BR locais, currículos da tradição, comentários editoriais.
Nunca publica textos externos como se fossem transcrições autorizadas.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "assets" / "content"
BASE = ROOT / "assets" / "apologetica"
EXTRA = ROOT / "assets" / "apologetica_extra"
REFORMED = ROOT / "assets" / "apologetica_reformada"

TOPICS = (
    ("origins", "Origens, formação e diversidade"),
    ("sacred_texts", "Textos, transmissão e autoridade"),
    ("ultimate_reality", "Realidade última e linguagem religiosa"),
    ("human_condition", "Pessoa, condição humana e sofrimento"),
    ("salvation", "Transformação e finalidade da vida"),
    ("worship", "Práticas, ritos e comunidade"),
    ("morality", "Ética, justiça e relações sociais"),
    ("afterlife", "Morte, continuidade e esperança"),
)

# O objetivo destes textos é aumentar a profundidade ANALÍTICA, nunca fingir
# que possuímos uma tradução licenciada de fonte primária ainda não importada.
READINGS = (
    (
        "Ao apresentar uma origem, diferencie o relato que a comunidade conta de si mesma, "
        "a reconstrução histórica baseada em documentos e as interpretações de pesquisadores "
        "ou interlocutores. Essas camadas dialogam, mas não são intercambiáveis. Um relato "
        "fundador pode expressar identidade religiosa sem funcionar como uma cronologia "
        "moderna. Por sua vez, uma cronologia não esgota o significado que os participantes "
        "atribuem aos acontecimentos. Evite tratar a diversidade interna como erro a ser "
        "corrigido pelo editor: identifique datas, lugares, autores e a comunidade a que "
        "cada afirmação se refere. Narrativas mais recentes não devem ser projetadas "
        "automaticamente em épocas anteriores à sua formulação.",
        "Uma leitura histórica proveitosa acompanha instituições, movimentos, diásporas, "
        "contatos culturais e mudanças no vocabulário. Pergunte quando certas escolas "
        "passaram a definir oficialmente uma posição e como ela foi recebida por grupos "
        "distintos. Diferencie documento normativo e prática social observável. Se duas "
        "fontes divergem, apresente ambas e descreva sua proveniência; não escolha uma "
        "versão somente porque aparece primeiro nos mecanismos de busca. A maturidade "
        "do estudo está em explicar por que a discordância surgiu, quais dados a apoiam "
        "e quais pontos ainda exigem conferência, sem inventar uma unanimidade histórica."
    ),
    (
        "Fontes religiosas precisam ser descritas segundo sua função e seu lugar dentro "
        "da comunidade. Uma escritura, um comentário, uma exposição de mestre, um canto "
        "ritual, uma narrativa oral e uma publicação universitária não possuem "
        "automaticamente a mesma autoridade. Algumas tradições atribuem centralidade "
        "a uma coleção definida de escritos; outras dependem amplamente da aprendizagem "
        "com pessoas e práticas. Não confunda a existência de um livro popular com a "
        "adoção universal de seu conteúdo. Ao citar um documento, indique idioma, "
        "responsável pela edição, circunstância de produção e interpretação dos próprios "
        "participantes. Uma tradução moderna pode ajudar, mas não se torna o original.",
        "Faça três operações separadas: localize o enunciado na fonte, explique como "
        "ela o utiliza e registre uma interpretação alternativa quando documentada. "
        "Termos como revelação, tradição, cânon e ensinamento não possuem exatamente "
        "o mesmo alcance entre diferentes religiões. Também é necessário distinguir "
        "o conteúdo de um texto da autoridade que determinada escola lhe atribui. "
        "Quando o material é reservado, não reconstitua ensinamentos secretos por "
        "inferência nem publique transcrições sem autorização. A fidelidade documental "
        "inclui reconhecer limites de acesso e recusar citações cujo contexto não pode "
        "ser conferido. Isso melhora a pesquisa e respeita a autoria."
    ),
    (
        "Antes de traduzir ideias entre tradições, esclareça o sentido empregado "
        "para Deus, realidade, espírito, natureza, verdade, absoluto ou transcendência. "
        "Duas doutrinas podem utilizar uma palavra portuguesa semelhante para responder "
        "a perguntas distintas. O risco é tomar uma analogia didática como equivalência "
        "filosófica. Procure identificar se a fonte descreve uma pessoa, uma relação, "
        "um princípio, um processo, uma dimensão da experiência ou o limite da linguagem. "
        "Algumas escolas divergem entre si sobre esses pontos. A apresentação imparcial "
        "não deve impor teísmo, materialismo ou outra classificação a uma corrente "
        "apenas porque a linguagem do leitor favorece uma dessas categorias.",
        "É útil separar afirmações ontológicas — o que existe —, epistemológicas — como "
        "conhecemos — e práticas — como uma crença orienta a vida. Uma narrativa "
        "simbólica pode responder a uma questão existencial sem pretender funcionar "
        "como modelo científico. Em outras situações, a fonte afirma proposições "
        "literais e deve ser tratada como tal. Descreva o argumento na melhor versão "
        "encontrada, assinale as escolhas de tradução e só então compare conceitos. "
        "Não deduza uma contradição a partir de passagens que tratam de assuntos "
        "diferentes. O objetivo é reconstruir uma visão de mundo inteligível "
        "segundo os termos em que foi realmente formulada."
    ),
    (
        "A condição humana pode ser abordada em termos de corpo, identidade, memória, "
        "dever, parentesco, comunidade, sofrimento, liberdade ou relações com o mundo. "
        "O vocabulário varia profundamente. Não traduza conceitos de outras tradições "
        "automaticamente por pecado, queda, karma, ignorância ou mérito: primeiro "
        "verifique se essas categorias existem e qual função desempenham. Considere "
        "o modo como a pessoa é educada, a forma pela qual aprende responsabilidades "
        "e a relação entre decisões individuais e vínculos coletivos. Uma descrição "
        "de costumes também deve distinguir prescrições doutrinárias de hábitos "
        "observados numa época e lugar específicos.",
        "Pergunte como a tradição explica uma crise pessoal, que recursos de cuidado "
        "são reconhecidos e qual papel é atribuído à família, à comunidade ou a "
        "especialistas religiosos. Crenças não devem ser reduzidas a hipóteses "
        "psicológicas, e uma explicação religiosa do sofrimento não autoriza atribuir "
        "a seus adeptos aprovação moral da injustiça. Práticas concretas podem "
        "discordar dos próprios ideais enunciados; descreva essa tensão com fontes "
        "e datas, sem aplicá-la seletivamente a uma única religião. O estudo deve "
        "tornar visível como valores, instituições e experiências humanas se "
        "relacionam, inclusive quando existem desacordos internos."
    ),
    (
        "Não pressuponha uma definição universal de salvação. Algumas religiões "
        "articulam libertação, iluminação, reconciliação, cura, vida harmoniosa, "
        "comunhão ou transformação como fins distintos. Cosmovisões não religiosas "
        "podem não formular um destino último sobrenatural. Um bom estudo identifica "
        "a condição inicial, o bem pretendido, os caminhos indicados e a autoridade "
        "reconhecida para descrevê-los. A existência de práticas semelhantes em duas "
        "comunidades não demonstra que seus objetivos sejam iguais. Diferenças entre "
        "correntes internas também precisam ser atribuídas corretamente, em vez "
        "de substituídas por uma definição escolhida apenas por conveniência.",
        "Para comparar ideias sem achatá-las, separe o vocabulário dos meios e o "
        "vocabulário dos resultados. Pergunte que mudanças a fonte considera "
        "possíveis, se a vida coletiva é parte constitutiva do processo e qual "
        "papel é atribuído ao aprendizado, à experiência ou à iniciativa divina "
        "quando esses conceitos realmente aparecem. Evite transformar cada "
        "finalidade num equivalente funcional de justificação cristã. Registre "
        "o que é afirmado, o que é sugerido e o que não é abordado. Uma leitura "
        "completa apresenta a compreensão da própria tradição antes de fazer "
        "qualquer comparação externa, mantendo fontes e contextos acessíveis."
    ),
    (
        "Para compreender um rito, é insuficiente enumerar objetos e gestos. "
        "Pergunte quem participa, em que ocasião, qual papel é atribuído ao "
        "silêncio, à palavra, à música, ao corpo ou ao espaço e o que a comunidade "
        "diz que acontece naquela prática. Um gesto semelhante pode desempenhar "
        "papel completamente diferente em comunidades distintas. Também não é "
        "adequado presumir que toda tradição possua templos, sacerdotes ou "
        "cerimônias paralelas às do cristianismo. A pesquisa identifica quando "
        "uma prática é central, facultativa, regional ou reservada, sem transformar "
        "uma observação local na regra universal de um grupo diversificado.",
        "Vida comunitária é mais do que a soma de rituais. Examine liderança, "
        "transmissão de conhecimentos, aprendizagem entre gerações, formas de "
        "participação e transformações em contextos de migração. Fontes "
        "produzidas por observadores podem ajudar a documentar aspectos "
        "públicos, mas devem ser lidas ao lado dos relatos dos participantes. "
        "A divulgação de práticas reservadas sem autorização não é exigência "
        "legítima de um estudo completo; há diferença entre reconhecer a "
        "existência de saberes restritos e tentar reproduzi-los. Descreva "
        "as interpretações apresentadas publicamente e documente as "
        "variações, sem exotizar nem romantizar a vida religiosa."
    ),
    (
        "Sistemas éticos não são listas intercambiáveis de regras. Uma prática "
        "pode decorrer de virtudes, obrigações, concepções de comunidade, "
        "ensinamentos de autoridades ou reflexões filosóficas. Examine "
        "como a fonte justifica uma norma, a quem ela se aplica e como se "
        "resolvem os desacordos. A existência de valores que lembram princípios "
        "de outra religião não significa que possuam fundamentos idênticos. "
        "Evite atribuir a todos os seguidores a ação de determinada liderança "
        "ou avaliar uma doutrina apenas pelos erros de seus praticantes. "
        "De modo inverso, não trate o ideal proclamado como prova de que "
        "sempre se realizou historicamente.",
        "A pesquisa moral precisa lidar com casos concretos sem generalizações. "
        "Distingua um ensinamento normativo, sua interpretação atual, a conduta "
        "de indivíduos e contextos políticos ou sociais que condicionam a "
        "vida comunitária. Pergunte como responsabilidade, justiça, "
        "solidariedade e conflito são entendidos, sem presumir que as "
        "mesmas palavras tenham conteúdo idêntico em todos os sistemas. "
        "A descrição imparcial pode reconhecer abusos e controvérsias "
        "documentadas, desde que indique quem os praticou e por que "
        "não representam automaticamente a doutrina de toda uma tradição. "
        "Atribuição de fontes é parte da precisão ética do próprio estudo."
    ),
    (
        "A abordagem da morte exige especial precisão, porque se entrelaça "
        "com o luto, a memória comunitária e as esperanças pessoais. "
        "Algumas tradições formulam ensinamentos explícitos sobre "
        "ressurreição, renascimento, continuidade ou ancestrais; "
        "outras têm várias escolas, e determinadas perspectivas "
        "não afirmam uma existência consciente após a morte. "
        "Não complete lacunas com crenças retiradas de outra cultura. "
        "Identifique se uma fonte está descrevendo o mundo, oferecendo "
        "uma narrativa simbólica, definindo uma prática ritual ou "
        "registrando uma tradição oral. Cada gênero requer leitura "
        "adequada, inclusive quando o vocabulário parece familiar.",
        "Práticas funerárias não demonstram por si sós uma doutrina uniforme "
        "sobre a vida após a morte. Observe a relação entre a memória "
        "dos falecidos, os deveres dos vivos, a identidade individual "
        "e a continuidade do grupo. Em algumas comunidades, os temas "
        "envolvem saberes transmitidos em circunstâncias particulares "
        "e não disponíveis para publicação geral. Registre a diversidade "
        "dos relatos e os limites do material público. Uma explicação "
        "rigorosa não transforma incerteza em certeza nem apresenta "
        "um silêncio editorial como negação teológica. O respeito "
        "ao interlocutor inclui reconhecer a importância existencial "
        "dessas questões e evitar caricaturas."
    ),
)

REFORMED_METHOD = (
    "A argumentação presbiteriana distingue história institucional de "
    "autoridade normativa. Na tradição reformada, antiguidade, alcance "
    "geográfico e número de adeptos não decidem automaticamente a "
    "verdade de uma doutrina. O estudo deve apresentar o que o "
    "interlocutor afirma, identificar premissas verificáveis "
    "e expor por que a Escritura é utilizada como critério na "
    "teologia confessional (CFW 1). Divergências históricas "
    "devem ser documentadas e não substituídas por rótulos.",
    "A defesa reformada atribui às Escrituras autoridade normativa, "
    "mas isso não a dispensa de ler os textos conforme gênero, "
    "contexto e transmissão. Uma referência bíblica não "
    "resolve o debate por mera citação; é necessário explicar "
    "o argumento, reconhecer traduções e distinguir a autoridade "
    "aceita pelos presbiterianos daquela reconhecida por outros "
    "participantes. A CFW 1 deve ser estudada com as próprias "
    "passagens usadas em cada afirmação.",
    "Deus, revelação e criação são compreendidos a partir da fé "
    "trinitária reformada. Antes de refutar uma concepção diversa, "
    "é necessário esclarecer se o interlocutor fala de um ser "
    "pessoal, de um princípio, de múltiplos seres ou de outro "
    "tipo de realidade. Uma analogia entre sistemas não "
    "constitui identidade doutrinária. A crítica interna "
    "precisa demonstrar a alegada incompatibilidade entre "
    "proposições reais, não formular contradições artificiais.",
    "A teologia presbiteriana associa criação à imagem de Deus, "
    "responsabilidade moral, pecado e necessidade da graça. "
    "A comparação deve explicar essas doutrinas positivamente "
    "antes de avaliar sistemas diferentes. Não é adequado "
    "converter todos os conceitos alheios automaticamente em "
    "pecado original ou mérito. A dignidade dos interlocutores "
    "não depende da concordância sobre antropologia religiosa.",
    "Na soteriologia reformada, justificação, santificação "
    "e glorificação não são sinônimos. CFW 11–18 oferece "
    "uma estrutura para discutir os benefícios da obra de Cristo, "
    "a fé e a perseverança. Uma comparação honesta pergunta "
    "que fim a outra tradição realmente afirma buscar, "
    "em vez de presumir que todo caminho religioso equivale "
    "a uma versão da justificação pela fé. A objeção "
    "deve partir de uma proposição efetivamente ensinada.",
    "O culto presbiteriano é examinado em relação à Escritura "
    "e à comunidade da Igreja. Ao tratar de práticas "
    "religiosas diferentes, a defesa reformada precisa "
    "distinguir a avaliação confessional de uma prática "
    "e a descrição documental do que seus participantes "
    "acreditam que estão fazendo. Semelhanças externas "
    "entre ritos não demonstram igualdade de finalidade. "
    "Práticas reservadas exigem respeito, não inferência.",
    "A ética presbiteriana vincula obediência, gratidão "
    "e responsabilidade à ação da graça, sem transformar "
    "boas obras na causa meritória da justificação. "
    "Comparações morais devem distinguir ideais, "
    "interpretações e comportamentos. A falha de uma pessoa "
    "não demonstra automaticamente a falsidade de toda "
    "a doutrina de sua comunidade. A crítica confessional "
    "precisa oferecer argumentos e reconhecer seus limites.",
    "A esperança cristã de ressurreição e juízo final é "
    "afirmada no contexto da obra de Cristo, não a partir "
    "da suposição de que todas as religiões ensinam "
    "uma forma equivalente de vida após a morte. "
    "Um debate rigoroso confronta enunciados específicos "
    "e verifica como cada tradição os compreende. "
    "Questões sobre luto, ancestralidade e identidade "
    "pessoal devem ser tratadas com respeito."
)

FALLBACKS = {
    "umbanda": "A Umbanda possui casas e linhas diversas; não há uma autoridade única para todas as formulações doutrinárias.",
    "candomble": "Os candomblés possuem nações, casas e saberes transmitidos de formas distintas; não devem ser reduzidos a uma doutrina única.",
    "indigenous_traditions": "Povos indígenas possuem histórias e cosmovisões específicas; não existe uma religião indígena universal.",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def clean_exposition(s: str) -> str:
    return str(s or "").split("**Roteiro de aprofundamento:**", 1)[0].strip()


def usable_sources(study: dict) -> list[dict]:
    return [s for s in study.get("sources", []) if isinstance(s, dict)
            and str(s.get("url", "")).startswith(("https://", "http://"))]


def generate() -> None:
    EXTRA.mkdir(parents=True, exist_ok=True)
    REFORMED.mkdir(parents=True, exist_ok=True)
    courses = load_json(CONTENT / "religion-curricula.json")
    originals = load_json(CONTENT / "studies.json")
    expansion = load_json(CONTENT / "editorial-expansion.json")["studies"]
    studies = {s["id"]: s for s in originals + expansion}
    # Alvos adicionais possuem perfis próprios, mas nem sempre um currículo de
    # 8 lições — não atribuir uma doutrina uniforme a suas comunidades.
    courses += [{"target": target, "name": name, "lessons": []}
                for target, name in [
                    ("umbanda", "Umbanda"),
                    ("candomble", "Candomblé"),
                    ("indigenous_traditions", "Tradições religiosas de povos indígenas"),
                ]]
    index = []
    for course in courses:
        target, name = course["target"], course["name"]
        baseline = BASE / f"{target}.md"
        if not baseline.is_file():
            raise SystemExit(f"Panorama original ausente: {baseline}")
        before = baseline.read_text(encoding="utf-8")
        if len(before) < 5000:
            raise SystemExit(f"Panorama original muito curto: {target}")
        lessons = [studies[x] for x in course["lessons"]] if course["lessons"] else []
        neutral = [
            f"# {name} — pesquisa impessoal aprofundada",
            "",
            "Complemento editorial dos oito temas; não é transcrição, escritura ou "
            "tradução oficial. Diferencia a autodescrição religiosa de interpretações "
            "históricas e acadêmicas. Não inclui refutação reformada.",
        ]
        reform = [
            f"# {name} — argumentação presbiteriana aprofundada",
            "",
            "Posicionamento confessional da tradição reformada, não opinião neutra "
            "nem descrição oficial da religião estudada. As objeções e respostas "
            "precisam ser confrontadas com as fontes.",
        ]
        for i, (topic, title) in enumerate(TOPICS):
            study = lessons[i] if lessons else {}
            if lessons and study.get("topic") != topic:
                raise SystemExit(f"Tópico fora de ordem: {target}, {topic}")
            premise = clean_exposition(study.get("exposition", "")) or FALLBACKS.get(
                target, "A pesquisa requer fontes primárias atribuídas."
            )
            src = usable_sources(study)
            src_text = "\n".join(f"- [{s.get('title') or 'Fonte'}]({s['url']})"
                                 for s in src[:4])
            if not src_text:
                src_text = ("- Conferir os autores, comunidades e fontes próprias "
                            "antes de atribuir esta descrição como doutrina.")
            neutral += [
                "", f"## {i+1}. {title}", "",
                f"**Ponto de partida da pesquisa:** {premise}", "",
                READINGS[i][0], "", READINGS[i][1], "",
                f"**Questões específicas para estudar {name}:** qual comunidade, "
                f"escola ou autor sustenta o ponto de partida? Quais expressões "
                f"possuem sentido técnico e qual edição registra esse sentido? "
                f"Como distinguir o ensinamento publicamente reconhecido "
                f"de interpretações particulares e de descrições de terceiros? "
                f"Registre o resultado com contexto histórico, identificação "
                f"da fonte e consciência das variantes internas.", "",
                "**Documentos para conferência:**", src_text,
            ]
            response = str(study.get("response") or "").strip()
            objection = str(study.get("strongest") or "").strip()
            rejoinder = str(study.get("rejoinder") or "").strip()
            reform += [
                "", f"## {i+1}. {title}", "", REFORMED_METHOD[i], "",
                f"**Questão apologética relacionada:** "
                f"{response or 'Uma resposta reformada deve partir de textos bíblicos contextualizados e documentos confessionais.'}", "",
                f"**Objeção a enfrentar com seriedade:** "
                f"{objection or 'O interlocutor não precisa aceitar previamente os pressupostos da teologia reformada.'}", "",
                f"**Limites da réplica:** "
                f"{rejoinder or 'Uma crítica responsável preserva a autodescrição do interlocutor e reconhece aquilo que não demonstrou.'}",
                "", "**Fontes de comparação:**", src_text,
            ]
        neutral += [
            "", "## Orientações de uso", "",
            "Utilize este material como guia de pesquisa em português. Identifique "
            "obras, escolas, período, tradução e grau de consenso. Quando uma "
            "fonte não tiver licença para republicação, consulte-a por meio da "
            "referência indicada em vez de apresentá-la como texto integral.",
        ]
        reform += [
            "", "## Conclusão metodológica", "",
            "Reúna os argumentos por proposição, examine a Confissão de Fé "
            "de Westminster nas questões pertinentes e leia as passagens "
            "bíblicas em contexto. Separe descrição histórica, interpretação "
            "de quem segue a tradição e avaliação confessional reformada. "
            "Não atribua ao interlocutor uma tese que suas fontes não afirmam.",
        ]
        neutral_body = "\n".join(neutral).strip() + "\n"
        reform_body = "\n".join(reform).strip() + "\n"
        if len(neutral_body) < 7000:
            raise SystemExit(f"Suplemento impessoal curto: {target}: {len(neutral_body)}")
        if len(reform_body) < 3000:
            raise SystemExit(f"Dossiê reformado curto: {target}: {len(reform_body)}")
        (EXTRA / f"{target}.md").write_text(neutral_body, encoding="utf-8")
        (REFORMED / f"{target}.md").write_text(reform_body, encoding="utf-8")
        index.append({
            "target": target, "name": name,
            "base_characters": len(before),
            "impersonal_added": len(neutral_body),
            "impersonal_total": len(before) + len(neutral_body),
            "reformed_addition": len(reform_body),
            "sources": sum(len(usable_sources(s)) for s in lessons),
            "kind": "editorial_research_and_confessional_argument",
        })
    (EXTRA / "index.json").write_text(
        json.dumps({"count": len(index), "profiles": index}, ensure_ascii=False,
                   indent=2) + "\n", encoding="utf-8"
    )
    if len(index) != 30:
        raise SystemExit(f"Esperadas 30 tradições, obtidas {len(index)}")
    assert min(x["impersonal_added"] for x in index) >= 7000
    assert min(x["reformed_addition"] for x in index) >= 3000
    print(f"Apologética ampliada: {len(index)} tradições.")
    print(f"Menor acréscimo impessoal: "
          f"{min(x['impersonal_added'] for x in index)} caracteres.")
    print(f"Menor dossiê presbiteriano: "
          f"{min(x['reformed_addition'] for x in index)} caracteres.")


if __name__ == "__main__":
    generate()

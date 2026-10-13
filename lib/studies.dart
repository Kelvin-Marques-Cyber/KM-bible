import 'dart:convert';
import 'study_catalog.dart';
import 'agostinho.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'store.dart';
import 'notes.dart';
import 'religion_curricula.dart';

const topicTitles = {
  ...expandedTopicTitles,
  'sabbath': 'Sábado e Dia do Senhor',
  'baptism': 'Batismo e aliança',
  'salvation': 'Justificação e salvação',
  'evil': 'O problema do mal',
  'scripture': 'Escritura, fé e razão',
  'resurrection': 'Ressurreição de Cristo',
  'trinity': 'Trindade',
};
const traditionTitles = {
  ...expandedTraditionTitles,
  'presbyterian': 'Presbiteriana reformada',
  'baptist': 'Batista confessional',
  'seventh_day_adventist': 'Adventista do Sétimo Dia',
  'roman_catholic': 'Católica romana',
  'atheism': 'Ateísmo / objeções filosóficas',
};

class ConfessionsPage extends StatefulWidget {
  const ConfessionsPage({super.key});
  @override
  State<ConfessionsPage> createState() => _ConfessionsPageState();
}

class _ConfessionsPageState extends State<ConfessionsPage> {
  String code = 'WCF', query = '';
  late final Future<Map<String, dynamic>> _agostinho = rootBundle
      .loadString('assets/content/agostinho-confissoes-facil.json')
      .then((raw) => Map<String, dynamic>.from(jsonDecode(raw) as Map));
  int agostinhoLivro = 0; // Zero = todos os livros.

  Widget _agostinhoNoMesmoPainel(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _agostinho,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: SelectableText(
              'Não foi possível carregar o índice de Agostinho: '
              '${snapshot.error}',
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data!;
        final books = (data['books'] as List)
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        final chapters = <({
          int bookIndex,
          int chapter,
          Map<String, dynamic> book,
        })>[];
        for (var b = 0; b < books.length; b++) {
          final book = books[b];
          if (agostinhoLivro != 0 && book['number'] != agostinhoLivro) {
            continue;
          }
          final count = book['chapterCount'] as int;
          for (var chapter = 1; chapter <= count; chapter++) {
            if (query.isNotEmpty &&
                !fold(
                  'Livro ${book['number']} ${book['title']} '
                  'Capítulo $chapter',
                ).contains(fold(query))) {
              continue;
            }
            chapters.add((bookIndex: b, chapter: chapter, book: book));
          }
        }

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            const Text(
              '13 livros e 278 capítulos em português integral, '
              'sem resumos e disponíveis offline. '
              'Selecione um capítulo para ler aqui no aplicativo.',
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              key: ValueKey('agostinho-indice-livro-$agostinhoLivro'),
              isExpanded: true,
              initialValue: agostinhoLivro,
              decoration: const InputDecoration(
                labelText: 'Selecionar livro de Agostinho',
              ),
              items: [
                const DropdownMenuItem(
                  value: 0,
                  child: Text('Todos os 13 livros · 278 capítulos'),
                ),
                for (final book in books)
                  DropdownMenuItem(
                    value: book['number'] as int,
                    child: Text(
                      'Livro ${book['number']} · ${book['title']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (value) {
                if (value != null) {
                  setState(() => agostinhoLivro = value);
                }
              },
            ),
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: () => openAugustineSource(
                context,
                augustineFullEdition,
              ),
              icon: const Icon(Icons.menu_book_outlined),
              label: const Text('Consultar edição integral em português'),
            ),
            if (chapters.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Nenhum capítulo encontrado.'),
              ),
            for (final entry in chapters)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.auto_stories_outlined),
                title: Text(
                  'Livro ${entry.book['number']} · '
                  'Capítulo ${entry.chapter}',
                ),
                subtitle: Text(
                  '${entry.book['title']} · '
                  'Ler as palavras de Agostinho',
                ),
                trailing: const Icon(Icons.open_in_new),
                onTap: () {
                  context.app.store.setPref(
                    'agostinho_livro',
                    entry.bookIndex,
                  );
                  context.app.store.setPref(
                    'agostinho_capitulo',
                    entry.chapter - 1,
                  );
                  sheet(
                    context,
                    'Agostinho · Livro ' + (entry.bookIndex + 1).toString(),
                    const AugustineConfessionsPage(),
                  );
                },
              ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'Tradução de J. Oliveira Santos e A. Ambrósio de Pina. '
                'Edição Solus Ágape / Valdemar Teodoro Editor (2024), '
                'distribuída com atribuição conforme os créditos.',
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    final rows =
        a.store
            .documents(moduleId: code)
            .where(
              (r) =>
                  query.isEmpty ||
                  fold(
                    '${r['title']} ${r['body']} ${a.store.translatedEntry('document', r['id'] as String)?['body'] ?? ''}',
                  ).contains(fold(query)),
            )
            .toList()
          ..sort(
            (x, y) => (jsonMap(x['metadata'])['number'] as int? ?? 0).compareTo(
              jsonMap(y['metadata'])['number'] as int? ?? 0,
            ),
          );
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(
                code == 'AUG'
                    ? 'Confissões de Santo Agostinho: texto integral em português '
                      'por livro e capítulo, sem resumos, disponível offline. '
                      'Obra distinta dos padrões de Westminster.'
                    : 'Escrituras como regra suprema. Westminster como '
                      'padrão subordinado. Textos em português para estudo, '
                      'com o original histórico disponível para conferência.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  for (final c in [
                    ('WCF', 'Confissão · 33'),
                    ('WSC', 'Breve · 107'),
                    ('WLC', 'Maior · 196'),
                    ('AUG', 'Agostinho · 13 livros'),
                  ])
                    ChoiceChip(
                      label: Text(c.$2),
                      selected: code == c.$1,
                      onSelected: (_) => setState(() => code = c.$1),
                    ),
                ],
              ),
              TextField(
                decoration: InputDecoration(labelText: a.t('search')),
                onChanged: (v) => setState(() => query = v),
              ),
            ],
          ),
        ),
        Expanded(
          child: code == 'AUG'
              ? _agostinhoNoMesmoPainel(context)
              : ListView(
            children: rows
                .map(
                  (d) => ListTile(
                    title: Text(
                      code == 'WCF'
                          ? d['title'] as String
                          : 'Pergunta ${jsonMap(d['metadata'])['number']}',
                    ),
                    subtitle: Text(
                      (jsonMap(d['metadata'])['references'] as List? ?? [])
                          .map(
                            (r) =>
                                Reference.fromId(
                                  r.toString(),
                                )?.label(a.language) ??
                                r.toString(),
                          )
                          .join(' · '),
                    ),
                    onTap: () =>
                        sheet(context, d['title'] as String, DocumentPage(d)),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}

class StudiesBrowser extends StatefulWidget {
  final bool apologetic;
  const StudiesBrowser({super.key, required this.apologetic});
  @override
  State<StudiesBrowser> createState() => _StudiesBrowserState();
}

class _StudiesBrowserState extends State<StudiesBrowser> {
  int? level;
  String? topic, target;
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        rows = a.store.studies(topic: topic, target: target, level: level);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          widget.apologetic
              ? 'Estai sempre preparados para responder — 1 Pedro 3:15'
              : 'Conhecer cada posição por suas fontes e seus próprios argumentos.',
          style: const TextStyle(fontFamily: 'EBGaramond', fontSize: 23),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          children: [
            action(
              'Religiões por categoria',
              Icons.public,
              () => sheet(
                context,
                'Religiões e cosmovisões',
                ReligionCurriculaPage(apologetic: widget.apologetic),
              ),
            ),
            action(
              'Ciência e ateísmo',
              Icons.science_outlined,
              () => sheet(context, 'Ciência e ateísmo', const SciencePage()),
            ),
            action(
              a.t('apologists'),
              Icons.local_library,
              () => sheet(context, a.t('apologists'), const ApologistsPage()),
            ),
            action(
              a.t('arena'),
              Icons.forum_outlined,
              () => sheet(context, a.t('arena'), const ArenaPage()),
            ),
          ],
        ),
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              label: Text(a.t('all')),
              selected: level == null,
              onSelected: (_) => setState(() => level = null),
            ),
            for (var n = 1; n <= 3; n++)
              ChoiceChip(
                label: Text(
                  a.t(['beginner', 'intermediate', 'advanced'][n - 1]),
                ),
                selected: level == n,
                onSelected: (_) => setState(() => level = n),
              ),
          ],
        ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          initialValue: topic,
          decoration: InputDecoration(labelText: a.t('topic')),
          items: [
            DropdownMenuItem(value: null, child: Text(a.t('all'))),
            ...topicTitles.entries.map(
              (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
            ),
          ],
          onChanged: (v) => setState(() => topic = v),
        ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          isExpanded: true,
          initialValue: target,
          decoration: const InputDecoration(
            labelText: 'Tradição / perspectiva',
          ),
          items: [
            DropdownMenuItem(value: null, child: Text(a.t('all'))),
            ...traditionTitles.entries.map(
              (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
            ),
          ],
          onChanged: (v) => setState(() => target = v),
        ),
        const SizedBox(height: 18),
        ...rows.map(
          (r) => Card(
            child: ListTile(
              title: Text(r['title'] as String),
              subtitle: Text(
                '${a.t(['beginner', 'intermediate', 'advanced'][(r['level'] as int) - 1])} · ${traditionTitles[r['target']]}',
              ),
              leading: Icon(
                a.store.isCompleted(r['id'] as String)
                    ? Icons.check_circle_outline
                    : Icons.school_outlined,
              ),
              onTap: () => sheet(
                context,
                r['title'] as String,
                StudyPage(r, apologetic: widget.apologetic),
              ),
            ),
          ),
        ),
        if (rows.isEmpty) Text(a.t('noStudy')),
      ],
    );
  }
}

class StudyPage extends StatefulWidget {
  final RecordRow study;
  final bool apologetic;
  const StudyPage(this.study, {super.key, required this.apologetic});
  @override
  State<StudyPage> createState() => _StudyPageState();
}

class _StudyPageState extends State<StudyPage> {
  late bool apologetic;
  bool strongest = false, rejoinder = false;
  @override
  void initState() {
    super.initState();
    apologetic = widget.apologetic;
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        s = widget.study,
        refs = jsonList(
          s['refs'],
        ).map((x) => Reference.fromId(x as String)).whereType<Reference>();
    final sources = jsonList(s['sources']);
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              label: Text(a.t('apologetics')),
              selected: apologetic,
              onSelected: (_) => setState(() => apologetic = true),
            ),
            ChoiceChip(
              label: Text(a.t('impersonal')),
              selected: !apologetic,
              onSelected: (_) => setState(() => apologetic = false),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          '${a.t('impersonal')} · ${traditionTitles[s['target']]}',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 10),
        MarkdownText(s['exposition'] as String),
        if (apologetic) ...[
          const Divider(height: 36),
          Text(
            a.t('apologetics'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          MarkdownText(s['response'] as String),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => setState(() => strongest = !strongest),
            icon: const Icon(Icons.manage_search),
            label: Text(a.t('strongest')),
          ),
          if (strongest) MarkdownText(s['strongest'] as String),
          OutlinedButton.icon(
            onPressed: () => setState(() => rejoinder = !rejoinder),
            icon: const Icon(Icons.reply_all),
            label: Text(a.t('rejoinder')),
          ),
          if (rejoinder) MarkdownText(s['rejoinder'] as String),
        ] else ...[
          const Divider(height: 30),
          Text(
            'Como a posição selecionada responde às críticas',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          MarkdownText(s['strongest'] as String),
        ],
        const SizedBox(height: 16),
        TextButton.icon(
          onPressed: () => sheet(
            context,
            a.t('argumentCompare'),
            ListView(
              padding: const EdgeInsets.all(18),
              children: [
                Table(
                  border: TableBorder.all(
                    color: Theme.of(context).dividerColor,
                  ),
                  columnWidths: const {
                    0: FlexColumnWidth(1),
                    1: FlexColumnWidth(1),
                  },
                  children: [
                    TableRow(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(traditionTitles[s['target']]!),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(a.t('apologetics')),
                        ),
                      ],
                    ),
                    TableRow(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: MarkdownText(s['exposition'] as String),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: MarkdownText(s['response'] as String),
                        ),
                      ],
                    ),
                    TableRow(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: MarkdownText(s['strongest'] as String),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: MarkdownText(s['rejoinder'] as String),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                sourceLinks(context, sources),
              ],
            ),
          ),
          icon: const Icon(Icons.table_chart_outlined),
          label: Text(a.t('argumentCompare')),
        ),
        Wrap(
          spacing: 8,
          children: refs
              .map(
                (r) => action(
                  r.label(a.language),
                  Icons.menu_book,
                  () => showPassage(
                    context,
                    a.store.mapped('BLN4', r, a.translation) ?? r,
                  ),
                ),
              )
              .toList(),
        ),
        sourceLinks(context, sources),
        CheckboxListTile(
          value: a.store.isCompleted(s['id'] as String),
          onChanged: (v) {
            a.store.completed(s['id'] as String, v ?? false);
            a.refresh();
          },
          title: Text(a.t('completed')),
        ),
        action(
          a.t('note'),
          Icons.edit_note,
          () => openNewNote(
            context,
            title: s['title'] as String,
            body: 'Estudo: ${s['id']}\n\n',
            reference: s['id'] as String,
          ),
        ),
      ],
    );
  }
}

class ArenaPage extends StatefulWidget {
  const ArenaPage({super.key});
  @override
  State<ArenaPage> createState() => _ArenaPageState();
}

class _ArenaPageState extends State<ArenaPage> {
  String? studyId;
  String approach = 'presuppositional';
  int stage = 1;
  final response = TextEditingController();
  String? feedback;
  @override
  void dispose() {
    response.dispose();
    super.dispose();
  }

  void evaluate(RecordRow study) {
    final text = response.text;
    final refs = referencesIn(text),
        hasSource =
            text.contains('Westminster') ||
            text.contains('https://') ||
            text.contains('CFW');
    final results = <String>[];
    results.add(
      text.length < 150
          ? 'Desenvolva premissas e conclusão em vez de uma afirmação isolada.'
          : 'Identifique quais frases são premissas e qual é a conclusão.',
    );
    results.add(
      refs.isEmpty
          ? 'Inclua uma referência bíblica e explique seu contexto.'
          : 'Referências encontradas: ${refs.map((r) => r.label()).join(', ')}. Confira o contexto; a presença da referência não prova o argumento.',
    );
    results.add(
      hasSource
          ? 'Confira se a fonte citada sustenta sua afirmação.'
          : 'Identifique uma fonte confessional ou histórica.',
    );
    if (stage >= 2) {
      results.add(
        'Compare sua representação com a exposição descritiva do estudo.',
      );
    }
    if (stage >= 3) {
      results.add(
        'Apresente a objeção mais forte e uma resposta possível do interlocutor.',
      );
    }
    results.add(
      'Esta verificação avalia estrutura textual. Não julga a verdade teológica da resposta.',
    );
    setState(() => feedback = results.join('\n\n'));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        studies = a.store.studies(),
        s =
            studies.where((r) => r['id'] == studyId).firstOrNull ??
            studies.first;
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        DropdownButtonFormField<String>(
          initialValue: studyId ?? s['id'] as String,
          decoration: const InputDecoration(
            labelText: 'Objeção a ser estudada',
          ),
          items: studies
              .map(
                (r) => DropdownMenuItem(
                  value: r['id'] as String,
                  child: Text(
                    r['title'] as String,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          isExpanded: true,
          onChanged: (v) => setState(() => studyId = v),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: approach,
          decoration: InputDecoration(labelText: a.t('approach')),
          items: ['presuppositional', 'evidential', 'exegetical']
              .map((v) => DropdownMenuItem(value: v, child: Text(a.t(v))))
              .toList(),
          onChanged: (v) => setState(() => approach = v!),
        ),
        Wrap(
          spacing: 10,
          children: [
            for (var n = 1; n <= 3; n++)
              ChoiceChip(
                label: Text(
                  '$n · ${['Fundamentar', 'Responder', 'Debater'][n - 1]}',
                ),
                selected: stage == n,
                onSelected: (_) => setState(() => stage = n),
              ),
          ],
        ),
        Text(
          stage == 1
              ? 'Formule uma tese e duas premissas.'
              : stage == 2
              ? 'Represente a posição interlocutora e responda com fontes.'
              : 'Inclua objeção forte, resposta e réplica possível.',
        ),
        const SizedBox(height: 18),
        TextField(
          controller: response,
          minLines: 10,
          maxLines: null,
          decoration: InputDecoration(labelText: a.t('response')),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () => evaluate(s),
          child: Text(a.t('feedback')),
        ),
        if (feedback != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Text(feedback!),
          ),
        OutlinedButton(
          onPressed: () => sheet(
            context,
            s['title'] as String,
            StudyPage(s, apologetic: true),
          ),
          child: Text(a.t('argumentCompare')),
        ),
        action(a.t('save'), Icons.save_outlined, () {
          a.store.saveNote(
            title: 'Laboratório: ${s['title']}',
            body:
                'Abordagem: ${a.t(approach)}\nEtapa: $stage\n\n${response.text}\n\n${feedback ?? ''}',
            reference: s['id'] as String,
            notebook: 'Laboratório',
          );
          a.store.completed('arena:${s['id']}:$stage', true);
          a.refresh();
          message(context, a.t('success'));
        }),
      ],
    );
  }
}

const apologists = [
  {
    'name': 'Cornelius Van Til',
    'dates': '1895–1987',
    'text':
        'Professor presbiteriano de apologética em Westminster. Enfatizou a dependência do conhecimento humano em relação a Deus, a antítese entre compromissos últimos e a crítica interna de cosmovisões. Sua abordagem pressuposicional difere do uso de argumentos como provas autossuficientes em terreno religiosamente neutro.',
    'works': 'The Defense of the Faith; Christian Apologetics',
    'source': 'https://www.wts.edu/',
  },
  {
    'name': 'Greg L. Bahnsen',
    'dates': '1948–1995',
    'text':
        'Apologista reformado associado ao pressuposicionalismo de Van Til. Desenvolveu aplicações ao debate e à análise das condições de conhecimento. Sua defesa transcendental exige examinar premissas e alternativas; a aplicação não deve ser reduzida a insultos contra o interlocutor.',
    'works': 'Always Ready; Van Til’s Apologetic: Readings and Analysis',
    'source': 'https://www.cmfnow.com/',
  },
  {
    'name': 'Francis A. Schaeffer',
    'dates': '1912–1984',
    'text':
        'Pensador presbiteriano e fundador de L’Abri. Relacionou fé, filosofia, arte e cultura e enfatizou diálogo atento às pessoas. Não deve ser tratado como simples reprodução metodológica de Van Til ou Bahnsen.',
    'works':
        'The God Who Is There; Escape from Reason; He Is There and He Is Not Silent',
    'source': 'https://labri.org/',
  },
  {
    'name': 'João Calvino',
    'dates': '1509–1564',
    'text':
        'Reformador cuja teologia deu atenção ao conhecimento de Deus, à revelação e ao testemunho do Espírito. A tradição presbiteriana recebeu sua contribuição, sem identificar todas as práticas históricas de Genebra com normas permanentes para o presente.',
    'works': 'Institutas da Religião Cristã; comentários bíblicos',
    'source': 'https://www.ccel.org/ccel/calvin/institutes.html',
  },
  {
    'name': 'Herman Bavinck',
    'dates': '1854–1921',
    'text':
        'Teólogo reformado neerlandês. Tratou revelação, criação, conhecimento e vida cristã em relação orgânica. Sua dogmática dialoga com a filosofia de seu tempo e contribui para a reflexão apologética sem dissolver a identidade confessional.',
    'works': 'Reformed Dogmatics; Philosophy of Revelation',
    'source': 'https://www.ccel.org/ccel/bavinck/revelation.html',
  },
  {
    'name': 'Alvin Plantinga',
    'dates': 'n. 1932',
    'text':
        'Filósofo ligado à epistemologia reformada. Investigou garantia, função adequada e crença básica. Essa linha deve ser distinguida do pressuposicionalismo de Van Til. Um modelo de garantia não é, por si só, uma demonstração histórica do cristianismo.',
    'works': 'God and Other Minds; Warranted Christian Belief',
    'source':
        'https://global.oup.com/academic/product/warranted-christian-belief-9780195131932',
  },
];

class ApologistsPage extends StatelessWidget {
  const ApologistsPage({super.key});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(22),
    children: apologists
        .map(
          (a) => Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    a['name']!,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text(a['dates']!),
                  const SizedBox(height: 12),
                  Text(a['text']!),
                  const SizedBox(height: 12),
                  Text(a['works']!),
                  sourceLinks(context, [a['source']!]),
                  const Text(
                    'Resumo próprio e bibliografia. Obras protegidas não são reproduzidas neste catálogo.',
                    style: TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        )
        .toList(),
  );
}

class SciencePage extends StatelessWidget {
  const SciencePage({super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        rows = a.store.studies(target: 'atheism', topic: 'science');
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Ciência, filosofia e fé',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        const Text(
          'O laboratório examina dados científicos e argumentos sobre Deus, com a perspectiva reformada identificada. Cada estudo separa observações, inferências, objeções e reflexão. O ateísmo e o agnosticismo são tratados pelas posições que efetivamente sustentam.',
        ),
        const SizedBox(height: 16),
        for (final row in rows)
          feature(
            context,
            row['title'] as String,
            'Estudo com fontes · argumento e objeção mais forte',
            Icons.science_outlined,
            () => sheet(
              context,
              row['title'] as String,
              StudyPage(row, apologetic: true),
            ),
          ),
      ],
    );
  }
}

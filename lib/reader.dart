import 'library.dart';
import 'verse_study.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'portuguese_resources.dart';
import 'cross_references.dart';
import 'passage_picker.dart';
export 'passage_picker.dart';
import 'appearance.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import 'app.dart';
import 'domain.dart';
import 'store.dart';
import 'common.dart';
import 'notes.dart';
import 'linguistics.dart';
import 'explore.dart';
import 'memory.dart';

Future<void> choosePassage(BuildContext context) =>
    sheet(context, context.app.t('reference'), const PassagePicker());

class ReaderPage extends StatefulWidget {
  const ReaderPage({super.key});
  @override
  State<ReaderPage> createState() => _ReaderPageState();
}

class _ReaderPageState extends State<ReaderPage> {
  final positions = ItemPositionsListener.create();
  final scroll = ItemScrollController();
  List<RecordRow> rows = [];
  Map<String, int> colors = {};
  String cache = '';
  Set<String> selected = {};
  AppController? app;
  bool updating = false;
  @override
  void initState() {
    super.initState();
    positions.itemPositions.addListener(remember);
  }

  @override
  void dispose() {
    positions.itemPositions.removeListener(remember);
    super.dispose();
  }

  void remember() {
    if (updating || app == null || rows.isEmpty) return;
    final visible =
        positions.itemPositions.value
            .where((p) => p.itemTrailingEdge > 0 && p.itemLeadingEdge < 1)
            .toList()
          ..sort((a, b) => a.index.compareTo(b.index));
    if (visible.isEmpty) return;
    final r = Reference.fromId(
      rows[visible.first.index]['reference'] as String,
    )!;
    if (app!.passage.id == r.id) return;
    app!.passage = r;
    app!.store.setPref('last_reference', r.id);
    if (mounted) setState(() {});
  }

  void select(String id) {
    setState(() {
      if (!selected.add(id)) selected.remove(id);
    });
    app!.passage = Reference.fromId(id)!;
    app!.store.recordReading(app!.translation, app!.passage);
  }

  @override
  Widget build(BuildContext context) {
    app = context.app;
    final a = app!, whole = a.store.pref('whole_book', false);
    final key =
        '${a.translation}:${a.passage.book}:${whole ? 0 : a.passage.chapter}:${a.revision}';
    if (key != cache) {
      cache = key;
      updating = true;
      rows = a.store.verses(
        a.translation,
        a.passage.book,
        chapter: whole ? null : a.passage.chapter,
      );
      colors = a.store.highlights(a.translation, a.passage.book);
      selected = {};
      final index = rows.indexWhere((r) => r['reference'] == a.passage.id);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && scroll.isAttached && index >= 0) {
          scroll.jumpTo(index: index);
        }
        updating = false;
      });
    }
    final toolbar = SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          IconButton(
            tooltip: a.t('previous'),
            onPressed: () => a.step(-1),
            icon: const Icon(Icons.chevron_left),
          ),
          TextButton(
            onPressed: () => choosePassage(context),
            child: Text(
              '${bookNames(a.language)[a.passage.book - 1]} ${a.passage.chapter}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          IconButton(
            tooltip: a.t('next'),
            onPressed: () => a.step(1),
            icon: const Icon(Icons.chevron_right),
          ),
          IconButton(
            key: const ValueKey('reader-3d'),
            tooltip: a.t('models'),
            onPressed: () =>
                sheet(context, a.t('models'), ModelsPage(reference: a.passage)),
            icon: const Icon(Icons.view_in_ar),
          ),
          IconButton(
            key: const ValueKey('reader-context'),
            tooltip: 'Contexto, temas e teologia',
            onPressed: () => openVerseStudy(context, a.passage),
            icon: const Icon(Icons.history_edu),
          ),
          PopupMenuButton<String>(
            tooltip: a.t('translation'),
            onSelected: (e) {
              a.store.setPref('edition_chosen', true);
              final r =
                  a.store.mapped(a.translation, a.passage, e) ?? a.passage;
              a.navigate(
                a.store.verse(e, r) != null
                    ? r
                    : Reference(a.store.availableBooks(e).first, 1, 1),
                edition: e,
              );
            },
            itemBuilder: (_) => a.store
                .modules(kind: 'bible', installedOnly: true)
                .map(
                  (m) => PopupMenuItem(
                    value: m['id'] as String,
                    child: Text(m['title'] as String),
                  ),
                )
                .toList(),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(a.translation),
            ),
          ),
          IconButton(
            tooltip: a.t(a.study ? 'readingMode' : 'studyMode'),
            onPressed: () => a.set('study', !a.study),
            icon: Icon(a.study ? Icons.menu_book : Icons.school_outlined),
          ),
          IconButton(
            tooltip: a.t('fullscreen'),
            onPressed: () => a.set('fullscreen', !a.fullscreen),
            icon: Icon(a.fullscreen ? Icons.fullscreen_exit : Icons.fullscreen),
          ),
          if (a.study) ...[
            IconButton(
              tooltip: a.t('compare'),
              onPressed: () =>
                  sheet(context, a.t('compare'), ComparisonPage(a.passage)),
              icon: const Icon(Icons.view_week_outlined),
            ),
            IconButton(
              tooltip: a.t('tabs'),
              onPressed: () => savedPlaces(context, 'study_tabs'),
              icon: const Icon(Icons.tab),
            ),
            IconButton(
              tooltip: a.t('bookmarks'),
              onPressed: () => savedPlaces(context, 'bookmarks'),
              icon: const Icon(Icons.bookmarks_outlined),
            ),
          ],
        ],
      ),
    );
    final reading = rows.isEmpty
        ? Center(child: Text(a.t('noContent')))
        : ScrollablePositionedList.builder(
            itemCount: rows.length,
            itemScrollController: scroll,
            itemPositionsListener: positions,
            initialScrollIndex: rows
                .indexWhere((r) => r['reference'] == a.passage.id)
                .clamp(0, rows.length - 1),
            padding: EdgeInsets.symmetric(horizontal: a.margins, vertical: 24),
            itemBuilder: (ctx, i) {
              final row = rows[i],
                  ref = Reference.fromId(row['reference'] as String)!,
                  meta = jsonMap(row['metadata']),
                  text = row['text'] as String;
              final paragraph = a.store.pref('paragraphs', false),
                  picked = selected.contains(ref.id);
              final base = TextStyle(
                fontFamily: preferredReadingFont(
                  a.store.pref('font_family', 'EBGaramond'),
                ),
                fontSize: a.fontSize,
                height: a.lineHeight,
                color: Theme.of(ctx).colorScheme.onSurface,
              );
              final spans = <InlineSpan>[];
              var cursor = 0;
              if (a.store.pref('numbers', true)) {
                spans.add(
                  TextSpan(
                    text: '${ref.verse}  ',
                    style: base.copyWith(
                      fontSize: a.fontSize * .65,
                      color: Theme.of(ctx).colorScheme.primary,
                    ),
                  ),
                );
              }
              if (a.store.pref('red', true)) {
                for (final range in meta['red_ranges'] as List? ?? []) {
                  final start = (range[0] as int).clamp(cursor, text.length),
                      end = (range[1] as int).clamp(start, text.length);
                  spans.add(TextSpan(text: text.substring(cursor, start)));
                  spans.add(
                    TextSpan(
                      text: text.substring(start, end),
                      style: TextStyle(
                        color: Theme.of(ctx).brightness == Brightness.dark
                            ? const Color(0xffff998f)
                            : const Color(0xffa22321),
                      ),
                    ),
                  );
                  cursor = end;
                }
              }
              spans.add(TextSpan(text: text.substring(cursor)));
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (whole &&
                      (i == 0 || rows[i - 1]['chapter'] != row['chapter']))
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Text(
                        '${bookNames(a.language)[ref.book - 1]} ${ref.chapter}',
                        style: Theme.of(ctx).textTheme.headlineSmall,
                      ),
                    ),
                  if (a.store.pref('headings', true) &&
                      meta['heading'] is String &&
                      (meta['heading'] as String).isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Text(
                        meta['heading'] as String,
                        style: Theme.of(ctx).textTheme.titleMedium,
                      ),
                    ),
                  Semantics(
                    label: '${ref.label(a.language)}. $text',
                    selected: picked,
                    button: true,
                    excludeSemantics: true,
                    child: InkWell(
                      onTap: () => select(ref.id),
                      onLongPress: () => select(ref.id),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: paragraph ? 2 : 8,
                        ),
                        margin: EdgeInsets.only(
                          bottom: paragraph
                              ? (meta['paragraph'] == true ? 14 : 0)
                              : 7,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          color: picked
                              ? Theme.of(ctx).colorScheme.primaryContainer
                              : colors[ref.id] != null
                              ? Color(colors[ref.id]!).withValues(alpha: .25)
                              : null,
                          border: picked
                              ? Border.all(
                                  color: Theme.of(ctx).colorScheme.primary,
                                )
                              : null,
                        ),
                        child: Text.rich(
                          TextSpan(style: base, children: spans),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
    return Column(
      children: [
        toolbar,
        if (selected.isNotEmpty) selectionBar(context),
        if (a.study)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                action(
                  a.t('context'),
                  Icons.history_edu,
                  () => sheet(
                    context,
                    a.t('context'),
                    TimelinePage(reference: a.passage),
                  ),
                ),
                action(
                  a.t('references'),
                  Icons.link,
                  () => showReferences(context, a.passage),
                ),
                action(
                  a.t('original'),
                  Icons.translate,
                  () =>
                      sheet(context, a.t('original'), OriginalPage(a.passage)),
                ),
                action(
                  a.t('commentaries'),
                  Icons.library_books,
                  () => sheet(
                    context,
                    a.t('commentaries'),
                    CommentariesPage(a.passage),
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: LayoutBuilder(
            builder: (ctx, size) =>
                a.study &&
                    a.store.pref('split_comments', true) &&
                    size.maxWidth >= 850
                ? Row(
                    children: [
                      Expanded(flex: 3, child: reading),
                      const VerticalDivider(width: 1),
                      Expanded(flex: 2, child: CommentariesPage(a.passage)),
                    ],
                  )
                : reading,
          ),
        ),
        if (!a.fullscreen)
          LinearProgressIndicator(
            value: rows.isEmpty
                ? 0
                : (rows.indexWhere((r) => r['reference'] == a.passage.id) + 1) /
                      rows.length,
            minHeight: 2,
          ),
      ],
    );
  }

  Widget selectionBar(BuildContext context) {
    final a = app!;
    final chosen = rows
            .where((r) => selected.contains(r['reference']))
            .toList(),
        r = Reference.fromId(chosen.first['reference'] as String)!;
    final text = chosen
        .map(
          (v) =>
              '${Reference.fromId(v['reference'] as String)!.label(a.language)} ${v['text']}',
        )
        .join('\n');
    return Material(
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            IconButton(
              tooltip: a.t('close'),
              onPressed: () => setState(() => selected = {}),
              icon: const Icon(Icons.close),
            ),
            Text('${selected.length} ${a.t('selected')}'),
            action(
              'Contexto e estudo',
              Icons.hub,
              () => openVerseStudy(context, r),
            ),
            action(
              'Referências',
              Icons.account_tree,
              () => showReferences(context, r),
            ),
            action(
              'Comentários',
              Icons.comment,
              () => sheet(context, 'Comentários', CommentariesPage(r)),
            ),
            action(a.t('copy'), Icons.copy, () {
              Clipboard.setData(ClipboardData(text: '$text\n${a.translation}'));
              message(context, a.t('copy'));
            }),
            action(
              a.t('note'),
              Icons.edit_note,
              () => openNewNote(
                context,
                title: r.label(a.language),
                reference: r.id,
                body: '[[${r.id}]]\n\n> ${text.replaceAll('\n', '\n> ')}\n\n',
              ),
            ),
            action(a.t('bookmark'), Icons.bookmark_add, () {
              a.store.savePlace(
                'bookmarks',
                r.id,
                a.translation,
                r.label(a.language),
              );
              message(context, a.t('success'));
            }),
            action(a.t('tab'), Icons.tab, () {
              a.store.savePlace(
                'study_tabs',
                r.id,
                a.translation,
                r.label(a.language),
              );
              message(context, a.t('success'));
            }),
            ...const [0xffffc857, 0xff83bd75, 0xff6cacdb, 0xffcd91c4].map(
              (c) => IconButton(
                tooltip: '${a.t('highlight')} ${c.toRadixString(16)}',
                onPressed: () {
                  a.store.highlight(a.translation, selected, c);
                  setState(
                    () => colors = a.store.highlights(
                      a.translation,
                      a.passage.book,
                    ),
                  );
                },
                icon: Icon(Icons.circle, color: Color(c)),
              ),
            ),
            action(a.t('clearHighlight'), Icons.format_color_reset, () {
              a.store.highlight(a.translation, selected, null);
              setState(
                () =>
                    colors = a.store.highlights(a.translation, a.passage.book),
              );
            }),
            action(
              a.t('addCard'),
              Icons.psychology_alt,
              () => createCard(
                context,
                r,
                chosen.map((v) => v['text']).join('\n'),
              ),
            ),
            action(
              a.t('original'),
              Icons.translate,
              () => sheet(context, a.t('original'), OriginalPage(r)),
            ),
            action(
              a.t('contextCompare'),
              Icons.compare_arrows,
              () => sheet(
                context,
                a.t('contextCompare'),
                ContextComparisonPage(first: r),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> savedPlaces(BuildContext context, String kind) => sheet(
  context,
  context.app.t(kind == 'study_tabs' ? 'tabs' : 'bookmarks'),
  StatefulBuilder(
    builder: (ctx, set) {
      final a = ctx.app,
          rows = a.store.savedPlaces(kind),
          history = kind == 'bookmarks'
              ? a.store.savedPlaces('reading_history')
              : [];
      return ListView(
        children: [
          ...rows.map(
            (r) => ListTile(
              title: Text(r['title'] as String),
              subtitle: Text(r['translation'] as String),
              onTap: () {
                a.activeTab = kind == 'study_tabs' ? r['id'] as String : null;
                a.navigate(
                  Reference.fromId(r['reference'] as String)!,
                  edition: r['translation'] as String,
                );
                Navigator.pop(ctx);
              },
              trailing: IconButton(
                tooltip: a.t('delete'),
                onPressed: () {
                  a.store.deletePlace(kind, r['id'] as String);
                  set(() {});
                },
                icon: const Icon(Icons.close),
              ),
            ),
          ),
          if (history.isNotEmpty) const Divider(),
          ...history.map(
            (r) => ListTile(
              title: Text(
                Reference.fromId(r['reference'] as String)!.label(a.language),
              ),
              subtitle: Text(r['translation'] as String),
              onTap: () {
                a.navigate(
                  Reference.fromId(r['reference'] as String)!,
                  edition: r['translation'] as String,
                  history: false,
                );
                Navigator.pop(ctx);
              },
            ),
          ),
        ],
      );
    },
  ),
);

class CommentariesPage extends StatefulWidget {
  final Reference reference;
  const CommentariesPage(this.reference, {super.key});
  @override
  State<CommentariesPage> createState() => _CommentariesPageState();
}

class _CommentariesPageState extends State<CommentariesPage> {
  Set<String> authors = {};
  bool showEnglishOriginals = false;
  List<RecordRow> _calvinOnDemand = [];

  @override
  void initState() {
    super.initState();
    _loadCalvinOnDemand();
  }

  Future<void> _loadCalvinOnDemand() async {
    final mobileWeb = kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.android ||
         defaultTargetPlatform == TargetPlatform.iOS);
    if (!mobileWeb) return;
    try {
      final book = widget.reference.book;
      final text = await rootBundle.loadString('assets/calvino-por-livro/$book.json');
      final data = jsonDecode(text) as List;
      final key = widget.reference.key;
      int keyOf(String ref) {
        final parts = ref.split(':');
        if (parts.length != 3) return -1;
        final values = parts.map(int.tryParse).toList();
        if (values.any((v) => v == null)) return -1;
        return values[0]! * 1000000 + values[1]! * 1000 + values[2]!;
      }
      final rows = <RecordRow>[];
      for (final entry in data) {
        final row = Map<String, Object?>.from(entry as Map);
        final start = keyOf(row['reference'] as String);
        final end = keyOf(row['end_reference'] as String);
        if (start > key || end < key) continue;
        rows.add({
          ...row,
          'module_id': 'CalvinCommentaries',
          'bibliography': 'Calvin Commentaries — CCEL (texto historico)',
        });
      }
      if (mounted) setState(() => _calvinOnDemand = rows);
    } catch (_) {
      // Os outros comentaristas permanecem disponiveis.
    }
  }
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        all = a.store.commentaries(
          widget.reference,
          sourceTranslation: a.translation,
        );
    final found = all.map((entry) => entry['id']).toSet();
    for (final row in _calvinOnDemand) {
      if (found.add(row['id'])) all.add(row);
    }
    all.sort((x, y) {
      int rank(Map<String, Object?> r) =>
          (r['module_id'] as String).startsWith('HDL')
          ? 0
          : r['module_id'] == 'CalvinCommentaries'
          ? 1
          : 2;
      return rank(x).compareTo(rank(y));
    });
    // Prioriza traducao persistida no banco e comentarios originais em pt-BR.
    final localized = a.language != 'pt' || showEnglishOriginals
        ? all
        : all.where((entry) {
            final module = a.store.module(entry['module_id'] as String);
            final language = (module?['language'] ?? '').toString().toLowerCase();
            return language.startsWith('pt') ||
                a.store.translatedEntry('commentary', entry['id'] as String) != null;
          }).toList();
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Text(
          a.t('addressWarning'),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Text(
          widget.reference.label(a.language),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (a.language == 'pt') ...[
          const SizedBox(height: 12),
          // Guias de fontes e catálogos não são comentários exegéticos
          // integrais. Mantê-los disponíveis, mas fora do corpo de comentários.
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Guias de leitura e referências'),
            subtitle: const Text(
              'Material de apoio, separado dos comentários bíblicos integrais.',
            ),
            children: [
              for (final moduleId in const [
                'HDL-GUIA-FONTES',
                'JOSEMAR-GUIA-FONTES',
                'EXP2-CALV-PT',
              ])
                if (a.store.installed(moduleId))
                  ListTile(
                    title: Text(
                      a.store.module(moduleId)?['title'] as String? ?? moduleId,
                    ),
                    subtitle: const Text(
                      'Guia editorial e referências; não reproduz a obra integral.',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => sheet(
                      context,
                      a.store.module(moduleId)?['title'] as String? ?? moduleId,
                      ModulePage(a.store.module(moduleId)!),
                    ),
                  ),
            ],
          ),
          if (!all.any((r) =>
              (r['module_id'] as String).startsWith('HDL')))
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Os comentários integrais de Hernandes Dias Lopes ainda não '
                'constam desta edição. O guia de fontes disponível acima '
                'é um material diferente.',
              ),
            ),
        ],

        if (a.language == 'pt')
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Mostrar textos originais em inglês'),
            subtitle: const Text('Entradas traduzidas aparecem automaticamente quando disponíveis.'),
            value: showEnglishOriginals,
            onChanged: (v) => setState(() => showEnglishOriginals = v),
          ),
        if (all.isNotEmpty && localized.isEmpty)
          const Text('Nenhuma tradução instalada para esta passagem. '
              'Ative a opção acima para consultar os originais.'),
        Wrap(
          spacing: 8,
          children: localized
              .map((r) => r['module_id'] as String)
              .toSet()
              .map(
                (id) => FilterChip(
                  label: Text(
                    id == 'HDL-JOAO'
                        ? 'Hernandes · João'
                        : (a.store.module(id)?['author'] as String?) ??
                            (id == 'CalvinCommentaries' ? 'João Calvino' : id),
                  ),
                  selected: authors.contains(id),
                  onSelected: (v) => setState(() {
                    v ? authors.add(id) : authors.remove(id);
                  }),
                ),
              )
              .toList(),
        ),
        if (all.isEmpty) Text(a.t('noContent')),
        ...localized.where((r) => authors.isEmpty || authors.contains(r['module_id'])).map((
          r,
        ) {
          final m = a.store.module(r['module_id'] as String) ??
              <String, Object?>{
                'author': 'João Calvino',
                'title': 'Comentários reunidos de João Calvino',
                'language': 'en',
                'id': 'CalvinCommentaries',
                'version': 'public.1',
                'license': 'Domínio público',
                'source': 'CCEL — edição histórica',
              };
          final pt = a.store.translatedEntry('commentary', r['id'] as String);
          final englishOnly =
              pt == null && m['language'] == 'en' && a.language == 'pt';
          final body = pt?['body'] as String? ?? r['body'] as String;
          final preview = body.length > 2500
              ? '${body.substring(0, body.lastIndexOf(' ', 2500))}…'
              : body;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "${m['author']} · ${pt != null ? 'Português (tradução de estudo)' : m['language']}",
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    '${r['kind']} · ${r['reference']} — ${r['end_reference']}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 14),
                  if (englishOnly)
                    ExpansionTile(
                      title: const Text('Texto original em inglês'),
                      subtitle: const Text(
                        'Esta entrada ainda não tem tradução de estudo em português.',
                      ),
                      children: [MarkdownText(preview)],
                    )
                  else
                    MarkdownText(preview),
                  if (body.length > 2500 && !englishOnly)
                    action(
                      'Ler comentário completo',
                      Icons.article,
                      () => sheet(
                        context,
                        '${m['author']} · ${(pt?['title'] as String?)?.trim().isNotEmpty == true ? pt!['title'] : r['title']}',
                        LongStudyText(body),
                      ),
                    ),
                  if (pt != null) ...[
                    Text(
                      pt['status'] as String,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    action(
                      'Consultar original em inglês',
                      Icons.translate,
                      () => sheet(
                        context,
                        '${m['author']} · original',
                        LongStudyText(r['body'] as String),
                      ),
                    ),
                  ],
                  action(a.t('copy'), Icons.format_quote, () {
                    Clipboard.setData(
                      ClipboardData(
                        text:
                            '${body.substring(0, body.length > 1500 ? 1500 : body.length)}\n\n${m['author']}; ${m['title']}; ${widget.reference.label(a.language)}; entrada ${r['reference']}–${r['end_reference']}; ${r['bibliography'] ?? ''}; módulo ${m['id']} ${m['version']}; ${m['license']}.',
                      ),
                    );
                    message(context, a.t('copy'));
                  }),
                  Text(
                    '${m['license']} · ${m['source']}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}

class ComparisonPage extends StatefulWidget {
  final Reference reference;
  const ComparisonPage(this.reference, {super.key});
  @override
  State<ComparisonPage> createState() => _ComparisonPageState();
}

class _ComparisonPageState extends State<ComparisonPage> {
  Set<String> editions = {};
  bool columns = false, diff = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (editions.isEmpty) editions = {context.app.translation};
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        rows = a.store.verses(
          a.translation,
          widget.reference.book,
          chapter: widget.reference.chapter,
        ),
        selected = a.store
            .modules(kind: 'bible', installedOnly: true)
            .where((m) => editions.contains(m['id']))
            .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Wrap(
                spacing: 8,
                children: a.store
                    .modules(kind: 'bible', installedOnly: true)
                    .map(
                      (m) => FilterChip(
                        label: Text(m['id'] as String),
                        selected: editions.contains(m['id']),
                        onSelected: (v) => setState(() {
                          v
                              ? editions.add(m['id'] as String)
                              : editions.remove(m['id']);
                        }),
                      ),
                    )
                    .toList(),
              ),
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: Text(a.t('columns')),
                    selected: columns,
                    onSelected: (_) => setState(() => columns = true),
                  ),
                  ChoiceChip(
                    label: Text(a.t('alternating')),
                    selected: !columns,
                    onSelected: (_) => setState(() => columns = false),
                  ),
                  FilterChip(
                    label: Text(a.t('differences')),
                    selected: diff,
                    onSelected: (v) => setState(() => diff = v),
                  ),
                ],
              ),
              Text(
                a.t('addressWarning'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: columns
                  ? (MediaQuery.sizeOf(context).width > selected.length * 240
                        ? MediaQuery.sizeOf(context).width
                        : selected.length * 240.0)
                  : MediaQuery.sizeOf(context).width,
              child: ListView.builder(
                itemCount: rows.length,
                itemBuilder: (ctx, index) {
                  final source = rows[index],
                      r = Reference.fromId(source['reference'] as String)!;
                  final widgets = selected.map((m) {
                    final id = m['id'] as String,
                        mapped = a.store.mapped(a.translation, r, id),
                        v = a.store.verse(id, mapped ?? r);
                    final text = v?['text'] as String? ?? a.t('noContent'),
                        base = (source['text'] as String)
                            .split(RegExp(r'\s+'))
                            .map(fold)
                            .toSet();
                    return Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$id · ${(mapped ?? r).label(a.language)}${mapped == null ? ' *' : ''}',
                          ),
                          SelectableText.rich(
                            TextSpan(
                              style: TextStyle(
                                fontFamily: 'EBGaramond',
                                fontSize: a.fontSize,
                                height: a.lineHeight,
                              ),
                              children: text
                                  .split(' ')
                                  .map(
                                    (word) => TextSpan(
                                      text: '$word ',
                                      style: diff && !base.contains(fold(word))
                                          ? TextStyle(
                                              backgroundColor: Theme.of(
                                                ctx,
                                              ).colorScheme.secondaryContainer,
                                            )
                                          : null,
                                    ),
                                  )
                                  .toList(),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList();
                  return columns
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: widgets
                              .map((w) => Expanded(child: w))
                              .toList(),
                        )
                      : Column(children: widgets);
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

Future<void> showReferences(BuildContext context, Reference r) =>
    sheet(context, 'Referências cruzadas', CrossReferencesPage(r));

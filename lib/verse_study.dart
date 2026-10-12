import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'explore.dart';
import 'cross_references.dart';
import 'linguistics.dart';
import 'reader.dart' show CommentariesPage;
import 'studies.dart';
import 'store.dart';

Future<List<Map<String, dynamic>>>? _books;
Future<List<Map<String, dynamic>>> bookBackgrounds() => _books ??= (() async =>
    (jsonDecode(
              await rootBundle.loadString(
                'assets/content/book-backgrounds.json',
              ),
            )
            as List)
        .map((x) => Map<String, dynamic>.from(x))
        .toList())();

Future<void> openVerseStudy(BuildContext context, Reference reference) => sheet(
  context,
  'Estudo conectado · ${reference.label(context.app.language)}',
  VerseStudyPage(reference),
);

class VerseStudyPage extends StatefulWidget {
  final Reference reference;
  const VerseStudyPage(this.reference, {super.key});
  @override
  State<VerseStudyPage> createState() => _VerseStudyPageState();
}

class _VerseStudyPageState extends State<VerseStudyPage> {
  Map<String, dynamic>? background, history;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (background != null) return;
    Future.wait([bookBackgrounds(), loadContext(context.app.store)]).then((
      data,
    ) {
      if (mounted) {
        setState(() {
          background = (data[0] as List<Map<String, dynamic>>).firstWhere(
            (b) => b['book'] == widget.reference.book,
          );
          history = data[1] as Map<String, dynamic>;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        r = widget.reference,
        comments = a.store.commentaries(r, sourceTranslation: a.translation),
        events = history == null ? <dynamic>[] : eventsAt(history!, r);
    final intro = a.store
        .documents()
        .where(
          (d) =>
              jsonMap(d['metadata'])['book'] == r.book &&
              jsonMap(d['metadata'])['scope'] == 'book',
        )
        .toList();
    final allStudies = a.store.studies();
    final direct = allStudies
        .where((s) => jsonList(s['refs']).any((id) => id == r.id))
        .toList();
    final bookStudies = allStudies
        .where(
          (s) => jsonList(
            s['refs'],
          ).any((id) => Reference.fromId(id.toString())?.book == r.book),
        )
        .take(12)
        .toList();
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Text(
          r.label(a.language),
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            action(
              'Ler no contexto',
              Icons.menu_book,
              () => showPassage(context, r),
            ),
            action(
              'Rede de conexões',
              Icons.hub,
              () =>
                  sheet(context, 'Conexões bíblicas', GraphPage(reference: r)),
            ),
          ],
        ),
        feature(
          context,
          'Referências cruzadas',
          '${a.store.crossReferenceCount(r)} ligações diretas · passagens com prévia e fonte',
          Icons.account_tree,
          () => sheet(context, 'Referências cruzadas', CrossReferencesPage(r)),
        ),
        feature(
          context,
          'Comentários',
          '${comments.length} entradas para a passagem · autores e intervalos identificados',
          Icons.comment,
          () => sheet(context, 'Comentários', CommentariesPage(r)),
        ),
        feature(
          context,
          'Idioma original',
          'Lema, morfologia, glosa em português e outras ocorrências',
          Icons.translate,
          () => sheet(context, 'Idioma original', OriginalPage(r)),
        ),
        feature(
          context,
          'Modelos 3D',
          'Reconstruções, objetos e imagens literárias do trecho',
          Icons.view_in_ar,
          () =>
              sheet(context, 'Modelos 3D da leitura', ModelsPage(reference: r)),
        ),
        const SizedBox(height: 12),
        Text(
          'Contexto histórico e literário',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (background == null)
          const LinearProgressIndicator()
        else ...[
          Chip(label: Text('${background!['genre']} · panorama do livro')),
          MarkdownText(background!['body'] as String),
          const SizedBox(height: 8),
          Text(
            background!['chronology'] as String,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          Wrap(
            spacing: 8,
            children: (background!['references'] as List).map((id) {
              final ref = Reference.fromId(id as String)!;
              return action(
                ref.label(a.language),
                Icons.menu_book,
                () => showPassage(context, ref, sourceEdition: 'BLN4'),
              );
            }).toList(),
          ),
        ],
        if (events.isNotEmpty)
          ...events.map(
            (event) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event['title'] as String,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text('${event['certainty']} · associação pela perícope'),
                    MarkdownText(event['description'] as String),
                    action(
                      'Ver na cronologia',
                      Icons.timeline,
                      () => sheet(
                        context,
                        'Cronologia',
                        TimelinePage(reference: r),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'Não há evento individual datado para esta passagem. O panorama do livro acima fornece o contexto disponível.',
            ),
          ),
        for (final doc in intro)
          feature(
            context,
            doc['title'] as String,
            'Introdução ao livro · ${a.store.module(doc['module_id'] as String)?['author']}',
            Icons.article,
            () => sheet(context, doc['title'] as String, DocumentPage(doc)),
          ),
        feature(
          context,
          'Mapas históricos',
          'Lugares e rotas cadastrados, com incertezas indicadas',
          Icons.map,
          () => sheet(context, 'Mapas históricos', AtlasPage()),
        ),
        feature(
          context,
          'Comparar contextos',
          'Escolha por testamento, livro, capítulo, versículo ou acontecimento',
          Icons.compare_arrows,
          () => sheet(
            context,
            'Comparar contexto',
            ContextComparisonPage(first: r),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'Teologia e diálogo',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        feature(
          context,
          'Padrões de Westminster',
          'Confissão de Fé, Breve Catecismo e Catecismo Maior',
          Icons.library_books,
          () =>
              sheet(context, 'Padrões de Westminster', const ConfessionsPage()),
        ),
        Text(
          direct.isNotEmpty
              ? 'Estudos que citam este versículo'
              : 'Estudos que citam o livro · associação temática ampla',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        for (final study in direct.isNotEmpty ? direct : bookStudies)
          feature(
            context,
            study['title'] as String,
            '${traditionTitles[study['target']] ?? study['target']} · estudo com fontes',
            Icons.school,
            () => sheet(
              context,
              study['title'] as String,
              StudyPage(study, apologetic: true),
            ),
          ),
        feature(
          context,
          'Conhecer outras tradições',
          'Exposição pela perspectiva de cada tradição e suas fontes',
          Icons.public,
          () => sheet(
            context,
            'Mesa de Estudos',
            const StudiesBrowser(apologetic: false),
          ),
        ),
        feature(
          context,
          'Defesa presbiteriana',
          'Argumentos, objeção mais forte e resposta do interlocutor',
          Icons.forum,
          () => sheet(
            context,
            'Apologética presbiteriana',
            const StudiesBrowser(apologetic: true),
          ),
        ),
      ],
    );
  }
}

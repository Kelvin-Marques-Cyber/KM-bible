import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:biblia_reformada/app.dart';
import 'package:biblia_reformada/common.dart';
import 'package:biblia_reformada/domain.dart';
import 'package:biblia_reformada/graph.dart';
import 'package:biblia_reformada/passage_picker.dart';
import 'package:biblia_reformada/scripture_links.dart';
import 'package:biblia_reformada/store.dart';
import 'package:biblia_reformada/studies.dart';
import 'package:biblia_reformada/verse_study.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory dir;
  late Store store;
  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('connected-study-');
    for (final resource in [
      'catalogue',
      'lexicon',
      'library',
      'connections',
      'portuguese',
      'topics',
    ]) {
      await File(
        'assets/content/$resource.sqlite',
      ).copy('${dir.path}/$resource.sqlite');
    }
  });
  setUp(() {
    store = Store(
      sqlite3.open('${dir.path}/catalogue.sqlite'),
      sqlite3.openInMemory(),
      sqlite3.open('${dir.path}/lexicon.sqlite'),
      sqlite3.open('${dir.path}/library.sqlite'),
      dir.path,
    );
  });
  tearDown(() => store.dispose());
  tearDownAll(() => dir.delete(recursive: true));
  Widget host(Widget page) => AppScope(
    app: AppController(store),
    child: MaterialApp(home: Scaffold(body: page)),
  );

  test(
    'Citations become links without modifying code, authored links or notes',
    () {
      final result = linkScriptureReferences(
        'João 3:16–18; Rm. 8:28. CFW 21.7. `João 3:16` [João 3:16](https://example.org) [[João 3:16]]',
      );
      expect(result, contains('biblia:43%3A3%3A16..43%3A3%3A18'));
      expect(result, contains('biblia:45%3A8%3A28'));
      expect(result, contains('confession:WCF:21'));
      expect(result, contains('`João 3:16`'));
      expect(result, contains('[João 3:16](https://example.org)'));
      expect(result, contains('[[João 3:16]]'));
      expect(
        linkedReferences('Isaías 53:5 e 1Pe 2:24').map((r) => r.id),
        containsAll(['23:53:5', '60:2:24']),
      );
      expect(
        linkScriptureReferences('```\nJoão 3:16\n```'),
        '```\nJoão 3:16\n```',
      );
    },
  );
  test(
    'Plain Bible citations create backlinks while retaining original note Markdown',
    () {
      final note = store.saveNote(
        title: 'Cristologia',
        body: 'Isaías 53:5 e 1 Pedro 2:24.',
        reference: '43:1:1',
      );
      expect(store.backlinks('23:53:5').map((n) => n['id']), contains(note));
      expect(store.note(note)?['body'], 'Isaías 53:5 e 1 Pedro 2:24.');
    },
  );
  test(
    'Cross-reference data preserve ranges and clearly label chapter fallback',
    () {
      final db = store.connections!;
      expect(db.select('PRAGMA integrity_check').first.values.first, 'ok');
      expect(
        db.select('SELECT count(*) AS n FROM cross_references').first['n'],
        greaterThan(340000),
      );
      final exact = store.crossReferences(const Reference(43, 3, 16));
      expect(exact, isNotEmpty);
      expect(exact.every((r) => r['scope'] == 'verse'), isTrue);
      expect(
        exact
            .map((r) => '${r['target']}..${r['end_reference']}')
            .toSet()
            .length,
        exact.length,
      );
      expect(
        db
            .select(
              'SELECT count(*) AS n FROM cross_references WHERE target<>end_reference',
            )
            .first['n'],
        greaterThan(10000),
      );
      final none = store.crossReferences(const Reference(1, 3, 176));
      expect(none.every((r) => r['scope'] == 'chapter'), isTrue);
    },
  );
  test('Westminster joins retain document identity and question metadata', () {
    for (final pair in [('WCF', 33), ('WSC', 107), ('WLC', 196)]) {
      final docs = store.documents(moduleId: pair.$1);
      expect(docs.length, pair.$2);
      expect(docs.map((d) => d['id']).toSet().length, pair.$2);
      expect(
        docs.every((d) => jsonMap(d['metadata'])['number'] is int),
        isTrue,
      );
    }
  });
  test(
    'Editorial expansion preserves notes, progress and stable study identifiers',
    () async {
      final note = store.saveNote(
        title: 'Minha nota',
        body: 'Romanos 8:28',
        reference: '45:8:28',
      );
      store.completed('science-cosmos', true);
      await store.refreshEditorial();
      final count = store.studies().length;
      expect(count, greaterThanOrEqualTo(35));
      expect(store.studies(topic: 'science').length, 8);
      await store.refreshEditorial();
      expect(store.studies().length, count);
      expect(store.note(note), isNotNull);
      expect(store.isCompleted('science-cosmos'), isTrue);
      for (final study in store.studies(topic: 'science')) {
        expect(jsonList(study['sources']), isNotEmpty);
        expect(study['strongest'], isNotEmpty);
        expect(study['rejoinder'], isNotEmpty);
      }
    },
  );
  test(
    'Every book has explicitly scoped historical background, without fake event dates',
    () async {
      final books = await bookBackgrounds();
      expect(books.length, 66);
      expect(books.map((b) => b['book']).toSet().length, 66);
      expect(books.every((b) => b['scope'] == 'book'), isTrue);
      for (final book in books) {
        expect(book['body'], isNotEmpty);
        expect(book['chronology'], isNotEmpty);
      }
    },
  );
  testWidgets(
    'All Westminster tabs open without the previous null metadata crash',
    (tester) async {
      await tester.pumpWidget(host(const ConfessionsPage()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Breve · 107'));
      await tester.pumpAndSettle();
      expect(find.text('Pergunta 1'), findsOneWidget);
      await tester.tap(find.text('Pergunta 1'));
      await tester.pumpAndSettle();
      expect(find.byType(DocumentPage), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('Graph exposes a readable list and expandable neighborhoods', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(const GraphPage(reference: Reference(43, 3, 16))),
    );
    await tester.pump();
    await tester.runAsync(
      () async => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pumpAndSettle();
    expect(find.byType(InteractiveViewer), findsOneWidget);
    expect(find.textContaining('referências diretas na base'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'Hierarchical picker selects a verse without moving the reader for comparison',
    (tester) async {
      final app = AppController(store);
      final original = app.passage;
      Reference? selection;
      await tester.pumpWidget(
        AppScope(
          app: app,
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () => sheet(
                    context,
                    'Comparar',
                    PassagePicker(onSelect: (r) => selection = r),
                  ),
                  child: const Text('Escolher'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Escolher'));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      await tester.tap(find.text('Novo Testamento'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('João'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('16'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('16'));
      await tester.pumpAndSettle();
      expect(selection?.id, '43:3:16');
      expect(app.passage.id, original.id);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}

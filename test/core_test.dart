import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:biblia_reformada/reader.dart';
import 'dart:io';
import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:biblia_reformada/domain.dart';
import 'package:biblia_reformada/store.dart';
import 'package:biblia_reformada/packages.dart';
import 'package:biblia_reformada/backups.dart';
import 'package:biblia_reformada/app.dart';
import 'package:biblia_reformada/main.dart';
import 'package:biblia_reformada/studies.dart';
import 'package:biblia_reformada/explore.dart';

Uint8List pack({
  String id = 'TEST',
  String path = 'verses.json',
  bool badHash = false,
}) {
  final rows = utf8.encode(
    jsonEncode([
      {'reference': '43:3:16', 'text': 'Texto de teste'},
    ]),
  );
  final manifest = {
    'format_version': 1,
    'id': id,
    'title': 'Edição de teste',
    'version': '1.0',
    'language': 'pt',
    'author': 'Teste',
    'license': 'CC0',
    'license_text': 'Teste autorizado',
    'source': 'Teste local',
    'kind': 'bible',
    'dependencies': [],
    'files': {path: badHash ? 'wrong' : sha256.convert(rows).toString()},
    'metadata': {'versification': 'TEST'},
  };
  final archive = Archive()
    ..addFile(
      ArchiveFile(
        'manifest.json',
        utf8.encode(jsonEncode(manifest)).length,
        utf8.encode(jsonEncode(manifest)),
      ),
    )
    ..addFile(ArchiveFile(path, rows.length, rows));
  return Uint8List.fromList(ZipEncoder().encode(archive));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory dir;
  late Store s;
  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('biblia-test-');
    for (final name in [
      'catalogue',
      'lexicon',
      'library',
      'connections',
      'portuguese',
    ]) {
      await File(
        'assets/content/$name.sqlite',
      ).copy('${dir.path}/$name.sqlite');
    }
    final font = FontLoader('EBGaramond')
      ..addFont(rootBundle.load('assets/content/EBGaramond.ttf'));
    await font.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    final sans = FontLoader('UiSans')
      ..addFont(rootBundle.load('assets/content/Roboto-Regular.ttf'));
    await sans.load();
  });
  setUp(() {
    s = Store(
      sqlite3.open('${dir.path}/catalogue.sqlite'),
      sqlite3.openInMemory(),
      sqlite3.open('${dir.path}/lexicon.sqlite'),
      sqlite3.open('${dir.path}/library.sqlite'),
      dir.path,
    );
  });
  tearDown(() => s.dispose());
  tearDownAll(() => dir.delete(recursive: true));
  test(
    'References: accents, languages, abbreviations, ambiguous input and limits',
    () {
      expect(Reference.parse('João 3:16')?.id, '43:3:16');
      expect(Reference.parse('John 3:16')?.id, '43:3:16');
      expect(Reference.parse('Jn 3:16')?.id, '43:3:16');
      expect(Reference.parse('Jó 1:1')?.book, 18);
      expect(Reference.parse('Jo 3:16')?.book, 43);
      expect(Reference.parse('1Co 13:4')?.book, 46);
      expect(Reference.parse('J 3:16'), isNull);
      expect(Reference.fromId('67:1:1'), isNull);
    },
  );
  test('Local seed integrity and complete confessional original coverage', () {
    for (final name in ['catalogue', 'lexicon', 'library']) {
      final bytes = File('assets/content/$name.sqlite').readAsBytesSync();
      expect(
        sha256.convert(bytes).toString(),
        File('assets/content/$name.sha256').readAsStringSync().trim(),
      );
    }
    expect(s.documents(moduleId: 'WCF').length, 33);
    expect(s.documents(moduleId: 'WSC').length, 107);
    expect(s.documents(moduleId: 'WLC').length, 196);
    expect(s.studies().length, greaterThanOrEqualTo(12));
    expect(s.storeIntegrity(), isTrue);
  });
  test('Bibles and original corpora are real indexed content', () {
    expect(s.verses('BLN4', 43).length, 879);
    expect(
      s.verse('ASV', const Reference(43, 3, 16))!['text'],
      contains('loved'),
    );
    expect(s.wordsAt(const Reference(43, 3, 16)), isNotEmpty);
    expect(s.wordsAt(const Reference(1, 1, 1)), isNotEmpty);
    expect(s.frequency('G26'), greaterThan(0));
    expect(s.commentaries(const Reference(43, 3, 16)), isNotEmpty);
    expect(
      s.search('aliança', 'BLN4').any((h) => h['category'] == 'bible'),
      isTrue,
    );
  });
  test(
    'Updating built-in model index preserves personal notes and imported content',
    () async {
      final note = s.saveNote(
        title: 'Estudo preservado',
        body: '[[João 3:16]]',
      );
      ContentPackage.parse(pack(id: 'PERSONALTEST')).install(s);
      s.content.execute("DELETE FROM document_search WHERE id LIKE 'model:%'");
      s.content.execute("DELETE FROM documents WHERE module_id='APP-3D'");
      await s.refreshModelIndex();
      expect(s.documents(moduleId: 'APP-3D').length, 136);
      expect(s.note(note)!['title'], 'Estudo preservado');
      expect(
        s.verse('PERSONALTEST', const Reference(43, 3, 16))!['text'],
        'Texto de teste',
      );
      expect(
        s
            .search('candeeiros', 'BLN4')
            .any((r) => r['category'] == 'model_index'),
        isTrue,
      );
      await s.refreshModelIndex();
      expect(s.documents(moduleId: 'APP-3D').length, 136);
    },
  );
  test('Unknown equivalence is not silently treated as an exact mapping', () {
    final p = ContentPackage.parse(pack());
    p.install(s);
    expect(s.mapped('BLN4', const Reference(43, 3, 16), 'TEST'), isNull);
  });
  test('Reject corrupted and path traversal content before installation', () {
    expect(
      () => ContentPackage.parse(pack(badHash: true)),
      throwsFormatException,
    );
    expect(
      () => ContentPackage.parse(pack(path: '../verses.json')),
      throwsFormatException,
    );
    expect(
      () => ContentPackage.parse(pack(id: '../bad')),
      throwsFormatException,
    );
  });
  test('Removing and updating a module preserve personal notes', () {
    ContentPackage.parse(pack()).install(s);
    final id = s.saveNote(
      title: 'Aliança',
      body: '[[João 3:16]]',
      reference: '43:3:16',
    );
    s.removeModule('TEST');
    expect(s.note(id), isNotNull);
    ContentPackage.parse(pack()).install(s);
    expect(s.note(id)!['body'], '[[João 3:16]]');
    expect(s.backlinks('43:3:16').single['id'], id);
  });
  test(
    'Bidirectional note links, Markdown backup and attachment integrity',
    () async {
      final first = s.saveNote(title: 'Cristo', body: 'Origem');
      final second = s.saveNote(
        title: 'Isaías',
        body: '[[note:$first]]\n[[Isaías 53:5]]',
        notebook: 'Cristologia',
      );
      await s.attach(
        second,
        'imagem.txt',
        Uint8List.fromList(utf8.encode('Anexo local')),
      );
      expect(s.backlinks(first).length, 1);
      final bytes = await Backups.export(s);
      final zip = ZipDecoder().decodeBytes(bytes);
      expect(
        zip.files.any((f) => f.name.startsWith('notes/Cristologia/')),
        isTrue,
      );
      s.deleteNote(second);
      await Backups.restore(s, bytes);
      expect(s.note(second), isNotNull);
      expect(s.backlinks(first).length, 1);
    },
  );
  test('Backup merge keeps newer notes and recomputes their links', () async {
    final id = s.saveNote(title: 'Nota', body: '[[João 3:16]]');
    final bytes = await Backups.export(s);
    s.saveNote(id: id, title: 'Nota nova', body: '[[Romanos 8:28]]');
    s.personal.execute(
      'UPDATE notes SET updated_at=updated_at+1000 WHERE id=?',
      [id],
    );
    await Backups.restore(s, bytes);
    expect(s.note(id)!['body'], '[[Romanos 8:28]]');
    expect(s.backlinks('43:3:16'), isEmpty);
    expect(s.backlinks('45:8:28').length, 1);
  });
  test('Encrypted backups authenticate the password', () async {
    s.saveNote(title: 'Privado', body: 'Conteúdo');
    final bytes = await Backups.export(s, password: 'senha-valida-123');
    expect(
      () => Backups.restore(s, bytes, password: 'outra-senha'),
      throwsA(anything),
    );
    expect(await Backups.restore(s, bytes, password: 'senha-valida-123'), 1);
  });
  test('Arena progress identifiers survive personal backup', () async {
    s.completed('arena:sabbath_intro:3', true);
    final bytes = await Backups.export(s);
    s.personal.execute('DELETE FROM learning_progress');
    await Backups.restore(s, bytes);
    expect(s.isCompleted('arena:sabbath_intro:3'), isTrue);
  });
  test('Year-zero exclusion and Haversine are explicit', () {
    expect(historicalInterval(-1, -1, 1, 1), (1, 1));
    expect(historicalInterval(null, null, 30, 33), isNull);
    expect(() => historicalYear(0), throwsArgumentError);
    expect(geographicDistance(0, 0, 0, 1), closeTo(111.195, .01));
  });
  test('Spaced review changes intervals and constrains ease', () {
    final now = DateTime(2026, 10, 12);
    final first = const ReviewSchedule().review(4, now),
        second = first.review(4, now);
    expect(first.interval, 1);
    expect(second.interval, 6);
    final fail = second.review(0, now);
    expect(fail.repetitions, 0);
    expect(fail.interval, 1);
    expect(fail.ease, greaterThanOrEqualTo(1.3));
  });
  test(
    'Complete model collection has embedded safe buffers and textual descriptions',
    () {
      final models =
          jsonDecode(File('assets/3d/models.json').readAsStringSync()) as List;
      expect(models.length, greaterThanOrEqualTo(130));
      for (final m in models) {
        final glb = File('assets/3d/${m['file']}').readAsBytesSync();
        validateGlb(glb);
        expect((m['references'] as List), isNotEmpty);
        expect(m['certainty'], contains('interpretativa'));
      }
    },
  );
  test(
    'Every chapter has a real model association within a four chapter block',
    () {
      final data =
          jsonDecode(
                File('assets/content/model-scenes.json').readAsStringSync(),
              )
              as Map;
      final scenes = (data['scenes'] as List)
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      final ids =
          (jsonDecode(File('assets/3d/models.json').readAsStringSync()) as List)
              .map((e) => e['id'])
              .toSet();
      expect(scenes.length, 321);
      final covered = <String>{};
      for (final block in scenes) {
        final book = block['book'] as int,
            start = block['start_chapter'] as int,
            end = block['end_chapter'] as int;
        expect(end - start, inInclusiveRange(0, 3));
        expect(block['items'] as List, isNotEmpty);
        for (var ch = start; ch <= end; ch++) {
          expect(covered.add('$book:$ch'), isTrue);
          expect(
            modelBlockAt(scenes, Reference(book, ch, 1))?['id'],
            block['id'],
          );
        }
        for (final item in block['items'] as List) {
          final ref = Reference.fromId(item['reference'] as String)!;
          expect(ref.book, book);
          expect(ref.chapter, inInclusiveRange(start, end));
          expect(s.verse('BLN4', ref), isNotNull);
          expect(ids.contains(item['model_id']), isTrue);
          expect(['t', 'c', 'm', 'v'], contains(item['kind']));
          expect(item['explanation'], isNotEmpty);
        }
      }
      for (var book = 1; book <= 66; book++) {
        for (var ch = 1; ch <= s.chapters('BLN4', book); ch++) {
          expect(covered, contains('$book:$ch'));
        }
      }
      expect(covered.length, 1189);
      expect(
        s
            .search('candeeiros', 'BLN4')
            .any((r) => r['category'] == 'model_index'),
        isTrue,
      );
    },
  );
  testWidgets('Reader provides contextual 3D models in reading mode', (
    tester,
  ) async {
    final a = AppController(s);
    a.navigate(Reference(1, 6, 1));
    a.set('study', false);
    await tester.runAsync(() async {
      await loadModels(s);
      await loadModelScenes();
    });
    s.setPref('dedication_seen', true);
    s.setPref('onboarding_done', true);
    await tester.pumpWidget(BibleApp(a));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('reader-3d')));
    await tester.pump();
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 80));
    });
    await tester.pumpAndSettle();
    expect(find.byType(ModelsPage), findsOneWidget);
    expect(find.text('Arca de Noé'), findsOneWidget);
    expect(find.text('Gênesis 5–8'), findsOneWidget);
    expect(find.text('Objeto no texto'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'Reader keyboard passage navigation, verse selection and small screen render',
    (tester) async {
      tester.view.physicalSize = const Size(460, 920);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final a = AppController(s);
      s.setPref('dedication_seen', true);
      s.setPref('onboarding_done', true);
      final key = GlobalKey();
      await tester.pumpWidget(RepaintBoundary(key: key, child: BibleApp(a)));
      await tester.pumpAndSettle();
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.keyL);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
      await tester.pumpAndSettle();
      expect(find.byType(PassagePicker), findsOneWidget);
      final manual = find.text('Digitar uma referência');
      await tester.ensureVisible(manual);
      await tester.tap(manual);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Rm 8:28');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(a.passage.id, '45:8:28');
      expect(find.byType(PassagePicker), findsNothing);
      final verse = find.byWidgetPredicate(
        (w) =>
            w is Semantics &&
            (w.properties.label ?? '').startsWith('Romanos 8:28.'),
      );
      await tester.tap(verse);
      await tester.pumpAndSettle();
      expect(find.text('Copiar'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final boundary =
            key.currentContext!.findRenderObject() as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 1.5);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        final screenshot = File('../recovery/reader.png');
        await screenshot.parent.create(recursive: true);
        await screenshot.writeAsBytes(bytes!.buffer.asUint8List());
      });
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'Dedication accepts Enter once and transitions to optional setup',
    (tester) async {
      final a = AppController(s);
      await tester.pumpWidget(BibleApp(a));
      await tester.pumpAndSettle();
      expect(
        find.text('Em presente dedicatória à Rebeca Teles'),
        findsOneWidget,
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(s.pref('dedication_seen', false), isTrue);
      expect(find.byType(FirstSetup), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'Study desk starts with descriptive mode and exposes explicit mode switching',
    (tester) async {
      final a = AppController(s),
          row = s
              .studies(topic: 'sabbath', target: 'seventh_day_adventist')
              .first;
      await tester.pumpWidget(
        AppScope(
          app: a,
          child: MaterialApp(
            home: Scaffold(body: StudyPage(row, apologetic: false)),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Examinar a objeção mais forte'), findsNothing);
      await tester.tap(find.text('Apologética presbiteriana').first);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Examinar a objeção mais forte'),
        250,
        scrollable: find
            .descendant(
              of: find.byType(StudyPage),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.text('Examinar a objeção mais forte'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
}

extension Integrity on Store {
  bool storeIntegrity() => [
    content,
    lexical,
    library,
  ].every((db) => db.select('PRAGMA quick_check').first.values.first == 'ok');
}

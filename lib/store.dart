import 'scripture_links.dart';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:uuid/uuid.dart';
import 'domain.dart';

typedef RecordRow = Map<String, Object?>;
Map<String, dynamic> jsonMap(Object? text) {
  try {
    return Map<String, dynamic>.from(jsonDecode(text as String));
  } catch (_) {
    return {};
  }
}

List<dynamic> jsonList(Object? text) {
  try {
    return List<dynamic>.from(jsonDecode(text as String));
  } catch (_) {
    return [];
  }
}

class Store {
  final Database content, personal, lexical, library;
  final String directory;
  Database? _connections;
  Database? _portuguese;
  Store(
    this.content,
    this.personal,
    this.lexical,
    this.library,
    this.directory,
  ) {
    initPersonal();
  }
  static Future<Store> open() async {
    final dir = await getApplicationSupportDirectory();
    await dir.create(recursive: true);
    for (final name in [
      'catalogue',
      'lexicon',
      'library',
      'connections',
      'portuguese',
    ]) {
      final target = File(p.join(dir.path, '$name.sqlite'));
      final updateable = name == 'connections' || name == 'portuguese';
      final expected = (await rootBundle.loadString(
        'assets/content/$name.sha256',
      )).trim();
      if (!await target.exists() ||
          (updateable &&
              sha256.convert(await target.readAsBytes()).toString() !=
                  expected)) {
        final data = await rootBundle.load('assets/content/$name.sqlite');
        final bytes = data.buffer.asUint8List(
          data.offsetInBytes,
          data.lengthInBytes,
        );

        if (sha256.convert(bytes).toString() != expected) {
          throw StateError('Content integrity: $name');
        }
        final temp = File('${target.path}.tmp');
        await temp.writeAsBytes(bytes, flush: true);
        await temp.rename(target.path);
      }
    }
    final store = Store(
      sqlite3.open(p.join(dir.path, 'catalogue.sqlite')),
      sqlite3.open(p.join(dir.path, 'personal.sqlite')),
      sqlite3.open(p.join(dir.path, 'lexicon.sqlite')),
      sqlite3.open(p.join(dir.path, 'library.sqlite')),
      dir.path,
    );
    await store.refreshModelIndex();
    await store.refreshEditorial();
    return store;
  }

  Future<void> refreshEditorial() async {
    final raw = await rootBundle.loadString(
      'assets/content/editorial-expansion.json',
    );
    final digest = sha256.convert(utf8.encode(raw)).toString();
    if (pref('editorial_expansion_hash', '') == digest) return;
    final data = jsonMap(raw);
    content.execute('BEGIN IMMEDIATE');
    try {
      for (final record in data['studies'] as List) {
        final row = Map<String, dynamic>.from(record as Map);
        content.execute(
          'INSERT OR REPLACE INTO studies VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          [
            row['id'],
            row['level'],
            row['topic'],
            row['target'],
            row['title'],
            row['exposition'],
            row['response'],
            row['strongest'],
            row['rejoinder'],
            jsonEncode(row['refs']),
            jsonEncode(row['sources']),
          ],
        );
        content.execute('DELETE FROM study_search WHERE id=?', [row['id']]);
        content.execute('INSERT INTO study_search VALUES(?,?,?,?)', [
          row['id'],
          row['title'],
          row['exposition'],
          row['response'],
        ]);
      }
      content.execute('COMMIT');
      setPref('editorial_expansion_hash', digest);
    } catch (_) {
      content.execute('ROLLBACK');
      rethrow;
    }
  }

  Future<void> refreshModelIndex() async {
    final raw = await rootBundle.loadString('assets/3d/models.json');
    final digest = sha256.convert(utf8.encode(raw)).toString();
    if (pref('model_index_hash', '') == digest) return;
    final models = jsonDecode(raw) as List;
    final scenes =
        jsonDecode(
              await rootBundle.loadString('assets/content/model-scenes.json'),
            )
            as Map;
    content.execute('BEGIN IMMEDIATE');
    try {
      content.execute(
        "DELETE FROM document_search WHERE id IN (SELECT id FROM documents WHERE module_id='APP-3D')",
      );
      content.execute("DELETE FROM documents WHERE module_id='APP-3D'");
      content.execute(
        'INSERT OR REPLACE INTO content_modules VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          'APP-3D',
          'Acervo 3D e associações bíblicas',
          'model_collection',
          'pt',
          '1.0',
          'Kelvin e Silva Marques',
          'CC BY 4.0',
          'https://creativecommons.org/licenses/by/4.0/',
          'Passagens bíblicas indicadas; geometria original do projeto.',
          1,
          1,
          jsonEncode({
            'models': models.length,
            'blocks': scenes['blocks'],
            'chapter_interval': 4,
          }),
        ],
      );
      for (final model in models) {
        final id = 'model:${model['id']}', refs = model['references'] as List;
        final body =
            '${model['description']}\n${model['certainty']}\n${refs.join(' · ')}';
        content.execute(
          'INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?,?,?)',
          [
            id,
            'APP-3D',
            'model_index',
            model['title'],
            body,
            refs.first,
            jsonEncode({'model_id': model['id'], 'references': refs}),
          ],
        );
        content.execute('INSERT INTO document_search VALUES(?,?,?)', [
          id,
          model['title'],
          body,
        ]);
      }
      content.execute('COMMIT');
      setPref('model_index_hash', digest);
    } catch (_) {
      content.execute('ROLLBACK');
      rethrow;
    }
  }

  Database? get connections {
    final file = File(p.join(directory, 'connections.sqlite'));
    return _connections ??= file.existsSync()
        ? sqlite3.open(file.path, mode: OpenMode.readOnly)
        : null;
  }

  Database? get portuguese {
    final file = File(p.join(directory, 'portuguese.sqlite'));
    return _portuguese ??= file.existsSync()
        ? sqlite3.open(file.path, mode: OpenMode.readOnly)
        : null;
  }

  List<RecordRow> crossReferences(
    Reference reference, {
    int limit = 30,
    bool includeChapter = true,
  }) {
    final db = connections;
    if (db == null) return [];
    var rows = query(
      db,
      'SELECT * FROM cross_references WHERE source=? ORDER BY priority DESC,target LIMIT ?',
      [reference.id, limit],
    );
    var scope = 'verse';
    if (rows.isEmpty && includeChapter) {
      rows = query(
        db,
        'SELECT * FROM cross_references WHERE source LIKE ? ORDER BY priority DESC,target LIMIT ?',
        ['${reference.book}:${reference.chapter}:%', limit],
      );
      scope = 'chapter';
    }
    final seen = <String>{};
    return rows
        .where((r) => seen.add('${r['target']}..${r['end_reference']}'))
        .map((r) => {...r, 'scope': scope})
        .toList();
  }

  int crossReferenceCount(Reference reference) =>
      connections?.select(
            'SELECT count(*) AS n FROM cross_references WHERE source=?',
            [reference.id],
          ).first['n']
          as int? ??
      0;
  RecordRow? translatedEntry(String type, String id) {
    final db = portuguese;
    if (db == null) return null;
    final rows = query(db, 'SELECT * FROM translations WHERE type=? AND id=?', [
      type,
      id,
    ]);
    return rows.firstOrNull;
  }

  void initPersonal() {
    personal.execute('PRAGMA foreign_keys=ON');
    personal.execute('PRAGMA journal_mode=WAL');
    personal.execute(
      '''CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,title TEXT,body TEXT,reference TEXT,notebook TEXT,tags TEXT,updated_at INTEGER);
CREATE TABLE IF NOT EXISTS note_links(source_id TEXT,target_id TEXT,kind TEXT,PRIMARY KEY(source_id,target_id));
CREATE TABLE IF NOT EXISTS highlights(reference TEXT,translation TEXT,color INTEGER,PRIMARY KEY(reference,translation));
CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,title TEXT);
CREATE TABLE IF NOT EXISTS study_tabs(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,title TEXT);
CREATE TABLE IF NOT EXISTS reading_history(id INTEGER PRIMARY KEY AUTOINCREMENT,reference TEXT,translation TEXT,created_at INTEGER);
CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,note_id TEXT,filename TEXT,path TEXT,sha256 TEXT);
CREATE TABLE IF NOT EXISTS flashcards(id TEXT PRIMARY KEY,reference TEXT,translation TEXT,text TEXT,topic TEXT,mode TEXT,repetitions INTEGER,interval INTEGER,ease REAL,due INTEGER);
CREATE TABLE IF NOT EXISTS review_history(id TEXT PRIMARY KEY,card_id TEXT,grade INTEGER,reviewed_at INTEGER);
CREATE TABLE IF NOT EXISTS learning_progress(id TEXT PRIMARY KEY,completed INTEGER,updated_at INTEGER);
CREATE VIRTUAL TABLE IF NOT EXISTS note_search USING fts5(id UNINDEXED,title,body,tags,tokenize='unicode61 remove_diacritics 2');''',
    );
  }

  List<RecordRow> query(
    Database db,
    String sql, [
    List<Object?> values = const [],
  ]) =>
      db.select(sql, values).map((r) => Map<String, Object?>.from(r)).toList();
  T pref<T>(String key, T fallback) {
    final r = personal.select('SELECT value FROM preferences WHERE key=?', [
      key,
    ]);
    if (r.isEmpty) return fallback;
    try {
      final v = jsonDecode(r.first['value'] as String);
      if (v is T) return v;
      if (fallback is double && v is num) return v.toDouble() as T;
    } catch (_) {}
    return fallback;
  }

  void setPref(String key, Object? value) => personal.execute(
    'INSERT OR REPLACE INTO preferences VALUES(?,?)',
    [key, jsonEncode(value)],
  );
  List<RecordRow> modules({String? kind, bool installedOnly = false}) => query(
    content,
    'SELECT * FROM content_modules WHERE (? IS NULL OR kind=?) AND (?=0 OR installed=1) ORDER BY CASE id WHEN \'ARA\' THEN 0 WHEN \'BLN4\' THEN 1 ELSE 2 END,title',
    [kind, kind, installedOnly ? 1 : 0],
  );
  RecordRow? module(String id) {
    final rows = query(content, 'SELECT * FROM content_modules WHERE id=?', [
      id,
    ]);
    return rows.isEmpty ? null : rows.first;
  }

  bool installed(String id) => module(id)?['installed'] == 1;
  List<RecordRow> verses(String translation, int book, {int? chapter}) => query(
    content,
    'SELECT * FROM verses WHERE translation=? AND book=? AND (? IS NULL OR chapter=?) ORDER BY chapter,verse',
    [translation, book, chapter, chapter],
  );
  RecordRow? verse(String translation, Reference r) {
    if (!installed(translation)) return null;
    final rows = query(
      content,
      'SELECT * FROM verses WHERE translation=? AND reference=?',
      [translation, r.id],
    );
    return rows.isEmpty ? null : rows.first;
  }

  int chapters(String translation, int book) =>
      content.select(
            'SELECT COALESCE(MAX(chapter),0) AS n FROM verses WHERE translation=? AND book=?',
            [translation, book],
          ).first['n']
          as int;
  List<int> availableBooks(String translation) => content
      .select(
        'SELECT DISTINCT book FROM verses WHERE translation=? ORDER BY book',
        [translation],
      )
      .map((r) => r['book'] as int)
      .toList();
  Reference? mapped(String a, Reference r, String b) {
    final found = content.select(
      'SELECT target_reference FROM verse_mappings WHERE source_translation=? AND source_reference=? AND target_translation=?',
      [a, r.id, b],
    );
    if (found.isNotEmpty) {
      return Reference.fromId(found.first['target_reference'] as String);
    }
    final reverse = content.select(
      'SELECT source_reference FROM verse_mappings WHERE source_translation=? AND target_translation=? AND target_reference=?',
      [b, a, r.id],
    );
    if (reverse.length == 1) {
      return Reference.fromId(reverse.first['source_reference'] as String);
    }
    final ma = jsonMap(module(a)?['metadata']),
        mb = jsonMap(module(b)?['metadata']);
    if (a == b ||
        (ma['versification'] == 'KJV' && mb['versification'] == 'KJV')) {
      return r;
    }
    return null;
  }

  void recordReading(String translation, Reference reference) {
    setPref('last_reference', reference.id);
    setPref('translation', translation);
    final rows = personal.select(
      'SELECT reference,translation FROM reading_history ORDER BY id DESC LIMIT 1',
    );
    if (rows.isEmpty ||
        rows.first['reference'] != reference.id ||
        rows.first['translation'] != translation) {
      personal.execute(
        'INSERT INTO reading_history(reference,translation,created_at) VALUES(?,?,?)',
        [reference.id, translation, DateTime.now().millisecondsSinceEpoch],
      );
      personal.execute(
        'DELETE FROM reading_history WHERE id NOT IN (SELECT id FROM reading_history ORDER BY id DESC LIMIT 100)',
      );
    }
  }

  List<RecordRow> get notes =>
      query(personal, 'SELECT * FROM notes ORDER BY updated_at DESC');
  RecordRow? note(String id) {
    final rows = query(personal, 'SELECT * FROM notes WHERE id=?', [id]);
    return rows.isEmpty ? null : rows.first;
  }

  String saveNote({
    String? id,
    required String title,
    required String body,
    String reference = '',
    String notebook = 'Estudos',
    String tags = '',
  }) {
    id ??= const Uuid().v4();
    final now = DateTime.now().millisecondsSinceEpoch;
    personal.execute('BEGIN IMMEDIATE');
    try {
      personal.execute('INSERT OR REPLACE INTO notes VALUES(?,?,?,?,?,?,?)', [
        id,
        title,
        body,
        reference,
        notebook,
        tags,
        now,
      ]);
      personal.execute('DELETE FROM note_links WHERE source_id=?', [id]);
      for (final match in RegExp(r'\[\[([^\]]+)\]\]').allMatches(body)) {
        final target = match[1]!.trim();
        final r = Reference.parse(target);
        personal.execute('INSERT OR IGNORE INTO note_links VALUES(?,?,?)', [
          id,
          r?.id ?? (target.startsWith('note:') ? target.substring(5) : target),
          r == null ? 'personal' : 'biblical',
        ]);
      }
      for (final reference in linkedReferences(body)) {
        personal.execute('INSERT OR IGNORE INTO note_links VALUES(?,?,?)', [
          id,
          reference.id,
          'biblical',
        ]);
      }
      personal.execute('DELETE FROM note_search WHERE id=?', [id]);
      personal.execute('INSERT INTO note_search VALUES(?,?,?,?)', [
        id,
        title,
        body,
        tags,
      ]);
      personal.execute('COMMIT');
      return id;
    } catch (_) {
      personal.execute('ROLLBACK');
      rethrow;
    }
  }

  void deleteNote(String id) {
    personal.execute('BEGIN');
    try {
      personal.execute('DELETE FROM notes WHERE id=?', [id]);
      personal.execute('DELETE FROM note_links WHERE source_id=?', [id]);
      personal.execute('DELETE FROM note_search WHERE id=?', [id]);
      personal.execute('COMMIT');
    } catch (_) {
      personal.execute('ROLLBACK');
      rethrow;
    }
  }

  List<RecordRow> backlinks(String target) => query(
    personal,
    'SELECT n.* FROM notes n JOIN note_links l ON n.id=l.source_id WHERE l.target_id=? ORDER BY n.updated_at DESC',
    [target],
  );
  List<RecordRow> notesAt(String reference) => query(
    personal,
    'SELECT * FROM notes WHERE reference=? ORDER BY updated_at DESC',
    [reference],
  );
  void highlight(String translation, Iterable<String> refs, int? color) {
    for (final ref in refs) {
      if (color == null) {
        personal.execute(
          'DELETE FROM highlights WHERE translation=? AND reference=?',
          [translation, ref],
        );
      } else {
        personal.execute('INSERT OR REPLACE INTO highlights VALUES(?,?,?)', [
          ref,
          translation,
          color,
        ]);
      }
    }
  }

  Map<String, int> highlights(String translation, int book) => {
    for (final r in personal.select(
      'SELECT reference,color FROM highlights WHERE translation=? AND reference LIKE ?',
      [translation, '$book:%'],
    ))
      r['reference'] as String: r['color'] as int,
  };
  void savePlace(
    String kind,
    String reference,
    String translation,
    String title, {
    String? id,
  }) {
    if (!['bookmarks', 'study_tabs'].contains(kind)) throw ArgumentError(kind);
    personal.execute('INSERT OR REPLACE INTO $kind VALUES(?,?,?,?)', [
      id ?? const Uuid().v4(),
      reference,
      translation,
      title,
    ]);
  }

  List<RecordRow> savedPlaces(String kind) {
    if (!['bookmarks', 'study_tabs', 'reading_history'].contains(kind)) {
      throw ArgumentError(kind);
    }
    return query(
      personal,
      'SELECT * FROM $kind${kind == 'reading_history' ? ' ORDER BY id DESC' : ''}',
    );
  }

  void deletePlace(String kind, String id) {
    if (!['bookmarks', 'study_tabs'].contains(kind)) throw ArgumentError(kind);
    personal.execute('DELETE FROM $kind WHERE id=?', [id]);
  }

  List<RecordRow> documents({String? moduleId, String? kind}) => query(
    content,
    'SELECT d.* FROM documents d JOIN content_modules m ON d.module_id=m.id WHERE m.installed=1 AND (? IS NULL OR d.module_id=?) AND (? IS NULL OR d.kind=?) ORDER BY d.id',
    [moduleId, moduleId, kind, kind],
  );
  RecordRow? document(String id) {
    final rows = query(
      content,
      'SELECT d.* FROM documents d JOIN content_modules m ON d.module_id=m.id WHERE d.id=? AND m.installed=1',
      [id],
    );
    return rows.isEmpty ? null : rows.first;
  }

  List<RecordRow> commentaries(
    Reference r, {
    String? moduleId,
    String? sourceTranslation,
  }) {
    if (sourceTranslation != null) {
      final reference = mapped(sourceTranslation, r, 'BLN4');
      if (reference != null) {
        r = reference;
      } else if (jsonMap(
                module(sourceTranslation)?['metadata'],
              )['versification'] ==
              'ARA1993' &&
          {
            '9:20',
            '11:22',
            '47:13',
            '64:1',
          }.contains('${r.book}:${r.chapter}')) {
        return [];
      }
    }
    final available = modules(
      kind: 'commentary',
      installedOnly: true,
    ).map((r) => r['id']).toSet();
    return query(
      library,
      'SELECT * FROM commentary_entries WHERE start_key<=? AND end_key>=? AND (? IS NULL OR module_id=?) ORDER BY module_id,start_key DESC',
      [r.key, r.key, moduleId, moduleId],
    ).where((r) => available.contains(r['module_id'])).toList();
  }

  List<RecordRow> wordsAt(Reference r, {String? sourceTranslation}) {
    if (sourceTranslation != null &&
        jsonMap(module(sourceTranslation)?['metadata'])['versification'] ==
            'ARA1993' &&
        {'47:13', '64:1'}.contains('${r.book}:${r.chapter}')) {
      final mappedRef = mapped(sourceTranslation, r, 'BLN4');
      if (mappedRef == null) return [];
      r = mappedRef;
    }
    return query(
      lexical,
      'SELECT w.*,l.lemma,l.transliteration,l.gloss,l.definition,l.language,l.source FROM words w LEFT JOIN lexemes l ON w.lexeme=l.id WHERE w.reference=? ORDER BY edition,position',
      [r.id],
    ).where((w) => installed(w['module_id'] as String)).toList();
  }

  String strongId(String s) {
    final m = RegExp(r'^([GH])0*(\d+)$', caseSensitive: false).firstMatch(s);
    return m == null ? s : '${m[1]!.toUpperCase()}${int.parse(m[2]!)}';
  }

  List<RecordRow> occurrences(String lemma) => query(
    lexical,
    'SELECT DISTINCT edition,reference,surface,morphology FROM words WHERE lexeme=? ORDER BY edition,reference LIMIT 200',
    [strongId(lemma)],
  );
  int frequency(String lemma) =>
      lexical.select('SELECT COUNT(*) AS n FROM words WHERE lexeme=?', [
            strongId(lemma),
          ]).first['n']
          as int;
  List<RecordRow> studies({String? topic, String? target, int? level}) => query(
    content,
    'SELECT * FROM studies WHERE (? IS NULL OR topic=?) AND (? IS NULL OR target=?) AND (? IS NULL OR level=?) ORDER BY level,title',
    [topic, topic, target, target, level, level],
  );
  void completed(String id, bool value) => personal.execute(
    'INSERT OR REPLACE INTO learning_progress VALUES(?,?,?)',
    [id, value ? 1 : 0, DateTime.now().millisecondsSinceEpoch],
  );
  bool isCompleted(String id) =>
      personal.select('SELECT completed FROM learning_progress WHERE id=?', [
        id,
      ]).firstOrNull?['completed'] ==
      1;
  void addCard(
    String translation,
    Reference r,
    String text, {
    String mode = 'reference_to_text',
    String topic = '',
  }) => personal.execute('INSERT INTO flashcards VALUES(?,?,?,?,?,?,?,?,?,?)', [
    const Uuid().v4(),
    r.id,
    translation,
    text,
    topic,
    mode,
    0,
    0,
    2.5,
    0,
  ]);
  List<RecordRow> cards({bool dueOnly = false}) => query(
    personal,
    'SELECT * FROM flashcards WHERE (?=0 OR due<=?) ORDER BY due',
    [dueOnly ? 1 : 0, DateTime.now().millisecondsSinceEpoch],
  );
  void review(RecordRow card, int grade) {
    final now = DateTime.now();
    final old = ReviewSchedule(
      repetitions: card['repetitions'] as int,
      interval: card['interval'] as int,
      ease: (card['ease'] as num).toDouble(),
      due: card['due'] as int,
    );
    final next = old.review(grade, now);
    personal.execute('BEGIN');
    try {
      personal.execute(
        'UPDATE flashcards SET repetitions=?,interval=?,ease=?,due=? WHERE id=?',
        [next.repetitions, next.interval, next.ease, next.due, card['id']],
      );
      personal.execute('INSERT INTO review_history VALUES(?,?,?,?)', [
        const Uuid().v4(),
        card['id'],
        grade,
        now.millisecondsSinceEpoch,
      ]);
      personal.execute('COMMIT');
    } catch (_) {
      personal.execute('ROLLBACK');
      rethrow;
    }
  }

  Future<String> attach(String noteId, String filename, Uint8List bytes) async {
    if (bytes.length > 20 * 1024 * 1024) {
      throw ArgumentError('Attachment exceeds 20 MB');
    }
    final id = const Uuid().v4();
    final ext = p.extension(filename).toLowerCase();
    final path = p.join(
      directory,
      'attachments',
      '$id${RegExp(r'^\.[a-z0-9]{1,8}$').hasMatch(ext) ? ext : '.bin'}',
    );
    final file = File(path);
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes, flush: true);
    personal.execute('INSERT INTO attachments VALUES(?,?,?,?,?)', [
      id,
      noteId,
      p.basename(filename),
      path,
      sha256.convert(bytes).toString(),
    ]);
    return id;
  }

  RecordRow? attachment(String id) {
    final r = query(personal, 'SELECT * FROM attachments WHERE id=?', [id]);
    return r.isEmpty ? null : r.first;
  }

  static String fts(String query) => RegExp(r'[\p{L}\p{N}]+', unicode: true)
      .allMatches(query.substring(0, query.length.clamp(0, 300)))
      .map((m) => '"${m[0]}"')
      .join(' AND ');
  List<RecordRow> search(String queryText, String translation) {
    final q = fts(queryText);
    if (q.isEmpty) return [];
    final hits = <RecordRow>[];
    final pt = portuguese;
    if (pt != null &&
        pt
            .select(
              "SELECT name FROM sqlite_master WHERE name='translation_search'",
            )
            .isNotEmpty) {
      for (final r in query(
        pt,
        'SELECT t.* FROM translation_search f JOIN translations t ON t.type=f.type AND t.id=f.id WHERE translation_search MATCH ? LIMIT 80',
        [q],
      )) {
        final id = r['id'] as String;
        if (r['type'] == 'commentary') {
          final entries = query(
            library,
            'SELECT reference,module_id,title FROM commentary_entries WHERE id=?',
            [id],
          );
          if (entries.isEmpty ||
              !installed(entries.first['module_id'] as String)) {
            continue;
          }
          hits.add({
            'category': 'commentary',
            'id': id,
            'title': r['title'],
            'body': r['body'],
            'source': entries.first['module_id'],
            'reference': entries.first['reference'],
          });
        } else if (r['type'] == 'lexeme') {
          final word = query(lexical, 'SELECT * FROM lexemes WHERE id=?', [
            id,
          ]).firstOrNull;
          if (word != null) {
            hits.add({
              'category': 'lexicon',
              'id': id,
              'title': '$id · ${word['lemma']}',
              'body': r['gloss'],
              'source': word['source'],
            });
          }
        } else if (r['type'] == 'document') {
          final doc = document(id);
          if (doc != null && installed(doc['module_id'] as String)) {
            hits.add({
              'category': doc['kind'],
              'id': id,
              'title': doc['title'],
              'body': r['body'],
              'source': doc['module_id'],
            });
          }
        }
      }
    }
    for (final r in query(
      content,
      'SELECT reference,text FROM verse_search WHERE verse_search MATCH ? AND translation=? LIMIT 60',
      [q, translation],
    )) {
      hits.add({
        'category': 'bible',
        'id': r['reference'],
        'title':
            Reference.fromId(r['reference'] as String)?.label() ??
            r['reference'],
        'body': r['text'],
        'source': translation,
      });
    }
    for (final r in query(
      personal,
      'SELECT n.* FROM note_search f JOIN notes n ON f.id=n.id WHERE note_search MATCH ? LIMIT 40',
      [q],
    )) {
      hits.add({
        'category': 'notes',
        'id': r['id'],
        'title': r['title'],
        'body': r['body'],
        'source': r['notebook'],
      });
    }
    for (final r in query(
      content,
      'SELECT d.* FROM document_search f JOIN documents d ON f.id=d.id JOIN content_modules m ON m.id=d.module_id WHERE document_search MATCH ? AND m.installed=1 LIMIT 40',
      [q],
    )) {
      hits.add({
        'category': r['kind'],
        'id': r['id'],
        'title': r['title'],
        'body': r['body'],
        'source': r['module_id'],
      });
    }
    for (final r in query(
      content,
      'SELECT s.* FROM study_search f JOIN studies s ON f.id=s.id WHERE study_search MATCH ? LIMIT 40',
      [q],
    )) {
      hits.add({
        'category': 'studies',
        'id': r['id'],
        'title': r['title'],
        'body': r['response'],
        'source': 'Apologética reformada',
      });
    }
    final active = modules(
      kind: 'commentary',
      installedOnly: true,
    ).map((m) => m['id']).toSet();
    for (final r in query(
      library,
      'SELECT c.* FROM commentary_search f JOIN commentary_entries c ON f.id=c.id WHERE commentary_search MATCH ? LIMIT 60',
      [q],
    )) {
      if (active.contains(r['module_id'])) {
        hits.add({
          'category': 'commentary',
          'id': r['id'],
          'title': r['title'],
          'body': r['body'],
          'source': r['module_id'],
          'reference': r['reference'],
        });
      }
    }
    for (final r in query(
      lexical,
      'SELECT l.* FROM lexical_search f JOIN lexemes l ON l.id=f.id WHERE lexical_search MATCH ? LIMIT 40',
      [q],
    )) {
      hits.add({
        'category': 'lexicon',
        'id': r['id'],
        'title': '${r['id']} · ${r['lemma']}',
        'body': r['gloss'],
        'source': r['source'],
      });
    }
    final seen = <String>{};
    return hits.where((h) => seen.add('${h['category']}:${h['id']}')).toList();
  }

  String? suggestion(String queryText) {
    final q = fold(queryText);
    if (q.length < 4 || q.contains(' ')) return null;
    final candidates = content.select(
      'SELECT term FROM verse_vocab WHERE term LIKE ? LIMIT 600',
      ['${q.substring(0, 2)}%'],
    );
    final ranked = [
      for (final c in candidates)
        (c['term'] as String, editDistance(q, c['term'] as String)),
    ]..sort((a, b) => a.$2.compareTo(b.$2));
    return ranked.isNotEmpty && ranked.first.$2 <= 2 && ranked.first.$1 != q
        ? ranked.first.$1
        : null;
  }

  void removeModule(String id) {
    final m = module(id);
    if (m == null) return;
    if (m['kind'] == 'bible' &&
        m['installed'] == 1 &&
        modules(kind: 'bible', installedOnly: true).length <= 1) {
      throw StateError('Keep one Bible installed');
    }
    content.execute('UPDATE content_modules SET installed=0 WHERE id=?', [id]);
  }

  void restoreModule(String id) {
    if (module(id)?['builtin'] != 1) {
      throw StateError('Import the content package again');
    }
    content.execute('UPDATE content_modules SET installed=1 WHERE id=?', [id]);
  }

  void dispose() {
    content.dispose();
    personal.dispose();
    lexical.dispose();
    library.dispose();
    _connections?.dispose();
    _portuguese?.dispose();
  }
}

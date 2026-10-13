import 'dart:isolate';
import 'package:sqlite3/common.dart';
import 'sqlite_runtime.dart' as runtime;
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'domain.dart';
import 'store.dart';

const packageKinds = [
  'bible',
  'commentary',
  'dictionary',
  'confession',
  'lexicon',
  'atlas',
  'model',
  'study',
];

class ContentPackage {
  final Map<String, dynamic> manifest;
  final List<Map<String, dynamic>> records;
  final Map<String, Uint8List> files;
  ContentPackage(this.manifest, this.records, this.files);
  static ContentPackage parse(Uint8List bytes) {
    if (bytes.length > 80 * 1024 * 1024) {
      throw const FormatException('Package exceeds 80 MB');
    }
    final archive = ZipDecoder().decodeBytes(bytes, verify: true);
    final files = <String, Uint8List>{};
    var total = 0;
    for (final file in archive) {
      if (!file.isFile) continue;
      final name = file.name;
      if (name.startsWith('/') ||
          name.contains('\\') ||
          name.split('/').any((s) => s == '..' || s.isEmpty) ||
          files.containsKey(name) ||
          name.contains(':')) {
        throw const FormatException('Unsafe or duplicate path');
      }
      total += file.size;
      if (total > 240 * 1024 * 1024) {
        throw const FormatException('Expanded package too large');
      }
      files[name] = Uint8List.fromList(file.content as List<int>);
    }
    final raw = files['manifest.json'];
    if (raw == null) throw const FormatException('Missing manifest');
    final m = Map<String, dynamic>.from(jsonDecode(utf8.decode(raw)));
    if (m['format_version'] != 1 ||
        !packageKinds.contains(m['kind']) ||
        !RegExp(
          r'^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$',
        ).hasMatch(m['id'] is String ? m['id'] as String : '')) {
      throw const FormatException('Unsupported package');
    }
    for (final key in [
      'title',
      'version',
      'language',
      'author',
      'license',
      'license_text',
      'source',
    ]) {
      if (m[key] is! String || (m[key] as String).trim().isEmpty) {
        throw FormatException('Missing $key');
      }
    }
    if (m['dependencies'] is! List ||
        (m['dependencies'] as List).any((v) => v is! String)) {
      throw const FormatException('Invalid dependencies');
    }
    final min = m['min_app_version'];
    if (min != null) {
      if (min is! String || !RegExp(r'^\d+\.\d+\.\d+$').hasMatch(min)) {
        throw const FormatException('Invalid minimum app version');
      }
      final required = min.split('.').map(int.parse).toList(),
          current = [0, 5, 0];
      for (var i = 0; i < 3; i++) {
        if (required[i] > current[i]) {
          throw const FormatException('Package needs a newer application');
        }
        if (required[i] < current[i]) break;
      }
    }
    if (m['files'] is! Map) throw const FormatException('Missing file hashes');
    final hashes = Map<String, dynamic>.from(m['files']);
    for (final entry in hashes.entries) {
      final payload = files[entry.key];
      if (payload == null ||
          entry.value != sha256.convert(payload).toString()) {
        throw FormatException('Integrity failure: ${entry.key}');
      }
    }
    if (files.keys.any(
      (name) => name != 'manifest.json' && !hashes.containsKey(name),
    )) {
      throw const FormatException('Unexpected file');
    }
    final name = m['kind'] == 'bible' ? 'verses.json' : 'data.json';
    if (!files.containsKey(name)) {
      throw const FormatException('Missing records');
    }
    final values = jsonDecode(utf8.decode(files[name]!));
    if (values is! List || values.length > 500000) {
      throw const FormatException('Invalid record list');
    }
    final rows = values
        .map((v) => Map<String, dynamic>.from(v as Map))
        .toList();
    final keys = <String>{};
    for (final row in rows) {
      if (m['kind'] == 'bible') {
        final r = Reference.fromId(
          row['reference'] is String ? row['reference'] as String : '',
        );
        if (r == null ||
            row['text'] is! String ||
            (row['text'] as String).isEmpty ||
            !keys.add(r.id)) {
          throw const FormatException('Invalid or duplicate verse');
        }
        final metadata = row['metadata'] ?? {};
        if (metadata is! Map) throw const FormatException('Invalid metadata');
        if (metadata['heading'] != null && metadata['heading'] is! String) {
          throw const FormatException('Invalid heading');
        }
        for (final range in metadata['red_ranges'] ?? []) {
          if (range is! List ||
              range.length != 2 ||
              range.any((v) => v is! int) ||
              range[0] < 0 ||
              range[1] > row['text'].length ||
              range[0] >= range[1]) {
            throw const FormatException('Invalid red range');
          }
        }
      } else {
        if (row['id'] is! String || !keys.add(row['id'] as String)) {
          throw const FormatException('Invalid record ID');
        }
        if (m['kind'] == 'commentary') {
          final a = Reference.fromId(row['reference'] ?? ''),
              b = Reference.fromId(
                row['end_reference'] ?? row['reference'] ?? '',
              );
          if (a == null ||
              b == null ||
              b.key < a.key ||
              row['body'] is! String) {
            throw const FormatException('Invalid commentary range');
          }
        } else if (['dictionary', 'confession', 'study'].contains(m['kind'])) {
          if (row['title'] is! String || row['body'] is! String) {
            throw const FormatException('Invalid document');
          }
        } else if (m['kind'] == 'lexicon') {
          if (row['lemma'] is! String || row['gloss'] is! String) {
            throw const FormatException('Invalid lexeme');
          }
        } else if (m['kind'] == 'atlas') {
          for (final place in row['places'] ?? []) {
            if (place['lat'] is! num ||
                place['lon'] is! num ||
                place['lat'] < -90 ||
                place['lat'] > 90 ||
                place['lon'] < -180 ||
                place['lon'] > 180) {
              throw const FormatException('Invalid coordinates');
            }
          }
          for (final event in row['events'] ?? []) {
            for (final v in [event['start'], event['end']]) {
              if (v != null && (v is! int || v == 0)) {
                throw const FormatException('Invalid date');
              }
            }
          }
        } else if (m['kind'] == 'model') {
          final glb = files[row['file']];
          if (glb == null) throw const FormatException('Missing GLB');
          validateGlb(glb);
        }
      }
    }
    return ContentPackage(m, rows, files);
  }

  void install(Store s) {
    final id = manifest['id'] as String, kind = manifest['kind'] as String;
    for (final dep in manifest['dependencies']) {
      if (!s.installed(dep as String)) {
        throw FormatException('Missing dependency: $dep');
      }
    }
    final libPath =
            s.library.select('PRAGMA database_list').first['file'] as String,
        lexPath =
            s.lexical.select('PRAGMA database_list').first['file'] as String;
    final memory = libPath.isEmpty || lexPath.isEmpty;
    if (memory &&
        kind != 'bible' &&
        ![
          'dictionary',
          'confession',
          'atlas',
          'model',
          'study',
        ].contains(kind)) {
      throw const FormatException('Resource database unavailable');
    }
    if (!memory) {
      if (!s.content
          .select('PRAGMA database_list')
          .any((r) => r['name'] == 'library')) {
        s.content.execute('ATTACH DATABASE ? AS library', [libPath]);
      }
      if (!s.content
          .select('PRAGMA database_list')
          .any((r) => r['name'] == 'linguistic')) {
        s.content.execute('ATTACH DATABASE ? AS linguistic', [lexPath]);
      }
    }
    final written = <File>[];
    s.content.execute('BEGIN IMMEDIATE');
    try {
      s.content.execute(
        'INSERT OR REPLACE INTO content_modules VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          manifest['title'],
          kind,
          manifest['language'],
          manifest['version'],
          manifest['author'],
          manifest['license'],
          manifest['license_text'],
          manifest['source'],
          1,
          0,
          jsonEncode(manifest['metadata'] ?? {}),
        ],
      );
      if (kind == 'bible') {
        s.content.execute('DELETE FROM verses WHERE translation=?', [id]);
        s.content.execute('DELETE FROM verse_search WHERE translation=?', [id]);
        s.content.execute(
          'DELETE FROM verse_mappings WHERE source_translation=? OR target_translation=?',
          [id, id],
        );
        for (final row in records) {
          final r = Reference.fromId(row['reference'] as String)!;
          s.content.execute('INSERT INTO verses VALUES(?,?,?,?,?,?,?)', [
            id,
            r.id,
            r.book,
            r.chapter,
            r.verse,
            row['text'],
            jsonEncode(row['metadata'] ?? {}),
          ]);
          s.content.execute('INSERT INTO verse_search VALUES(?,?,?)', [
            id,
            r.id,
            row['text'],
          ]);
        }
        for (final row in manifest['mappings'] ?? []) {
          final a = Reference.fromId(row['source_reference'] ?? ''),
              b = Reference.fromId(row['target_reference'] ?? '');
          if (a == null || b == null || row['target_translation'] is! String) {
            throw const FormatException('Invalid verse mapping');
          }
          s.content.execute('INSERT INTO verse_mappings VALUES(?,?,?,?,?,?)', [
            id,
            a.id,
            row['target_translation'],
            b.id,
            row['kind'] ?? 'editorial',
            manifest['source'],
          ]);
        }
      } else if (kind == 'commentary') {
        s.content.execute(
          'DELETE FROM library.commentary_search WHERE module_id=?',
          [id],
        );
        s.content.execute(
          'DELETE FROM library.commentary_entries WHERE module_id=?',
          [id],
        );
        for (final row in records) {
          final r = Reference.fromId(row['reference'])!,
              end = Reference.fromId(row['end_reference'] ?? row['reference'])!;
          final rid = '$id:${row['id']}';
          s.content.execute(
            'INSERT INTO library.commentary_entries VALUES(?,?,?,?,?,?,?,?,?,?)',
            [
              rid,
              id,
              r.id,
              end.id,
              r.key,
              end.key,
              row['title'] ?? r.label(),
              row['body'],
              row['commentary_kind'] ?? 'exegesis',
              row['bibliography'] ?? manifest['title'],
            ],
          );
          s.content.execute(
            'INSERT INTO library.commentary_search VALUES(?,?,?,?)',
            [rid, id, row['title'] ?? r.label(), row['body']],
          );
        }
      } else if (kind == 'lexicon') {
        s.content.execute('DELETE FROM linguistic.words WHERE module_id=?', [
          id,
        ]);
        final owned = s.content.select(
          'SELECT lexeme_id FROM lexicon_ownership WHERE module_id=?',
          [id],
        );
        for (final old in owned) {
          s.content.execute('DELETE FROM linguistic.lexemes WHERE id=?', [
            old['lexeme_id'],
          ]);
          s.content.execute(
            'DELETE FROM linguistic.lexical_search WHERE id=?',
            [old['lexeme_id']],
          );
        }
        s.content.execute('DELETE FROM lexicon_ownership WHERE module_id=?', [
          id,
        ]);
        for (final row in records) {
          final lid = '$id:${row['id']}';
          s.content
              .execute('INSERT INTO linguistic.lexemes VALUES(?,?,?,?,?,?,?)', [
                lid,
                row['lemma'],
                row['transliteration'] ?? '',
                row['gloss'],
                row['definition'] ?? '',
                row['language'] ?? manifest['language'],
                manifest['source'],
              ]);
          s.content.execute(
            'INSERT INTO linguistic.lexical_search VALUES(?,?,?,?,?)',
            [
              lid,
              row['lemma'],
              row['transliteration'] ?? '',
              row['gloss'],
              row['definition'] ?? '',
            ],
          );
          s.content.execute('INSERT INTO lexicon_ownership VALUES(?,?)', [
            id,
            lid,
          ]);
          for (final w in row['occurrences'] ?? []) {
            final r = Reference.fromId(w['reference'] ?? '');
            if (r == null || w['surface'] is! String || w['position'] is! int) {
              throw const FormatException('Invalid word occurrence');
            }
            s.content.execute(
              'INSERT INTO linguistic.words VALUES(?,?,?,?,?,?,?,?)',
              [
                '$lid:${r.id}:${w['position']}',
                id,
                r.id,
                w['position'],
                w['surface'],
                lid,
                w['morphology'] ?? '',
                id,
              ],
            );
          }
        }
      } else {
        final old = s.content.select(
          'SELECT id FROM documents WHERE module_id=?',
          [id],
        );
        for (final row in old) {
          s.content.execute('DELETE FROM document_search WHERE id=?', [
            row['id'],
          ]);
        }
        s.content.execute('DELETE FROM documents WHERE module_id=?', [id]);
        for (final row in records) {
          final rid = '$id:${row['id']}';
          final meta = Map<String, dynamic>.from(row['metadata'] ?? {});
          if (kind == 'model') {
            final bytes = files[row['file']]!;
            final path = p.join(
              s.directory,
              'content',
              id,
              '${sha256.convert(bytes)}.glb',
            );
            final f = File(path);
            f.parent.createSync(recursive: true);
            if (!f.existsSync()) {
              f.writeAsBytesSync(bytes, flush: true);
              written.add(f);
            }
            meta.addAll(row);
            meta['local_file'] = path;
          } else if (kind == 'atlas') {
            meta.addAll(row);
          }
          s.content.execute('INSERT INTO documents VALUES(?,?,?,?,?,?,?)', [
            rid,
            id,
            kind,
            row['title'] ?? manifest['title'],
            row['body'] ?? '',
            row['reference'] ?? '',
            jsonEncode(meta),
          ]);
          s.content.execute('INSERT INTO document_search VALUES(?,?,?)', [
            rid,
            row['title'] ?? manifest['title'],
            row['body'] ?? '',
          ]);
        }
      }
      s.content.execute('COMMIT');
    } catch (_) {
      s.content.execute('ROLLBACK');
      for (final f in written) {
        if (f.existsSync()) f.deleteSync();
      }
      rethrow;
    }
  }
}

void validateGlb(Uint8List bytes) {
  if (bytes.length < 20 || bytes.length > 20 * 1024 * 1024) {
    throw const FormatException('Invalid GLB size');
  }
  final b = ByteData.sublistView(bytes);
  if (b.getUint32(0, Endian.little) != 0x46546c67 ||
      b.getUint32(4, Endian.little) != 2 ||
      b.getUint32(8, Endian.little) != bytes.length) {
    throw const FormatException('Invalid GLB header');
  }
  var offset = 12;
  Map<String, dynamic>? document;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      throw const FormatException('Invalid GLB chunk');
    }
    final size = b.getUint32(offset, Endian.little),
        type = b.getUint32(offset + 4, Endian.little);
    offset += 8;
    if (offset + size > bytes.length) {
      throw const FormatException('Invalid GLB length');
    }
    if (type == 0x4e4f534a) {
      document = Map<String, dynamic>.from(
        jsonDecode(utf8.decode(bytes.sublist(offset, offset + size)).trim()),
      );
    }
    offset += size;
  }
  if (document == null ||
      document['asset']?['version'] != '2.0' ||
      (document['extensionsRequired'] as List? ?? []).isNotEmpty) {
    throw const FormatException('Unsupported glTF');
  }
  for (final key in ['buffers', 'images']) {
    if ((document[key] as List? ?? []).any((e) => e['uri'] != null)) {
      throw const FormatException('External model resources prohibited');
    }
  }
}

Future<void> installContentPackageOffline(Store store, Uint8List bytes) async {
  final directory = store.directory;
  final transfer = TransferableTypedData.fromList([bytes]);
  await Isolate.run(() {
    final isolated = Store(
      runtime.sqlite3.open(p.join(directory, 'catalogue.sqlite')),
      runtime.sqlite3.open(p.join(directory, 'personal.sqlite')),
      runtime.sqlite3.open(p.join(directory, 'lexicon.sqlite')),
      runtime.sqlite3.open(p.join(directory, 'library.sqlite')),
      directory,
    );
    try {
      ContentPackage.parse(
        transfer.materialize().asUint8List(),
      ).install(isolated);
    } finally {
      isolated.dispose();
    }
  });
}

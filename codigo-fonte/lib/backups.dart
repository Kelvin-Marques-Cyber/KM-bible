import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart' hide Hmac;
import 'package:cryptography/cryptography.dart';
import 'package:path/path.dart' as p;
import 'store.dart';
import 'domain.dart';

const backupTables = [
  'preferences',
  'notes',
  'note_links',
  'highlights',
  'bookmarks',
  'study_tabs',
  'reading_history',
  'attachments',
  'flashcards',
  'review_history',
  'learning_progress',
];

class Backups {
  static Future<Uint8List> export(Store s, {String? password}) async {
    final rows = {
      for (final table in backupTables)
        table: s.query(s.personal, 'SELECT * FROM $table'),
    };
    final archive = Archive();
    final hashes = <String, String>{};
    void add(String name, List<int> bytes) {
      archive.addFile(ArchiveFile(name, bytes.length, bytes));
      hashes[name] = sha256.convert(bytes).toString();
    }

    String safe(String text) => text
        .replaceAll(RegExp(r'[^\p{L}\p{N}._-]+', unicode: true), '_')
        .substring(
          0,
          text
              .replaceAll(RegExp(r'[^\p{L}\p{N}._-]+', unicode: true), '_')
              .length
              .clamp(0, 70),
        );
    for (final note in rows['notes']!) {
      final notebook = safe(note['notebook'] as String);
      add(
        'notes/$notebook/${note['id']}.md',
        utf8.encode('# ${note['title']}\n\n${note['body']}\n'),
      );
    }
    for (final a in rows['attachments']!) {
      final f = File(a['path'] as String);
      if (!await f.exists()) {
        throw StateError('Missing attachment: ${a['filename']}');
      }
      final bytes = await f.readAsBytes();
      if (sha256.convert(bytes).toString() != a['sha256']) {
        throw StateError('Attachment integrity: ${a['filename']}');
      }
      add('attachments/${a['id']}${p.extension(f.path)}', bytes);
    }
    add('data.json', utf8.encode(jsonEncode(rows)));
    add(
      'manifest.json',
      utf8.encode(
        jsonEncode({
          'format': 1,
          'application': 'BibliaReformadaBackup',
          'files': hashes,
        }),
      ),
    );
    var output = Uint8List.fromList(ZipEncoder().encode(archive));
    if (output.length > 150 * 1024 * 1024) {
      throw StateError('Backup exceeds 150 MB');
    }
    if (password == null || password.isEmpty) return output;
    if (password.length < 8) {
      throw ArgumentError('Use at least eight characters');
    }
    final random = Random.secure(),
        salt = List<int>.generate(16, (_) => random.nextInt(256));
    final kdf = Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: 210000,
      bits: 256,
    );
    final key = await kdf.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: salt,
    );
    final cipher = AesGcm.with256bits();
    final box = await cipher.encrypt(
      output,
      secretKey: key,
      aad: utf8.encode('BibliaReformadaBackup:1'),
    );
    return Uint8List.fromList(
      utf8.encode(
        jsonEncode({
          'encrypted': 1,
          'algorithm': 'AES-256-GCM+PBKDF2-SHA256-210000',
          'salt': base64Encode(salt),
          'nonce': base64Encode(box.nonce),
          'ciphertext': base64Encode(box.cipherText),
          'mac': base64Encode(box.mac.bytes),
        }),
      ),
    );
  }

  static Future<int> restore(
    Store s,
    Uint8List bytes, {
    String? password,
  }) async {
    if (bytes.length > 205 * 1024 * 1024) {
      throw const FormatException('Backup too large');
    }
    if (bytes.isNotEmpty && bytes.first == 123) {
      final envelope = jsonDecode(utf8.decode(bytes));
      if (envelope['encrypted'] != 1 ||
          envelope['algorithm'] != 'AES-256-GCM+PBKDF2-SHA256-210000' ||
          password == null) {
        throw const FormatException('Password required');
      }
      final salt = base64Decode(envelope['salt']),
          nonce = base64Decode(envelope['nonce']),
          mac = base64Decode(envelope['mac']);
      if (salt.length != 16 || nonce.length != 12 || mac.length != 16) {
        throw const FormatException('Invalid encrypted backup');
      }
      final key = await Pbkdf2(
        macAlgorithm: Hmac.sha256(),
        iterations: 210000,
        bits: 256,
      ).deriveKey(secretKey: SecretKey(utf8.encode(password)), nonce: salt);
      bytes = Uint8List.fromList(
        await AesGcm.with256bits().decrypt(
          SecretBox(
            base64Decode(envelope['ciphertext']),
            nonce: nonce,
            mac: Mac(mac),
          ),
          secretKey: key,
          aad: utf8.encode('BibliaReformadaBackup:1'),
        ),
      );
    }
    final archive = ZipDecoder().decodeBytes(bytes, verify: true);
    final files = <String, Uint8List>{};
    var expanded = 0;
    for (final f in archive) {
      if (!f.isFile) continue;
      expanded += f.size;
      if (expanded > 300 * 1024 * 1024 ||
          f.name.startsWith('/') ||
          f.name.contains('\\') ||
          f.name.contains(':') ||
          f.name.split('/').any((s) => s == '..' || s.isEmpty) ||
          files.containsKey(f.name)) {
        throw const FormatException('Unsafe backup');
      }
      files[f.name] = Uint8List.fromList(f.content as List<int>);
    }
    if (!files.containsKey('manifest.json') ||
        !files.containsKey('data.json')) {
      throw const FormatException('Incomplete backup');
    }
    final manifest = jsonDecode(utf8.decode(files['manifest.json']!));
    if (manifest['format'] != 1 ||
        manifest['application'] != 'BibliaReformadaBackup') {
      throw const FormatException('Unsupported backup');
    }
    final hashes = Map<String, dynamic>.from(manifest['files']);
    if (files.keys.any((f) => f != 'manifest.json' && !hashes.containsKey(f))) {
      throw const FormatException('Unexpected backup file');
    }
    for (final h in hashes.entries) {
      if (files[h.key] == null ||
          sha256.convert(files[h.key]!).toString() != h.value) {
        throw FormatException('Integrity failure: ${h.key}');
      }
    }
    final data = Map<String, dynamic>.from(
      jsonDecode(utf8.decode(files['data.json']!)),
    );
    if (data.keys.any((k) => !backupTables.contains(k))) {
      throw const FormatException('Unknown data table');
    }
    for (final table in data.keys) {
      final columns = s.personal
          .select('PRAGMA table_info($table)')
          .map((r) => r['name'] as String)
          .toSet();
      if (data[table] is! List) {
        throw const FormatException('Invalid table data');
      }
      for (final value in data[table]) {
        if (value is! Map ||
            value.keys.toSet().difference(columns).isNotEmpty ||
            value.keys.length != columns.length ||
            value.values.any((v) => v != null && v is! String && v is! num)) {
          throw const FormatException('Invalid data row');
        }
        if (value['id'] != null &&
            !RegExp(
              table == 'learning_progress'
                  ? r'^[A-Za-z0-9][A-Za-z0-9._:-]{0,160}$'
                  : r'^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$',
            ).hasMatch(value['id'].toString())) {
          throw const FormatException('Invalid identifier');
        }
      }
    }
    final written = <File>[];
    final attachmentRows = (data['attachments'] as List? ?? []);
    try {
      for (final value in attachmentRows) {
        final row = Map<String, dynamic>.from(value);
        final matches = files.keys.where(
          (k) => k.startsWith('attachments/${row['id']}.'),
        );
        if (matches.length != 1) {
          throw const FormatException('Missing attachment');
        }
        final name = matches.single, b = files[name]!;
        if (b.length > 20 * 1024 * 1024 ||
            sha256.convert(b).toString() != row['sha256']) {
          throw const FormatException('Attachment integrity');
        }
        final f = File(p.join(s.directory, 'attachments', p.basename(name)));
        await f.parent.create(recursive: true);
        if (await f.exists()) {
          if (sha256.convert(await f.readAsBytes()).toString() !=
              row['sha256']) {
            throw const FormatException('Attachment conflict');
          }
        } else {
          await f.writeAsBytes(b, flush: true);
          written.add(f);
        }
        value['path'] = f.path;
      }
      s.personal.execute('BEGIN IMMEDIATE');
      var count = 0;
      try {
        for (final table in backupTables) {
          for (final value in data[table] ?? []) {
            final row = Map<String, dynamic>.from(value);
            if (table == 'note_links') continue;
            if (table == 'notes') {
              final existing = s.note(row['id'] as String);
              if (existing != null &&
                  (existing['updated_at'] as int) >
                      (row['updated_at'] as int)) {
                continue;
              }
              count++;
            }
            final columns = row.keys.toList();
            s.personal.execute(
              'INSERT OR REPLACE INTO $table(${columns.join(',')}) VALUES(${List.filled(columns.length, '?').join(',')})',
              columns.map((k) => row[k]).toList(),
            );
          }
        }
        s.personal.execute('DELETE FROM note_links');
        for (final note in s.notes) {
          for (final match in RegExp(
            r'\[\[([^\]]+)\]\]',
          ).allMatches(note['body'] as String)) {
            final target = match[1]!.trim(), ref = Reference.parse(target);
            s.personal.execute(
              'INSERT OR IGNORE INTO note_links VALUES(?,?,?)',
              [
                note['id'],
                ref?.id ??
                    (target.startsWith('note:') ? target.substring(5) : target),
                ref == null ? 'personal' : 'biblical',
              ],
            );
          }
        }
        s.personal.execute('DELETE FROM note_search');
        s.personal.execute(
          'INSERT INTO note_search SELECT id,title,body,tags FROM notes',
        );
        s.personal.execute('COMMIT');
        return count;
      } catch (_) {
        s.personal.execute('ROLLBACK');
        rethrow;
      }
    } catch (_) {
      for (final f in written) {
        if (await f.exists()) await f.delete();
      }
      rethrow;
    }
  }
}

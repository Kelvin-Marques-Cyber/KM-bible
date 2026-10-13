import 'dart:typed_data';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:sqlite3/common.dart';
import 'sqlite_runtime_web.dart' as runtime;

// Digest incremental: evita juntar arquivos SQLite de mais de 100 MB em RAM.
class _Sha256Result implements Sink<Digest> {
  Digest? value;
  @override
  void add(Digest data) { value = data; }
  @override
  void close() {}
}


/// Inicializa os bancos disponibilizados no APK original na VFS do navegador.
/// Copias pessoais (como ARA) NAO fazem parte desse processo.
Future<(CommonDatabase, CommonDatabase, CommonDatabase, CommonDatabase)>
    openBrowserDatabases() async {
  await runtime.initializeSqliteRuntime();

  final vfs = runtime.sqliteFileSystem;
  // Os bancos grandes são enviados em partes de 16 MiB pela hospedagem Web.
  // Os bancos pequenos continuam no formato SQLite original.
  final rawParts = jsonDecode(
    await rootBundle.loadString('assets/content/sqlite-web-parts.json'),
  ) as Map<String, dynamic>;
  if (rawParts['format'] != 1) {
    throw StateError('Manifest das partes SQLite Web inválido.');
  }
  final splitDatabases = Map<String, dynamic>.from(
    rawParts['partitioned'] as Map,
  );
  // Estas preferências já existem no armazenamento persistente do usuário.
  // Guardamos apenas os hashes de distribuição, sem copiar, apagar ou
  // modificar as anotações e os dados de leitura.
  final versions = runtime.sqlite3.open('personal.sqlite');
  versions.execute(
    'CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY, value TEXT)',
  );
  for (final name in const [
    'catalogue',
    'lexicon',
    'library',
    'connections',
    'portuguese',
    'topics',
  ]) {
    // O SQLite transforma "catalogue.sqlite" em "/catalogue.sqlite".
    // A copia deve usar o MESMO caminho para evitar abrir banco vazio.
    final path = vfs.xFullPathName('$name.sqlite');
    // Os bancos de traducao sao atualizaveis; nunca sobrescrever dados pessoais.
    final mustCheckUpdate = name == 'portuguese' || name == 'topics';
    final exists = vfs.xAccess(path, 0) != 0;
    if (exists && !mustCheckUpdate) continue;

    final bundlePath = 'assets/content/$name.sqlite';
    final expected =
        (await rootBundle.loadString('assets/content/$name.sha256')).trim();
    // Bancos ja validados nao precisam ser relidos (dezenas de MB) a cada F5.
    // Se uma nova edicao do aplicativo tiver outro hash, verificamos/trocamos
    // apenas aquele banco, nunca o personal.sqlite.
    final versionKey = 'browser_asset_sha256_$name';
    final remembered = versions.select(
      'SELECT value FROM preferences WHERE key=?', [versionKey],
    );
    if (exists && remembered.isNotEmpty &&
        remembered.first['value'] == jsonEncode(expected)) {
      continue;
    }
    if (exists) {
      final current = vfs.xOpen(
        Sqlite3Filename(path),
        SqlFlag.SQLITE_OPEN_READONLY | SqlFlag.SQLITE_OPEN_MAIN_DB,
      ).file;
      try {
        final size = current.xFileSize();
        if (size > 0) {
          final existingBytes = Uint8List(size);
          current.xRead(existingBytes, 0);
          if (sha256.convert(existingBytes).toString() == expected) {
            versions.execute(
              'INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?)',
              [versionKey, jsonEncode(expected)],
            );
            await vfs.flush();
            continue;
          }
        }
      } finally {
        current.xClose();
      }
    }
    final opened = vfs.xOpen(
      Sqlite3Filename(path),
      SqlFlag.SQLITE_OPEN_READWRITE |
          SqlFlag.SQLITE_OPEN_CREATE |
          SqlFlag.SQLITE_OPEN_MAIN_DB,
    );
    final file = opened.file;
    try {
      file.xTruncate(0);
      const writeChunk = 256 * 1024;
      final split = splitDatabases[name];
      if (split != null) {
        final spec = Map<String, dynamic>.from(split as Map);
        if (spec['sha256'] != expected) {
          throw StateError('SHA-256 do manifesto incorreto: $name');
        }
        final digestResult = _Sha256Result();
        final digestInput = sha256.startChunkedConversion(digestResult);
        var written = 0;
        for (final item in spec['chunks'] as List) {
          final part = Map<String, dynamic>.from(item as Map);
          final partName = part['file'] as String;
          final data = await rootBundle.load('assets/content/$partName');
          final bytes = data.buffer.asUint8List(
            data.offsetInBytes,
            data.lengthInBytes,
          );
          if (bytes.length != part['size'] ||
              sha256.convert(bytes).toString() != part['sha256']) {
            throw StateError('Parte SQLite corrompida: $partName');
          }
          digestInput.add(bytes);
          for (var offset = 0; offset < bytes.length; offset += writeChunk) {
            final end = offset + writeChunk < bytes.length
                ? offset + writeChunk : bytes.length;
            file.xWrite(Uint8List.sublistView(bytes, offset, end),
                written + offset);
          }
          written += bytes.length;
        }
        digestInput.close();
        if (written != spec['size'] ||
            digestResult.value.toString() != expected) {
          throw StateError('Banco SQLite reconstruído incorretamente: $name');
        }
      } else {
        final data = await rootBundle.load(bundlePath);
        final bytes = data.buffer.asUint8List(
          data.offsetInBytes,
          data.lengthInBytes,
        );
        if (sha256.convert(bytes).toString() != expected) {
          throw StateError('Falha de integridade no banco $name');
        }
        for (var offset = 0; offset < bytes.length; offset += writeChunk) {
          final end = offset + writeChunk < bytes.length
              ? offset + writeChunk : bytes.length;
          file.xWrite(Uint8List.sublistView(bytes, offset, end), offset);
        }
      }
      file.xSync(0);
    } finally {
      file.xClose();
    }
    // Aguardamos a persistencia antes de abrir o banco via SQLite.
    await vfs.flush();
    versions.execute(
      'INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?)',
      [versionKey, jsonEncode(expected)],
    );
    await vfs.flush();
  }
  versions.dispose();

  return (
    runtime.sqlite3.open('catalogue.sqlite'),
    runtime.sqlite3.open('personal.sqlite'),
    runtime.sqlite3.open('lexicon.sqlite'),
    runtime.sqlite3.open('library.sqlite'),
  );
}

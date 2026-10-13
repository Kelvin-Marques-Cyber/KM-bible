import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:sqlite3/common.dart';
import 'sqlite_runtime_web.dart' as runtime;

/// Inicializa os bancos disponibilizados no APK original na VFS do navegador.
/// Copias pessoais (como ARA) NAO fazem parte desse processo.
Future<(CommonDatabase, CommonDatabase, CommonDatabase, CommonDatabase)>
    openBrowserDatabases() async {
  await runtime.initializeSqliteRuntime();

  final vfs = runtime.sqliteFileSystem;
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
          if (sha256.convert(existingBytes).toString() == expected) continue;
        }
      } finally {
        current.xClose();
      }
    }
    final data = await rootBundle.load(bundlePath);
    final bytes =
        data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    if (sha256.convert(bytes).toString() != expected) {
      throw StateError('Falha de integridade no banco $name');
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
      const chunkSize = 256 * 1024;
      for (var offset = 0; offset < bytes.length; offset += chunkSize) {
        final end = offset + chunkSize < bytes.length
            ? offset + chunkSize
            : bytes.length;
        file.xWrite(Uint8List.sublistView(bytes, offset, end), offset);
      }
      file.xSync(0);
    } finally {
      file.xClose();
    }
    // Aguardamos a persistencia antes de abrir o banco via SQLite.
    await vfs.flush();
  }

  return (
    runtime.sqlite3.open('catalogue.sqlite'),
    runtime.sqlite3.open('personal.sqlite'),
    runtime.sqlite3.open('lexicon.sqlite'),
    runtime.sqlite3.open('library.sqlite'),
  );
}

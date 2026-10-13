import 'package:sqlite3/wasm.dart';

// Somente Flutter Web: SQLite compilado para WebAssembly.
late WasmSqlite3 sqlite3;
late IndexedDbFileSystem sqliteFileSystem;
Future<void>? _initializing;

Future<void> initializeSqliteRuntime() =>
    _initializing ??= _loadSqlite();

Future<void> _loadSqlite() async {
  final module = await WasmSqlite3.loadFromUrl(Uri.parse('sqlite3.wasm'));
  sqliteFileSystem = await IndexedDbFileSystem.open(dbName: 'biblia_reformada_web');
  module.registerVirtualFileSystem(sqliteFileSystem, makeDefault: true);
  sqlite3 = module;
}

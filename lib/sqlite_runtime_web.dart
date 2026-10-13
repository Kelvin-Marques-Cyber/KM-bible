import 'package:sqlite3/wasm.dart';

late WasmSqlite3 sqlite3;
late IndexedDbFileSystem sqliteFileSystem;
Future<void>? _initializing;
final Map<String, IndexedDbFileSystem> _resources = {};
final Map<String, Future<CommonDatabase>> _opening = {};

Future<void> initializeSqliteRuntime() =>
    _initializing ??= _loadSqlite();

Future<void> _loadSqlite() async {
  final module = await WasmSqlite3.loadFromUrl(Uri.parse('sqlite3.wasm'));
  // Versao 2: somente o catalogo basico e os DADOS PESSOAIS sao lidos
  // na abertura. O IDB legado continha >300 MB em um unico VFS e carregava
  // todos os arquivos em memoria ate para abrir uma unica anotacao.
  sqliteFileSystem = await IndexedDbFileSystem.open(
    dbName: 'biblia_reformada_web_v2_core',
  );
  module.registerVirtualFileSystem(sqliteFileSystem, makeDefault: true);
  sqlite3 = module;
}

Future<CommonDatabase> openResource(String name) async {
  if (!const ['lexicon', 'library', 'connections', 'topics', 'portuguese']
      .contains(name)) {
    throw ArgumentError.value(name, 'name', 'Banco nao permitido');
  }
  await initializeSqliteRuntime();
  return _opening.putIfAbsent(name, () async {
    final vfsName = 'biblia_resource_$name';
    final vfs = await IndexedDbFileSystem.open(
      dbName: 'biblia_reformada_web_v2_$name',
      vfsName: vfsName,
    );
    _resources[name] = vfs;
    sqlite3.registerVirtualFileSystem(vfs);
    return sqlite3.open('$name.sqlite', vfs: vfsName);
  });
}

IndexedDbFileSystem resourceFileSystem(String name) {
  final result = _resources[name];
  if (result == null) throw StateError('Banco nao carregado: $name');
  return result;
}

///// Persiste alterações pendentes dos bancos da PWA antes de concluir a
///// inicialização. Dados pessoais são mantidos; não exclui nenhuma VFS.
Future<void> flushBrowserCache() async {
  await initializeSqliteRuntime();
  await sqliteFileSystem.flush();
  for (final vfs in _resources.values) {
    await vfs.flush();
  }
}

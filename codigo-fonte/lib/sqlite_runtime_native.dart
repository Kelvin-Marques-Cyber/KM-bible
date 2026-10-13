import 'package:sqlite3/sqlite3.dart' as native;

// Somente Android, iOS e desktop: SQLite via FFI.
final sqlite3 = native.sqlite3;

Future<void> initializeSqliteRuntime() async {}

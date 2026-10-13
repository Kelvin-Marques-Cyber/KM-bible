import 'package:sqlite3/common.dart';

Future<(CommonDatabase, CommonDatabase, CommonDatabase, CommonDatabase)>
    openBrowserDatabases() async {
  throw UnsupportedError('Banco de dados web indisponivel nesta plataforma.');
}

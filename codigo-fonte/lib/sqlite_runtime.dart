// Seleciona a implementacao SQLite sem carregar FFI no navegador.
export 'sqlite_runtime_native.dart'
    if (dart.library.js_interop) 'sqlite_runtime_web.dart';

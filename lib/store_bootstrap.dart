// Seleciona a inicializacao de banco apropriada para a plataforma.
export 'store_bootstrap_stub.dart'
    if (dart.library.js_interop) 'store_bootstrap_web.dart';

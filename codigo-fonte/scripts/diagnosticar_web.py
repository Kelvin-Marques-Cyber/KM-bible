#!/usr/bin/env python3
"""Relatorio baseado nos imports/chamadas do projeto, sem chute visual."""
from pathlib import Path
TOKENS={
"dart:io":"adaptador File/Platform para web",
"dart:ffi":"FFI nao compativel com navegador",
"package:sqlite3/sqlite3.dart":"SQLite WASM via common.dart + wasm.dart / IndexedDB",
"package:webview_flutter/":"WebView: substituicao web",
"package:flutter_local_notifications/":"Notificacoes locais nativas",
"package:flutter_timezone/":"Timezone nativo",
"File(":"Acesso a arquivos nativo",
"Directory(":"Diretorio nativo",
"Platform.":"Checagem de plataforma nativa"
}
n=0
for f in sorted(Path("lib").rglob("*.dart")):
 for i,line in enumerate(f.read_text(encoding="utf8").splitlines(),1):
  for token,issue in TOKENS.items():
   if token in line:
    n+=1
    print(f"{f}:{i} | {token} | {issue}")
print(f"Total: {n}. Corrija os erros reais reportados pelo compilador.")

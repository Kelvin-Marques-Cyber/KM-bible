# Conversão Flutter Web fiel ao APK

Em vez de reescrever interfaces em HTML/CSS, este projeto compila os **widgets Flutter originais**. `lib/main.dart` usa `MaterialApp`, Material 3, a navegação do APK e `lib/appearance.dart` define temas e fontes.

## Gerar/diagnosticar

Execute no Linux com Flutter e Python 3: `bash scripts/build_flutter_web_fiel.sh`. O script cria a plataforma Web usando Flutter SDK, identifica dependências nativas em `flutter-web-dependencias.txt` e compila com `flutter build web --release --base-href /KM-bible/`. Ele salva erros reais em `flutter-web-build.log`. **Não entrega ZIP de build enquanto a compilação falhar.**

Também é possível rodar o workflow `flutter-web-fidelidade` no Codemagic, nesta branch. Ele não publica automaticamente.

## Adaptadores que ainda precisam ser implementados

- `store.dart` acessa arquivos via `dart:io` e `sqlite3.open()`: usar `package:sqlite3/common.dart`, `package:sqlite3/wasm.dart` e VFS IndexedDB ou OPFS, conforme a documentação do sqlite3 2.9.4.
- `packages.dart`, `backups.dart`, `common.dart`, `settings.dart` e `explore.dart` usam File/Platform; abstrair funções por plataforma mantendo os widgets originais.
- `explore.dart` contém `webview_flutter` nativo: substituir visualização por mecanismo web compatível.
- `needle.dart` contém FFI; não executar esse componente no browser.
- `notifications.dart` depende de notificações locais nativas.
- `.biblepkg` deve continuar importável no navegador, e **ARA não deve ser incorporada ao build público**.

## Bloqueio de publicação

A atual PWA estática em `gh-pages` continua online. Só substitua-a depois que a versão Flutter compilar, persistir bancos SQLite no Safari, carregar biblioteca offline, importar `.biblepkg` e passar por comparação visual com o APK.

Documentação: https://docs.flutter.dev/platform-integration/web/building e https://pub.dev/packages/sqlite3/versions/2.9.4
// Ignora o cache da shell Web sem apagar IndexedDB ou preferencias.
import 'dart:html' as html;

void openWebUpdater() {
  html.window.location.assign(
    Uri.base.resolve('atualizar.html').toString(),
  );
}

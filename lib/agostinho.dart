import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'app.dart';

const augustineFullEdition =
    'https://www.solusagape.com.br/obras-milenares/confiss%C3%B5es';

Future<void> openAugustineSource(BuildContext context, String url) async {
  try {
    if (await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)) {
      return;
    }
  } catch (_) {}
  await Clipboard.setData(ClipboardData(text: url));
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Link da fonte copiado para consulta.')),
    );
  }
}

/// Leitor original integral, sem resumos, com textos previamente embutidos.
class AugustineConfessionsPage extends StatefulWidget {
  final int? initialBook;
  final int? initialChapter;
  const AugustineConfessionsPage({
    super.key,
    this.initialBook,
    this.initialChapter,
  });
  @override
  State<AugustineConfessionsPage> createState() =>
      _AugustineConfessionsPageState();
}

class _AugustineConfessionsPageState extends State<AugustineConfessionsPage> {
  late final Future<Map<String, dynamic>> manifest = rootBundle
      .loadString('assets/agostinho/manifest.json')
      .then((s) => Map<String, dynamic>.from(jsonDecode(s) as Map));
  final books = <int, Future<Map<String, dynamic>>>{};
  final scrollController = ScrollController();
  int? bookIndex, chapterIndex;
  double fontSize = 19;

  @override
  void initState() {
    super.initState();
    bookIndex = widget.initialBook;
    chapterIndex = widget.initialChapter;
  }

  Future<Map<String, dynamic>> book(int number) =>
      books.putIfAbsent(number, () => rootBundle
          .loadString('assets/agostinho/' + number.toString() + '.json')
          .then((s) => Map<String, dynamic>.from(jsonDecode(s) as Map)));

  void select(int bookNumber, int chapterNumber) {
    final store = context.app.store;
    store.setPref('agostinho_livro', bookNumber);
    store.setPref('agostinho_capitulo', chapterNumber);
    setState(() {
      bookIndex = bookNumber;
      chapterIndex = chapterNumber;
    });
    if (scrollController.hasClients) scrollController.jumpTo(0);
  }

  @override
  void dispose() {
    scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: manifest,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(child: Padding(
            padding: const EdgeInsets.all(18),
            child: SelectableText(
              'Edição integral ausente deste build. ' +
              snapshot.error.toString(),
            ),
          ));
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final meta = snapshot.data!;
        final counts = List<int>.from(meta['chapterCounts'] as List);
        if (counts.length != 13 || meta['chapterCount'] != 278) {
          return const Center(child: Text('Índice integral inválido.'));
        }
        final store = context.app.store;
        final savedBook = store.pref('agostinho_livro', 0);
        final b = (bookIndex ?? (savedBook is int ? savedBook : 0))
            .clamp(0, 12).toInt();
        final savedChapter = store.pref('agostinho_capitulo', 0);
        final c = (chapterIndex ??
                (savedChapter is int ? savedChapter : 0))
            .clamp(0, counts[b] - 1).toInt();

        return FutureBuilder<Map<String, dynamic>>(
          future: book(b + 1),
          builder: (context, page) {
            if (page.hasError) {
              return Center(child: SelectableText(
                'Não foi possível ler o livro: ' + page.error.toString(),
              ));
            }
            if (!page.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final entries = (page.data!['chapters'] as List)
                .map((item) => Map<String, dynamic>.from(item as Map))
                .toList();
            if (entries.length != counts[b]) {
              return const Center(child: Text('Livro incompleto.'));
            }
            final chapter = entries[c];
            final body = chapter['body'] as String;
            final title = chapter['title'] as String?;
            final footnotes = (chapter['footnotes'] as List<dynamic>? ?? [])
                .map((item) => Map<String, dynamic>.from(item as Map))
                .toList();
            final bookmark = 'agostinho_favorito_' +
                (b + 1).toString() + '_' + (c + 1).toString();
            final marked = store.pref(bookmark, false) == true;
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 32),
              children: [
                Text('Confissões de Santo Agostinho',
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 6),
                const Text(
                  'Texto integral em português. Leitura offline, sem resumos.',
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  key: ValueKey('aug-book-' + b.toString()),
                  isExpanded: true,
                  initialValue: b,
                  decoration: const InputDecoration(
                    labelText: 'Livro',
                    floatingLabelBehavior: FloatingLabelBehavior.always,
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 18,
                    ),
                  ),
                  items: [
                    for (var i = 0; i < counts.length; i++)
                      DropdownMenuItem(
                        value: i,
                        child: Text('Livro ' + (i + 1).toString()),
                      ),
                  ],
                  onChanged: (n) { if (n != null) select(n, 0); },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  key: ValueKey('aug-chapter-$b-$c'),
                  isExpanded: true,
                  initialValue: c,
                  decoration: const InputDecoration(
                    labelText: 'Capítulo',
                    floatingLabelBehavior: FloatingLabelBehavior.always,
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 18,
                    ),
                  ),
                  items: [
                    for (var i = 0; i < counts[b]; i++)
                      DropdownMenuItem(
                        value: i,
                        child: Text('Capítulo ' + (i + 1).toString()),
                      ),
                  ],
                  onChanged: (n) { if (n != null) select(b, n); },
                ),
                const SizedBox(height: 18),
                Text(
                  'Livro ' + (b + 1).toString() +
                      ' · Capítulo ' + (c + 1).toString(),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 14),
                if (title != null && title.trim().isNotEmpty) ...[
                  SelectableText(
                    title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'EBGaramond',
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                SelectableText(
                  body,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontFamily: 'EBGaramond',
                    fontSize: fontSize,
                    height: 1.78,
                  ),
                ),
                if (footnotes.isNotEmpty) ...[
                  const Divider(height: 38),
                  Text(
                    'Notas da edição',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 10),
                  for (final note in footnotes)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SelectableText(
                        '${note['number']}. ${note['text']}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontFamily: 'EBGaramond',
                          fontSize: fontSize - 3,
                          height: 1.5,
                        ),
                      ),
                    ),
                ],
                const SizedBox(height: 20),
                Wrap(
                  spacing: 8,
                  children: [
                    TextButton.icon(
                      icon: Icon(marked ? Icons.bookmark : Icons.bookmark_border),
                      label: Text(marked ? 'Marcado' : 'Marcar leitura'),
                      onPressed: () {
                        store.setPref(bookmark, !marked);
                        setState(() {});
                      },
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.copy),
                      label: const Text('Copiar capítulo'),
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(
                          text: 'Confissões de Santo Agostinho — Livro ' +
                              (b + 1).toString() + ', capítulo ' +
                              (c + 1).toString() + '\n\n' + body +
                              '\n\nTradução: J. Oliveira Santos e ' +
                              'A. Ambrósio de Pina. Fonte: Solus Ágape.',
                        ));
                      },
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.text_increase),
                      label: const Text('Fonte maior'),
                      onPressed: () => setState(
                        () => fontSize = fontSize < 30 ? fontSize + 2 : 19,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Expanded(child: OutlinedButton.icon(
                      onPressed: b == 0 && c == 0 ? null
                          : () => c > 0
                              ? select(b, c - 1)
                              : select(b - 1, counts[b - 1] - 1),
                      icon: const Icon(Icons.arrow_back),
                      label: const Text('Anterior'),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: FilledButton.icon(
                      onPressed: b == 12 && c == counts[b] - 1 ? null
                          : () => c + 1 < counts[b]
                              ? select(b, c + 1)
                              : select(b + 1, 0),
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Próximo'),
                    )),
                  ],
                ),
                const Divider(height: 32),
                SelectableText(
                  'Fonte: ' + meta['source'].toString() + '\n' +
                  'Tradução: ' + meta['translator'].toString() + '\n' +
                  'Edição: ' + meta['edition'].toString() + '\n' +
                  meta['license'].toString(),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                TextButton.icon(
                  onPressed: () =>
                      openAugustineSource(context, augustineFullEdition),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Conferir edição e créditos'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

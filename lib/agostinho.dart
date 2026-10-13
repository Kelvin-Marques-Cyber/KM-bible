import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app.dart';

/// Texto integral: fonte externa em português, não resumo nem paráfrase.
/// As traduções modernas mantêm créditos e permissões de seus editores.
const augustineChapterBase =
    'https://www.liriocatolico.com.br/santo_agostinho/'
    'obras/autobiografia/confissoes/';
const augustineFullEdition =
    'https://www.solusagape.com.br/obras-milenares/confiss%C3%B5es';

String augustineChapterUrl(int book, int chapter) =>
    '${augustineChapterBase}livro-$book/capitulo-$chapter/';

Future<void> openAugustineSource(
  BuildContext context,
  String url,
) async {
  final uri = Uri.parse(url);
  try {
    if (await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      return;
    }
  } catch (_) {
    // Alguns navegadores bloqueiam a abertura de uma nova aba.
  }
  await Clipboard.setData(ClipboardData(text: url));
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Não foi possível abrir a fonte. O endereço foi copiado.',
        ),
      ),
    );
  }
}

class AugustineConfessionsPage extends StatefulWidget {
  const AugustineConfessionsPage({super.key});

  @override
  State<AugustineConfessionsPage> createState() =>
      _AugustineConfessionsPageState();
}

class _AugustineConfessionsPageState extends State<AugustineConfessionsPage> {
  late final Future<List<Map<String, dynamic>>> _books = rootBundle
      .loadString('assets/content/agostinho-confissoes-facil.json')
      .then((raw) => (jsonDecode(raw) as Map<String, dynamic>)['books'] as List)
      .then((list) => list
          .map((book) => Map<String, dynamic>.from(book as Map))
          .toList());

  int? selectedBook;
  int? selectedChapter;

  void select(int bookIndex, int chapterIndex) {
    context.app.store.setPref('agostinho_livro', bookIndex);
    context.app.store.setPref('agostinho_capitulo', chapterIndex);
    setState(() {
      selectedBook = bookIndex;
      selectedChapter = chapterIndex;
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _books,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(child: Text(
              'Não foi possível abrir o índice dos livros: ${snapshot.error}'));
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final books = snapshot.data!;
        if (books.isEmpty) return const Center(child: Text('Acervo vazio.'));
        final store = context.app.store;
        final bookIndex = (selectedBook ??
                (store.pref('agostinho_livro', 0) as int? ?? 0))
            .clamp(0, books.length - 1);
        final book = books[bookIndex];
        final chapterCount = book['chapterCount'] as int;
        final chapterIndex = (selectedChapter ??
                (store.pref('agostinho_capitulo', 0) as int? ?? 0))
            .clamp(0, chapterCount - 1);
        final currentUrl = augustineChapterUrl(bookIndex + 1, chapterIndex + 1);

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 32),
          children: [
            Text(
              'Confissões de Santo Agostinho — texto integral',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text(
              'Aqui você escolhe o livro e o capítulo para ler '
              'as palavras de Agostinho em tradução portuguesa completa. '
              'Não são resumos. A leitura abre a edição textual da fonte.',
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              key: ValueKey('original-agostinho-livro-$bookIndex'),
              isExpanded: true,
              initialValue: bookIndex,
              decoration: const InputDecoration(
                labelText: 'Livro (1 a 13)',
              ),
              items: [
                for (var i = 0; i < books.length; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text(
                      'Livro ${books[i]['number']} · '
                      '${books[i]['title']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (n) {
                if (n != null) select(n, 0);
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              key: ValueKey('original-agostinho-cap-$bookIndex-$chapterIndex'),
              isExpanded: true,
              initialValue: chapterIndex,
              decoration: const InputDecoration(
                labelText: 'Capítulo integral',
              ),
              items: [
                for (var i = 0; i < chapterCount; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text('Capítulo ${i + 1}'),
                  ),
              ],
              onChanged: (n) {
                if (n != null) select(bookIndex, n);
              },
            ),
            const SizedBox(height: 18),
            Text('Livro ${book['number']} · Capítulo ${chapterIndex + 1}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text(
              'Fonte disponível em português, com comparação '
              'em latim. Toque abaixo para ler o capítulo inteiro.',
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => openAugustineSource(context, currentUrl),
              icon: const Icon(Icons.menu_book),
              label: const Text('Ler as palavras de Agostinho'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () =>
                  openAugustineSource(context, augustineFullEdition),
              icon: const Icon(Icons.open_in_new),
              label: const Text('Consultar edição portuguesa integral'),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: chapterIndex == 0 && bookIndex == 0
                        ? null
                        : () {
                            if (chapterIndex > 0) {
                              select(bookIndex, chapterIndex - 1);
                            } else {
                              select(
                                bookIndex - 1,
                                (books[bookIndex - 1]['chapterCount'] as int) -
                                    1,
                              );
                            }
                          },
                    child: const Text('Anterior'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: chapterIndex == chapterCount - 1 &&
                            bookIndex == books.length - 1
                        ? null
                        : () {
                            if (chapterIndex + 1 < chapterCount) {
                              select(bookIndex, chapterIndex + 1);
                            } else {
                              select(bookIndex + 1, 0);
                            }
                          },
                    child: const Text('Próximo'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Text(
              'Fonte de leitura por capítulos: Lírio Católico. '
              'Edição portuguesa integral para consulta: Solus Ágape, '
              'tradução de J. Oliveira Santos e A. Ambrósio de Pina, '
              'revisão e edição de E. L. de Souza Campos (2024). '
              'A leitura dos textos integrais requer internet; '
              'este aplicativo não reproduz traduções sem verificar '
              'as respectivas condições de distribuição.',
            ),
          ],
        );
      },
    );
  }
}

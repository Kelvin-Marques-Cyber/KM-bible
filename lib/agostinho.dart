import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';

/// Leitor offline: adaptacao explicativa original, nao traducao literal.
class AugustineConfessionsPage extends StatefulWidget {
  const AugustineConfessionsPage({super.key});

  @override
  State<AugustineConfessionsPage> createState() =>
      _AugustineConfessionsPageState();
}

class _AugustineConfessionsPageState extends State<AugustineConfessionsPage> {
  late final Future<Map<String, dynamic>> _content = rootBundle
      .loadString('assets/content/agostinho-confissoes-facil.json')
      .then((source) => Map<String, dynamic>.from(jsonDecode(source) as Map));

  int? selectedBook;
  int? selectedSection;

  void openSection(int book, int section) {
    final store = context.app.store;
    store.setPref('agostinho_livro', book);
    store.setPref('agostinho_secao', section);
    setState(() {
      selectedBook = book;
      selectedSection = section;
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _content,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: SelectableText('Não foi possível abrir as Confissões: '
                  '${snapshot.error}'),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final content = snapshot.data!;
        final books = List<Map<String, dynamic>>.from(
          (content['books'] as List).map(
            (book) => Map<String, dynamic>.from(book as Map),
          ),
        );
        if (books.isEmpty) {
          return const Center(child: Text('Conteúdo ainda indisponível.'));
        }

        final store = context.app.store;
        final rememberedBook = store.pref('agostinho_livro', 0);
        final currentBook = (selectedBook ?? (rememberedBook is int
                ? rememberedBook
                : 0))
            .clamp(0, books.length - 1)
            .toInt();
        final book = books[currentBook];
        final sections = List<Map<String, dynamic>>.from(
          (book['sections'] as List).map(
            (section) => Map<String, dynamic>.from(section as Map),
          ),
        );
        if (sections.isEmpty) {
          return const Center(child: Text('Livro sem leituras disponíveis.'));
        }
        final rememberedSection = store.pref('agostinho_secao', 0);
        final currentSection = (selectedSection ?? (rememberedSection is int
                ? rememberedSection
                : 0))
            .clamp(0, sections.length - 1)
            .toInt();
        final section = sections[currentSection];
        final bookmark = 'agostinho_favorito_${book['number']}_'
            '${section['from']}';
        final bookmarked = store.pref(bookmark, false) == true;
        final from = section['from'] as int;
        final to = section['to'] as int;
        final chapterLabel = from == to
            ? 'Capítulo $from'
            : 'Capítulos $from–$to';

        void previous() {
          if (currentSection > 0) {
            openSection(currentBook, currentSection - 1);
          } else if (currentBook > 0) {
            final previousSections = books[currentBook - 1]['sections'] as List;
            openSection(currentBook - 1, previousSections.length - 1);
          }
        }

        void next() {
          if (currentSection + 1 < sections.length) {
            openSection(currentBook, currentSection + 1);
          } else if (currentBook + 1 < books.length) {
            openSection(currentBook + 1, 0);
          }
        }

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 32),
          children: [
            Text('Confissões de Agostinho',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 6),
            const Text(
              'Leitura fácil, organizada nos 13 livros da obra histórica.',
            ),
            const SizedBox(height: 10),
            Text(content['notice'] as String,
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 20),
            DropdownButtonFormField<int>(
              isExpanded: true,
              initialValue: currentBook,
              decoration: const InputDecoration(
                labelText: 'Escolha o livro (canto)',
              ),
              items: [
                for (var index = 0; index < books.length; index++)
                  DropdownMenuItem<int>(
                    value: index,
                    child: Text(
                      'Livro ${books[index]['number']} · '
                      '${books[index]['title']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (index) {
                if (index != null) openSection(index, 0);
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              key: ValueKey('agostinho-capitulos-$currentBook'),
              isExpanded: true,
              initialValue: currentSection,
              decoration: const InputDecoration(
                labelText: 'Escolha os capítulos',
              ),
              items: [
                for (var index = 0; index < sections.length; index++)
                  DropdownMenuItem<int>(
                    value: index,
                    child: Text(
                      'Cap. ${sections[index]['from']}–'
                      '${sections[index]['to']} · '
                      '${sections[index]['title']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (index) {
                if (index != null) openSection(currentBook, index);
              },
            ),
            const SizedBox(height: 18),
            Text('Livro ${book['number']} — ${book['title']}',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(book['summary'] as String),
            const Divider(height: 32),
            Text(chapterLabel,
                style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Text(section['title'] as String,
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 14),
            for (final paragraph in
                (section['body'] as String).split('\n\n')) ...[
              SelectableText(
                paragraph,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      height: 1.65,
                    ),
              ),
              const SizedBox(height: 14),
            ],
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                TextButton.icon(
                  onPressed: () {
                    store.setPref(bookmark, !bookmarked);
                    setState(() {});
                  },
                  icon: Icon(
                    bookmarked ? Icons.bookmark : Icons.bookmark_border,
                  ),
                  label: Text(bookmarked ? 'Marcado' : 'Marcar leitura'),
                ),
                TextButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(
                        text: 'Confissões de Agostinho · Livro '
                            '${book['number']} · $chapterLabel\n'
                            '${section['title']}\n\n${section['body']}\n\n'
                            'Adaptação explicativa em português simples, '
                            'não tradução literal.',
                      ),
                    );
                  },
                  icon: const Icon(Icons.copy_outlined),
                  label: const Text('Copiar leitura'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: currentBook == 0 && currentSection == 0
                        ? null
                        : previous,
                    icon: const Icon(Icons.arrow_back),
                    label: const Text('Anterior'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: currentBook == books.length - 1 &&
                            currentSection == sections.length - 1
                        ? null
                        : next,
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text('Próxima'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              'Para consultar o texto histórico integral e conferir a '
              'fidelidade da síntese: ${content['source']}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        );
      },
    );
  }
}

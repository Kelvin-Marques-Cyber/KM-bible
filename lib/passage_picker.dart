import 'package:flutter/material.dart';
import 'app.dart';
import 'domain.dart';

class PassagePicker extends StatefulWidget {
  final ValueChanged<Reference>? onSelect;
  final Reference? initial;
  final String? edition;
  const PassagePicker({super.key, this.onSelect, this.initial, this.edition});
  @override
  State<PassagePicker> createState() => _PassagePickerState();
}

class _PassagePickerState extends State<PassagePicker> {
  final field = TextEditingController();
  int testament = 0;
  int? book, chapter;
  String? error;
  @override
  void initState() {
    super.initState();
    field.text = widget.initial?.label() ?? '';
  }

  @override
  void dispose() {
    field.dispose();
    super.dispose();
  }

  void select(Reference r) {
    final a = context.app;
    if (a.store.verse(widget.edition ?? a.translation, r) == null) {
      setState(() => error = a.t('noContent'));
      return;
    }
    if (widget.onSelect != null) {
      widget.onSelect!(r);
    } else {
      a.navigate(r);
    }
    Navigator.pop(context);
  }

  void manual() {
    final r = Reference.parse(field.text);
    if (r == null) {
      setState(() => error = 'Confira o livro, capítulo e versículo.');
    } else {
      select(r);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app, edition = widget.edition ?? context.app.translation;
    final books = a.store
        .availableBooks(edition)
        .where((b) => testament == 0 || (testament == 1 ? b < 40 : b >= 40));
    final verses = book != null && chapter != null
        ? a.store.verses(edition, book!, chapter: chapter)
        : const <Map<String, Object?>>[];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Escolha a passagem',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final entry in [
              (0, 'Todos'),
              (1, 'Antigo Testamento'),
              (2, 'Novo Testamento'),
            ])
              ChoiceChip(
                label: Text(entry.$2),
                selected: testament == entry.$1,
                onSelected: (_) => setState(() {
                  testament = entry.$1;
                  book = null;
                  chapter = null;
                }),
              ),
          ],
        ),
        const SizedBox(height: 12),
        const Divider(height: 30),
        ExpansionTile(
          title: const Text('Digitar uma referência'),
          children: [
            TextField(
              controller: field,
              onSubmitted: (_) => manual(),
              decoration: InputDecoration(
                labelText: a.t('reference'),
                hintText: 'João 3:16 · Rm 8:28',
                errorText: error,
                suffixIcon: IconButton(
                  tooltip: 'Selecionar passagem',
                  onPressed: manual,
                  icon: const Icon(Icons.check),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
        const SizedBox(height: 12),
        if (book != null)
          Wrap(
            spacing: 8,
            children: [
              ActionChip(
                label: const Text('Livros'),
                avatar: const Icon(Icons.arrow_back, size: 16),
                onPressed: () => setState(() {
                  book = null;
                  chapter = null;
                }),
              ),
              ActionChip(
                label: Text(bookNames(a.language)[book! - 1]),
                onPressed: () => setState(() => chapter = null),
              ),
              if (chapter != null) Chip(label: Text('Capítulo $chapter')),
            ],
          ),
        if (book == null)
          ...books.map(
            (b) => ListTile(
              leading: const Icon(Icons.menu_book),
              title: Text(bookNames(a.language)[b - 1]),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => setState(() => book = b),
            ),
          )
        else if (chapter == null) ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Text('Capítulo'),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var c = 1; c <= a.store.chapters(edition, book!); c++)
                FilledButton.tonal(
                  onPressed: () => setState(() => chapter = c),
                  child: Text('$c'),
                ),
            ],
          ),
        ] else ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Text('Versículo'),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: verses
                .map(
                  (v) => FilledButton.tonal(
                    onPressed: () =>
                        select(Reference(book!, chapter!, v['verse'] as int)),
                    child: Text('${v['verse']}'),
                  ),
                )
                .toList(),
          ),
          TextButton.icon(
            onPressed: () => select(Reference(book!, chapter!, 1)),
            icon: const Icon(Icons.menu_book),
            label: const Text('Abrir o início do capítulo'),
          ),
        ],
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'portuguese_resources.dart';

class BibleTopicsPage extends StatefulWidget {
  final Reference? reference;
  final String initial;
  const BibleTopicsPage({super.key, this.reference, this.initial = ''});
  @override
  State<BibleTopicsPage> createState() => _BibleTopicsPageState();
}

class _BibleTopicsPageState extends State<BibleTopicsPage> {
  late String search = widget.initial;
  bool all = false;
  int limit = 80;
  @override
  Widget build(BuildContext context) {
    final store = context.app.store, scoped = widget.reference != null && !all;
    final rows = store.topics(
      search: search,
      reference: scoped ? widget.reference : null,
      limit: limit,
    );
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Temas bíblicos', style: TextStyle(fontSize: 22)),
              const Text(
                'Índice histórico de R. A. Torrey em português, com ligações editoriais às passagens. Leia sempre os textos no contexto.',
              ),
              if (widget.reference != null)
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: Text(widget.reference!.label()),
                      selected: scoped,
                      onSelected: (_) => setState(() => all = false),
                    ),
                    ChoiceChip(
                      label: const Text('Todos os temas'),
                      selected: all,
                      onSelected: (_) => setState(() => all = true),
                    ),
                  ],
                ),
              if (!scoped)
                TextField(
                  decoration: const InputDecoration(
                    labelText: 'Pesquisar tema',
                    hintText: 'Amor, graça, fé, aliança…',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (v) => setState(() => search = v),
                ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: rows.length + 1,
            itemBuilder: (ctx, i) {
              if (i == rows.length) {
                return rows.length >= limit
                    ? TextButton(
                        onPressed: () => setState(() => limit += 80),
                        child: const Text('Mostrar mais temas'),
                      )
                    : rows.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Não há tema editorial indexado para esta busca. A pesquisa bíblica continua disponível.',
                        ),
                      )
                    : const SizedBox();
              }
              final row = rows[i];
              return ListTile(
                leading: const Icon(Icons.label_outline),
                title: Text(row['title'] as String),
                subtitle: const Text(
                  'Passagens, aspectos do tema e fonte histórica',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => sheet(
                  context,
                  row['title'] as String,
                  TopicPage(row['id'] as String),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class TopicPage extends StatelessWidget {
  final String id;
  const TopicPage(this.id, {super.key});
  @override
  Widget build(BuildContext context) {
    final row = context.app.store.topic(id);
    if (row == null) return const Center(child: Text('Tema não instalado.'));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                row['title'] as String,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text(
                row['source'] as String,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Text(
                row['review_status'] as String,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              TextButton.icon(
                icon: const Icon(Icons.translate),
                label: const Text('Consultar o índice original em inglês'),
                onPressed: () => sheet(
                  context,
                  'Original histórico',
                  LongStudyText(
                    (row['original_body'] as String).replaceAll(
                      RegExp('<[^>]*>'),
                      ' ',
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(child: LongStudyText(row['body'] as String)),
      ],
    );
  }
}

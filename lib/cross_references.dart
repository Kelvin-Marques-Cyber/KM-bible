import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'graph.dart';
import 'store.dart';
import 'explore.dart' show loadRelations;

class CrossReferencesPage extends StatefulWidget {
  final Reference reference;
  const CrossReferencesPage(this.reference, {super.key});
  @override
  State<CrossReferencesPage> createState() => _CrossReferencesPageState();
}

class _CrossReferencesPageState extends State<CrossReferencesPage> {
  String filter = 'all';
  int limit = 20;
  List<Map<String, dynamic>> curated = [];
  @override
  void initState() {
    super.initState();
    loadRelations().then((v) {
      if (mounted) setState(() => curated = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app, r = widget.reference, rows = <RecordRow>[];
    for (final edge in curated) {
      final target = edge['from'] == r.id
          ? edge['to']
          : edge['to'] == r.id
          ? edge['from']
          : null;
      if (target != null) {
        rows.add({
          'target': target,
          'end_reference': target,
          'kind': edge['kind'],
          'provenance': edge['description'],
          'scope': 'verse',
        });
      }
    }
    rows.addAll(a.store.crossReferences(r, limit: limit));
    final shown = rows
        .where((row) => filter == 'all' || row['kind'] == filter)
        .toList();
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Text(
          r.label(a.language),
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        Text(
          '${a.store.crossReferenceCount(r)} referências diretas cadastradas',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        action(
          'Explorar a rede desta passagem',
          Icons.hub,
          () => sheet(context, 'Conexões bíblicas', GraphPage(reference: r)),
        ),
        Wrap(
          spacing: 8,
          children: [
            for (final e in [
              ('all', 'Todos'),
              ('textual', 'Citações'),
              ('editorial', 'Temas relacionados'),
              ('theological', 'Teologia'),
            ])
              ChoiceChip(
                label: Text(e.$2),
                selected: filter == e.$1,
                onSelected: (_) => setState(() => filter = e.$1),
              ),
          ],
        ),
        const SizedBox(height: 12),
        for (final row in shown)
          Builder(
            builder: (ctx) {
              final target = Reference.fromId(row['target'] as String)!,
                  end = Reference.fromId(row['end_reference'] as String)!;
              final preview = a.store.verse('BLN4', target)?['text'] as String?;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(15),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        end.id == target.id
                            ? target.label(a.language)
                            : '${target.label(a.language)} – ${end.label(a.language)}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        relationLabels[row['kind']] ?? 'Referência editorial',
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      if (row['scope'] == 'chapter')
                        const Text(
                          'Relação do capítulo: não há ligação específica cadastrada para este versículo.',
                        ),
                      if (preview != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Text(
                            preview,
                            maxLines: 4,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      Wrap(
                        spacing: 8,
                        children: [
                          action(
                            'Ler no contexto',
                            Icons.menu_book,
                            () => showPassage(
                              context,
                              target,
                              end: end,
                              sourceEdition: 'BLN4',
                            ),
                          ),
                          action(
                            'Ver conexões',
                            Icons.hub,
                            () => sheet(
                              context,
                              'Conexões bíblicas',
                              GraphPage(reference: target),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        '${row['provenance']}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        if (shown.isEmpty)
          const Text(
            'Não há referências neste filtro. Veja o contexto do capítulo ou outro tipo de ligação.',
          ),
        if (a.store.crossReferenceCount(r) > limit)
          TextButton(
            onPressed: () => setState(() => limit += 20),
            child: const Text('Mostrar mais referências'),
          ),
        const Divider(height: 28),
        Text(
          'OpenBible.info / Treasury of Scripture Knowledge · CC BY 4.0. Base de endereços KJV; a leitura acima usa Bíblia Livre. Confira possíveis diferenças de numeração ao comparar edições.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

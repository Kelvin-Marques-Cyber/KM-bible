import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'explore.dart' show loadContext, loadRelations, eventsAt;
import 'notes.dart';
import 'passage_picker.dart';

const relationLabels = {
  'editorial': 'Referência editorial',
  'textual': 'Citação textual',
  'theological': 'Interpretação teológica',
  'personal': 'Anotação pessoal',
  'history': 'Acontecimento',
  'place': 'Lugar',
};

class GraphNode {
  final String id, title, kind, description;
  final Reference? reference;
  const GraphNode(
    this.id,
    this.title,
    this.kind,
    this.description, [
    this.reference,
  ]);
}

class GraphPage extends StatefulWidget {
  final Reference? reference;
  const GraphPage({super.key, this.reference});
  @override
  State<GraphPage> createState() => _GraphPageState();
}

class _GraphPageState extends State<GraphPage> {
  final transform = TransformationController();
  final trail = <Reference>[];
  Reference? root;
  List<Map<String, dynamic>> curated = [];
  Map<String, dynamic>? history;
  GraphNode? selected;
  String kind = 'all';
  int density = 8;
  bool list = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (root != null) return;
    root = widget.reference ?? context.app.passage;
    Future.wait([loadRelations(), loadContext(context.app.store)]).then((data) {
      if (mounted) {
        setState(() {
          curated = data[0] as List<Map<String, dynamic>>;
          history = data[1] as Map<String, dynamic>;
        });
      }
    });
  }

  @override
  void dispose() {
    transform.dispose();
    super.dispose();
  }

  void focus(Reference ref, {bool remember = true}) {
    if (remember && root != null) trail.add(root!);
    setState(() {
      root = ref;
      selected = null;
      transform.value = Matrix4.identity();
    });
  }

  List<GraphNode> neighbors() {
    final a = context.app, r = root!, nodes = <String, GraphNode>{};
    for (final edge in a.store.crossReferences(r, limit: 60)) {
      final target = Reference.fromId(edge['target'] as String)!;
      final end = Reference.fromId(edge['end_reference'] as String)!;
      nodes[target.id] = GraphNode(
        target.id,
        target.label(a.language),
        'editorial',
        '${edge['scope'] == 'chapter' ? 'Relação do capítulo; não é associação específica deste versículo.\n' : ''}Fonte: ${edge['provenance']}. ${end.id != target.id ? 'Intervalo até ${end.label(a.language)}. ' : ''}Leia as duas passagens no contexto.',
        target,
      );
    }
    for (final edge in curated) {
      final id = edge['from'] == r.id
          ? edge['to']
          : edge['to'] == r.id
          ? edge['from']
          : null;
      final target = id == null ? null : Reference.fromId(id as String);
      if (target != null) {
        nodes[target.id] = GraphNode(
          target.id,
          target.label(a.language),
          edge['kind'] as String,
          edge['description'] as String,
          target,
        );
      }
    }
    for (final note in [...a.store.notesAt(r.id), ...a.store.backlinks(r.id)]) {
      final id = note['id'] as String;
      nodes[id] = GraphNode(
        id,
        note['title'] as String,
        'personal',
        'Nota vinculada ou com referência à passagem.',
      );
    }
    if (history != null) {
      for (final event in eventsAt(history!, r)) {
        nodes['event:${event['id']}'] = GraphNode(
          'event:${event['id']}',
          event['title'] as String,
          'history',
          '${event['description']}\n${event['certainty']} — associação pela perícope.',
        );
        final place = (history!['locations'] as List)
            .where((p) => p['id'] == event['location'])
            .firstOrNull;
        if (place != null) {
          nodes['place:${place['id']}'] = GraphNode(
            'place:${place['id']}',
            place['ancient'] as String,
            'place',
            '${place['uncertainty']}',
          );
        }
      }
    }
    final values = nodes.values
        .where((n) => n.id != r.id && (kind == 'all' || n.kind == kind))
        .toList();
    // Personal and explicitly curated connections remain visible alongside references.
    values.sort(
      (a, b) => (a.kind == 'editorial' ? 1 : 0).compareTo(
        b.kind == 'editorial' ? 1 : 0,
      ),
    );
    return values.take(density).toList();
  }

  Widget details(GraphNode node) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(node.title, style: Theme.of(context).textTheme.titleMedium),
          Text(
            relationLabels[node.kind] ?? node.kind,
            style: Theme.of(context).textTheme.labelMedium,
          ),
          const SizedBox(height: 8),
          Text(node.description),
          Wrap(
            spacing: 8,
            children: [
              if (node.reference != null) ...[
                action(
                  'Ler passagem',
                  Icons.menu_book,
                  () => showPassage(
                    context,
                    node.reference!,
                    sourceEdition: 'BLN4',
                  ),
                ),
                action(
                  'Expandir conexões',
                  Icons.hub,
                  () => focus(node.reference!),
                ),
              ] else if (node.kind == 'personal')
                action('Abrir anotação', Icons.edit_note, () {
                  final n = context.app.store.note(node.id);
                  if (n != null) openNote(context, n);
                }),
            ],
          ),
        ],
      ),
    ),
  );
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        r = root!,
        nodes = neighbors(),
        color = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            if (trail.isNotEmpty)
              IconButton(
                tooltip: 'Voltar à conexão anterior',
                onPressed: () {
                  final previous = trail.removeLast();
                  focus(previous, remember: false);
                },
                icon: const Icon(Icons.arrow_back),
              ),
            Expanded(
              child: TextButton.icon(
                onPressed: () => sheet(
                  context,
                  'Escolher passagem',
                  PassagePicker(initial: r, onSelect: focus),
                ),
                icon: const Icon(Icons.menu_book),
                label: Text(r.label(a.language)),
              ),
            ),
          ],
        ),
        Text(
          '${a.store.crossReferenceCount(r)} referências diretas na base. Toque em um nó para ler ou expandir.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: kind,
                decoration: const InputDecoration(labelText: 'Tipo de ligação'),
                items: [
                  const DropdownMenuItem(value: 'all', child: Text('Todos')),
                  for (final entry in relationLabels.entries)
                    DropdownMenuItem(
                      value: entry.key,
                      child: Text(entry.value),
                    ),
                ],
                onChanged: (v) => setState(() {
                  kind = v!;
                  selected = null;
                }),
              ),
            ),
            const SizedBox(width: 8),
            DropdownButton<int>(
              value: density,
              items: [
                for (final n in [8, 12, 20])
                  DropdownMenuItem(value: n, child: Text('$n nós')),
              ],
              onChanged: (v) => setState(() => density = v!),
            ),
          ],
        ),
        Row(
          children: [
            TextButton.icon(
              onPressed: () => setState(() => list = !list),
              icon: Icon(list ? Icons.hub : Icons.list),
              label: Text(list ? 'Ver grafo' : 'Lista acessível'),
            ),
            const Spacer(),
            IconButton(
              tooltip: 'Redefinir zoom',
              onPressed: () => transform.value = Matrix4.identity(),
              icon: const Icon(Icons.center_focus_strong),
            ),
          ],
        ),
        if (nodes.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Este filtro não possui ligações cadastradas. Escolha outro tipo ou passagem.',
            ),
          ),
        if (list)
          ...nodes.map(
            (node) => ListTile(
              leading: const Icon(Icons.circle_outlined),
              title: Text(node.title),
              subtitle: Text(relationLabels[node.kind] ?? node.kind),
              selected: selected?.id == node.id,
              onTap: () => setState(() => selected = node),
            ),
          )
        else if (nodes.isNotEmpty)
          LayoutBuilder(
            builder: (ctx, constraints) {
              final size = Size(
                    constraints.maxWidth,
                    math.max(420, ((nodes.length + 1) ~/ 2) * 64.0 + 90),
                  ),
                  positions = <String, Offset>{
                    r.id: Offset(
                      constraints.maxWidth / 2,
                      math.max(420, ((nodes.length + 1) ~/ 2) * 64.0 + 90) / 2,
                    ),
                  };
              final rows = (nodes.length + 1) ~/ 2;
              for (var i = 0; i < nodes.length; i++) {
                positions[nodes[i].id] = Offset(
                  size.width * (i.isEven ? .17 : .83),
                  55 + (i ~/ 2 + .5) * (size.height - 100) / rows,
                );
              }
              return ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: ColoredBox(
                  color: color.surfaceContainerLow,
                  child: SizedBox(
                    height: size.height,
                    child: InteractiveViewer(
                      transformationController: transform,
                      minScale: .65,
                      maxScale: 4,
                      boundaryMargin: const EdgeInsets.all(160),
                      child: GestureDetector(
                        onTapUp: (tap) {
                          final point = tap.localPosition;
                          GraphNode? hit;
                          for (final n in nodes) {
                            final center = positions[n.id]!;
                            final label = Rect.fromLTWH(
                              center.dx < size.width / 2 ? 4 : size.width - 108,
                              center.dy + 17,
                              104,
                              40,
                            ).inflate(8);
                            if ((center - point).distance < 32 ||
                                label.contains(point)) {
                              hit = n;
                              break;
                            }
                          }
                          if (hit != null) setState(() => selected = hit);
                        },
                        child: CustomPaint(
                          size: size,
                          painter: StudyGraphPainter(
                            r.label(a.language),
                            r.id,
                            nodes,
                            positions,
                            selected?.id,
                            color,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        if (selected != null)
          details(selected!)
        else if (nodes.isNotEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'O zoom e o deslocamento exploram a rede. A lista oferece as mesmas ações para teclado e leitor de tela.',
            ),
          ),
        Text(
          'As cores distinguem citação textual, referência editorial, interpretação teológica, nota pessoal, acontecimento e lugar. Referências editoriais não afirmam equivalência entre textos.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class StudyGraphPainter extends CustomPainter {
  final String title, root;
  final List<GraphNode> nodes;
  final Map<String, Offset> positions;
  final String? selected;
  final ColorScheme colors;
  StudyGraphPainter(
    this.title,
    this.root,
    this.nodes,
    this.positions,
    this.selected,
    this.colors,
  );
  Color color(String kind) => switch (kind) {
    'textual' => colors.primary,
    'theological' => colors.tertiary,
    'personal' => Colors.amber.shade700,
    'history' => Colors.blue.shade400,
    'place' => Colors.teal.shade400,
    _ => colors.secondary,
  };
  @override
  void paint(Canvas canvas, Size size) {
    final center = positions[root]!;
    for (final node in nodes) {
      final p = positions[node.id]!, c = color(node.kind);
      canvas.drawLine(
        center,
        p,
        Paint()
          ..color = c.withValues(alpha: node.id == selected ? .8 : .24)
          ..strokeWidth = node.id == selected ? 2.5 : 1.2,
      );
    }
    canvas.drawCircle(center, 16, Paint()..color = colors.primary);
    label(
      canvas,
      title,
      Offset(center.dx - 45, center.dy - 64),
      90,
      colors.onSurface,
    );
    for (final node in nodes) {
      final p = positions[node.id]!, c = color(node.kind);
      if (node.id == selected) {
        canvas.drawCircle(p, 18, Paint()..color = c.withValues(alpha: .2));
      }
      canvas.drawCircle(p, 10, Paint()..color = c);
      final left = p.dx < size.width / 2;
      label(
        canvas,
        node.title,
        Offset(left ? 4 : size.width - 108, p.dy + 17),
        104,
        colors.onSurface,
      );
    }
  }

  void label(
    Canvas canvas,
    String text,
    Offset position,
    double width,
    Color color,
  ) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: 13,
          color: color,
          height: 1.15,
          fontWeight: FontWeight.w500,
        ),
      ),
      maxLines: 2,
      ellipsis: '…',
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    )..layout(maxWidth: width);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(position.dx, position.dy, width, tp.height + 6),
        const Radius.circular(4),
      ),
      Paint()..color = colors.surfaceContainerLow.withValues(alpha: .92),
    );
    tp.paint(canvas, position + const Offset(0, 3));
  }

  @override
  bool shouldRepaint(covariant StudyGraphPainter old) => true;
}

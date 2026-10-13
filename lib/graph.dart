import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'explore.dart' show loadContext, loadRelations, eventsAt;
import 'notes.dart';
import 'passage_picker.dart';
import 'bible_topics.dart';

const relationLabels = {
  'editorial': 'Referência editorial',
  'textual': 'Citação textual',
  'theological': 'Interpretação teológica',
  'personal': 'Anotação pessoal',
  'history': 'Acontecimento',
  'place': 'Lugar',
  'topic': 'Tema editorial',
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

class _GraphPageState extends State<GraphPage>
    with SingleTickerProviderStateMixin {
  final transform = TransformationController();
  final trail = <({Reference reference, String? topicId})>[];
  late final AnimationController motion;
  @override
  void initState() {
    super.initState();
    motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 360),
    );
  }

  String? topicId;
  bool animating = false;
  bool _needsFit = true;
  Size _viewport = Size.zero;
  Size _scene = Size.zero;
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
    motion.dispose();
    transform.dispose();
    super.dispose();
  }

  String get centerId => topicId ?? root!.id;
  String get centerTitle => topicId == null
      ? root!.label(context.app.language)
      : context.app.store.topic(topicId!)?['title'] as String? ?? 'Tema';
  void focus(Reference ref, {bool remember = true, String? topic}) {
    if (root != null && remember) {
      trail.add((reference: root!, topicId: topicId));
    }
    motion.stop();
    setState(() {
      root = ref;
      topicId = topic;
      kind = 'all';
      selected = null;
      _needsFit = true;
    });
  }

  Matrix4 _fitMatrix() {
    if (_viewport == Size.zero || _scene == Size.zero) {
      return Matrix4.identity();
    }
    final scale = math.min(
      _viewport.width / _scene.width,
      _viewport.height / _scene.height,
    ) * .94;
    return Matrix4.diagonal3Values(scale, scale, 1)
      ..setTranslationRaw(
        (_viewport.width - _scene.width * scale) / 2,
        (_viewport.height - _scene.height * scale) / 2,
        0,
      );
  }

  void _fitGraph() {
    transform.value = _fitMatrix();
  }

  void _zoom(double factor) {
    final current = transform.value;
    final oldScale = current.getMaxScaleOnAxis();
    if (oldScale <= 0 || _viewport == Size.zero) return;
    final nextScale = (oldScale * factor).clamp(.2, 4.5).toDouble();
    final ratio = nextScale / oldScale;
    final oldTranslation = current.getTranslation();
    final pivot = Offset(_viewport.width / 2, _viewport.height / 2);
    transform.value = Matrix4.diagonal3Values(nextScale, nextScale, 1)
      ..setTranslationRaw(
        pivot.dx - (pivot.dx - oldTranslation.x) * ratio,
        pivot.dy - (pivot.dy - oldTranslation.y) * ratio,
        0,
      );
  }

  Future<void> selectNode(GraphNode node, Offset position) async {
    // Evita salto brusco no enquadramento ao tocar uma conexao.
    motion.stop();
    if (mounted) setState(() => selected = node);
  }

  List<GraphNode> neighbors() {
    final a = context.app, r = root!, nodes = <String, GraphNode>{};
    if (topicId != null) {
      if (kind != 'all' && kind != 'editorial') return [];
      return a.store.topicReferences(topicId!, limit: density)
          .map((row) => Reference.fromId('${row['reference']}'))
          .whereType<Reference>()
          .map((ref) => GraphNode(
                ref.id,
                ref.label(a.language),
                'editorial',
                'Passagem associada ao tema no índice histórico de Torrey; relação editorial, não equivalência exegética.',
                ref,
              ))
          .toList();
    }
    for (final theme in a.store.topics(reference: r, limit: 3)) {
      nodes['topic:${theme['id']}'] = GraphNode(
        'topic:${theme['id']}',
        theme['title'] as String,
        'topic',
        'Tema associado pelo índice histórico de R. A. Torrey. Expanda para explorar suas passagens.',
      );
    }
    for (final edge in a.store.crossReferences(r, limit: 60)) {
      final target = Reference.fromId('${edge['target']}');
      if (target == null) continue;
      final end = Reference.fromId('${edge['end_reference']}') ?? target;
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
      final target = id == null ? null : Reference.fromId('$id');
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
              ] else if (node.kind == 'topic') ...[
                action(
                  'Abrir estudo do tema',
                  Icons.label_outline,
                  () => sheet(
                    context,
                    node.title,
                    TopicPage(node.id.substring('topic:'.length)),
                  ),
                ),
                action(
                  'Expandir passagens do tema',
                  Icons.hub,
                  () => focus(root!, topic: node.id.substring('topic:'.length)),
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
        Wrap(
          spacing: 6,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (topicId == null)
              action(
                'Ler passagem',
                Icons.menu_book,
                () => showPassage(context, r, sourceEdition: 'BLN4'),
              ),
            if (trail.isNotEmpty)
              IconButton(
                tooltip: 'Voltar à conexão anterior',
                onPressed: () {
                  final previous = trail.removeLast();
                  focus(
                    previous.reference,
                    topic: previous.topicId,
                    remember: false,
                  );
                },
                icon: const Icon(Icons.arrow_back),
              ),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: math.max(160.0, MediaQuery.sizeOf(context).width - 96),
              ),
              child: TextButton.icon(
                onPressed: () => sheet(
                  context,
                  'Escolher passagem',
                  PassagePicker(initial: r, onSelect: focus),
                ),
                icon: const Icon(Icons.menu_book),
                label: Text(centerTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ),
          ],
        ),
        Text(
          topicId == null
              ? '${a.store.crossReferenceCount(r)} referências diretas na base. Toque para ampliar a conexão.'
              : 'Rede do tema · toque numa passagem para explorar suas conexões.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (ctx, limits) {
          final narrow = limits.maxWidth < 480;
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: narrow ? limits.maxWidth : limits.maxWidth - 144,
                child: DropdownButtonFormField<String>(
                  initialValue: kind,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Tipo de ligação'),
                  items: [
                    const DropdownMenuItem(value: 'all', child: Text('Todos')),
                    for (final entry in relationLabels.entries)
                      DropdownMenuItem(
                        value: entry.key,
                        child: Text(entry.value, maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() {
                    if (v == null) return;
                    kind = v;
                    selected = null;
                    _needsFit = true;
                  }),
                ),
              ),
              SizedBox(
                width: narrow ? limits.maxWidth : 136,
                child: DropdownButtonFormField<int>(
                  initialValue: density,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Densidade'),
                  items: [
                    for (final n in [8, 12, 20])
                      DropdownMenuItem(value: n, child: Text('$n nós')),
                  ],
                  onChanged: (v) => setState(() {
                    if (v == null) return;
                    density = v;
                    selected = null;
                    _needsFit = true;
                  }),
                ),
              ),
            ],
          );
        }),
        Wrap(
          spacing: 4,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TextButton.icon(
              onPressed: () => setState(() => list = !list),
              icon: Icon(list ? Icons.hub : Icons.list),
              label: Text(list ? 'Ver grafo' : 'Lista acessível'),
            ),
            IconButton(
              tooltip: 'Aproximar rede',
              icon: const Icon(Icons.add),
              onPressed: () => _zoom(1.35),
            ),
            IconButton(
              tooltip: 'Afastar rede',
              icon: const Icon(Icons.remove),
              onPressed: () => _zoom(1 / 1.35),
            ),
            IconButton(
              tooltip: 'Enquadrar toda a galáxia',
              onPressed: _fitGraph,
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
              trailing: node.reference != null || node.kind == 'topic'
                  ? IconButton(
                      icon: const Icon(Icons.hub),
                      tooltip: 'Expandir conexões',
                      onPressed: () => focus(node.reference ?? root!,
                          topic: node.kind == 'topic'
                              ? node.id.substring('topic:'.length)
                              : null),
                    )
                  : null,
            ),
          )
        else if (nodes.isNotEmpty)
          LayoutBuilder(
            builder: (ctx, constraints) {
              final viewport = Size(
                constraints.maxWidth,
                math.min(
                  550.0,
                  math.max(390.0, MediaQuery.sizeOf(ctx).height * .56),
                ),
              );
              // A consistent scene allows full zoom/pan without overlapping
              // labels on small devices. There are 8 nodes in the first ring
              // and up to 12 in the second.
              final scene = Size(
                nodes.length <= 8 ? 730 : 900,
                nodes.length <= 8 ? 670 : 830,
              );
              final center = Offset(scene.width / 2, scene.height / 2);
              final positions = <String, Offset>{centerId: center};
              for (var i = 0; i < nodes.length; i++) {
                final outer = i >= 8;
                final index = outer ? i - 8 : i;
                final count = outer ? nodes.length - 8 : math.min(nodes.length, 8);
                final angle = -math.pi / 2 + 2 * math.pi * index / count +
                    (outer ? math.pi / count : 0);
                final radius = outer
                    ? 295.0
                    : (nodes.length <= 8 ? 208.0 : 175.0);
                positions[nodes[i].id] = center +
                    Offset(radius * math.cos(angle), radius * math.sin(angle));
              }
              final layoutChanged = _viewport != viewport || _scene != scene;
              _viewport = viewport;
              _scene = scene;
              if (_needsFit || layoutChanged) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted) return;
                  _fitGraph();
                  _needsFit = false;
                });
              }
              return ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: ColoredBox(
                  color: color.surfaceContainerLow,
                  child: SizedBox(
                    height: viewport.height,
                    child: InteractiveViewer(
                      transformationController: transform,
                      minScale: .2,
                      maxScale: 4.5,
                      boundaryMargin: const EdgeInsets.all(900),
                      constrained: false,
                      child: SizedBox(
                        width: scene.width,
                        height: scene.height,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTapUp: (tap) {
                            final point = tap.localPosition;
                            for (final n in nodes.reversed) {
                              final position = positions[n.id]!;
                              final label = StudyGraphPainter.labelBounds(
                                position,
                                center,
                                scene,
                              ).inflate(13);
                              if ((position - point).distance <= 30 ||
                                  label.contains(point)) {
                                selectNode(n, position);
                                return;
                              }
                            }
                          },
                          child: CustomPaint(
                            size: scene,
                            painter: StudyGraphPainter(
                              centerTitle,
                              centerId,
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
              'Toque em uma estrela para ver os detalhes e ampliar sua conexão. Use dois dedos ou +/− para o zoom. A lista é acessível por teclado.',
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
    'topic' => Colors.purple.shade400,
    _ => colors.secondary,
  };

  // Shared by painter and hit test: labels stay clickable after zooming.
  static Rect labelBounds(Offset p, Offset center, Size size) {
    const w = 138.0;
    final right = p.dx >= center.dx;
    final x = (right ? p.dx + 13 : p.dx - w - 13)
        .clamp(8.0, size.width - w - 8);
    final y = (p.dy - 22).clamp(8.0, size.height - 48.0);
    return Rect.fromLTWH(x.toDouble(), y.toDouble(), w, 44);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final center = positions[root]!;
    // Deterministic star field: no timers or continuous GPU/CPU use.
    final seed = math.Random(1729);
    for (var i = 0; i < 115; i++) {
      final point = Offset(seed.nextDouble() * size.width,
          seed.nextDouble() * size.height);
      canvas.drawCircle(point, i % 9 == 0 ? 1.5 : .7,
          Paint()..color = colors.primary.withValues(alpha: .10 + .15 * seed.nextDouble()));
    }
    for (final node in nodes) {
      final p = positions[node.id]!, c = color(node.kind);
      final highlighted = node.id == selected;
      canvas.drawLine(
        center,
        p,
        Paint()
          ..color = c.withValues(alpha: highlighted ? .83 : .31)
          ..strokeWidth = highlighted ? 3.0 : 1.5,
      );
    }
    canvas.drawCircle(center, 25,
        Paint()..color = colors.primary.withValues(alpha: .16));
    canvas.drawCircle(center, 15, Paint()..color = colors.primary);
    final centerLabel = Rect.fromCenter(
        center: center + const Offset(0, -47), width: 162, height: 43);
    label(canvas, title, centerLabel, colors.onSurface,
        emphasized: true);

    for (final node in nodes) {
      final p = positions[node.id]!, c = color(node.kind);
      final highlighted = node.id == selected;
      if (highlighted) {
        canvas.drawCircle(p, 23,
            Paint()..color = c.withValues(alpha: .25));
      }
      canvas.drawCircle(p, highlighted ? 12 : 10,
          Paint()..color = c);
      final rect = labelBounds(p, center, size);
      label(canvas, node.title, rect, colors.onSurface,
          emphasized: highlighted);
    }
  }

  void label(Canvas canvas, String text, Rect rect, Color color,
      {bool emphasized = false}) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: emphasized ? 14 : 13,
          color: color,
          height: 1.15,
          fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      maxLines: 2,
      ellipsis: '…',
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    )..layout(maxWidth: rect.width - 8);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(9)),
      Paint()
        ..color = colors.surfaceContainerLow.withValues(
            alpha: emphasized ? .98 : .93),
    );
    final baseline = rect.top + (rect.height - tp.height) / 2;
    tp.paint(canvas,
        Offset(rect.left + (rect.width - tp.width) / 2, baseline));
    tp.dispose();
  }

  @override
  bool shouldRepaint(covariant StudyGraphPainter old) =>
      old.title != title || old.selected != selected ||
      old.nodes.length != nodes.length || old.colors != colors ||
      old.positions != positions;
}

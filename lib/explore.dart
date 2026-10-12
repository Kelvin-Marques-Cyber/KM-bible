import 'graph.dart';
export 'graph.dart';
import 'passage_picker.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'notes.dart';
import 'store.dart';
import 'linguistics.dart';

Future<Map<String, dynamic>> loadContext([Store? store]) async {
  final data = Map<String, dynamic>.from(
    jsonDecode(await rootBundle.loadString('assets/content/context.json')),
  );
  if (store != null) {
    for (final doc in store.documents(kind: 'atlas')) {
      final m = jsonMap(doc['metadata']), prefix = '${doc['id']}:';
      var index = 0;
      for (final raw in m['locations'] as List? ?? []) {
        final l = Map<String, dynamic>.from(raw);
        l['id'] = prefix + (l['id'] ?? 'place${index++}').toString();
        l['ancient'] = l['ancient'] ?? l['title'] ?? l['name'] ?? l['id'];
        l['modern'] = l['modern'] ?? l['ancient'];
        l['uncertainty'] =
            l['uncertainty'] ??
            'Localização fornecida pelo módulo; consulte a fonte.';
        l['source'] = store.module(doc['module_id'] as String)?['source'];
        (data['locations'] as List).add(l);
      }
      for (final raw in m['events'] as List? ?? []) {
        final e = Map<String, dynamic>.from(raw);
        e['id'] = prefix + (e['id'] ?? 'event${index++}').toString();
        e['title'] = e['title'] ?? doc['title'];
        e['description'] = e['description'] ?? doc['body'];
        e['certainty'] = e['certainty'] ?? 'módulo importado';
        e['references'] = (e['references'] as List? ?? [])
            .where((r) => Reference.fromId(r.toString()) != null)
            .toList();
        e['ranges'] = (e['references'] as List)
            .map(
              (r) => {
                'start': r,
                'end': r.toString().replaceFirst(RegExp(r':[^:]+$'), ':176'),
              },
            )
            .toList();
        e['sources'] = [
          store.module(doc['module_id'] as String)?['source'] ?? '',
        ];
        e['world'] = e['world'] == true;
        e['location'] = e['location'] == null ? null : prefix + e['location'];
        e['alternatives'] = [];
        (data['events'] as List).add(e);
      }
    }
  }
  return data;
}

Future<List<Map<String, dynamic>>> loadRelations() async =>
    (jsonDecode(await rootBundle.loadString('assets/content/relations.json'))
            as List)
        .map((x) => Map<String, dynamic>.from(x))
        .toList();
Future<List<Map<String, dynamic>>>? _bundledModels;
Future<List<Map<String, dynamic>>> _loadBundledModels() async =>
    (jsonDecode(await rootBundle.loadString('assets/3d/models.json')) as List)
        .map((x) => Map<String, dynamic>.from(x))
        .toList();
Future<List<Map<String, dynamic>>> loadModels([Store? store]) async {
  final bundled = await (_bundledModels ??= _loadBundledModels());
  final models = bundled.map((m) => Map<String, dynamic>.from(m)).toList();
  if (store != null) {
    for (final d in store.documents(kind: 'model')) {
      final m = jsonMap(d['metadata']);
      m['title'] = d['title'];
      m['description'] = m['description'] ?? d['body'];
      m['layers'] = m['layers'] ?? ['Estrutura'];
      m['references'] = (m['references'] as List? ?? [])
          .where((r) => Reference.fromId(r.toString()) != null)
          .toList();
      m['certainty'] =
          m['certainty'] ??
          'Reconstrução fornecida pelo módulo. Consulte as fontes.';
      m['author'] = store.module(d['module_id'] as String)?['author'];
      m['license'] = store.module(d['module_id'] as String)?['license'];
      models.add(m);
    }
  }
  return models;
}

Future<List<Map<String, dynamic>>>? _modelScenes;
Future<List<Map<String, dynamic>>> loadModelScenes() =>
    _modelScenes ??= () async {
      final data =
          jsonDecode(
                await rootBundle.loadString('assets/content/model-scenes.json'),
              )
              as Map;
      return (data['scenes'] as List)
          .map((x) => Map<String, dynamic>.from(x))
          .toList();
    }();

Map<String, dynamic>? modelBlockAt(
  List<Map<String, dynamic>> scenes,
  Reference ref,
) {
  for (final block in scenes) {
    if (block['book'] == ref.book &&
        ref.chapter >= (block['start_chapter'] as int) &&
        ref.chapter <= (block['end_chapter'] as int)) {
      return block;
    }
  }
  return null;
}

List<dynamic> eventsAt(Map<String, dynamic> data, Reference ref) =>
    (data['events'] as List)
        .where(
          (e) => (e['ranges'] as List).any((range) {
            final start = Reference.fromId(range['start'] as String)!,
                end = Reference.fromId(range['end'] as String)!;
            return ref.key >= start.key && ref.key <= end.key;
          }),
        )
        .toList();
String yearLabel(Object? year) => year == null
    ? 'Data não estabelecida'
    : (year as int) < 0
    ? '${-year} a.C.'
    : '$year d.C.';

class ExplorePage extends StatelessWidget {
  const ExplorePage({super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app;
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        feature(
          context,
          a.t('timeline'),
          'Eventos, propostas de datação e referências',
          Icons.history,
          () => sheet(context, a.t('timeline'), const TimelinePage()),
        ),
        feature(
          context,
          a.t('map'),
          'Cidades antigas, geografia atual e rotas estimadas',
          Icons.public,
          () => sheet(context, a.t('map'), const AtlasPage()),
        ),
        feature(
          context,
          a.t('contextCompare'),
          'Dois acontecimentos: tempo, lugar e incerteza',
          Icons.compare_arrows,
          () => sheet(
            context,
            a.t('contextCompare'),
            ContextComparisonPage(first: a.passage),
          ),
        ),
        feature(
          context,
          a.t('models'),
          'Acervo com camadas, pesquisa e recursos a cada quatro capítulos',
          Icons.view_in_ar,
          () => sheet(context, a.t('models'), const ModelsPage()),
        ),
        feature(
          context,
          a.t('units'),
          'Unidades históricas e intervalos aproximados',
          Icons.straighten,
          () => sheet(context, a.t('units'), const UnitsPage()),
        ),
        feature(
          context,
          a.t('linguistics'),
          'Hebraico, aramaico, grego, Strong e morfologia',
          Icons.translate,
          () =>
              sheet(context, a.t('linguistics'), const LinguisticSearchPage()),
        ),
        feature(
          context,
          a.t('graph'),
          'Referências textuais, interpretações e notas pessoais',
          Icons.hub,
          () => sheet(context, a.t('graph'), const GraphPage()),
        ),
      ],
    );
  }
}

class TimelinePage extends StatefulWidget {
  final Reference? reference;
  final String query;
  const TimelinePage({super.key, this.reference, this.query = ''});
  @override
  State<TimelinePage> createState() => _TimelinePageState();
}

class _TimelinePageState extends State<TimelinePage> {
  Map<String, dynamic>? data;
  bool world = true, all = false;
  String query = '';
  @override
  void initState() {
    super.initState();
    query = widget.query;
    Future.delayed(Duration.zero, () {
      if (!mounted) return loadContext();
      return loadContext(context.app.store);
    }).then((d) {
      if (mounted) setState(() => data = d);
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    if (data == null) return const Center(child: CircularProgressIndicator());
    final events = widget.reference == null || all
        ? data!['events'] as List
        : eventsAt(data!, widget.reference!);
    final rows =
        events
            .where(
              (e) =>
                  (world || e['world'] != true) &&
                  (query.isEmpty ||
                      fold(
                        '${e['title']} ${e['description']}',
                      ).contains(fold(query))),
            )
            .toList()
          ..sort(
            (x, y) => (x['start'] as int? ?? -99999).compareTo(
              y['start'] as int? ?? -99999,
            ),
          );
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (widget.reference != null)
          Text(
            widget.reference!.label(a.language),
            style: Theme.of(context).textTheme.titleLarge,
          ),
        Wrap(
          spacing: 8,
          children: [
            FilterChip(
              label: Text(a.t('world')),
              selected: world,
              onSelected: (v) => setState(() => world = v),
            ),
            if (widget.reference != null)
              FilterChip(
                label: Text(a.t('all')),
                selected: all,
                onSelected: (v) => setState(() => all = v),
              ),
          ],
        ),
        TextField(
          decoration: InputDecoration(labelText: a.t('search')),
          onChanged: (v) => setState(() => query = v),
        ),
        const SizedBox(height: 16),
        const Text(
          'Datas dizem respeito ao acontecimento descrito. Um intervalo pode abranger propostas alternativas; não indica sempre sua duração.',
        ),
        if (rows.isEmpty) Text(a.t('insufficient')),
        ...rows.map(
          (e) => Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    e['title'] as String,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Text(
                    '${yearLabel(e['start'])}${e['end'] != e['start'] ? ' — ${yearLabel(e['end'])}' : ''} · ${e['certainty']}',
                  ),
                  const SizedBox(height: 12),
                  Text(e['description'] as String),
                  ...((e['alternatives'] as List?) ?? []).map(
                    (alt) => Text(
                      '• ${alt['label']}: ${yearLabel(alt['start'])} — ${yearLabel(alt['end'])}',
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    children: (e['references'] as List).map((r) {
                      final ref = Reference.fromId(r as String)!;
                      return action(
                        ref.label(a.language),
                        Icons.menu_book,
                        () => showPassage(context, ref, sourceEdition: 'BLN4'),
                      );
                    }).toList(),
                  ),
                  if (e['location'] != null)
                    action(
                      a.t('map'),
                      Icons.place,
                      () => sheet(
                        context,
                        a.t('map'),
                        AtlasPage(focus: e['location'] as String),
                      ),
                    ),
                  sourceLinks(context, e['sources'] as List),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class ContextComparisonPage extends StatefulWidget {
  final Reference first;
  const ContextComparisonPage({super.key, required this.first});
  @override
  State<ContextComparisonPage> createState() => _ContextComparisonPageState();
}

class _ContextComparisonPageState extends State<ContextComparisonPage> {
  late TextEditingController first;
  final second = TextEditingController(text: 'Atos 28:16');
  Map<String, dynamic>? data;
  String? output;
  List<dynamic> chosen = [];
  @override
  void initState() {
    super.initState();
    first = TextEditingController(text: widget.first.label());
    Future.delayed(Duration.zero, () {
      if (!mounted) return loadContext();
      return loadContext(context.app.store);
    }).then((d) {
      if (mounted) setState(() => data = d);
    });
  }

  @override
  void dispose() {
    first.dispose();
    second.dispose();
    super.dispose();
  }

  void compare() {
    final a = context.app,
        r = Reference.parse(first.text),
        s = Reference.parse(second.text);
    if (r == null || s == null || data == null) return;
    final x = eventsAt(data!, r), y = eventsAt(data!, s);
    final lines = <String>[];
    chosen = [];
    if (x.isEmpty || y.isEmpty) {
      lines.add(a.t('insufficient'));
    } else {
      final e = x.first, f = y.first;
      chosen = [e, f];
      lines.add('${e['title']} ↔ ${f['title']}');
      final time = historicalInterval(
        e['start'] as int?,
        e['end'] as int?,
        f['start'] as int?,
        f['end'] as int?,
      );
      lines.add(
        time == null
            ? a.t('insufficient')
            : 'Intervalo possível: ${time.$1}–${time.$2} anos. Não há ano zero.',
      );
      final locations = data!['locations'] as List;
      final p = locations.where((l) => l['id'] == e['location']).firstOrNull,
          q = locations.where((l) => l['id'] == f['location']).firstOrNull;
      if (p != null && q != null) {
        final km = geographicDistance(
          (p['lat'] as num).toDouble(),
          (p['lon'] as num).toDouble(),
          (q['lat'] as num).toDouble(),
          (q['lon'] as num).toDouble(),
        );
        lines.add(
          'Distância em linha reta: ≈ ${km.toStringAsFixed(1)} km. Não é distância de viagem.',
        );
        lines.add(
          '${p['ancient']}: ${p['uncertainty']}\n${q['ancient']}: ${q['uncertainty']}',
        );
      } else {
        lines.add('Localização insuficiente para distância.');
      }
      lines.add('${e['description']}\n\n${f['description']}');
      lines.add(
        'Associações por perícope. Um versículo pode mencionar vários acontecimentos: confira a identificação antes de usar os resultados.',
      );
    }
    setState(() => output = lines.join('\n\n'));
  }

  Widget referenceChoice(String title, TextEditingController controller) =>
      Card(
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.menu_book),
              title: Text(title),
              subtitle: Text(controller.text),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => sheet(
                context,
                'Escolher passagem',
                PassagePicker(
                  initial: Reference.parse(controller.text),
                  onSelect: (r) => setState(() {
                    controller.text = r.label(context.app.language);
                    output = null;
                  }),
                ),
              ),
            ),
            ExpansionTile(
              title: const Text('Acontecimentos históricos'),
              children: [
                if (data == null)
                  const LinearProgressIndicator()
                else
                  ...(data!['events'] as List)
                      .where(
                        (e) =>
                            e['world'] != true &&
                            (e['references'] as List).isNotEmpty,
                      )
                      .map(
                        (e) => ListTile(
                          title: Text(e['title']),
                          subtitle: Text(
                            '${e['certainty']} · referência da perícope',
                          ),
                          onTap: () => setState(() {
                            controller.text = Reference.fromId(
                              (e['references'] as List).first.toString(),
                            )!.label(context.app.language);
                            output = null;
                          }),
                        ),
                      ),
              ],
            ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        referenceChoice('1 · Referência', first),
        const SizedBox(height: 12),
        referenceChoice('2 · Referência', second),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: data == null ? null : compare,
          child: Text(a.t('contextCompare')),
        ),
        if (output != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 22),
            child: SelectableText(output!),
          ),
        if (chosen.isNotEmpty)
          OutlinedButton.icon(
            onPressed: () => sheet(
              context,
              a.t('map'),
              AtlasPage(focus: chosen.first['location'] as String?),
            ),
            icon: const Icon(Icons.public),
            label: Text(a.t('map')),
          ),
      ],
    );
  }
}

class AtlasPage extends StatefulWidget {
  final String? focus;
  const AtlasPage({super.key, this.focus});
  @override
  State<AtlasPage> createState() => _AtlasPageState();
}

class _AtlasPageState extends State<AtlasPage> {
  Map<String, dynamic>? data;
  List<dynamic> land = [];
  final transform = TransformationController();
  bool modern = false;
  String? route;
  String filter = '';
  @override
  void initState() {
    super.initState();
    Future.wait([
      Future.delayed(Duration.zero, () {
        if (!mounted) return loadContext();
        return loadContext(context.app.store);
      }),
      rootBundle.loadString('assets/content/land.json'),
    ]).then((d) {
      if (mounted) {
        setState(() {
          data = d[0] as Map<String, dynamic>;
          land = jsonDecode(d[1] as String) as List;
        });
      }
    });
  }

  @override
  void dispose() {
    transform.dispose();
    super.dispose();
  }

  void zoom(double factor) {
    transform.value = transform.value.clone()
      ..scaleByDouble(factor, factor, 1, 1);
  }

  void pan(double x, double y) {
    transform.value = transform.value.clone()..translateByDouble(x, y, 0, 1);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    if (data == null) return const Center(child: CircularProgressIndicator());
    final locations = (data!['locations'] as List)
        .where(
          (l) =>
              filter.isEmpty ||
              fold('${l['ancient']} ${l['modern']}').contains(fold(filter)),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Wrap(
                spacing: 4,
                children: [
                  FilterChip(
                    label: Text(a.t('modern')),
                    selected: modern,
                    onSelected: (v) => setState(() => modern = v),
                  ),
                  action(a.t('zoomIn'), Icons.add, () => zoom(1.3)),
                  action(a.t('zoomOut'), Icons.remove, () => zoom(.77)),
                  action(
                    a.t('reset'),
                    Icons.restart_alt,
                    () => transform.value = Matrix4.identity(),
                  ),
                  IconButton(
                    tooltip: 'Mover oeste',
                    onPressed: () => pan(50, 0),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  IconButton(
                    tooltip: 'Mover leste',
                    onPressed: () => pan(-50, 0),
                    icon: const Icon(Icons.arrow_forward),
                  ),
                  IconButton(
                    tooltip: 'Mover norte',
                    onPressed: () => pan(0, 50),
                    icon: const Icon(Icons.arrow_upward),
                  ),
                  IconButton(
                    tooltip: 'Mover sul',
                    onPressed: () => pan(0, -50),
                    icon: const Icon(Icons.arrow_downward),
                  ),
                ],
              ),
              DropdownButtonFormField<String>(
                initialValue: route,
                decoration: const InputDecoration(labelText: 'Rota / Route'),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('Nenhuma / None'),
                  ),
                  ...(data!['routes'] as List).map(
                    (r) => DropdownMenuItem(
                      value: r['id'] as String,
                      child: Text(
                        r['title'] as String,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
                isExpanded: true,
                onChanged: (v) => setState(() => route = v),
              ),
            ],
          ),
        ),
        Expanded(
          child: InteractiveViewer(
            transformationController: transform,
            minScale: .6,
            maxScale: 8,
            constrained: false,
            child: CustomPaint(
              size: const Size(1200, 680),
              painter: MapPainter(
                land,
                data!['locations'] as List,
                data!['routes'] as List,
                modern,
                route,
                widget.focus,
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Geografia atual de referência. Linhas de rota são sequências reconstruídas, não estradas medidas. Fronteiras antigas não são inferidas da costa moderna.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (route != null)
                ...(data!['routes'] as List)
                    .where((r) => r['id'] == route)
                    .map((r) => Text('${r['source']} · ${r['certainty']}')),
              const SizedBox(height: 12),
              TextField(
                decoration: InputDecoration(labelText: a.t('search')),
                onChanged: (v) => setState(() => filter = v),
              ),
              ...locations.map(
                (l) => ListTile(
                  title: Text('${l['ancient']} / ${l['modern']}'),
                  subtitle: Text(
                    '${l['lat']}, ${l['lon']} · ${l['uncertainty']}',
                  ),
                  onTap: () => sheet(
                    context,
                    l['ancient'] as String,
                    ListView(
                      padding: const EdgeInsets.all(22),
                      children: [
                        SelectableText('${l['source']}\n${l['uncertainty']}'),
                        action(
                          a.t('note'),
                          Icons.edit_note,
                          () => openNewNote(
                            context,
                            title: l['ancient'] as String,
                            reference: 'place:${l['id']}',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class MapPainter extends CustomPainter {
  final List<dynamic> land, locations, routes;
  final bool modern;
  final String? route, focus;
  MapPainter(
    this.land,
    this.locations,
    this.routes,
    this.modern,
    this.route,
    this.focus,
  );
  Offset project(num lon, num lat, Size size) => Offset(
    (lon.toDouble() + 20) / 100 * size.width,
    (65 - lat.toDouble()) / 55 * size.height,
  );
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xffd8e5e7),
    );
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    for (final polygon in land) {
      final path = Path();
      for (var i = 0; i < (polygon as List).length; i++) {
        final point = project(polygon[i][0] as num, polygon[i][1] as num, size);
        i == 0
            ? path.moveTo(point.dx, point.dy)
            : path.lineTo(point.dx, point.dy);
      }
      path.close();
      canvas.drawPath(path, Paint()..color = const Color(0xffded4b8));
      canvas.drawPath(
        path,
        Paint()
          ..color = const Color(0xff9fa58c)
          ..style = PaintingStyle.stroke
          ..strokeWidth = .7,
      );
    }
    for (final r in routes.where((r) => r['id'] == route)) {
      final path = Path();
      var i = 0;
      for (final id in r['places']) {
        final l = locations.where((l) => l['id'] == id).firstOrNull;
        if (l == null) continue;
        final p = project(l['lon'] as num, l['lat'] as num, size);
        i++ == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = const Color(0xffa85942)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3,
      );
    }
    for (final l in locations) {
      final p = project(l['lon'] as num, l['lat'] as num, size);
      canvas.drawCircle(
        p,
        l['id'] == focus ? 7 : 4,
        Paint()
          ..color = l['id'] == focus
              ? const Color(0xffc54131)
              : const Color(0xff304b3b),
      );
      final text = TextPainter(
        text: TextSpan(
          text: (modern ? l['modern'] : l['ancient']) as String,
          style: const TextStyle(
            color: Color(0xff23342c),
            fontSize: 11,
            backgroundColor: Color(0xbbedebdd),
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, p + const Offset(5, -15));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(MapPainter old) => true;
}

class ModelsPage extends StatefulWidget {
  final Reference? reference;
  const ModelsPage({super.key, this.reference});
  @override
  State<ModelsPage> createState() => _ModelsPageState();
}

class _ModelsPageState extends State<ModelsPage> {
  List<Map<String, dynamic>>? models;
  List<Map<String, dynamic>> scenes = [];
  Map<String, dynamic>? block;
  String query = '', category = '';
  bool all = false;
  String? error;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (models != null) return;
    load();
  }

  Future<void> load() async {
    try {
      final loaded = await loadModels(context.app.store);
      final associations = await loadModelScenes();
      if (!mounted) return;
      setState(() {
        models = loaded;
        scenes = associations;
        block = widget.reference == null
            ? null
            : modelBlockAt(scenes, widget.reference!);
      });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    if (error != null) return Center(child: Text(error!));
    if (models == null) return const Center(child: CircularProgressIndicator());
    final items = block?['items'] as List? ?? [];
    final contextual = block != null && !all;
    final visible = models!
        .where(
          (m) =>
              (!contextual || items.any((i) => i['model_id'] == m['id'])) &&
              (category.isEmpty || m['category'] == category) &&
              (query.isEmpty ||
                  fold(
                    '${m['title']} ${m['description']}',
                  ).contains(fold(query))),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${models!.length} modelos · ${scenes.length} blocos · 66 livros',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (block != null) ...[
                Text(
                  '${bookNames(a.language)[(block!['book'] as int) - 1]} ${block!['start_chapter']}–${block!['end_chapter']}',
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: Text(
                        a.language == 'en'
                            ? 'This passage'
                            : a.language == 'es'
                            ? 'Este pasaje'
                            : 'Neste trecho',
                      ),
                      selected: !all,
                      onSelected: (_) => setState(() {
                        all = false;
                        category = '';
                        query = '';
                      }),
                    ),
                    ChoiceChip(
                      label: Text(a.t('all')),
                      selected: all,
                      onSelected: (_) => setState(() => all = true),
                    ),
                  ],
                ),
              ],
              if (!contextual) ...[
                TextField(
                  onChanged: (v) => setState(() => query = v),
                  decoration: InputDecoration(
                    labelText: a.t('search'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                ),
                DropdownButton<String>(
                  isExpanded: true,
                  value: category,
                  items: [
                    DropdownMenuItem(value: '', child: Text(a.t('all'))),
                    ...models!
                        .map(
                          (m) =>
                              (m['category'] ?? 'Módulo importado') as String,
                        )
                        .toSet()
                        .map((c) => DropdownMenuItem(value: c, child: Text(c))),
                  ],
                  onChanged: (v) => setState(() => category = v ?? ''),
                ),
              ],
              const Text(
                'Reconstruções com materiais e iluminação PBR. O nível de detalhe varia por modelo. Objetos do relato, contexto cultural, metáforas e visões são identificados separadamente.',
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            itemCount: visible.length,
            itemBuilder: (ctx, index) {
              final m = visible[index];
              final association = contextual
                  ? items.firstWhere((i) => i['model_id'] == m['id']) as Map
                  : null;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if ([
                        'arca_noe',
                        'arca_alianca',
                        'tabernaculo',
                        'templo_salomao',
                        'habitacao',
                        'harpa',
                      ].contains(m['id']))
                        InkWell(
                          onTap: () => sheet(
                            context,
                            m['title'] as String,
                            ModelPage(m),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.asset(
                              'assets/3d/previews/${m['id']}.jpg',
                              height: 170,
                              fit: BoxFit.cover,
                              semanticLabel: 'Abrir modelo 3D: ${m['title']}',
                              errorBuilder: (_, _, _) => const SizedBox(),
                            ),
                          ),
                        ),
                      ListTile(
                        leading: const Icon(Icons.view_in_ar),
                        title: Text(m['title'] as String),
                        subtitle: Text(
                          m['category'] as String? ?? 'Módulo importado',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () =>
                            sheet(context, m['title'] as String, ModelPage(m)),
                      ),
                      if (association != null) ...[
                        Wrap(
                          spacing: 8,
                          children: [
                            Chip(label: Text(association['genre'] as String)),
                            action(
                              Reference.fromId(
                                association['reference'] as String,
                              )!.label(a.language),
                              Icons.menu_book,
                              () => showPassage(
                                context,
                                Reference.fromId(
                                  association['reference'] as String,
                                )!,
                                sourceEdition: 'BLN4',
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.all(8),
                          child: Text(association['explanation'] as String),
                        ),
                      ] else
                        Padding(
                          padding: const EdgeInsets.all(8),
                          child: Text(m['description'] as String),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class ModelPage extends StatefulWidget {
  final Map<String, dynamic> model;
  const ModelPage(this.model, {super.key});
  @override
  State<ModelPage> createState() => _ModelPageState();
}

class _ModelPageState extends State<ModelPage> {
  WebViewController? web;
  Set<String> hidden = {};
  bool text = false, spin = false, cool = false;
  String selected = '';
  @override
  void initState() {
    super.initState();
    if (Platform.isAndroid || Platform.isIOS) {
      try {
        web = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(const Color(0xff1c2430))
          ..addJavaScriptChannel(
            'Status',
            onMessageReceived: (m) {
              if (mounted && m.message != 'ready') {
                setState(() => selected = m.message);
              }
            },
          )
          ..setNavigationDelegate(
            NavigationDelegate(
              onNavigationRequest: (r) =>
                  r.url.startsWith('file:') || r.url.startsWith('about:')
                  ? NavigationDecision.navigate
                  : NavigationDecision.prevent,
              onPageFinished: (_) async {
                try {
                  final List<int> bytes;
                  if (widget.model['local_file'] is String) {
                    bytes = await File(widget.model['local_file'] as String)
                        .readAsBytes();
                  } else {
                    final data = await rootBundle.load(
                      'assets/3d/${widget.model['file']}',
                    );
                    bytes = data.buffer.asUint8List(
                      data.offsetInBytes,
                      data.lengthInBytes,
                    );
                  }
                  if (!mounted) return;
                  // Enviar em blocos: alguns WebViews rejeitam um comando JS
                  // único contendo vários MB de GLB codificado em base64.
                  final encoded = base64Encode(bytes);
                  await web!.runJavaScript('window.__modelBase64 = "";');
                  const chunkSize = 128 * 1024;
                  for (var i = 0; i < encoded.length; i += chunkSize) {
                    if (!mounted) return;
                    final end = i + chunkSize > encoded.length
                        ? encoded.length
                        : i + chunkSize;
                    await web!.runJavaScript(
                      'window.__modelBase64 += ${jsonEncode(encoded.substring(i, end))};',
                    );
                  }
                  if (!mounted) return;
                  final reduceMotion = context.app.store.pref('reduced_motion', false);
                  await web!.runJavaScript(
                    'reduceMotion($reduceMotion);setup(window.__modelBase64);window.__modelBase64=null;',
                  );
                } catch (e) {
                  if (mounted) {
                    setState(() => selected = 'Erro ao carregar arquivo 3D: $e');
                  }
                }
              },
            ),
          )
          ..loadFlutterAsset('assets/3d/viewer_immersive.html');
      } catch (e) {
        selected = '$e';
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app, m = widget.model;
    return Column(
      children: [
        Wrap(
          spacing: 4,
          children: [
            action(
              a.t('reset'),
              Icons.restart_alt,
              () => web?.runJavaScript('reset()'),
            ),
            action(
              '${a.t('rotate')} ←',
              Icons.rotate_left,
              () => web?.runJavaScript('rotate(-15)'),
            ),
            action(
              '${a.t('rotate')} →',
              Icons.rotate_right,
              () => web?.runJavaScript('rotate(15)'),
            ),
            action(
              a.t('zoomIn'),
              Icons.add,
              () => web?.runJavaScript('zoom(.8)'),
            ),
            action(
              a.t('zoomOut'),
              Icons.remove,
              () => web?.runJavaScript('zoom(1.25)'),
            ),
            action(
              'Vista superior',
              Icons.vertical_align_top,
              () => web?.runJavaScript('viewpoint("top")'),
            ),
            action(
              'Vista frontal',
              Icons.crop_portrait,
              () => web?.runJavaScript('viewpoint("front")'),
            ),
            FilterChip(
              label: const Text('Giro automático'),
              selected: spin,
              onSelected: a.store.pref('reduced_motion', false)
                  ? null
                  : (v) {
                      setState(() => spin = v);
                      web?.runJavaScript('turntable($v)');
                    },
            ),
            FilterChip(
              label: const Text('Luz neutra'),
              selected: cool,
              onSelected: (v) {
                setState(() => cool = v);
                web?.runJavaScript(
                  'atmosphere(${jsonEncode(v ? 'cool' : 'warm')})',
                );
              },
            ),
            FilterChip(
              label: Text(a.t('textAlternative')),
              selected: text,
              onSelected: (v) => setState(() => text = v),
            ),
          ],
        ),
        if (!text && web != null)
          Expanded(flex: 7, child: WebViewWidget(controller: web!)),
        Expanded(
          flex: 2,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (selected.isNotEmpty) Text(selected),
              SelectableText(m['description'] as String),
              const SizedBox(height: 12),
              Text(m['certainty'] as String),
              Text('${m['author']} · ${m['license']}'),
              if (m['source'] != null) SelectableText('${m['source']}'),
              if (text && m['parts'] is List) ...[
                const SizedBox(height: 12),
                Text((m['parts'] as List).toSet().join(' · ')),
              ],
              Wrap(
                spacing: 8,
                children: (m['references'] as List).map((r) {
                  final ref = Reference.fromId(r as String)!;
                  return action(
                    ref.label(a.language),
                    Icons.menu_book,
                    () => showPassage(
                      context,
                      ref,
                      sourceEdition: widget.model['local_file'] == null
                          ? 'BLN4'
                          : null,
                    ),
                  );
                }).toList(),
              ),
              ...(m['layers'] as List).map(
                (l) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l as String),
                  value: !hidden.contains(l),
                  onChanged: (v) {
                    setState(() {
                      v == true ? hidden.remove(l) : hidden.add(l);
                    });
                    web?.runJavaScript('layer(${jsonEncode(l)},${v == true})');
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

const measures = [
  (
    'cubit',
    'Côvado',
    .45,
    .52,
    'm',
    'Comprimento do antebraço; padrões comuns e reais diferiam. Êxodo 25:10; Ezequiel 40:5.',
  ),
  (
    'shekel',
    'Siclo',
    11.0,
    11.5,
    'g',
    'Intervalo de referência do padrão hebraico; lugar, época e objeto pesável importam.',
  ),
  (
    'talent',
    'Talento',
    30000.0,
    35000.0,
    'g',
    'Ordem de grandeza de padrões próximos orientais; não há massa universal para todo talento.',
  ),
  (
    'ephah',
    'Efa',
    20.0,
    25.0,
    'L',
    'Estimativa de capacidade seca; padrões e reconstruções diferem.',
  ),
  (
    'bath',
    'Bato',
    20.0,
    25.0,
    'L',
    'Capacidade líquida; Ezequiel 45:11 relaciona bato e efa.',
  ),
  (
    'homer',
    'Hômer',
    200.0,
    250.0,
    'L',
    'Dez efas, dentro do modelo de referência.',
  ),
  (
    'hin',
    'Him',
    3.3,
    4.2,
    'L',
    'Estimativa comum; não substituir medições arqueológicas específicas.',
  ),
  (
    'stade',
    'Estádio',
    180.0,
    192.0,
    'm',
    'Padrões gregos e romanos variavam. Lucas 24:13.',
  ),
  (
    'denarius',
    'Denário',
    3.0,
    4.0,
    'g de prata',
    'Massa aproximada de exemplares do início do Império; teor e massa mudaram. Mateus 20:2 apresenta um pagamento de trabalho em uma parábola. Não há câmbio universal para reais.',
  ),
];

class UnitsPage extends StatefulWidget {
  const UnitsPage({super.key});
  @override
  State<UnitsPage> createState() => _UnitsPageState();
}

class _UnitsPageState extends State<UnitsPage> {
  String id = 'cubit';
  final value = TextEditingController(text: '1');
  @override
  void dispose() {
    value.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        m = measures.firstWhere((m) => m.$1 == id),
        n = double.tryParse(value.text.replaceAll(',', '.'));
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        DropdownButtonFormField<String>(
          initialValue: id,
          decoration: InputDecoration(labelText: a.t('units')),
          items: measures
              .map((m) => DropdownMenuItem(value: m.$1, child: Text(m.$2)))
              .toList(),
          onChanged: (v) => setState(() => id = v!),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: value,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Quantidade / Quantity'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 24),
        SelectableText(
          n == null || n < 0
              ? 'Informe uma quantidade válida.'
              : '≈ ${(n * m.$3).toStringAsFixed(2)}–${(n * m.$4).toStringAsFixed(2)} ${m.$5}',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 20),
        Text(m.$6),
        const SizedBox(height: 16),
        const Text(
          'Modelo de conversão por intervalo. Valores são referências aproximadas e não representam todos os padrões de todas as épocas. Para pesquisa acadêmica, consulte o padrão metrológico do período e a fonte do objeto.',
        ),
        sourceLinks(context, [
          'Êxodo 25:10; Ezequiel 40:5; 45:10–14; Lucas 24:13; Mateus 20:2',
        ]),
      ],
    );
  }
}

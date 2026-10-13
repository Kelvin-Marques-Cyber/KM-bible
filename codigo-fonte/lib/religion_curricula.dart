import 'package:flutter/material.dart';
import 'app.dart';
import 'domain.dart';
import 'common.dart';
import 'studies.dart' show StudyPage, traditionTitles;

const religionFamilies = {
  'Cristianismo': [
    'presbyterian',
    'roman_catholic',
    'eastern_orthodox',
    'lutheran',
    'anglican',
    'baptist',
    'methodist',
    'pentecostal',
    'seventh_day_adventist',
    'jehovahs_witnesses',
    'latter_day_saints',
  ],
  'Judaísmo, islã e Bahá’í': ['judaism', 'islam', 'shia_islam', 'bahai'],
  'Tradições da Índia': [
    'hinduism_vedanta',
    'buddhism_theravada',
    'buddhism_mahayana',
    'sikhism',
    'jainism',
  ],
  'Leste da Ásia e tradição iraniana': [
    'shinto',
    'daoism',
    'confucianism',
    'zoroastrianism',
  ],
  'Brasil e tradições locais': [
    'spiritism',
    'umbanda',
    'candomble',
    'indigenous_traditions',
  ],
  'Cosmovisões não religiosas': ['atheism', 'secular_humanism'],
};

class ReligionCurriculaPage extends StatefulWidget {
  final bool apologetic;
  const ReligionCurriculaPage({super.key, this.apologetic = false});
  @override
  State<ReligionCurriculaPage> createState() => _ReligionCurriculaPageState();
}

class _ReligionCurriculaPageState extends State<ReligionCurriculaPage> {
  String family = '', filter = '';
  @override
  Widget build(BuildContext context) {
    final store = context.app.store, all = store.studies();
    final available = all.map((s) => s['target']).toSet();
    final targets = traditionTitles.entries
        .where(
          (t) =>
              available.contains(t.key) &&
              (family.isEmpty || religionFamilies[family]!.contains(t.key)) &&
              (filter.isEmpty || fold(t.value).contains(fold(filter))),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Religiões e cosmovisões',
                style: TextStyle(fontSize: 23),
              ),
              const Text(
                'Introdução, textos, realidade última, ser humano, salvação, culto, ética e vida futura. As fontes e a cobertura de cada tradição ficam identificadas.',
              ),
              DropdownButtonFormField<String>(
                initialValue: family,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Categoria'),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Todas as categorias'),
                  ),
                  ...religionFamilies.keys.map(
                    (f) => DropdownMenuItem(value: f, child: Text(f)),
                  ),
                ],
                onChanged: (v) => setState(() => family = v ?? ''),
              ),
              const SizedBox(height: 8),
              TextField(
                decoration: const InputDecoration(
                  labelText: 'Procurar religião ou tradição',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => filter = v),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: targets.length,
            itemBuilder: (ctx, i) {
              final t = targets[i],
                  lessons = all.where((s) => s['target'] == t.key).toList();
              return Card(
                child: ListTile(
                  leading: const Icon(Icons.public),
                  title: Text(t.value),
                  subtitle: Text(
                    '${lessons.length} estudos instalados · fontes e comparação',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => sheet(
                    context,
                    t.value,
                    ReligionCoursePage(t.key, apologetic: widget.apologetic),
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

class ReligionCoursePage extends StatelessWidget {
  final String target;
  final bool apologetic;
  const ReligionCoursePage(this.target, {super.key, this.apologetic = false});
  @override
  Widget build(BuildContext context) {
    final store = context.app.store, rows = store.studies(target: target);
    const order = [
      'origins',
      'sacred_texts',
      'ultimate_reality',
      'human_condition',
      'salvation',
      'worship',
      'morality',
      'afterlife',
    ];
    rows.sort((a, b) {
      final x = order.indexOf(a['topic'] as String),
          y = order.indexOf(b['topic'] as String);
      return (x < 0 ? 100 : x).compareTo(y < 0 ? 100 : y);
    });
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Text(
          traditionTitles[target] ?? target,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const Text(
          'Acervo progressivo: cada assunto oferece exposição, referências, resposta reformada e exame de objeções. A cobertura é limitada aos estudos registrados, com revisão especializada pendente.',
        ),
        const SizedBox(height: 14),
        for (final row in rows)
          ListTile(
            leading: Icon(
              store.isCompleted(row['id'] as String)
                  ? Icons.check_circle_outline
                  : Icons.menu_book,
            ),
            title: Text(row['title'] as String),
            subtitle: Text('Nível ${row['level']} · exposição e apologética'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => sheet(
              context,
              row['title'] as String,
              StudyPage(row, apologetic: apologetic),
            ),
          ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'store.dart';

String morphology(String raw) {
  if (raw.startsWith('H') || raw.startsWith('A')) {
    final language = raw.startsWith('A') ? 'Aramaico' : 'Hebraico';
    const parts = {
      'N': 'substantivo',
      'V': 'verbo',
      'A': 'adjetivo',
      'P': 'pronome',
      'R': 'preposição',
      'C': 'conjunção',
      'D': 'advérbio',
      'T': 'partícula',
      'S': 'sufixo',
    };
    final decoded = raw
        .substring(1)
        .split('/')
        .map((s) => s.isEmpty ? '' : parts[s[0]] ?? s)
        .join(' + ');
    return '$language · $decoded · código OSHB: $raw';
  }
  final fields = raw.split('-');
  const parts = {
    'N': 'substantivo',
    'V': 'verbo',
    'A': 'adjetivo',
    'D': 'advérbio',
    'P': 'pronome pessoal',
    'R': 'pronome relativo',
    'T': 'artigo',
    'PREP': 'preposição',
    'CONJ': 'conjunção',
    'ADV': 'advérbio',
  };
  final decoded = <String>[parts[fields.first] ?? fields.first];
  if (fields.first == 'V' && fields.length > 1) {
    final code = fields[1].replaceFirst('2', '');
    const tense = {
      'P': 'presente',
      'I': 'imperfeito',
      'F': 'futuro',
      'A': 'aoristo',
      'R': 'perfeito',
      'L': 'mais-que-perfeito',
    };
    const voice = {
      'A': 'ativa',
      'M': 'média',
      'P': 'passiva',
      'E': 'média/passiva',
      'D': 'média deponente',
      'O': 'passiva deponente',
      'N': 'média/passiva deponente',
    };
    const mood = {
      'I': 'indicativo',
      'S': 'subjuntivo',
      'O': 'optativo',
      'M': 'imperativo',
      'N': 'infinitivo',
      'P': 'particípio',
    };
    if (code.length >= 3) {
      decoded.addAll([
        tense[code[0]] ?? code[0],
        voice[code[1]] ?? code[1],
        mood[code[2]] ?? code[2],
      ]);
    }
    if (fields.length > 2) {
      final code = fields[2];
      if (RegExp(r'^[123][SP]$').hasMatch(code)) {
        decoded.add(
          '${code[0]}ª pessoa, ${code[1] == 'S' ? 'singular' : 'plural'}',
        );
      } else {
        decoded.add('Flexão: $code');
      }
    }
  } else if (fields.length > 1) {
    const cases = {
      'N': 'nominativo',
      'G': 'genitivo',
      'D': 'dativo',
      'A': 'acusativo',
      'V': 'vocativo',
    };
    const number = {'S': 'singular', 'P': 'plural'},
        gender = {'M': 'masculino', 'F': 'feminino', 'N': 'neutro'};
    final code = fields[1];
    if (code.length >= 3) {
      decoded.addAll([
        cases[code[0]] ?? code[0],
        number[code[1]] ?? code[1],
        gender[code[2]] ?? code[2],
      ]);
    } else {
      decoded.add(code);
    }
  }
  return '${decoded.join(' · ')}\nCódigo Robinson: $raw';
}

class OriginalPage extends StatelessWidget {
  final Reference reference;
  const OriginalPage(this.reference, {super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        words = a.store.wordsAt(reference, sourceTranslation: a.translation);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          a.t('addressWarning'),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Text(
          a.t('lexicalWarning'),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 18),
        Text(
          reference.label(a.language),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (words.isEmpty) Text(a.t('noContent')),
        ...words.map(
          (w) => Card(
            child: ListTile(
              title: Text(
                w['surface'] as String,
                textDirection: reference.book < 40
                    ? TextDirection.rtl
                    : TextDirection.ltr,
                style: const TextStyle(fontSize: 25),
              ),
              subtitle: Text(
                '${w['edition']} ${Reference.fromId(w['reference'] as String)!.label(a.language)} · ${w['lexeme']} · ${w['transliteration'] ?? ''}\n${a.store.translatedEntry('lexeme', w['lexeme'] as String)?['gloss'] ?? w['gloss'] ?? ''}\n${morphology(w['morphology'] as String)}',
              ),
              onTap: () => sheet(
                context,
                '${w['lexeme']} · ${w['lemma'] ?? ''}',
                LexemePage(w['lexeme'] as String),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'OSHB: WLC, AT hebraico/aramaico. TIS: Tischendorf 8, NT grego. Glosas em português para estudo; definições históricas originais disponíveis para conferência. Estes corpora podem diferir textualmente e na numeração da edição em leitura.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class LexemePage extends StatelessWidget {
  final String id;
  const LexemePage(this.id, {super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        l = a.store.query(a.store.lexical, 'SELECT * FROM lexemes WHERE id=?', [
          a.store.strongId(id),
        ]).firstOrNull;
    if (l == null) return Center(child: Text(a.t('noContent')));
    final occurrences = a.store.occurrences(id);
    final pt = a.store.translatedEntry('lexeme', l['id'] as String);
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(
          '${l['id']} · ${l['lemma']}',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        Text('${l['transliteration']} · ${l['language']}'),
        const SizedBox(height: 20),
        Text(a.t('gloss'), style: Theme.of(context).textTheme.titleMedium),
        SelectableText(pt?['gloss'] as String? ?? l['gloss'] as String),
        const SizedBox(height: 16),
        SelectableText(pt?['body'] as String? ?? l['definition'] as String),
        if (pt != null) ...[
          Text(
            pt['status'] as String,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          ExpansionTile(
            title: const Text('Definição histórica original em inglês'),
            children: [SelectableText('${l['gloss']}\n\n${l['definition']}')],
          ),
        ],
        const SizedBox(height: 16),
        Text(a.t('lexicalWarning')),
        Text(
          '${a.t('frequency')}: ${a.store.frequency(id)}\n${l['source']}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const Divider(),
        Text('${a.t('occurrences')} (até 200)'),
        ...occurrences.map(
          (o) => ListTile(
            title: Text(
              '${o['edition']} · ${Reference.fromId(o['reference'] as String)!.label(a.language)}',
            ),
            subtitle: Text(
              '${o['surface']} · ${morphology(o['morphology'] as String)}',
            ),
            onTap: () => showPassage(
              context,
              Reference.fromId(o['reference'] as String)!,
            ),
          ),
        ),
      ],
    );
  }
}

class LinguisticSearchPage extends StatefulWidget {
  const LinguisticSearchPage({super.key});
  @override
  State<LinguisticSearchPage> createState() => _LinguisticSearchPageState();
}

class _LinguisticSearchPageState extends State<LinguisticSearchPage> {
  final field = TextEditingController();
  String mode = 'lemma';
  List<RecordRow> rows = [];
  @override
  void dispose() {
    field.dispose();
    super.dispose();
  }

  void run() {
    final a = context.app, s = field.text.trim();
    if (s.isEmpty) return;
    final columns = {
      'lemma': 'l.lemma',
      'surface': 'w.surface',
      'morphology': 'w.morphology',
      'Strong': 'w.lexeme',
    };
    if (mode == 'Strong') {
      rows = a.store.occurrences(a.store.strongId(s));
    } else {
      rows = a.store.query(
        a.store.lexical,
        'SELECT DISTINCT w.reference,w.surface,w.morphology,w.edition,w.lexeme FROM words w LEFT JOIN lexemes l ON l.id=w.lexeme WHERE ${columns[mode]} LIKE ? LIMIT 200',
        ['%$s%'],
      );
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Text(a.t('lexicalWarning')),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: mode,
                items: ['lemma', 'surface', 'morphology', 'Strong']
                    .map((m) => DropdownMenuItem(value: m, child: Text(a.t(m))))
                    .toList(),
                onChanged: (v) => setState(() => mode = v!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: field,
                onSubmitted: (_) => run(),
                decoration: InputDecoration(
                  labelText: a.t('search'),
                  suffixIcon: IconButton(
                    tooltip: a.t('search'),
                    onPressed: run,
                    icon: const Icon(Icons.search),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            children: rows
                .map(
                  (r) => ListTile(
                    title: Text('${r['surface']} · ${r['edition']}'),
                    subtitle: Text(
                      '${Reference.fromId(r['reference'] as String)!.label(a.language)} · ${r['morphology']}',
                    ),
                    onTap: () => showPassage(
                      context,
                      Reference.fromId(r['reference'] as String)!,
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}

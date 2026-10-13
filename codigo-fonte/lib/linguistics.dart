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

class OriginalPage extends StatefulWidget {
  final Reference reference;
  const OriginalPage(this.reference, {super.key});
  @override
  State<OriginalPage> createState() => _OriginalPageState();
}

class _OriginalPageState extends State<OriginalPage> {
  bool compact = true;
  int? selected;
  String gloss(RecordRow word) {
    final id = context.app.store.strongId(word['lexeme'] as String? ?? '');
    final translated = context.app.store.translatedEntry('lexeme', id);
    if (translated != null &&
        (translated['gloss'] as String).trim().isNotEmpty) {
      return translated['gloss'] as String;
    }
    return id.isEmpty
        ? 'Partícula ou sufixo · consulte a análise'
        : 'Glosa em português indisponível';
  }

  Widget detail(RecordRow word) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${word['surface']} · ${word['transliteration'] ?? ''}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(gloss(word)),
          const SizedBox(height: 8),
          Text(
            'Lema: ${word['lemma'] ?? 'não identificado'} · ${word['lexeme']}',
          ),
          Text(morphology(word['morphology'] as String)),
          if ((word['lexeme'] as String? ?? '').isNotEmpty)
            action(
              'Abrir dicionário e ocorrências',
              Icons.menu_book,
              () => sheet(
                context,
                'Dicionário do original',
                LexemePage(word['lexeme'] as String),
              ),
            ),
        ],
      ),
    ),
  );
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        r = widget.reference,
        words = a.store.wordsAt(r, sourceTranslation: a.translation);
    final edition =
        words.firstOrNull?['edition'] ?? (r.book < 40 ? 'WLC/OSHB' : 'TIS');
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Text(
          r.label(a.language),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        Text(
          '$edition · original com glosas em português',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              label: const Text('Interlinear'),
              selected: compact,
              onSelected: (_) => setState(() => compact = true),
            ),
            ChoiceChip(
              label: const Text('Análise palavra por palavra'),
              selected: !compact,
              onSelected: (_) => setState(() => compact = false),
            ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Text(
            'Toque em uma palavra para ver lema, morfologia e outras ocorrências. As glosas auxiliam o estudo; não formam uma tradução corrida nem um alinhamento automático com a RA.',
          ),
        ),
        if (words.isEmpty) Text(a.t('noContent')),
        if (compact)
          Wrap(
            spacing: 6,
            runSpacing: 8,
            textDirection: r.book < 40 ? TextDirection.rtl : TextDirection.ltr,
            children: [
              for (var i = 0; i < words.length; i++)
                SizedBox(
                  width: 146,
                  child: Semantics(
                    button: true,
                    label: '${words[i]['surface']}, ${gloss(words[i])}',
                    child: Card(
                      color: selected == i
                          ? Theme.of(context).colorScheme.secondaryContainer
                          : null,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () =>
                            setState(() => selected = selected == i ? null : i),
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            children: [
                              Text(
                                words[i]['surface'] as String,
                                textDirection: r.book < 40
                                    ? TextDirection.rtl
                                    : TextDirection.ltr,
                                style: const TextStyle(fontSize: 25),
                              ),
                              Text(
                                words[i]['transliteration'] as String? ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const Divider(height: 14),
                              Text(
                                gloss(words[i]),
                                textAlign: TextAlign.center,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                words[i]['lexeme'] as String? ?? '',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        if (compact && selected != null && selected! < words.length)
          detail(words[selected!]),
        if (!compact) ...words.map(detail),
        const SizedBox(height: 16),
        Text(
          a.t('lexicalWarning'),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Text(
          a.t('addressWarning'),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const Text(
          'AT: WLC e morfologia OSHB. NT: Tischendorf 8 e códigos Robinson/Strong. Textos de origem preservados; glosas de estudo em português com revisão especializada pendente.',
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

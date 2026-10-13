import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'store.dart';
import 'notifications.dart';

const cardModes = [
  'reference_to_text',
  'text_to_reference',
  'cloze',
  'recitation',
  'theme_card',
];
Future<void> createCard(
  BuildContext context,
  Reference reference,
  String text,
) async {
  final a = context.app, topic = TextEditingController();
  var mode = cardModes.first;
  await sheet(
    context,
    a.t('addCard'),
    StatefulBuilder(
      builder: (ctx, set) => ListView(
        padding: const EdgeInsets.all(22),
        children: [
          Text(
            reference.label(a.language),
            style: Theme.of(ctx).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          SelectableText(text),
          const SizedBox(height: 20),
          DropdownButtonFormField<String>(
            initialValue: mode,
            decoration: InputDecoration(labelText: a.t('cardMode')),
            items: cardModes
                .map((v) => DropdownMenuItem(value: v, child: Text(a.t(v))))
                .toList(),
            onChanged: (v) => set(() => mode = v!),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: topic,
            decoration: InputDecoration(labelText: a.t('topic')),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              a.store.addCard(
                a.translation,
                reference,
                text,
                mode: mode,
                topic: topic.text,
              );
              a.refresh();
              Navigator.pop(ctx);
              message(context, a.t('success'));
            },
            child: Text(a.t('save')),
          ),
        ],
      ),
    ),
  );
  topic.dispose();
}

class MemoryPage extends StatefulWidget {
  const MemoryPage({super.key});
  @override
  State<MemoryPage> createState() => _MemoryPageState();
}

class _MemoryPageState extends State<MemoryPage> {
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        cards = a.store.cards(),
        due = a.store.cards(dueOnly: true);
    final counts = a.store.personal
        .select(
          'SELECT COUNT(*) AS n,SUM(CASE WHEN grade>=3 THEN 1 ELSE 0 END) AS correct FROM review_history',
        )
        .first;
    final consolidated = cards
        .where((c) => (c['interval'] as int) >= 30)
        .length;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          '${a.t('pendingCards')}: ${due.length}',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: due.isEmpty
              ? null
              : () => sheet(context, a.t('review'), ReviewPage(due)).then((_) {
                  if (mounted) setState(() {});
                }),
          icon: const Icon(Icons.psychology),
          label: Text(a.t('review')),
        ),
        const SizedBox(height: 18),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Text(
              '${a.t('stats')}\n${cards.length} cartões · ${counts['n']} revisões\n${counts['n'] == 0 ? 0 : ((counts['correct'] as num) * 100 / (counts['n'] as int)).round()}% lembrados · $consolidated com intervalo ≥ 30 dias',
            ),
          ),
        ),
        ListTile(
          title: Text(a.t('reminder')),
          subtitle: Text(
            a.store.pref('reminder_enabled', false)
                ? a.store.pref('reminder_time', '19:00')
                : 'Desativado / Disabled',
          ),
          trailing: Switch(
            value: a.store.pref('reminder_enabled', false),
            onChanged: (v) async {
              try {
                if (v) {
                  final time = await showTimePicker(
                    context: context,
                    initialTime: const TimeOfDay(hour: 19, minute: 0),
                  );
                  if (time == null) return;
                  final granted = await Reminders.enable(
                    time.hour,
                    time.minute,
                    a.t('review'),
                    a.t('pendingCards'),
                  );
                  if (!granted) {
                    if (context.mounted) {
                      message(
                        context,
                        'Permissão de notificações não concedida.',
                      );
                    }
                    return;
                  }
                  a.set(
                    'reminder_time',
                    '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
                  );
                } else {
                  await Reminders.disable();
                }
                a.set('reminder_enabled', v);
              } catch (e) {
                if (context.mounted) message(context, e.toString());
              }
            },
          ),
        ),
        ...cards.map(
          (c) => Card(
            child: ListTile(
              title: Text(
                '${Reference.fromId(c['reference'] as String)!.label(a.language)} · ${c['translation']}',
              ),
              subtitle: Text(
                '${a.t(c['mode'] as String)} · ${c['topic']}\n${c['text']}',
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => sheet(context, a.t('review'), ReviewPage([c])),
              trailing: IconButton(
                tooltip: a.t('delete'),
                onPressed: () {
                  a.store.personal.execute(
                    'DELETE FROM flashcards WHERE id=?',
                    [c['id']],
                  );
                  a.refresh();
                },
                icon: const Icon(Icons.delete_outline),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class ReviewPage extends StatefulWidget {
  final List<RecordRow> cards;
  const ReviewPage(this.cards, {super.key});
  @override
  State<ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<ReviewPage> {
  int index = 0;
  bool revealed = false;
  final answer = TextEditingController();
  @override
  void dispose() {
    answer.dispose();
    super.dispose();
  }

  void grade(int value) {
    context.app.store.review(widget.cards[index], value);
    context.app.refresh();
    setState(() {
      index++;
      revealed = false;
      answer.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    if (index >= widget.cards.length) {
      return Center(
        child: Text(
          a.t('success'),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
      );
    }
    final card = widget.cards[index],
        r = Reference.fromId(card['reference'] as String)!,
        mode = card['mode'] as String,
        text = card['text'] as String;
    String prompt;
    switch (mode) {
      case 'text_to_reference':
        prompt = text;
      case 'cloze':
        var i = 0;
        prompt = text
            .split(' ')
            .map((w) => ++i % 4 == 0 ? '_____' : w)
            .join(' ');
      case 'recitation':
        prompt = '${r.label(a.language)}\n${a.t('recitation')}';
      case 'theme_card':
        prompt = card['topic'] as String;
      default:
        prompt = r.label(a.language);
    }
    return ListView(
      padding: const EdgeInsets.all(26),
      children: [
        LinearProgressIndicator(value: index / widget.cards.length),
        const SizedBox(height: 24),
        Text('${index + 1} / ${widget.cards.length} · ${a.t(mode)}'),
        const SizedBox(height: 24),
        SelectableText(
          prompt,
          style: TextStyle(
            fontFamily: 'EBGaramond',
            fontSize: a.fontSize + 3,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 24),
        if (!revealed) ...[
          TextField(
            controller: answer,
            minLines: 3,
            maxLines: 6,
            decoration: InputDecoration(labelText: a.t('response')),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => setState(() => revealed = true),
            child: Text(a.t('reveal')),
          ),
        ] else ...[
          SelectableText(
            '${r.label(a.language)} · ${card['translation']}\n\n$text\n\n${card['topic']}',
            style: TextStyle(
              fontFamily: 'EBGaramond',
              fontSize: a.fontSize,
              height: a.lineHeight,
            ),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final choice in [
                ('again', 0),
                ('hard', 3),
                ('good', 4),
                ('easy', 5),
              ])
                FilledButton.tonal(
                  onPressed: () => grade(choice.$2),
                  child: Text(a.t(choice.$1)),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';

class StudyText extends StatelessWidget {
  final String type, id, original;
  const StudyText({
    super.key,
    required this.type,
    required this.id,
    required this.original,
  });
  @override
  Widget build(BuildContext context) {
    final translated = context.app.store.translatedEntry(type, id);
    if (translated == null) return MarkdownText(original);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MarkdownText(translated['body'] as String),
        const SizedBox(height: 12),
        Text(
          translated['status'] as String,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        ExpansionTile(
          title: const Text('Consultar o original em inglês'),
          children: [MarkdownText(original)],
        ),
      ],
    );
  }
}

class LongStudyText extends StatelessWidget {
  final String text;
  const LongStudyText(this.text, {super.key});
  @override
  Widget build(BuildContext context) {
    final paragraphs = text
        .split(RegExp(r'\n\s*\n'))
        .where((p) => p.trim().isNotEmpty)
        .toList();
    // Long imported books use lazy paragraphs to preserve reader responsiveness.
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: paragraphs.length,
      itemBuilder: (ctx, i) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: MarkdownText(paragraphs[i]),
      ),
    );
  }
}

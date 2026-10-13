import 'portuguese_resources.dart';
import 'appearance.dart';
import 'scripture_links.dart';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'app.dart';
import 'domain.dart';
import 'store.dart';
import 'notes.dart';

void message(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

Future<T?> sheet<T>(BuildContext context, String title, Widget content) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: false,
      builder: (ctx) => Shortcuts(
        shortcuts: {
          const SingleActivator(LogicalKeyboardKey.escape):
              const DismissIntent(),
        },
        child: Actions(
          actions: {
            DismissIntent: CallbackAction<DismissIntent>(
              onInvoke: (_) {
                Navigator.pop(ctx);
                return null;
              },
            ),
          },
          child: SizedBox(
            height: MediaQuery.sizeOf(ctx).height * .9,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 8, 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: Theme.of(ctx).textTheme.titleLarge,
                        ),
                      ),
                      IconButton(
                        tooltip: ctx.app.t('close'),
                        onPressed: () => Navigator.pop(ctx),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(child: content),
              ],
            ),
          ),
        ),
      ),
    );
Widget action(String text, IconData icon, VoidCallback callback) => Tooltip(
  message: text,
  child: TextButton.icon(
    onPressed: callback,
    icon: Icon(icon, size: 19),
    label: Text(text),
  ),
);
Widget feature(
  BuildContext context,
  String title,
  String subtitle,
  IconData icon,
  VoidCallback callback,
) => Card(
  child: ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
    leading: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 28),
    title: Text(title, style: Theme.of(context).textTheme.titleMedium),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
    onTap: callback,
  ),
);
Widget sourceLinks(BuildContext context, List<dynamic> sources) => Column(
  crossAxisAlignment: CrossAxisAlignment.start,
  children: [
    Text(
      context.app.t('sources'),
      style: Theme.of(context).textTheme.titleSmall,
    ),
    ...sources.map((source) {
      final label = source is Map
          ? '${source['title']}\n${source['url']}'
          : source.toString();
      return TextButton.icon(
        onPressed: () {
          Clipboard.setData(ClipboardData(text: label));
          message(context, context.app.t('copy'));
        },
        icon: const Icon(Icons.link, size: 16),
        label: Text(label, textAlign: TextAlign.start),
      );
    }),
  ],
);
List<Reference> referencesIn(String text) {
  final result = <String, Reference>{};
  for (final m in RegExp(
    r'([1-3]?\s*[A-Za-zÀ-ú]{2,})\s*(\d+)[.:](\d+)',
  ).allMatches(text)) {
    final r = Reference.parse('${m[1]} ${m[2]}:${m[3]}');
    if (r != null) result[r.id] = r;
  }
  return result.values.toList();
}

Future<void> showPassage(
  BuildContext context,
  Reference r, {
  String? sourceEdition,
  Reference? end,
}) async {
  final app = context.app;
  var edition = app.translation;
  var reference = r;
  String? explanation;
  if (sourceEdition != null && sourceEdition != edition) {
    final mapped = app.store.mapped(sourceEdition, r, edition);
    if (mapped != null && app.store.verse(edition, mapped) != null) {
      reference = mapped;
    } else {
      edition = sourceEdition;
      explanation =
          'A referência é apresentada na edição de origem. Não há mapeamento verificado para a edição selecionada.';
    }
  }
  final rangeEnd =
      end != null && end.book == reference.book && end.key >= reference.key
      ? end
      : null;
  final lastChapter = rangeEnd == null
      ? reference.chapter
      : rangeEnd.chapter.clamp(reference.chapter, reference.chapter + 2);
  final rows = <Map<String, Object?>>[];
  for (var chapter = reference.chapter; chapter <= lastChapter; chapter++) {
    rows.addAll(
      app.store.verses(edition, reference.book, chapter: chapter).where((v) {
        final current = Reference(reference.book, chapter, v['verse'] as int);
        return current.key >= reference.key &&
            (rangeEnd != null
                ? current.key <= rangeEnd.key
                : current.verse <= reference.verse + 5);
      }),
    );
  }
  if (rangeEnd != null &&
      (rangeEnd.chapter > lastChapter || rows.length > 120)) {
    explanation =
        '${explanation ?? ''}\nPrévia do intervalo. Abra a Bíblia para continuar a leitura completa.';
  }
  await sheet(
    context,
    reference.label(app.language),
    ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(edition, style: Theme.of(context).textTheme.labelLarge),
        if (explanation != null) Text(explanation),
        const SizedBox(height: 16),
        ...rows
            .take(120)
            .map(
              (row) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: SelectableText(
                  '${row['chapter']}:${row['verse']}  ${row['text']}',
                  style: TextStyle(
                    fontFamily: preferredReadingFont(
                      app.store.pref('font_family', 'EBGaramond'),
                    ),
                    fontSize: app.fontSize,
                    height: app.lineHeight,
                  ),
                ),
              ),
            ),
        if (rows.isEmpty) Text(app.t('noContent')),
        FilledButton.icon(
          onPressed: () {
            app.navigate(reference, edition: edition);
            Navigator.pop(context);
          },
          icon: const Icon(Icons.menu_book),
          label: Text(app.t('bible')),
        ),
      ],
    ),
  );
}

class MarkdownText extends StatelessWidget {
  final String text;
  const MarkdownText(this.text, {super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final transformed = linkScriptureReferences(text).replaceAllMapped(
      RegExp(r'\[\[([^\]]+)\]\]'),
      (m) => '[${m[1]}](biblia:${Uri.encodeComponent(m[1]!)})',
    );
    return MarkdownBody(
      data: transformed,
      selectable: true,
      styleSheet: MarkdownStyleSheet.fromTheme(
        Theme.of(context),
      ).copyWith(p: TextStyle(fontSize: 17, height: 1.6)),
      onTapLink: (label, url, title) {
        if (url == null) return;
        final uri = Uri.tryParse(url);
        if (uri?.scheme == 'biblia') {
          final target = Uri.decodeComponent(uri!.path);
          final parts = target.split('..');
          final r = Reference.parse(parts.first);
          if (r != null) {
            showPassage(
              context,
              r,
              end: parts.length > 1 ? Reference.parse(parts.last) : null,
            );
            return;
          }
          final id = target.startsWith('note:') ? target.substring(5) : target;
          final note = app.store.note(id);
          if (note != null) {
            openNote(context, note);
            return;
          }
          final doc = app.store.document(target);
          if (doc != null) {
            sheet(context, doc['title'] as String, DocumentPage(doc));
            return;
          }
          message(context, app.t('noContent'));
        } else if (uri?.scheme == 'confession') {
          final parts = uri!.path.split(':');
          final doc = parts.length == 2
              ? app.store
                    .documents(moduleId: parts[0])
                    .where(
                      (d) =>
                          jsonMap(d['metadata'])['number'].toString() ==
                          parts[1],
                    )
                    .firstOrNull
              : null;
          if (doc != null) {
            sheet(context, doc['title'] as String, DocumentPage(doc));
          } else {
            message(context, app.t('noContent'));
          }
        } else {
          Clipboard.setData(ClipboardData(text: url));
          message(context, app.t('copy'));
        }
      },
      sizedImageBuilder: (config) {
        final uri = config.uri, title = config.title, alt = config.alt;
        if (uri.scheme != 'attachment') {
          return Text(alt ?? title ?? 'Imagem local');
        }
        final a = app.store.attachment(uri.path);
        if (a == null || !File(a['path'] as String).existsSync()) {
          return Text(alt ?? 'Imagem indisponível');
        }
        return Image.file(
          File(a['path'] as String),
          semanticLabel: alt ?? a['filename'] as String,
          errorBuilder: (ctx, e, s) => Text(a['filename'] as String),
        );
      },
    );
  }
}

class DocumentPage extends StatelessWidget {
  final RecordRow document;
  const DocumentPage(this.document, {super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.app, metadata = jsonMap(document['metadata']);
    final references = (metadata['references'] as List? ?? [])
        .map((s) => Reference.fromId(s.toString()))
        .whereType<Reference>();
    final module = app.store.module(document['module_id'] as String);
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(
          '${module?['author'] ?? ''} · ${module?['language'] ?? ''}',
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 14),
        StudyText(
          type: 'document',
          id: document['id'] as String,
          original: document['body'] as String,
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 8,
          children: references
              .map(
                (r) => action(
                  r.label(app.language),
                  Icons.menu_book,
                  () => showPassage(context, r),
                ),
              )
              .toList(),
        ),
        sourceLinks(context, [module?['source'] ?? '']),
        Text(
          '${module?['license']}\n${module?['metadata'] ?? ''}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        action(
          app.t('note'),
          Icons.edit_note,
          () => openNewNote(
            context,
            title: document['title'] as String,
            body: '[[${document['id']}]]\n\n',
            reference: document['id'] as String,
          ),
        ),
        action(app.t('copy'), Icons.copy, () {
          Clipboard.setData(
            ClipboardData(
              text:
                  '${document['body']}\n\n${module?['author']}; ${module?['title']}; ${document['id']}; ${module?['source']}',
            ),
          );
          message(context, app.t('copy'));
        }),
      ],
    );
  }
}

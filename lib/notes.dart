import 'dart:async';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'store.dart';
import 'domain.dart';
import 'studies.dart';
import 'agostinho.dart';
import 'explore.dart';

Future<void> openNote(BuildContext context, RecordRow note) =>
    sheet(context, note['title'] as String, NoteEditor(note));
Future<void> openNewNote(
  BuildContext context, {
  String title = '',
  String body = '',
  String reference = '',
}) async {
  final app = context.app;
  final id = app.store.saveNote(
    title: title.isEmpty ? app.t('newNote') : title,
    body: body,
    reference: reference,
  );
  app.refresh();
  await openNote(context, app.store.note(id)!);
}

class NotesPage extends StatefulWidget {
  const NotesPage({super.key});
  @override
  State<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<NotesPage> {
  String notebook = '', query = '';
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    final all = app.store.notes;
    final rows = all
        .where(
          (n) =>
              (notebook.isEmpty || n['notebook'] == notebook) &&
              (query.isEmpty ||
                  foldText(
                    '${n['title']} ${n['body']} ${n['tags']}',
                  ).contains(foldText(query))),
        )
        .toList();
    final notebooks = all.map((n) => n['notebook'] as String).toSet();
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        feature(
          context,
          app.t('confessions'),
          'Confissão de Fé · Breve Catecismo · Catecismo Maior',
          Icons.account_balance,
          () => sheet(context, app.t('confessions'), const ConfessionsPage()),
        ),
        feature(
          context,
          'Confissões de Santo Agostinho',
          '13 livros · 52 leituras em linguagem simples · por capítulos',
          Icons.auto_stories_outlined,
          () => sheet(
            context,
            'Confissões de Santo Agostinho',
            const AugustineConfessionsPage(),
          ),
        ),
        Wrap(
          spacing: 8,
          children: [
            action(
              app.t('apologetics'),
              Icons.shield,
              () => sheet(
                context,
                app.t('apologetics'),
                const StudiesBrowser(apologetic: true),
              ),
            ),
            action(
              app.t('desk'),
              Icons.table_chart,
              () => sheet(
                context,
                app.t('desk'),
                const StudiesBrowser(apologetic: false),
              ),
            ),
            action(
              app.t('arena'),
              Icons.forum,
              () => sheet(context, app.t('arena'), const ArenaPage()),
            ),
            action(
              app.t('graph'),
              Icons.hub,
              () => sheet(context, app.t('graph'), const GraphPage()),
            ),
            action(app.t('newNote'), Icons.add, () => openNewNote(context)),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search),
            labelText: app.t('search'),
          ),
          onChanged: (v) => setState(() => query = v),
        ),
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              label: Text(app.t('all')),
              selected: notebook.isEmpty,
              onSelected: (_) => setState(() => notebook = ''),
            ),
            ...notebooks.map(
              (n) => ChoiceChip(
                label: Text(n),
                selected: notebook == n,
                onSelected: (_) => setState(() => notebook = n),
              ),
            ),
          ],
        ),
        ...rows.map(
          (n) => Card(
            child: ListTile(
              title: Text(n['title'] as String),
              subtitle: Text(
                '${n['notebook']} · ${n['tags']}\n${(n['body'] as String).replaceAll('\n', ' ')}',
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => openNote(context, n),
            ),
          ),
        ),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(app.t('empty')),
          ),
      ],
    );
  }
}

String foldText(String s) => fold(s);

class NoteEditor extends StatefulWidget {
  final RecordRow note;
  const NoteEditor(this.note, {super.key});
  @override
  State<NoteEditor> createState() => _NoteEditorState();
}

class _NoteEditorState extends State<NoteEditor> {
  late TextEditingController title, body, notebook, tags;
  Timer? debounce;
  late AppController app;
  bool preview = false, deleted = false;
  String? error;
  @override
  void initState() {
    super.initState();
    title = TextEditingController(text: widget.note['title'] as String);
    body = TextEditingController(text: widget.note['body'] as String);
    notebook = TextEditingController(text: widget.note['notebook'] as String);
    tags = TextEditingController(text: widget.note['tags'] as String);
    for (final c in [title, body, notebook, tags]) {
      c.addListener(changed);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    app = context.app;
  }

  void changed() {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 500), save);
  }

  void save({bool notify = true}) {
    if (deleted) return;
    try {
      app.store.saveNote(
        id: widget.note['id'] as String,
        title: title.text,
        body: body.text,
        reference: widget.note['reference'] as String,
        notebook: notebook.text,
        tags: tags.text,
      );
      if (notify && mounted) setState(() => error = null);
      if (notify) app.refresh();
    } catch (e) {
      if (notify && mounted) setState(() => error = e.toString());
    }
  }

  @override
  void dispose() {
    debounce?.cancel();
    save(notify: false);
    for (final c in [title, body, notebook, tags]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> attach() async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (result == null || !mounted) return;
    final file = result.files.single;
    final bytes = file.bytes;
    if (bytes == null) return;
    try {
      final id = await app.store.attach(
        widget.note['id'] as String,
        file.name,
        Uint8List.fromList(bytes),
      );
      if (!mounted) return;
      final image = [
        'png',
        'jpg',
        'jpeg',
        'webp',
        'gif',
      ].contains(file.extension?.toLowerCase());
      body.text += '\n${image ? '!' : ''}[${file.name}](attachment:$id)\n';
      save();
    } catch (e) {
      if (mounted) message(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final links = app.store.backlinks(widget.note['id'] as String);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        TextField(
          controller: title,
          decoration: InputDecoration(labelText: app.t('title')),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: notebook,
                decoration: InputDecoration(labelText: app.t('notebook')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: tags,
                decoration: InputDecoration(labelText: app.t('tags')),
              ),
            ),
          ],
        ),
        Wrap(
          spacing: 8,
          children: [
            action(
              app.t(preview ? 'edit' : 'preview'),
              preview ? Icons.edit : Icons.visibility,
              () => setState(() => preview = !preview),
            ),
            action(app.t('attach'), Icons.attach_file, attach),
            action(app.t('delete'), Icons.delete_outline, () {
              deleted = true;
              debounce?.cancel();
              app.store.deleteNote(widget.note['id'] as String);
              app.refresh();
              Navigator.pop(context);
            }),
          ],
        ),
        if (preview)
          MarkdownText(body.text)
        else
          TextField(
            controller: body,
            minLines: 14,
            maxLines: null,
            decoration: const InputDecoration(
              hintText: 'Markdown · [[João 3:16]] · [[note:identificador]]',
            ),
          ),
        const SizedBox(height: 10),
        Text(
          error ?? app.t('autosaved'),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (links.isNotEmpty)
          Text(
            app.t('backlinks'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ...links.map(
          (n) => ListTile(
            title: Text(n['title'] as String),
            onTap: () => openNote(context, n),
          ),
        ),
      ],
    );
  }
}

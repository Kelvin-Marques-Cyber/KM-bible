import 'dart:async';
import 'package:flutter/material.dart';
import 'app.dart';
import 'common.dart';
import 'domain.dart';
import 'store.dart';
import 'notes.dart';
import 'studies.dart';
import 'linguistics.dart';
import 'reader.dart';
import 'explore.dart';

Future<void> openSearch(BuildContext context) =>
    sheet(context, context.app.t('search'), const SearchPage());

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});
  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final field = TextEditingController();
  Timer? debounce;
  List<RecordRow> rows = [];
  String filter = '', query = '', suggestion = '';
  Reference? reference;
  String? error;
  @override
  void dispose() {
    debounce?.cancel();
    field.dispose();
    super.dispose();
  }

  void search(String value) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      final a = context.app;
      try {
        setState(() {
          query = value;
          reference = Reference.parse(value);
          rows = a.store.search(value, a.translation);
          suggestion = a.store.suggestion(value) ?? '';
          error = null;
        });
      } catch (e) {
        setState(() => error = e.toString());
      }
    });
  }

  Future<void> open(RecordRow hit) async {
    final a = context.app;
    switch (hit['category']) {
      case 'bible':
        showPassage(context, Reference.fromId(hit['id'] as String)!);
      case 'notes':
        openNote(context, a.store.note(hit['id'] as String)!);
      case 'studies':
        final row = a.store.studies().firstWhere((s) => s['id'] == hit['id']);
        sheet(
          context,
          row['title'] as String,
          StudyPage(row, apologetic: true),
        );
      case 'lexicon':
        sheet(context, hit['title'] as String, LexemePage(hit['id'] as String));
      case 'commentary':
        sheet(
          context,
          a.t('commentaries'),
          CommentariesPage(Reference.fromId(hit['reference'] as String)!),
        );
      default:
        final doc = a.store.document(hit['id'] as String);
        if (doc != null) {
          if (doc['kind'] == 'model_index') {
            final id = jsonMap(doc['metadata'])['model_id'];
            final models = await loadModels(a.store);
            if (!mounted) return;
            for (final model in models) {
              if (model['id'] == id) {
                sheet(context, model['title'] as String, ModelPage(model));
                return;
              }
            }
          }
          sheet(context, doc['title'] as String, DocumentPage(doc));
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        categories = rows.map((r) => r['category'] as String).toSet();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              TextField(
                controller: field,
                autofocus: true,
                onChanged: search,
                decoration: InputDecoration(
                  labelText: a.t('search'),
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    tooltip: a.t('close'),
                    onPressed: () {
                      field.clear();
                      search('');
                    },
                    icon: const Icon(Icons.clear),
                  ),
                ),
              ),
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: Text(a.t('all')),
                    selected: filter.isEmpty,
                    onSelected: (_) => setState(() => filter = ''),
                  ),
                  ...categories.map(
                    (c) => ChoiceChip(
                      label: Text(c),
                      selected: filter == c,
                      onSelected: (_) => setState(() => filter = c),
                    ),
                  ),
                ],
              ),
              if (suggestion.isNotEmpty)
                TextButton(
                  onPressed: () {
                    field.text = suggestion;
                    search(suggestion);
                  },
                  child: Text('${a.t('search')}: $suggestion'),
                ),
              if (error != null) Text(error!),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            children: [
              if (reference != null)
                ListTile(
                  leading: const Icon(Icons.menu_book),
                  title: Text(reference!.label(a.language)),
                  onTap: () => showPassage(context, reference!),
                ),
              ...rows
                  .where((r) => filter.isEmpty || r['category'] == filter)
                  .map(
                    (r) => ListTile(
                      title: Text(r['title'] as String),
                      subtitle: Text(
                        '${r['category']} · ${r['source']}\n${r['body']}',
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => open(r),
                    ),
                  ),
              if (rows.isEmpty && query.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(a.t('empty')),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

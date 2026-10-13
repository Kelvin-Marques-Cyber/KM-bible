import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'app.dart';
import 'domain.dart';
import 'common.dart';
import 'store.dart';
import 'packages.dart';

ContentPackage parseContent(Uint8List bytes) => ContentPackage.parse(bytes);

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key});
  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  String kind = '';
  bool busy = false;
  String? status;
  Future<void> install() async {
    final a = context.app;
    final picked = await FilePicker.platform.pickFiles(withData: true);
    if (picked == null || !mounted) return;
    if (picked.files.single.name.toLowerCase().endsWith('.pdf')) {
      setState(() => status = a.store.installed('ARA')
          ? 'PDF não pode ser importado diretamente. A ARA já está instalada; para outros textos, use .biblepkg.'
          : 'PDF não pode ser importado diretamente. Converta sua cópia autorizada em .biblepkg no computador e importe o módulo.');
      return;
    }
    final bytes = picked.files.single.bytes;
    if (bytes == null) return;
    setState(() => busy = true);
    try {
      final package = await compute(parseContent, bytes);
      if (!mounted) return;
      final accepted = await showDialog<bool>(
        context: context,
        builder: (ctx) => LicenseDialog(package.manifest),
      );
      if (accepted != true) return;
      // Importação pesada em isolate: a interface continua responsiva.
      await installContentPackageOffline(a.store, bytes);
      if (!mounted) return;
      a.refresh();
      status = a.t('success');
    } catch (e) {
      status = '${a.t('error')}: $e';
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app,
        rows = a.store.modules(kind: kind.isEmpty ? null : kind);
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        // A ARA é opcional: instalações pessoais podem incluí-la, e as
        // distribuições públicas permitem que cada usuário importe seu módulo.
        if (a.store.installed('ARA'))
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Almeida Revista e Atualizada (ARA)',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text('Edição instalada para leitura offline. '
                      'Conteúdo protegido da Sociedade Bíblica do Brasil; não redistribua.'),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: () {
                      a.store.setPref('edition_chosen', true);
                      final ref = a.store.verse('ARA', a.passage) == null
                          ? const Reference(1, 1, 1)
                          : a.passage;
                      a.navigate(ref, edition: 'ARA');
                    },
                    icon: const Icon(Icons.menu_book_outlined),
                    label: const Text('Ler Bíblia ARA'),
                  ),
                ],
              ),
            ),
          ),
        if (!a.store.installed('ARA'))
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Almeida Revista e Atualizada (ARA)',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text('Ainda não instalada. Se você possui uma cópia autorizada, '
                      'importe seu módulo .biblepkg para ler offline.'),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: busy ? null : install,
                    icon: const Icon(Icons.file_open_outlined),
                    label: const Text('Importar ARA'),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: busy ? null : install,
          icon: const Icon(Icons.add_box_outlined),
          label: const Text('Importar módulo (.biblepkg)'),
        ),
        const Padding(
          padding: EdgeInsets.only(top: 7, bottom: 10),
          child: Text('PDF não é importado diretamente nesta versão. '
              'Use um pacote .biblepkg de uma edição que tenha direito de usar.'),
        ),
        if (busy) ...[const LinearProgressIndicator(), Text(a.t('importing'))],
        if (status != null) SelectableText(status!),
        Wrap(
          spacing: 8,
          children:
              [
                    '',
                    'bible',
                    'commentary',
                    'confession',
                    'dictionary',
                    'lexicon',
                    'atlas',
                    'model',
                    'study',
                  ]
                  .map(
                    (v) => ChoiceChip(
                      label: Text(v.isEmpty ? a.t('all') : v),
                      selected: kind == v,
                      onSelected: (_) => setState(() => kind = v),
                    ),
                  )
                  .toList(),
        ),
        ...rows.map(
          (m) => Card(
            child: ListTile(
              title: Text(m['title'] as String),
              subtitle: Text(
                '${m['language']} · ${m['author']}\n${m['license']}\n${a.t(m['installed'] == 1 ? 'installed' : 'pending')}',
              ),
              isThreeLine: true,
              leading: Icon(
                m['installed'] == 1
                    ? Icons.offline_pin_outlined
                    : Icons.download_outlined,
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => sheet(context, m['title'] as String, ModulePage(m)),
            ),
          ),
        ),
      ],
    );
  }
}

class LicenseDialog extends StatefulWidget {
  final Map<String, dynamic> manifest;
  const LicenseDialog(this.manifest, {super.key});
  @override
  State<LicenseDialog> createState() => _LicenseDialogState();
}

class _LicenseDialogState extends State<LicenseDialog> {
  bool accepted = false;
  @override
  Widget build(BuildContext context) {
    final a = context.app, m = widget.manifest;
    return AlertDialog(
      title: Text(m['title'] as String),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${m['author']} · ${m['language']} · ${m['version']}\n${m['license']}\n${m['source']}',
              ),
              const SizedBox(height: 16),
              SelectableText(m['license_text'] as String),
              CheckboxListTile(
                value: accepted,
                onChanged: (v) => setState(() => accepted = v ?? false),
                title: Text(a.t('rights')),
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: Text(a.t('cancel')),
        ),
        FilledButton(
          onPressed: accepted ? () => Navigator.pop(context, true) : null,
          child: Text(a.t('install')),
        ),
      ],
    );
  }
}

class ModulePage extends StatelessWidget {
  final RecordRow module;
  const ModulePage(this.module, {super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app,
        m = a.store.module(module['id'] as String)!,
        metadata = jsonMap(m['metadata']),
        docs = a.store.documents(moduleId: m['id'] as String);
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        Text(
          m['title'] as String,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 6),
        Text(
          '${m['author']} · ${m['language']}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 14),
        if (const [
          'HDL-GUIA-FONTES',
          'EXP2-HDL-CAT',
          'JOSEMAR-GUIA-FONTES',
        ].contains(m['id']))
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'Este é um guia de fontes e leitura, não uma edição '
              'integral dos comentários do autor.',
            ),
          ),
        Text(
          'Conteúdo disponível · ${docs.length} ${docs.length == 1 ? 'texto' : 'textos'}',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        if (docs.isEmpty)
          const Text('Este módulo não contém textos disponíveis para leitura.'),
        for (final d in docs)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(d['title'] as String),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => sheet(
              context, d['title'] as String, DocumentPage(d),
            ),
          ),
        const Divider(height: 32),
        ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: const Text('Licença, fonte e informações técnicas'),
          children: [
            SelectableText(
              '${m['language']} · versão ${m['version']}\n'
              '${m['license']}\n${m['source']}',
            ),
            const SizedBox(height: 10),
            SelectableText(m['license_text'] as String),
            if (metadata.isNotEmpty) ...[
              const SizedBox(height: 12),
              SelectableText(
                metadata.entries.map((e) => '${e.key}: ${e.value}').join('\n'),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        if (m['installed'] == 1)
          OutlinedButton.icon(
            onPressed: () {
              try {
                a.store.removeModule(m['id'] as String);
                if (a.translation == m['id']) {
                  final next =
                      a.store
                              .modules(kind: 'bible', installedOnly: true)
                              .first['id']
                          as String;
                  a.translation = next;
                  a.store.setPref('translation', next);
                }
                a.refresh();
                Navigator.pop(context);
              } catch (e) {
                message(context, e.toString());
              }
            },
            icon: const Icon(Icons.remove_circle_outline),
            label: Text(a.t('remove')),
          )
        else if (m['builtin'] == 1 && metadata['availability'] == null)
          FilledButton.icon(
            onPressed: () {
              a.store.restoreModule(m['id'] as String);
              a.refresh();
              Navigator.pop(context);
            },
            icon: const Icon(Icons.restore),
            label: Text(a.t('restore')),
          ),

      ],
    );
  }
}

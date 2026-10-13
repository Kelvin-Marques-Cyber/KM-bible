import 'appearance.dart';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'pwa_update_stub.dart' if (dart.library.html) 'pwa_update_web.dart' as pwaUpdate;
import 'app.dart';
import 'domain.dart';
import 'common.dart';
import 'backups.dart';
import 'main.dart';

Future<void> openSettings(BuildContext context) =>
    sheet(context, context.app.t('settings'), const SettingsPage());

class AppearanceSettings extends StatelessWidget {
  const AppearanceSettings({super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: a.language,
          decoration: InputDecoration(labelText: a.t('language')),
          items: const [
            DropdownMenuItem(value: 'pt', child: Text('Português')),
            DropdownMenuItem(value: 'en', child: Text('English')),
            DropdownMenuItem(value: 'es', child: Text('Español')),
          ],
          onChanged: (v) => a.set('language', v),
        ),
        const SizedBox(height: 16),
        Text(a.t('theme')),
        Wrap(
          spacing: 10,
          children: readingThemes
              .map(
                (t) => ChoiceChip(
                  avatar: CircleAvatar(
                    backgroundColor: Color(t.surface),
                    child: Icon(
                      t.dark ? Icons.dark_mode : Icons.light_mode,
                      color: Color(t.accent),
                      size: 14,
                    ),
                  ),
                  label: Text(t.name(a.language)),
                  selected: a.store.pref('theme', 'sepia') == t.id,
                  onSelected: (_) => a.set('theme', t.id),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: a.translation,
          decoration: InputDecoration(labelText: a.t('translation')),
          items: a.store
              .modules(kind: 'bible', installedOnly: true)
              .map(
                (m) => DropdownMenuItem(
                  value: m['id'] as String,
                  child: Text(
                    m['title'] as String,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          isExpanded: true,
          onChanged: (v) {
            if (v == null) return;
            a.store.setPref('edition_chosen', true);
            a.navigate(
              a.store.verse(v, a.passage) != null
                  ? a.passage
                  : Reference(a.store.availableBooks(v).first, 1, 1),
              edition: v,
            );
          },
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: a.store.pref('font_family', 'EBGaramond'),
          decoration: InputDecoration(labelText: a.t('font')),
          items: readingFonts.entries
              .map(
                (f) => DropdownMenuItem(
                  value: f.key,
                  child: Text(
                    f.value,
                    style: TextStyle(fontFamily: preferredReadingFont(f.key)),
                  ),
                ),
              )
              .toList(),
          onChanged: (v) => a.set('font_family', v),
        ),
        const SizedBox(height: 12),
        Text(
          'Lâmpada para os meus pés é a tua palavra.',
          style: TextStyle(
            fontFamily: preferredReadingFont(
              a.store.pref('font_family', 'EBGaramond'),
            ),
            fontSize: a.fontSize,
            height: a.lineHeight,
          ),
        ),
        slider(context, 'fontSize', 'font_size', a.fontSize, 14, 48),
        slider(context, 'spacing', 'line_height', a.lineHeight, 1.1, 2.5),
        slider(context, 'margins', 'margins', a.margins, 8, 64),
      ],
    );
  }

  Widget slider(
    BuildContext context,
    String label,
    String key,
    double value,
    double min,
    double max,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${context.app.t(label)}: ${value.toStringAsFixed(key == 'line_height' ? 1 : 0)}',
      ),
      Slider(
        value: value,
        min: min,
        max: max,
        onChanged: (v) => context.app.set(key, v),
      ),
    ],
  );
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final password = TextEditingController();
  bool busy = false;
  String? status;
  @override
  void dispose() {
    password.dispose();
    super.dispose();
  }

  Future<void> backup(bool restore) async {
    final a = context.app;
    setState(() => busy = true);
    try {
      if (restore) {
        final picked = await FilePicker.platform.pickFiles(withData: true);
        if (picked == null) return;
        final bytes = picked.files.single.bytes;
        if (bytes == null) throw StateError('Arquivo indisponível');
        final count = await Backups.restore(
          a.store,
          bytes,
          password: password.text.isEmpty ? null : password.text,
        );
        a.refresh();
        status = '${a.t('restore')}: $count';
      } else {
        final bytes = await Backups.export(a.store, password: password.text);
        final path = await FilePicker.platform.saveFile(
          dialogTitle: a.t('export'),
          fileName:
              'Biblia-Estudos-${DateTime.now().toIso8601String().substring(0, 10)}.${password.text.isEmpty ? 'zip' : 'bibliaenc'}',
          bytes: bytes,
        );
        if (path != null && !Platform.isAndroid && !Platform.isIOS) {
          await File(path).writeAsBytes(bytes, flush: true);
        }
        status = path == null ? a.t('cancel') : a.t('success');
      }
    } catch (e) {
      status = '${a.t('error')}: $e';
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    return ListView(
      padding: const EdgeInsets.all(22),
      children: [
        const AppearanceSettings(),
        const Divider(height: 36),
        for (final item in [
          ('numbers', 'numbers', true),
          ('headings', 'headings', true),
          ('paragraphs', 'paragraphs', false),
          ('red', 'red', true),
          ('wholeBook', 'whole_book', false),
          ('contrast', 'contrast', false),
          ('reducedMotion', 'reduced_motion', false),
        ])
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(a.t(item.$1)),
            value: a.store.pref(item.$2, item.$3),
            onChanged: (v) => a.set(item.$2, v),
          ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(a.t('studyMode')),
          value: a.study,
          onChanged: (v) => a.set('study', v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            a.language == 'pt'
                ? 'Comentários em tela dividida'
                : 'Split commentary panel',
          ),
          value: a.store.pref('split_comments', true),
          onChanged: (v) => a.set('split_comments', v),
        ),
        if (kIsWeb) ...[
          const Divider(height: 36),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.system_update_alt),
            title: const Text('Atualizar aplicativo'),
            subtitle: const Text(
              'Buscar a versão mais recente sem apagar anotações, '
              'favoritos ou configurações.',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: pwaUpdate.openWebUpdater,
          ),
        ],
        const Divider(height: 36),
        Text(a.t('backup'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        TextField(
          controller: password,
          obscureText: true,
          decoration: InputDecoration(labelText: a.t('password')),
        ),
        Wrap(
          spacing: 10,
          children: [
            FilledButton.icon(
              onPressed: busy ? null : () => backup(false),
              icon: const Icon(Icons.archive_outlined),
              label: Text(a.t('export')),
            ),
            OutlinedButton.icon(
              onPressed: busy ? null : () => backup(true),
              icon: const Icon(Icons.restore),
              label: Text(a.t('restore')),
            ),
          ],
        ),
        if (busy) const LinearProgressIndicator(),
        if (status != null) SelectableText(status!),
        const Divider(height: 36),
        ListTile(
          title: Text(a.t('dedication')),
          leading: const Icon(Icons.favorite_outline),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const DedicationPage()),
          ),
        ),
        ExpansionTile(
          title: Text(a.t('keyboard')),
          children: const [
            Padding(
              padding: EdgeInsets.all(16),
              child: SelectableText(
                'Ctrl+F · Pesquisa / Search\nCtrl+L · Passagem / Passage\nCtrl+E · Leitura / Estudo\nAlt+← / → · Capítulos\nAlt+1…5 · Áreas principais\nEsc · Fechar painéis / sair da tela cheia\nTab / Shift+Tab · Foco\nEnter / Espaço · Ativar',
              ),
            ),
          ],
        ),
        action(
          a.language == 'pt'
              ? 'Licenças dos componentes'
              : a.language == 'es'
              ? 'Licencias de componentes'
              : 'Component licenses',
          Icons.policy_outlined,
          () => showLicensePage(
            context: context,
            applicationName: 'Bíblia Reformada',
            applicationVersion: '0.3.8',
            applicationLegalese: 'Criado por Kelvin e Silva Marques',
          ),
        ),
        const ListTile(
          title: Text('Bíblia Reformada'),
          subtitle: Text(
            'Criado por Kelvin e Silva Marques\nEm presente dedicatória à Rebeca Teles\nVersão 0.3.8',
          ),
        ),
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'As edições bíblicas e obras teológicas conservam suas autorias e licenças próprias. Os guias em português são sínteses de estudo; consulte os textos confessionais completos e as fontes.',
          ),
        ),
      ],
    );
  }
}

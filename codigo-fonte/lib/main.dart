import 'appearance.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'app.dart';
import 'store.dart';
import 'packages.dart';
import 'reader.dart';
import 'explore.dart';
import 'library.dart';
import 'notes.dart';
import 'memory.dart';
import 'settings.dart';
import 'search.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  LicenseRegistry.addLicense(() async* {
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    for (final path in manifest.listAssets().where(
      (p) => p.startsWith('assets/licenses/'),
    )) {
      yield LicenseEntryWithLineBreaks([
        path.split('/').last,
      ], await rootBundle.loadString(path));
    }
  });
  runApp(const Startup());
}

class Startup extends StatefulWidget {
  const Startup({super.key});
  @override
  State<Startup> createState() => _StartupState();
}

class _StartupState extends State<Startup> {
  AppController? controller;
  Object? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final store = await Store.open();
      for (final directory in ['bundled', 'private']) {
        List<dynamic> modules = [];
        try {
          modules =
              jsonDecode(
                    await rootBundle.loadString(
                      'assets/$directory/modules.json',
                    ),
                  )
                  as List;
        } catch (_) {}
        for (final item in modules) {
          final name = item is String ? item : item['file'] as String;
          final id = item is String ? 'ARA' : item['id'] as String;
          // O pacote de Calvino tem mais de 11 mil entradas. Na PWA de celular,
          // evita descompactar e indexar o acervo durante a abertura inicial.
          // No Android nativo ele continua disponivel normalmente.
          final mobileWeb = kIsWeb &&
              (defaultTargetPlatform == TargetPlatform.android ||
               defaultTargetPlatform == TargetPlatform.iOS);
          if (mobileWeb && id == 'CalvinCommentaries') {
            continue;
          }
          final imported = '${directory}_imported_$id';
          if (store.installed(id) ||
              store.pref(imported, false) ||
              (directory == 'private' &&
                  store.pref('private_imported_$id', false))) {
            continue;
          }
          try {
            final data = await rootBundle.load('assets/$directory/$name');
            await installContentPackageOffline(
              store,
              data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
            );
            store.content.execute(
              'UPDATE content_modules SET builtin=1 WHERE id=?',
              [id],
            );
            store.setPref(imported, true);
            store.setPref('bundled_error_$id', '');
            if (id == 'ARA' && !store.pref('edition_chosen', false)) {
              store.setPref('translation', 'ARA');
            }
          } catch (e) {
            // Falha em um modulo opcional nao deve bloquear a leitura biblica
            // nem impedir os outros pacotes de carregar. Continua disponivel
            // a importacao manual pela Biblioteca.
            debugPrint('Falha ao importar modulo $id: $e');
            store.setPref('bundled_error_$id', '$e');
          }
        }
      }
      if (mounted) setState(() => controller = AppController(store));
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  Widget build(BuildContext context) => controller != null
      ? BibleApp(controller!)
      : MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(
            body: Center(
              child: error == null
                  ? const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.menu_book, size: 48),
                        SizedBox(height: 24),
                        CircularProgressIndicator(),
                        SizedBox(height: 16),
                        Text('Preparando biblioteca local…'),
                      ],
                    )
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Não foi possível abrir o conteúdo local.',
                          ),
                          SelectableText('$error'),
                          FilledButton(
                            onPressed: load,
                            child: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        );
}

class BibleApp extends StatelessWidget {
  final AppController controller;
  const BibleApp(this.controller, {super.key});
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (ctx, _) {
      final theme = selectedReadingTheme(
        controller.store.pref('theme', 'sepia'),
      );
      final colors = ColorScheme.fromSeed(
        seedColor: Color(theme.accent),
        brightness: theme.dark ? Brightness.dark : Brightness.light,
        contrastLevel: controller.store.pref('contrast', false) ? 1 : 0,
        surface: Color(theme.surface),
      );
      return AppScope(
        app: controller,
        child: MaterialApp(
          title: 'Bíblia Reformada',
          debugShowCheckedModeBanner: false,
          locale: Locale(controller.language),
          supportedLocales: const [Locale('pt'), Locale('en'), Locale('es')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          theme: ThemeData(
            fontFamily: 'UiSans',
            useMaterial3: true,
            colorScheme: colors,
            scaffoldBackgroundColor: colors.surface,
            inputDecorationTheme: const InputDecorationTheme(
              border: OutlineInputBorder(),
            ),
            pageTransitionsTheme: controller.store.pref('reduced_motion', false)
                ? const PageTransitionsTheme(
                    builders: {
                      TargetPlatform.android: NoTransition(),
                      TargetPlatform.iOS: NoTransition(),
                      TargetPlatform.linux: NoTransition(),
                      TargetPlatform.windows: NoTransition(),
                      TargetPlatform.macOS: NoTransition(),
                    },
                  )
                : const PageTransitionsTheme(),
          ),
          home: !controller.store.pref('dedication_seen', false)
              ? const DedicationPage(first: true)
              : !controller.store.pref('onboarding_done', false)
              ? const FirstSetup()
              : const HomePage(),
        ),
      );
    },
  );
}

class NoTransition extends PageTransitionsBuilder {
  const NoTransition();
  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) => child;
}

class DedicationPage extends StatelessWidget {
  final bool first;
  const DedicationPage({super.key, this.first = false});
  @override
  Widget build(BuildContext context) {
    final a = context.app;
    void proceed() {
      if (first) {
        a.set('dedication_seen', true);
      } else {
        Navigator.pop(context);
      }
    }

    return Scaffold(
      body: Shortcuts(
        shortcuts: {
          const SingleActivator(LogicalKeyboardKey.enter):
              const ActivateIntent(),
          const SingleActivator(LogicalKeyboardKey.space):
              const ActivateIntent(),
        },
        child: Actions(
          actions: {
            ActivateIntent: CallbackAction<ActivateIntent>(
              onInvoke: (_) {
                proceed();
                return null;
              },
            ),
          },
          child: Focus(
            autofocus: true,
            child: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.auto_stories,
                        size: 60,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'Em presente dedicatória à Rebeca Teles',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'EBGaramond',
                          fontSize: 32,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 40),
                      FilledButton(
                        onPressed: proceed,
                        child: Text(a.t('continue')),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class FirstSetup extends StatelessWidget {
  const FirstSetup({super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app;
    return Scaffold(
      appBar: AppBar(title: const Text('Bíblia Reformada')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text(
            'A Bíblia no centro. Sua leitura e seus estudos, no seu dispositivo.',
            style: TextStyle(fontFamily: 'EBGaramond', fontSize: 28),
          ),
          const SizedBox(height: 24),
          const AppearanceSettings(),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () => a.set('onboarding_done', true),
            child: Text(a.t('skip')),
          ),
        ],
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});
  @override
  Widget build(BuildContext context) {
    final a = context.app, full = a.fullscreen && a.area == 0;
    final pages = [
      const ReaderPage(),
      const ExplorePage(),
      const LibraryPage(),
      const NotesPage(),
      const MemoryPage(),
    ];
    return Shortcuts(
      shortcuts: {
        const SingleActivator(LogicalKeyboardKey.keyF, control: true):
            const SearchIntent(),
        const SingleActivator(LogicalKeyboardKey.keyL, control: true):
            const PassageIntent(),
        const SingleActivator(LogicalKeyboardKey.keyE, control: true):
            const StudyIntent(),
        const SingleActivator(LogicalKeyboardKey.arrowLeft, alt: true):
            const StepIntent(-1),
        const SingleActivator(LogicalKeyboardKey.arrowRight, alt: true):
            const StepIntent(1),
        const SingleActivator(LogicalKeyboardKey.escape): const ExitIntent(),
        for (var i = 0; i < 5; i++)
          SingleActivator(
            [
              LogicalKeyboardKey.digit1,
              LogicalKeyboardKey.digit2,
              LogicalKeyboardKey.digit3,
              LogicalKeyboardKey.digit4,
              LogicalKeyboardKey.digit5,
            ][i],
            alt: true,
          ): AreaIntent(
            i,
          ),
      },
      child: Actions(
        actions: {
          SearchIntent: CallbackAction<SearchIntent>(
            onInvoke: (_) {
              openSearch(context);
              return null;
            },
          ),
          PassageIntent: CallbackAction<PassageIntent>(
            onInvoke: (_) {
              choosePassage(context);
              return null;
            },
          ),
          StudyIntent: CallbackAction<StudyIntent>(
            onInvoke: (_) {
              a.set('study', !a.study);
              return null;
            },
          ),
          ExitIntent: CallbackAction<ExitIntent>(
            onInvoke: (_) {
              a.set('fullscreen', false);
              return null;
            },
          ),
          StepIntent: CallbackAction<StepIntent>(
            onInvoke: (i) {
              a.step(i.direction);
              return null;
            },
          ),
          AreaIntent: CallbackAction<AreaIntent>(
            onInvoke: (i) {
              a.changeArea(i.area);
              return null;
            },
          ),
        },
        child: Focus(
          autofocus: true,
          child: Scaffold(
            appBar: full
                ? null
                : AppBar(
                    title: Text(
                      a.t(
                        [
                          'bible',
                          'explore',
                          'library',
                          'studies',
                          'memory',
                        ][a.area],
                      ),
                    ),
                    actions: [
                      IconButton(
                        tooltip: a.t('search'),
                        onPressed: () => openSearch(context),
                        icon: const Icon(Icons.search),
                      ),
                      IconButton(
                        tooltip: a.t('settings'),
                        onPressed: () => openSettings(context),
                        icon: const Icon(Icons.tune),
                      ),
                    ],
                  ),
            body: SafeArea(child: pages[a.area]),
            bottomNavigationBar: full
                ? null
                : NavigationBar(
                    selectedIndex: a.area,
                    onDestinationSelected: a.changeArea,
                    destinations: [
                      for (final item in [
                        (Icons.menu_book, 'bible'),
                        (Icons.public, 'explore'),
                        (Icons.local_library, 'library'),
                        (Icons.edit_note, 'studies'),
                        (Icons.psychology, 'memory'),
                      ])
                        NavigationDestination(
                          icon: Icon(item.$1),
                          label: a.t(item.$2),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class SearchIntent extends Intent {
  const SearchIntent();
}

class PassageIntent extends Intent {
  const PassageIntent();
}

class StudyIntent extends Intent {
  const StudyIntent();
}

class ExitIntent extends Intent {
  const ExitIntent();
}

class StepIntent extends Intent {
  final int direction;
  const StepIntent(this.direction);
}

class AreaIntent extends Intent {
  final int area;
  const AreaIntent(this.area);
}

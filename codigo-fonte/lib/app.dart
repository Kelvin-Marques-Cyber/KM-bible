import 'package:flutter/material.dart';
import 'domain.dart';
import 'store.dart';

const labels = <String, List<String>>{
  'bible': ['Bíblia', 'Bible', 'Biblia'],
  'explore': ['Explorar', 'Explore', 'Explorar'],
  'library': ['Biblioteca', 'Library', 'Biblioteca'],
  'studies': ['Estudos', 'Studies', 'Estudios'],
  'memory': ['Memorização', 'Memory', 'Memorización'],
  'settings': ['Configurações', 'Settings', 'Configuración'],
  'search': ['Pesquisar', 'Search', 'Buscar'],
  'close': ['Fechar', 'Close', 'Cerrar'],
  'cancel': ['Cancelar', 'Cancel', 'Cancelar'],
  'save': ['Salvar', 'Save', 'Guardar'],
  'delete': ['Excluir', 'Delete', 'Eliminar'],
  'copy': ['Copiar', 'Copy', 'Copiar'],
  'continue': ['Continuar', 'Continue', 'Continuar'],
  'skip': ['Começar a ler', 'Start reading', 'Comenzar a leer'],
  'reference': ['Referência', 'Reference', 'Referencia'],
  'translation': ['Tradução', 'Translation', 'Traducción'],
  'theme': ['Aparência', 'Appearance', 'Apariencia'],
  'light': ['Claro', 'Light', 'Claro'],
  'dark': ['Escuro', 'Dark', 'Oscuro'],
  'sepia': ['Sépia', 'Sepia', 'Sepia'],
  'language': [
    'Idioma da interface',
    'Interface language',
    'Idioma de la interfaz',
  ],
  'font': ['Fonte', 'Font', 'Fuente'],
  'fontSize': ['Tamanho do texto', 'Text size', 'Tamaño del texto'],
  'spacing': ['Espaçamento', 'Line spacing', 'Espaciado'],
  'margins': ['Margens', 'Margins', 'Márgenes'],
  'contrast': ['Alto contraste', 'High contrast', 'Alto contraste'],
  'reducedMotion': [
    'Movimento reduzido',
    'Reduce motion',
    'Movimiento reducido',
  ],
  'numbers': [
    'Números dos versículos',
    'Verse numbers',
    'Números de versículos',
  ],
  'headings': ['Títulos de seção', 'Section headings', 'Títulos de sección'],
  'red': [
    'Palavras de Jesus em vermelho',
    'Words of Jesus in red',
    'Palabras de Jesús en rojo',
  ],
  'paragraphs': ['Texto em parágrafos', 'Paragraph text', 'Texto en párrafos'],
  'wholeBook': [
    'Leitura contínua do livro',
    'Continuous book reading',
    'Lectura continua del libro',
  ],
  'fullscreen': ['Tela cheia', 'Full screen', 'Pantalla completa'],
  'readingMode': ['Leitura', 'Reading', 'Lectura'],
  'studyMode': ['Estudo', 'Study', 'Estudio'],
  'previous': ['Anterior', 'Previous', 'Anterior'],
  'next': ['Próximo', 'Next', 'Siguiente'],
  'compare': [
    'Comparar traduções',
    'Compare translations',
    'Comparar traducciones',
  ],
  'alternating': [
    'Linhas alternadas',
    'Alternating lines',
    'Líneas alternadas',
  ],
  'columns': ['Colunas', 'Columns', 'Columnas'],
  'differences': [
    'Mostrar diferenças',
    'Show differences',
    'Mostrar diferencias',
  ],
  'addressWarning': [
    'Endereços numéricos não garantem equivalência textual. Correspondências editoriais aparecem quando disponíveis.',
    'Numeric addresses do not guarantee textual equivalence. Editorial mappings are shown when available.',
    'Las referencias numéricas no garantizan equivalencia textual. Se muestran correspondencias editoriales cuando existen.',
  ],
  'note': ['Anotar', 'Add note', 'Anotar'],
  'notes': ['Anotações', 'Notes', 'Notas'],
  'bookmark': ['Favorito', 'Bookmark', 'Favorito'],
  'bookmarks': [
    'Favoritos e histórico',
    'Bookmarks and history',
    'Favoritos e historial',
  ],
  'tab': ['Abrir aba de estudo', 'Open study tab', 'Abrir pestaña de estudio'],
  'tabs': ['Abas de estudo', 'Study tabs', 'Pestañas de estudio'],
  'highlight': ['Destacar', 'Highlight', 'Resaltar'],
  'clearHighlight': [
    'Remover destaque',
    'Remove highlight',
    'Quitar resaltado',
  ],
  'original': ['Idioma original', 'Original language', 'Idioma original'],
  'references': ['Referências', 'References', 'Referencias'],
  'commentaries': ['Comentários', 'Commentaries', 'Comentarios'],
  'noContent': [
    'Não há conteúdo instalado para este trecho.',
    'No installed content for this passage.',
    'No hay contenido instalado para este pasaje.',
  ],
  'selected': ['Selecionados', 'Selected', 'Seleccionados'],
  'install': ['Importar módulo', 'Import module', 'Importar módulo'],
  'remove': ['Remover módulo', 'Remove module', 'Quitar módulo'],
  'restore': ['Restaurar', 'Restore', 'Restaurar'],
  'license': ['Licença e fonte', 'License and source', 'Licencia y fuente'],
  'installed': ['Instalado', 'Installed', 'Instalado'],
  'pending': [
    'Arquivo autorizado necessário',
    'Authorized file needed',
    'Archivo autorizado necesario',
  ],
  'rights': [
    'Declaro que tenho autorização para usar este conteúdo nas condições apresentadas.',
    'I am authorized to use this content under the displayed terms.',
    'Tengo autorización para utilizar este contenido con las condiciones indicadas.',
  ],
  'importing': [
    'Instalando conteúdo local…',
    'Installing local content…',
    'Instalando contenido local…',
  ],
  'export': ['Exportar estudos', 'Export studies', 'Exportar estudios'],
  'backup': [
    'Backup e restauração',
    'Backup and restore',
    'Copia y restauración',
  ],
  'password': [
    'Senha opcional para exportar; senha do arquivo para restaurar',
    'Optional export password; file password for restore',
    'Contraseña opcional al exportar; contraseña del archivo al restaurar',
  ],
  'dedication': [
    'Revisitar dedicatória',
    'Revisit dedication',
    'Volver a dedicatoria',
  ],
  'keyboard': ['Atalhos de teclado', 'Keyboard shortcuts', 'Atajos de teclado'],
  'newNote': ['Nova anotação', 'New note', 'Nueva nota'],
  'title': ['Título', 'Title', 'Título'],
  'notebook': ['Caderno', 'Notebook', 'Cuaderno'],
  'tags': ['Etiquetas', 'Tags', 'Etiquetas'],
  'preview': ['Visualizar Markdown', 'Preview Markdown', 'Ver Markdown'],
  'edit': ['Editar', 'Edit', 'Editar'],
  'attach': [
    'Anexar imagem ou arquivo',
    'Attach image or file',
    'Adjuntar imagen o archivo',
  ],
  'backlinks': ['Mencionado por', 'Referenced by', 'Mencionado por'],
  'autosaved': [
    'Salvo automaticamente no dispositivo',
    'Automatically saved on device',
    'Guardado automáticamente en el dispositivo',
  ],
  'confessions': [
    'Padrões de Westminster',
    'Westminster Standards',
    'Normas de Westminster',
  ],
  'apologetics': [
    'Apologética presbiteriana',
    'Presbyterian apologetics',
    'Apologética presbiteriana',
  ],
  'desk': ['Mesa de Estudos', 'Study desk', 'Mesa de Estudios'],
  'impersonal': [
    'Exposição impessoal',
    'Descriptive exposition',
    'Exposición descriptiva',
  ],
  'argumentCompare': [
    'Comparar argumentos',
    'Compare arguments',
    'Comparar argumentos',
  ],
  'strongest': [
    'Examinar a objeção mais forte',
    'Examine the strongest objection',
    'Examinar la objeción más fuerte',
  ],
  'rejoinder': [
    'Responder à refutação',
    'Respond to the rebuttal',
    'Responder a la refutación',
  ],
  'sources': ['Fontes', 'Sources', 'Fuentes'],
  'beginner': ['Iniciante', 'Beginner', 'Inicial'],
  'intermediate': ['Intermediário', 'Intermediate', 'Intermedio'],
  'advanced': ['Avançado', 'Advanced', 'Avanzado'],
  'completed': ['Estudo concluído', 'Study completed', 'Estudio completado'],
  'arena': [
    'Arena e laboratório',
    'Arena and laboratory',
    'Arena y laboratorio',
  ],
  'apologists': ['Grandes apologistas', 'Apologists', 'Apologistas'],
  'noStudy': [
    'Este estudo não está registrado na biblioteca.',
    'This study is not registered in the library.',
    'Este estudio no está registrado en la biblioteca.',
  ],
  'response': ['Sua resposta', 'Your response', 'Tu respuesta'],
  'feedback': [
    'Examinar estrutura da resposta',
    'Review response structure',
    'Examinar la estructura de la respuesta',
  ],
  'approach': ['Abordagem', 'Approach', 'Enfoque'],
  'presuppositional': [
    'Pressuposicional reformada',
    'Reformed presuppositional',
    'Presuposicional reformada',
  ],
  'evidential': [
    'Histórica e evidencial',
    'Historical and evidential',
    'Histórica y evidencial',
  ],
  'exegetical': [
    'Exegética e confessional',
    'Exegetical and confessional',
    'Exegética y confesional',
  ],
  'timeline': ['Linha do tempo', 'Timeline', 'Cronología'],
  'map': ['Mapas offline', 'Offline maps', 'Mapas offline'],
  'context': ['Contexto histórico', 'Historical context', 'Contexto histórico'],
  'contextCompare': [
    'Comparar contexto',
    'Compare context',
    'Comparar contexto',
  ],
  'models': ['Reconstruções 3D', '3D reconstructions', 'Reconstrucciones 3D'],
  'units': ['Medidas e moedas', 'Measures and coins', 'Medidas y monedas'],
  'graph': ['Grafo de estudos', 'Study graph', 'Grafo de estudios'],
  'linguistics': [
    'Pesquisa linguística',
    'Linguistic search',
    'Búsqueda lingüística',
  ],
  'reset': ['Redefinir', 'Reset', 'Restablecer'],
  'zoomIn': ['Ampliar', 'Zoom in', 'Ampliar'],
  'zoomOut': ['Reduzir', 'Zoom out', 'Reducir'],
  'rotate': ['Girar', 'Rotate', 'Girar'],
  'layers': ['Camadas', 'Layers', 'Capas'],
  'textAlternative': [
    'Descrição e referências',
    'Description and references',
    'Descripción y referencias',
  ],
  'uncertainty': [
    'Incerteza e metodologia',
    'Uncertainty and method',
    'Incertidumbre y método',
  ],
  'insufficient': [
    'Não há dados suficientes para um cálculo confiável.',
    'Insufficient data for a reliable calculation.',
    'No hay datos suficientes para un cálculo fiable.',
  ],
  'ancient': ['Nomes antigos', 'Ancient names', 'Nombres antiguos'],
  'modern': ['Nomes atuais', 'Modern names', 'Nombres actuales'],
  'world': ['Eventos paralelos', 'Parallel events', 'Eventos paralelos'],
  'filter': ['Filtrar', 'Filter', 'Filtrar'],
  'category': ['Categoria', 'Category', 'Categoría'],
  'all': ['Todos', 'All', 'Todos'],
  'personal': ['Pessoal', 'Personal', 'Personal'],
  'biblical': ['Textual', 'Textual', 'Textual'],
  'editorial': ['Editorial', 'Editorial', 'Editorial'],
  'theological': ['Teológica', 'Theological', 'Teológica'],
  'lemma': ['Lema', 'Lemma', 'Lema'],
  'surface': ['Forma original', 'Original form', 'Forma original'],
  'gloss': ['Glosa', 'Gloss', 'Glosa'],
  'morphology': ['Morfologia', 'Morphology', 'Morfología'],
  'frequency': [
    'Frequência no corpus',
    'Corpus frequency',
    'Frecuencia en el corpus',
  ],
  'occurrences': ['Ocorrências', 'Occurrences', 'Ocurrencias'],
  'lexicalWarning': [
    'O léxico, o uso contextual e a interpretação teológica são distintos. O corpus original não pressupõe alinhamento palavra por palavra com sua tradução.',
    'Lexical meaning, contextual use and theological interpretation are distinct. The original corpus does not assume word alignment with your translation.',
    'El significado léxico, el uso contextual y la interpretación teológica son distintos. El corpus original no supone alineación palabra por palabra con su traducción.',
  ],
  'addCard': ['Criar cartão', 'Create card', 'Crear tarjeta'],
  'review': ['Revisar', 'Review', 'Repasar'],
  'reveal': ['Mostrar resposta', 'Reveal answer', 'Mostrar respuesta'],
  'pendingCards': [
    'Revisões pendentes',
    'Reviews due',
    'Revisiones pendientes',
  ],
  'cardMode': ['Modo do cartão', 'Card mode', 'Modo de tarjeta'],
  'reference_to_text': [
    'Referência → texto',
    'Reference → text',
    'Referencia → texto',
  ],
  'text_to_reference': [
    'Texto → referência',
    'Text → reference',
    'Texto → referencia',
  ],
  'cloze': ['Completar palavras', 'Fill missing words', 'Completar palabras'],
  'recitation': ['Recitação livre', 'Free recitation', 'Recitación libre'],
  'theme_card': ['Passagem e tema', 'Passage and theme', 'Pasaje y tema'],
  'topic': ['Tema', 'Topic', 'Tema'],
  'again': ['Rever amanhã', 'Review tomorrow', 'Repasar mañana'],
  'hard': ['Difícil', 'Hard', 'Difícil'],
  'good': ['Lembrei', 'Recalled', 'Recordé'],
  'easy': ['Com facilidade', 'Easily recalled', 'Con facilidad'],
  'reminder': [
    'Lembrete diário opcional',
    'Optional daily reminder',
    'Recordatorio diario opcional',
  ],
  'hour': ['Horário', 'Time', 'Hora'],
  'stats': ['Acompanhamento', 'Progress', 'Seguimiento'],
  'empty': [
    'Nenhum item encontrado.',
    'No items found.',
    'No se encontraron elementos.',
  ],
  'error': [
    'Não foi possível concluir',
    'Could not complete',
    'No se pudo completar',
  ],
  'success': ['Concluído', 'Completed', 'Completado'],
  'start': ['Iniciar', 'Start', 'Iniciar'],
  'offline': [
    'Tudo disponível no dispositivo',
    'Available on your device',
    'Disponible en el dispositivo',
  ],
};

class AppController extends ChangeNotifier {
  final Store store;
  late String translation;
  late Reference passage;
  int area = 0, revision = 0;
  String? activeTab;
  AppController(this.store) {
    translation = store.pref('translation', 'BLN4');
    if (!store.installed(translation)) {
      translation =
          store.modules(kind: 'bible', installedOnly: true).first['id']
              as String;
    }
    passage =
        Reference.fromId(store.pref('last_reference', '43:3:16')) ??
        const Reference(43, 3, 16);
    if (store.verse(translation, passage) == null) {
      final b = store.availableBooks(translation).first;
      passage = Reference(b, 1, 1);
    }
  }
  String get language => store.pref('language', 'pt');
  String t(String key) =>
      (labels[key] ?? [key, key, key])[language == 'en'
          ? 1
          : language == 'es'
          ? 2
          : 0];
  bool get study => store.pref('study', false);
  bool get fullscreen => store.pref('fullscreen', false);
  double get fontSize => store.pref('font_size', 23.0).clamp(14.0, 48.0);
  double get lineHeight => store.pref('line_height', 1.6).clamp(1.1, 2.5);
  double get margins => store.pref('margins', 22.0).clamp(8.0, 64.0);
  void set(String key, Object? value) {
    store.setPref(key, value);
    notifyListeners();
  }

  void refresh() {
    revision++;
    notifyListeners();
  }

  void navigate(Reference r, {String? edition, bool history = true}) {
    final e = edition ?? translation;
    if (store.verse(e, r) == null) return;
    translation = e;
    passage = r;
    area = 0;
    revision++;
    if (history) store.recordReading(e, r);
    if (activeTab != null) {
      store.savePlace('study_tabs', r.id, e, r.label(language), id: activeTab);
    }
    notifyListeners();
  }

  void changeArea(int value) {
    area = value;
    notifyListeners();
  }

  void step(int direction) {
    var b = passage.book, c = passage.chapter + direction;
    if (c < 1) {
      final available = store.availableBooks(translation);
      final index = available.indexOf(b);
      if (index <= 0) return;
      b = available[index - 1];
      c = store.chapters(translation, b);
    } else if (c > store.chapters(translation, b)) {
      final available = store.availableBooks(translation);
      final index = available.indexOf(b);
      if (index + 1 >= available.length) return;
      b = available[index + 1];
      c = 1;
    }
    navigate(Reference(b, c, 1));
  }
}

class AppScope extends InheritedNotifier<AppController> {
  const AppScope({super.key, required AppController app, required super.child})
    : super(notifier: app);
  static AppController of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

extension AppContext on BuildContext {
  AppController get app => AppScope.of(this);
}

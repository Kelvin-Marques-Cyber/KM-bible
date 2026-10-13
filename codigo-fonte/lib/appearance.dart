class ReadingTheme {
  final String id;
  final List<String> names;
  final int surface, accent;
  final bool dark;
  const ReadingTheme(
    this.id,
    this.names,
    this.surface,
    this.accent, [
    this.dark = false,
  ]);
  String name(String language) =>
      names[language == 'en'
          ? 1
          : language == 'es'
          ? 2
          : 0];
}

const readingThemes = [
  ReadingTheme(
    'light',
    ['Papel claro', 'Light paper', 'Papel claro'],
    0xfffaf9f6,
    0xff466451,
  ),
  ReadingTheme('sepia', ['Sépia', 'Sepia', 'Sepia'], 0xfff4efdf, 0xff795839),
  ReadingTheme(
    'dark',
    ['Grafite', 'Graphite', 'Grafito'],
    0xff181f29,
    0xff86b99c,
    true,
  ),
  ReadingTheme(
    'midnight',
    ['Meia-noite', 'Midnight', 'Medianoche'],
    0xff101827,
    0xffa3b9df,
    true,
  ),
  ReadingTheme(
    'forest',
    ['Floresta', 'Forest', 'Bosque'],
    0xff14211a,
    0xff91cba2,
    true,
  ),
  ReadingTheme(
    'oled',
    ['Preto profundo', 'Deep black', 'Negro profundo'],
    0xff000000,
    0xffddddce,
    true,
  ),
  ReadingTheme(
    'coffee',
    ['Café', 'Coffee', 'Café'],
    0xff241c17,
    0xffd5b58d,
    true,
  ),
  ReadingTheme(
    'ocean',
    ['Oceano', 'Ocean', 'Océano'],
    0xff102327,
    0xff8ececb,
    true,
  ),
  ReadingTheme('wine', ['Vinho', 'Wine', 'Vino'], 0xff281820, 0xffe8b0c2, true),
  ReadingTheme(
    'parchment',
    ['Pergaminho', 'Parchment', 'Pergamino'],
    0xffeee0c9,
    0xff785232,
  ),
  ReadingTheme('ivory', ['Marfim', 'Ivory', 'Marfil'], 0xfffff8eb, 0xff5d6540),
  ReadingTheme(
    'lavender',
    ['Lavanda', 'Lavender', 'Lavanda'],
    0xfff4f0fa,
    0xff725989,
  ),
  ReadingTheme('mist', ['Névoa', 'Mist', 'Niebla'], 0xffedf0f2, 0xff496375),
  ReadingTheme(
    'rose',
    ['Rosa antigo', 'Old rose', 'Rosa antiguo'],
    0xfffbefee,
    0xff8a5658,
  ),
];

ReadingTheme selectedReadingTheme(String id) =>
    readingThemes.where((t) => t.id == id).firstOrNull ?? readingThemes[1];

const readingFonts = {
  'EBGaramond': 'EB Garamond',
  'UiSans': 'Roboto',
  'Lora': 'Lora',
  'SourceSerif4': 'Source Serif 4',
  'NotoSerif': 'Noto Serif',
  'LibreBaskerville': 'Libre Baskerville',
  'CrimsonPro': 'Crimson Pro',
  'Merriweather': 'Merriweather',
  'CormorantGaramond': 'Cormorant Garamond',
  'Spectral': 'Spectral',
  'Bitter': 'Bitter',
  'AtkinsonHyperlegible': 'Atkinson Hyperlegible',
  'Lexend': 'Lexend',
  'NotoSans': 'Noto Sans',
  'system': 'Sistema / System',
};

String? preferredReadingFont(String value) => value == 'system'
    ? null
    : readingFonts.containsKey(value)
    ? value
    : 'EBGaramond';

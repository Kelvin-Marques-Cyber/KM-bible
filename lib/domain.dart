import 'dart:math' as math;

const booksPt = [
  'Gênesis',
  'Êxodo',
  'Levítico',
  'Números',
  'Deuteronômio',
  'Josué',
  'Juízes',
  'Rute',
  '1 Samuel',
  '2 Samuel',
  '1 Reis',
  '2 Reis',
  '1 Crônicas',
  '2 Crônicas',
  'Esdras',
  'Neemias',
  'Ester',
  'Jó',
  'Salmos',
  'Provérbios',
  'Eclesiastes',
  'Cântico dos Cânticos',
  'Isaías',
  'Jeremias',
  'Lamentações',
  'Ezequiel',
  'Daniel',
  'Oseias',
  'Joel',
  'Amós',
  'Obadias',
  'Jonas',
  'Miqueias',
  'Naum',
  'Habacuque',
  'Sofonias',
  'Ageu',
  'Zacarias',
  'Malaquias',
  'Mateus',
  'Marcos',
  'Lucas',
  'João',
  'Atos',
  'Romanos',
  '1 Coríntios',
  '2 Coríntios',
  'Gálatas',
  'Efésios',
  'Filipenses',
  'Colossenses',
  '1 Tessalonicenses',
  '2 Tessalonicenses',
  '1 Timóteo',
  '2 Timóteo',
  'Tito',
  'Filemom',
  'Hebreus',
  'Tiago',
  '1 Pedro',
  '2 Pedro',
  '1 João',
  '2 João',
  '3 João',
  'Judas',
  'Apocalipse',
];
const booksEn = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'Song of Songs',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
];
const booksEs = [
  'Génesis',
  'Éxodo',
  'Levítico',
  'Números',
  'Deuteronomio',
  'Josué',
  'Jueces',
  'Rut',
  '1 Samuel',
  '2 Samuel',
  '1 Reyes',
  '2 Reyes',
  '1 Crónicas',
  '2 Crónicas',
  'Esdras',
  'Nehemías',
  'Ester',
  'Job',
  'Salmos',
  'Proverbios',
  'Eclesiastés',
  'Cantar de los Cantares',
  'Isaías',
  'Jeremías',
  'Lamentaciones',
  'Ezequiel',
  'Daniel',
  'Oseas',
  'Joel',
  'Amós',
  'Abdías',
  'Jonás',
  'Miqueas',
  'Nahúm',
  'Habacuc',
  'Sofonías',
  'Hageo',
  'Zacarías',
  'Malaquías',
  'Mateo',
  'Marcos',
  'Lucas',
  'Juan',
  'Hechos',
  'Romanos',
  '1 Corintios',
  '2 Corintios',
  'Gálatas',
  'Efesios',
  'Filipenses',
  'Colosenses',
  '1 Tesalonicenses',
  '2 Tesalonicenses',
  '1 Timoteo',
  '2 Timoteo',
  'Tito',
  'Filemón',
  'Hebreos',
  'Santiago',
  '1 Pedro',
  '2 Pedro',
  '1 Juan',
  '2 Juan',
  '3 Juan',
  'Judas',
  'Apocalipsis',
];
const osisBooks = [
  'Gen',
  'Exod',
  'Lev',
  'Num',
  'Deut',
  'Josh',
  'Judg',
  'Ruth',
  '1Sam',
  '2Sam',
  '1Kgs',
  '2Kgs',
  '1Chr',
  '2Chr',
  'Ezra',
  'Neh',
  'Esth',
  'Job',
  'Ps',
  'Prov',
  'Eccl',
  'Song',
  'Isa',
  'Jer',
  'Lam',
  'Ezek',
  'Dan',
  'Hos',
  'Joel',
  'Amos',
  'Obad',
  'Jonah',
  'Mic',
  'Nah',
  'Hab',
  'Zeph',
  'Hag',
  'Zech',
  'Mal',
  'Matt',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Rom',
  '1Cor',
  '2Cor',
  'Gal',
  'Eph',
  'Phil',
  'Col',
  '1Thess',
  '2Thess',
  '1Tim',
  '2Tim',
  'Titus',
  'Phlm',
  'Heb',
  'Jas',
  '1Pet',
  '2Pet',
  '1John',
  '2John',
  '3John',
  'Jude',
  'Rev',
];
List<String> bookNames(String language) => language == 'en'
    ? booksEn
    : language == 'es'
    ? booksEs
    : booksPt;
String fold(String s) {
  const a = 'áàâãäéèêëíìîïóòôõöúùûüçñ', b = 'aaaaaeeeeiiiiooooouuuucn';
  var v = s.toLowerCase();
  for (var i = 0; i < a.length; i++) {
    v = v.replaceAll(a[i], b[i]);
  }
  return v.trim();
}

int editDistance(String a, String b) {
  var prior = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    final next = [i];
    for (var j = 1; j <= b.length; j++) {
      next.add(
        math.min(
          math.min(next[j - 1] + 1, prior[j] + 1),
          prior[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1),
        ),
      );
    }
    prior = next;
  }
  return prior.last;
}

class Reference implements Comparable<Reference> {
  final int book, chapter, verse;
  const Reference(this.book, this.chapter, [this.verse = 1]);
  String get id => '$book:$chapter:$verse';
  int get key => book * 1000000 + chapter * 1000 + verse;
  String label([String language = 'pt']) =>
      '${bookNames(language)[book - 1]} $chapter:$verse';
  static Reference? fromId(String s) {
    final a = s.split(':').map(int.tryParse).toList();
    if (a.length != 3 ||
        a.any((v) => v == null) ||
        a[0]! < 1 ||
        a[0]! > 66 ||
        a[1]! < 1 ||
        a[1]! > 150 ||
        a[2]! < 1 ||
        a[2]! > 176) {
      return null;
    }
    return Reference(a[0]!, a[1]!, a[2]!);
  }

  static Reference? parse(String text) {
    final r = fromId(text);
    if (r != null) return r;
    final m = RegExp(
      r'^\s*(.+?)\s+(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?\s*$',
    ).firstMatch(text);
    if (m == null) return null;
    final name = fold(m[1]!).replaceAll(RegExp(r'[.\s]'), '');
    if (m[1]!.trim().toLowerCase() == 'jó') {
      return fromId('18:${m[2]}:${m[3] ?? 1}');
    }
    final aliases = <String, int>{
      'gn': 1,
      'ex': 2,
      'lv': 3,
      'nm': 4,
      'dt': 5,
      'js': 6,
      'jz': 7,
      'rt': 8,
      '1sm': 9,
      '2sm': 10,
      '1rs': 11,
      '2rs': 12,
      '1cr': 13,
      '2cr': 14,
      'ed': 15,
      'ne': 16,
      'et': 17,
      'sl': 19,
      'pv': 20,
      'ec': 21,
      'ct': 22,
      'is': 23,
      'jr': 24,
      'lm': 25,
      'ez': 26,
      'dn': 27,
      'os': 28,
      'jl': 29,
      'am': 30,
      'ob': 31,
      'jn': 43,
      'mq': 33,
      'na': 34,
      'hc': 35,
      'sf': 36,
      'ag': 37,
      'zc': 38,
      'ml': 39,
      'mt': 40,
      'mc': 41,
      'lc': 42,
      'jo': 43,
      'at': 44,
      'rm': 45,
      '1co': 46,
      '2co': 47,
      'gl': 48,
      'ef': 49,
      'fp': 50,
      'cl': 51,
      '1ts': 52,
      '2ts': 53,
      '1tm': 54,
      '2tm': 55,
      'tt': 56,
      'fm': 57,
      'hb': 58,
      'tg': 59,
      '1pe': 60,
      '2pe': 61,
      '1jo': 62,
      '2jo': 63,
      '3jo': 64,
      'jd': 65,
      'ap': 66,
    };
    if (aliases.containsKey(name)) {
      return fromId('${aliases[name]}:${m[2]}:${m[3] ?? 1}');
    }
    final matches = <int>{}, near = <int, int>{};
    for (var b = 0; b < 66; b++) {
      for (final a in [osisBooks[b], booksPt[b], booksEn[b], booksEs[b]]) {
        final n = fold(a).replaceAll(RegExp(r'[.\s]'), '');
        if (n == name || (name.length >= 2 && n.startsWith(name))) {
          matches.add(b + 1);
        }
        if (name.length >= 4) {
          final d = editDistance(n, name);
          if (d <= 2) near[b + 1] = math.min(near[b + 1] ?? 99, d);
        }
      }
    }
    if (matches.isEmpty && near.isNotEmpty) {
      final best = near.values.reduce(math.min);
      matches.addAll(near.keys.where((b) => near[b] == best));
    }
    if (matches.length != 1) return null;
    return fromId('${matches.single}:${m[2]}:${m[3] ?? 1}');
  }

  @override
  int compareTo(Reference other) => key.compareTo(other.key);
}

class ReviewSchedule {
  final int repetitions, interval, due;
  final double ease;
  const ReviewSchedule({
    this.repetitions = 0,
    this.interval = 0,
    this.ease = 2.5,
    this.due = 0,
  });
  ReviewSchedule review(int grade, DateTime now) {
    if (grade < 0 || grade > 5) throw ArgumentError.value(grade);
    final e = math.max(
      1.3,
      ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02),
    );
    final reps = grade < 3 ? 0 : repetitions + 1;
    final days = grade < 3
        ? 1
        : repetitions == 0
        ? 1
        : repetitions == 1
        ? 6
        : math.max(1, (interval * ease).round());
    return ReviewSchedule(
      repetitions: reps,
      interval: days,
      ease: e,
      due: DateTime(now.year, now.month, now.day + days).millisecondsSinceEpoch,
    );
  }
}

int historicalYear(int year) {
  if (year == 0) throw ArgumentError('No year zero');
  return year < 0 ? year + 1 : year;
}

(int, int)? historicalInterval(int? aStart, int? aEnd, int? bStart, int? bEnd) {
  if ([aStart, aEnd, bStart, bEnd].any((v) => v == null)) return null;
  final a = historicalYear(aStart!),
      b = historicalYear(aEnd!),
      c = historicalYear(bStart!),
      d = historicalYear(bEnd!);
  if (a > b || c > d) throw ArgumentError('Reversed interval');
  return (
    (a <= d && c <= b) ? 0 : math.min((c - b).abs(), (a - d).abs()),
    math.max((d - a).abs(), (c - b).abs()),
  );
}

double geographicDistance(double a, double b, double c, double d) {
  double r(double n) => n * math.pi / 180;
  final h =
      math.pow(math.sin(r(c - a) / 2), 2) +
      math.cos(r(a)) * math.cos(r(c)) * math.pow(math.sin(r(d - b) / 2), 2);
  return 6371.0088 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
}

import 'domain.dart';

const _abbreviations = [
  'Gn',
  'Ex',
  'Lv',
  'Nm',
  'Dt',
  'Js',
  'Jz',
  'Rt',
  '1Sm',
  '2Sm',
  '1Rs',
  '2Rs',
  '1Cr',
  '2Cr',
  'Ed',
  'Ne',
  'Et',
  'Jo',
  'Sl',
  'Pv',
  'Ec',
  'Ct',
  'Is',
  'Jr',
  'Lm',
  'Ez',
  'Dn',
  'Os',
  'Jl',
  'Am',
  'Ob',
  'Jn',
  'Mq',
  'Na',
  'Hc',
  'Sf',
  'Ag',
  'Zc',
  'Ml',
  'Mt',
  'Mc',
  'Lc',
  'João',
  'At',
  'Rm',
  '1Co',
  '2Co',
  'Gl',
  'Ef',
  'Fp',
  'Cl',
  '1Ts',
  '2Ts',
  '1Tm',
  '2Tm',
  'Tt',
  'Fm',
  'Hb',
  'Tg',
  '1Pe',
  '2Pe',
  '1Jo',
  '2Jo',
  '3Jo',
  'Jd',
  'Ap',
];

final _referencePattern = _buildReferencePattern();
RegExp _buildReferencePattern() {
  final names = {
    ...booksPt,
    ...booksEn,
    ...booksEs,
    ...osisBooks,
    ..._abbreviations,
  }.toList()..sort((a, b) => b.length.compareTo(a.length));
  return RegExp(
    '(^|[\\s(;,>*_#])(${names.map(RegExp.escape).join('|')})(?:\\.)?\\s*(\\d{1,3})[:.](\\d{1,3})(?:\\s*[-–]\\s*(?:(\\d{1,3})[:.])?(\\d{1,3}))?',
    caseSensitive: false,
    multiLine: true,
  );
}

/// Add navigation to ordinary citations while preserving authored links and code.
String linkScriptureReferences(String input) {
  final held = <String>[];
  String hold(Match m) {
    held.add(m[0]!);
    return '\uE000${held.length - 1}\uE001';
  }

  var text = input.replaceAllMapped(
    RegExp(r'```[\s\S]*?```|`[^`\n]*`|\[\[[^\]]+\]\]|\[[^\]\n]+\]\([^\)\n]+\)'),
    hold,
  );
  text = text.replaceAllMapped(_referencePattern, (m) {
    final label = m[0]!.substring(m[1]!.length);
    final start = Reference.parse('${m[2]} ${m[3]}:${m[4]}');
    if (start == null) return m[0]!;
    final end = m[6] == null
        ? null
        : Reference(start.book, int.parse(m[5] ?? m[3]!), int.parse(m[6]!));
    final address = end == null ? start.id : '${start.id}..${end.id}';
    return '${m[1]}[$label](biblia:${Uri.encodeComponent(address)})';
  });
  text = text.replaceAllMapped(
    RegExp(
      r'\b(CFW|WCF|BCW|WSC|CMW|WLC)\s*(\d{1,3})(?:[.:]\d+)?',
      caseSensitive: false,
    ),
    (m) {
      final code =
          {'CFW': 'WCF', 'BCW': 'WSC', 'CMW': 'WLC'}[m[1]!.toUpperCase()] ??
          m[1]!.toUpperCase();
      return '[${m[0]}](confession:$code:${m[2]})';
    },
  );
  return text.replaceAllMapped(
    RegExp('\uE000(\\d+)\uE001'),
    (m) => held[int.parse(m[1]!)],
  );
}

List<Reference> linkedReferences(String text) {
  final result = <String, Reference>{};
  final linked = linkScriptureReferences(text);
  for (final match in RegExp(r'\]\(biblia:([^\)]+)\)').allMatches(linked)) {
    final target = Uri.decodeComponent(match[1]!);
    for (final item in target.split('..')) {
      final reference = Reference.parse(item);
      if (reference != null) result[reference.id] = reference;
    }
  }
  return result.values.toList();
}

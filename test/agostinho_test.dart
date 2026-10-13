import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Confissoes de Agostinho incluem 13 livros e capitulos completos', () {
    final data = jsonDecode(
      File('assets/content/agostinho-confissoes-facil.json')
          .readAsStringSync(),
    ) as Map<String, dynamic>;
    final books = data['books'] as List;
    expect(books.length, 13);
    expect(data['type'], 'adaptacao_didatica');
    expect((data['notice'] as String).toLowerCase(),
        contains('não é a tradução integral'));

    var readings = 0;
    for (var number = 1; number <= 13; number++) {
      final book = books[number - 1] as Map<String, dynamic>;
      expect(book['number'], number);
      final sections = book['sections'] as List;
      expect(sections, isNotEmpty);
      var nextChapter = 1;
      for (final raw in sections) {
        final section = raw as Map<String, dynamic>;
        expect(section['from'], nextChapter);
        expect(section['to'] as int, greaterThanOrEqualTo(nextChapter));
        expect((section['title'] as String).trim().length, greaterThan(5));
        expect((section['body'] as String).trim().length, greaterThan(200));
        nextChapter = (section['to'] as int) + 1;
        readings++;
      }
      expect(nextChapter, (book['chapterCount'] as int) + 1);
    }
    expect(readings, 52);
  });
}

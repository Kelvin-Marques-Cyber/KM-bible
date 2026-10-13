import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Agostinho: indice dos 13 livros e 278 capitulos integrais', () {
    final source = File('assets/content/agostinho-confissoes-facil.json')
        .readAsStringSync();
    final data = jsonDecode(source) as Map<String, dynamic>;
    final books = data['books'] as List;
    expect(books.length, 13);
    expect(data['type'], 'indice_texto_integral_externo');
    expect((data['source'] as String), startsWith('https://'));
    expect((data['notice'] as String).toLowerCase(),
        contains('não há resumos'));

    var chapterCount = 0;
    for (var number = 1; number <= books.length; number++) {
      final book = books[number - 1] as Map<String, dynamic>;
      expect(book['number'], number);
      expect((book['title'] as String).trim(), isNotEmpty);
      final chapters = book['chapterCount'] as int;
      expect(chapters, greaterThan(0));
      chapterCount += chapters;
      expect(book.containsKey('sections'), isFalse,
          reason: 'O indice nao pode conter antigos resumos.');
    }
    expect(chapterCount, 278);
  });
}

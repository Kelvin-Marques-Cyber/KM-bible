import { describe, expect, it } from 'vitest';
import {
  editDistance,
  fnv1a,
  fold,
  fromId,
  geographicDistance,
  historicalInterval,
  keyToRef,
  parseRef,
  ref,
  refKey,
  refLabel,
  review,
  tokenize,
  uuid,
  yearLabel,
} from '../../src/lib/domain';
import { linkScriptureReferences, linkedReferences, referencesIn, wikiTargets } from '../../src/lib/scripture';

describe('referências', () => {
  it('interpreta nomes, abreviações e identificadores', () => {
    expect(parseRef('João 3:16')).toEqual(ref(43, 3, 16));
    expect(parseRef('Jo 3.16')).toEqual(ref(43, 3, 16));
    expect(parseRef('Rm 8')).toEqual(ref(45, 8, 1));
    expect(parseRef('43:3:16')).toEqual(ref(43, 3, 16));
    expect(parseRef('Jó 1:1')).toEqual(ref(18, 1, 1));
    expect(parseRef('1 Coríntios 13:4')).toEqual(ref(46, 13, 4));
    expect(parseRef('Genesis 1:1')).toEqual(ref(1, 1, 1));
    expect(parseRef('Apocalipse 22:21')).toEqual(ref(66, 22, 21));
  });

  it('tolera pequenos erros de digitação e recusa ambiguidades', () => {
    expect(parseRef('Romnos 8:1')).toEqual(ref(45, 8, 1));
    expect(parseRef('xyz 1:1')).toBeNull();
    expect(parseRef('')).toBeNull();
  });

  it('valida limites de identificadores', () => {
    expect(fromId('67:1:1')).toBeNull();
    expect(fromId('1:0:1')).toBeNull();
    expect(fromId('1:1:1')).toEqual(ref(1, 1, 1));
    expect(fromId(undefined)).toBeNull();
  });

  it('converte chave numérica nos dois sentidos', () => {
    const r = ref(19, 119, 176);
    expect(keyToRef(refKey(r))).toEqual(r);
    expect(refLabel(ref(43, 3, 16))).toBe('João 3:16');
  });
});

describe('texto', () => {
  it('remove acentos e tokeniza como o índice em Python', () => {
    expect(fold('  Êxodo ')).toBe('exodo');
    expect(tokenize('Graça, fé e Cristo — 2025!')).toEqual(['graca', 'fe', 'e', 'cristo', '2025']);
    expect(tokenize('número 123456')).toEqual(['numero']);
  });

  it('calcula distância de edição', () => {
    expect(editDistance('graca', 'graça')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });

  it('fnv1a é estável (mesmo valor do script de dados)', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
  });

  it('uuid tem formato v4', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('revisão espaçada (SM-2)', () => {
  const now = new Date(2025, 0, 10, 15, 0);
  it('reinicia em respostas ruins e cresce nas boas', () => {
    const start = { repetitions: 0, interval: 0, ease: 2.5, due: 0 };
    const first = review(start, 5, now);
    expect(first.repetitions).toBe(1);
    expect(first.interval).toBe(1);
    const second = review(first, 4, now);
    expect(second.interval).toBe(6);
    const third = review(second, 4, now);
    expect(third.interval).toBe(Math.round(6 * second.ease));
    const failed = review(third, 1, now);
    expect(failed.repetitions).toBe(0);
    expect(failed.interval).toBe(1);
    expect(failed.ease).toBeGreaterThanOrEqual(1.3);
  });
  it('recusa notas fora de 0..5', () => {
    expect(() => review({ repetitions: 0, interval: 0, ease: 2.5, due: 0 }, 6, now)).toThrow(RangeError);
  });
});

describe('história e geografia', () => {
  it('não existe ano zero', () => {
    expect(historicalInterval(-1, -1, 1, 1)).toEqual([1, 1]);
    expect(historicalInterval(-10, 10, 5, 20)).toEqual([0, 29]);
    expect(historicalInterval(null, 1, 1, 1)).toBeNull();
    expect(yearLabel(-586)).toBe('586 a.C.');
    expect(yearLabel(null)).toBe('Data não estabelecida');
  });
  it('distância Jerusalém–Belém ≈ 9 km', () => {
    const d = geographicDistance(31.7683, 35.2137, 31.7054, 35.2024);
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(9);
  });
});

describe('links de Escritura', () => {
  it('transforma citações em links e preserva código e links existentes', () => {
    const out = linkScriptureReferences('Veja Rm 8:28-30 e `Jo 3:16` e [Gn 1:1](biblia:1:1:1).');
    expect(out).toContain('[Rm 8:28-30](biblia:45%3A8%3A28..45%3A8%3A30)');
    expect(out).toContain('`Jo 3:16`');
    expect(out).toContain('[Gn 1:1](biblia:1:1:1)');
  });
  it('liga referências confessionais', () => {
    expect(linkScriptureReferences('CFW 1.6')).toBe('[CFW 1.6](confession:WCF:1)');
  });
  it('extrai referências de textos e notas', () => {
    expect(linkedReferences('Leia João 3:16.')).toEqual([ref(43, 3, 16)]);
    expect(referencesIn('cf. Rm 5:1 e Ef 2:8')).toEqual([ref(45, 5, 1), ref(49, 2, 8)]);
    expect(wikiTargets('[[João 1:1]] [[note:abc]] [[Tema]]')).toEqual([
      { target: '43:1:1', kind: 'biblical' },
      { target: 'abc', kind: 'personal' },
      { target: 'Tema', kind: 'personal' },
    ]);
  });
});

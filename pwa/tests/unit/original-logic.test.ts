import { describe, expect, it } from 'vitest';
import {
  foldOriginal, isOshbCode, lexBucket, matchTier, morphology,
  rankKeys, rankMorphCodes, indexKey,
} from '../../src/lib/original-logic';

describe('Idioma original: normalização e análise morfológica', () => {
  it('normaliza sinais vocálicos e formas finais sem perder letras', () => {
    expect(foldOriginal('בְּרֵאשִׁית')).toBe(foldOriginal('בראשית'));
    expect(foldOriginal('λόγος')).toBe(foldOriginal('λογος'));
    expect(foldOriginal('מֶלֶךְ')).toBe('מלכ');
  });

  it('não confunde código de adjetivo grego com aramaico OSHB', () => {
    expect(isOshbCode('HNm')).toBe(true);
    expect(isOshbCode('A-ASM')).toBe(false);
    expect(isOshbCode('ADV')).toBe(false);
    expect(morphology('V-PAI-3S')).toContain('presente');
    expect(morphology('V-PAI-3S')).toContain('indicativo');
  });

  it('mantém baldes Strong previsíveis e ranqueia campos de forma exata', () => {
    expect(lexBucket('G3056')).toBe('G12');
    expect(lexBucket('H7225')).toBe('H28');
    expect(matchTier('logos\u0001logos', 'logos')).toBe(0);
    expect(matchTier('logos\u0001logos', 'log')).toBe(1);
    expect(matchTier('logos\u0001logos', 'ogo')).toBe(2);
    expect(matchTier('logos\u0001logos', 'xyz')).toBe(-1);
  });

  it('ordena correspondências exatas, prefixos e subtokens', async () => {
    const keys = ['teologia', 'λόγος', 'λογισμός', 'λόγος'].map(foldOriginal);
    const found = await rankKeys(keys, foldOriginal('λόγος'), 4);
    expect(found.total).toBe(2);
    expect(found.indices).toEqual([1, 3]);
    expect(indexKey('lexemes', ['G3056', 'λόγος', 'logos', 'palavra'])).toContain(foldOriginal('λόγος'));
  });

  it('prioriza códigos morfológicos exatos antes dos parciais', () => {
    const result = rankMorphCodes([['V-PAI-3S', 4], ['N-NSM', 6], ['V-PAI', 2]], 'V-PAI');
    expect(result.codes.map(([code]) => code)).toEqual(['V-PAI', 'V-PAI-3S']);
    expect(result.corpus).toBe(6);
  });
});

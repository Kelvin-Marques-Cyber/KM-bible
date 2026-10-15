// Garante 30 argumentações próprias, 7.000+ caracteres por tradição e arte
// contextual empacotada localmente. release.sh gera dados ANTES dos testes.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '..');
const data = resolve(process.cwd(), 'public/data/v1');
const editorial = JSON.parse(readFileSync(resolve(root, 'assets/content/apologetica-editorial.json'), 'utf8')) as {
  profiles: Record<string, { lead: string; axes: string[]; visual: [string, string, string] }>;
};
const targets = Object.keys(editorial.profiles);

describe('Dossiês reformados específicos', () => {
  it('cobre 30 tradições com 240 eixos distintos de análise', () => {
    expect(targets).toHaveLength(30);
    const all = new Set<string>();
    for (const [target, profile] of Object.entries(editorial.profiles)) {
      expect(profile.lead.length, target).toBeGreaterThan(120);
      expect(profile.axes, target).toHaveLength(8);
      expect(profile.visual, target).toHaveLength(3);
      for (const axis of profile.axes) {
        expect(axis.length, target).toBeGreaterThan(70);
        expect(all.has(axis), target).toBe(false);
        all.add(axis);
      }
    }
    expect(all.size).toBe(240);
  });

  it('substitui os 30 dossiês antigos por textos completos e diferentes', () => {
    const texts = new Set<string>();
    for (const [target, profile] of Object.entries(editorial.profiles)) {
      const path = resolve(root, 'assets/apologetica_reformada', target + '.md');
      expect(existsSync(path), 'Prepare o acervo antes dos testes: ' + target).toBe(true);
      const body = readFileSync(path, 'utf8');
      expect(body.length, target).toBeGreaterThanOrEqual(7000);
      expect(body.split('\n## ').length, target).toBeGreaterThanOrEqual(11);
      for (const axis of profile.axes) expect(body.includes(axis), target).toBe(true);
      expect(texts.has(body), target).toBe(false);
      texts.add(body);
    }
  });

  it('disponibiliza ilustrações offline nos mesmos pacotes dos dossiês', () => {
    const catalogue = JSON.parse(readFileSync(resolve(data, 'catalog.json'), 'utf8'));
    const pack = catalogue.apologetica as { path: string; visuals: Record<string, { path: string; alt: string; credit: string; caption: string; photo?: { source: string } }> };
    expect(Object.keys(pack.visuals)).toHaveLength(30);
    for (const target of targets) {
      const visual = pack.visuals[target];
      expect(visual.alt).toMatch(/não fotografia/);
      expect(visual.credit.length).toBeGreaterThan(10);
      const path = resolve(data, pack.path, visual.path);
      expect(existsSync(path), target).toBe(true);
      const svg = readFileSync(path, 'utf8');
      expect(svg).toContain('<svg ');
      expect(svg).toContain('</svg>');
      expect(svg).not.toMatch(/<image\s/);
    }
    expect(pack.visuals.roman_catholic.photo?.source).toContain('commons.wikimedia.org');
  });
});

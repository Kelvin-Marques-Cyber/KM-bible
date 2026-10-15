// lib/search.ts: disposição dos índices a partir do catálogo, anotações e a
// pesquisa completa (sem Worker no jsdom: roda o mesmo núcleo na thread
// principal) sobre o acervo real de public/data/v1, inclusive sem conexão.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../src/lib/catalog';
import {
  buildRequest,
  categoryLabel,
  commentarySegments,
  generalSegments,
  parseQuery,
  searchNotes,
  sourceLabel,
  startSearch,
  type SearchState,
} from '../../src/lib/search';
import { deleteNote, notes, saveNote, setPref } from '../../src/lib/store';

const dataDir = `${resolve(process.cwd(), 'public/data/v1')}/`;
const hasData = existsSync(`${dataDir}search/general/p`) && existsSync(`${dataDir}bible/ARA/1.json`);
/** Prefixos (relativos a data/v1) que simulam falta de conexão. */
const offline: string[] = [];
const requested: string[] = [];

beforeAll(() => {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname.replace(/^.*\/data\/v1\//, ''));
    requested.push(path);
    if (offline.some((p) => path.startsWith(p))) throw new TypeError('Failed to fetch');
    try {
      const body = await readFile(dataDir + path, 'utf8');
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    } catch {
      return new Response('', { status: 404 });
    }
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  offline.length = 0;
  requested.length = 0;
});

function search(text: string, translation = 'ARA', deep = false): Promise<SearchState> {
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('tempo esgotado')), 60_000);
    startSearch(text, { translation, deep }, (state) => {
      if (state.loading) return;
      clearTimeout(timer);
      done(state);
    });
  });
}

describe('rótulos', () => {
  it('nomes legíveis das categorias em português', () => {
    expect(['bible', 'commentary', 'notes', 'topic', 'lexicon', 'studies', 'confession', 'document', 'place', 'history', 'model_index', 'study'].map(categoryLabel)).toEqual([
      'Bíblia',
      'Comentários',
      'Anotações',
      'Temas',
      'Léxico',
      'Estudos',
      'Confissões',
      'Documentos',
      'Lugares',
      'Acontecimentos',
      'Modelos 3D',
      'Estudos editoriais',
    ]);
  });

  it('mostra o título do módulo como fonte de documentos e comentários', () => {
    const hit = { key: 'confession:x', category: 'confession', id: 'x', title: '', body: '', source: 'WCF', reference: '', titleMatch: false };
    expect(sourceLabel(hit)).toBe(catalog.modules.find((m) => m.id === 'WCF')?.title ?? 'WCF');
    expect(sourceLabel({ ...hit, category: 'bible', source: 'ARA' })).toBe('ARA');
  });
});

describe('disposição dos índices (catálogo)', () => {
  it('search/general: temas, documentos por módulo, estudos e léxico somam todos os registros', () => {
    const segments = generalSegments(new Set(Object.keys(catalog.docs.modules)));
    expect(segments).not.toBeNull();
    expect(segments![0]).toMatchObject({ start: 0, group: 'topic' });
    expect(segments![segments!.length - 1]).toMatchObject({ end: catalog.search.general.records, group: 'lexicon' });
    for (let i = 1; i < segments!.length; i++) expect(segments![i].start).toBe(segments![i - 1].end);
    expect(segments!.filter((s) => s.group === 'documents').map((s) => s.module)).toEqual(Object.keys(catalog.docs.modules));
  });

  it('search/comm: um intervalo por módulo de comentário; desinstalados ficam marcados', () => {
    const first = Object.keys(catalog.commentaries)[0];
    const segments = commentarySegments(new Set(Object.keys(catalog.commentaries).filter((id) => id !== first)));
    expect(segments).not.toBeNull();
    expect(segments!.reduce((n, s) => n + s.end - s.start, 0)).toBe(catalog.search.commentary.records);
    expect(segments!.find((s) => s.module === first)?.allowed).toBe(false);
  });

  it('módulos desativados pelo usuário saem da pesquisa', async () => {
    await setPref('disabled_modules', ['WCF'], false);
    try {
      const request = buildRequest('graça', 'ARA');
      const general = request.indexes.find((i) => i.name === 'general')!;
      expect(general.allowed).not.toContain('WCF');
      expect(general.segments?.find((s) => s.module === 'WCF')?.allowed).toBe(false);
      expect(request.bible?.kind).toBe('urls');
      if (request.bible?.kind === 'urls') expect(request.bible.urls[0]).toMatch(/\/data\/v1\/bible\/ARA\/1\.json\?v=/);
    } finally {
      await setPref('disabled_modules', [], false);
    }
  });
});

describe('anotações (note_search)', () => {
  it('casa título, corpo e etiquetas sem acentos; até 40', async () => {
    const created: string[] = [];
    created.push(await saveNote({ title: 'Estudo sobre a Graça', body: 'Efésios 2', tags: '' }, false));
    created.push(await saveNote({ title: 'Outro', body: 'Texto qualquer', tags: 'graca soberana' }, false));
    created.push(await saveNote({ title: 'Sem relação', body: 'Nada aqui', tags: '' }, false));
    for (let i = 0; i < 45; i++) created.push(await saveNote({ title: `Lote ${i}`, body: 'misericórdia', tags: '' }, false));
    try {
      const hits = await searchNotes(parseQuery('graça'));
      expect(hits!.map((h) => h.title).sort()).toEqual(['Estudo sobre a Graça', 'Outro']);
      expect(hits![0]).toMatchObject({ category: 'notes', source: 'Estudos' });
      expect((await searchNotes(parseQuery('misericordia')))!.length).toBe(40);
      expect((await searchNotes(parseQuery('graca sober')))!.map((h) => h.title)).toEqual(['Outro']);
    } finally {
      for (const id of created) await deleteNote(id);
    }
    expect(await notes()).toEqual([]);
  });
});

describe.skipIf(!hasData)('pesquisa completa sobre o acervo publicado', () => {
  it('encontra temas, versículos, documentos e comentários (sem repetições)', async () => {
    const state = await search('graça');
    expect(state.failed).toBeNull();
    expect(state.errors).toEqual([]);
    const categories = new Set(state.hits.map((h) => h.category));
    for (const c of ['topic', 'bible', 'commentary']) expect(categories.has(c)).toBe(true);
    expect(new Set(state.hits.map((h) => h.key)).size).toBe(state.hits.length);
    const bible = state.hits.filter((h) => h.category === 'bible');
    expect(bible.length).toBeLessThanOrEqual(60);
    expect(bible[0].source).toBe('ARA');
    // Ordem canônica.
    const keys = bible.map((h) => h.id.split(':').map(Number)).map(([b, c, v]) => b * 1e6 + c * 1e3 + v);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
    // Temas com "graça" no título vêm primeiro.
    const topics = state.hits.filter((h) => h.category === 'topic');
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.length).toBeLessThanOrEqual(30);
    expect(topics[0].titleMatch).toBe(true);
    expect(state.bible).toMatchObject({ translation: 'ARA', missing: 0, offline: false });
  }, 60_000);

  it('sugere a grafia de uma palavra da Bíblia e reconhece prefixo', async () => {
    const typo = await search('pricipio');
    expect(typo.suggestion).toBe('principio');
    const prefix = await search('princip');
    expect(prefix.hits.some((h) => h.category === 'bible')).toBe(true);
    expect(prefix.suggestion).toBeNull();
  }, 60_000);

  it('comentários só de módulos instalados', async () => {
    const off = Object.keys(catalog.commentaries).find((id) => id === 'Barnes') ?? Object.keys(catalog.commentaries)[0];
    await setPref('disabled_modules', [off], false);
    try {
      const state = await search('justificação fé');
      expect(state.hits.filter((h) => h.category === 'commentary').every((h) => h.source !== off)).toBe(true);
    } finally {
      await setPref('disabled_modules', [], false);
    }
  }, 60_000);

  it('sem conexão para os comentários: avisa e mostra o restante', async () => {
    offline.push('search/comm/');
    const state = await search('redenção sangue');
    expect(state.offline).toBe(true);
    expect(state.failed).toBeNull();
    expect(state.hits.some((h) => h.category === 'commentary')).toBe(false);
    expect(state.hits.length).toBeGreaterThan(0);
  }, 60_000);

  it('cancelar descarta a consulta antiga', async () => {
    const updates: SearchState[] = [];
    const cancel = startSearch('cordeiro', { translation: 'ARA' }, (s) => updates.push(s));
    cancel();
    await new Promise((r) => setTimeout(r, 400));
    expect(updates).toEqual([]);
  });
});

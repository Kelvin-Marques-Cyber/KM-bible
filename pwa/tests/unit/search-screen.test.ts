// Teste de fumaça da SearchPage com o acervo real de public/data/v1 (fetch
// servido do disco; sem Worker no jsdom, o núcleo roda na thread principal).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { app, sheets } from '../../src/lib/app';
import { hitTitle } from '../../src/lib/search';
import { deleteNote, saveNote } from '../../src/lib/store';
import SearchPage from '../../src/screens/Search';

const dataDir = `${resolve(process.cwd(), 'public/data/v1')}/`;
const hasData = existsSync(`${dataDir}search/general/p`) && existsSync(`${dataDir}bible/ARA/1.json`);

// O jsdom não calcula dimensões; o virtualizador precisa de uma área rolável de celular.
const originalBounds = HTMLElement.prototype.getBoundingClientRect;
const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname.replace(/^.*\/data\/v1\//, ''));
    try {
      const body = await readFile(dataDir + path, 'utf8');
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    } catch {
      return new Response('', { status: 404 });
    }
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('scroll-area')) {
      return { x: 0, y: 0, top: 0, left: 0, right: 360, bottom: 800, width: 360, height: 800, toJSON: () => ({}) };
    }
    return originalBounds.call(this);
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList.contains('scroll-area')) return 800;
      if (this.hasAttribute('data-index')) return 96;
      return originalHeight?.get?.call(this) ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList.contains('scroll-area')) return 360;
      return originalWidth?.get?.call(this) ?? 0;
    },
  });
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalBounds;
  if (originalHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalHeight);
  if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalWidth);
  vi.unstubAllGlobals();
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  sheets.length = 0;
});

function render(): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(createElement(SearchPage)));
  return host;
}

async function until(check: () => boolean, timeout = 30_000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Tempo esgotado. Conteúdo: ${host?.textContent?.slice(0, 800)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
}

function type(value: string) {
  const input = host!.querySelector('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const buttons = () => [...host!.querySelectorAll('button')];
const button = (match: (b: HTMLButtonElement) => boolean) => {
  const found = buttons().find(match);
  if (!found) throw new Error(`Botão não encontrado. Conteúdo: ${host?.textContent?.slice(0, 600)}`);
  return found;
};
const click = (element: HTMLElement) => act(() => element.click());
const results = () => [...host!.querySelectorAll<HTMLButtonElement>('button[data-result]')];
/** Região aria-live com o resumo (só mostra a contagem quando todas as seções terminaram). */
const status = () => host!.querySelector('[role=status]')?.textContent ?? '';

describe('hitTitle', () => {
  it('troca títulos de comentário que são só identificadores pela referência legível', () => {
    const hit = { key: 'commentary:x', category: 'commentary', id: 'x', title: '40:1:22 · 40:1:22', body: '', source: 'Barnes', reference: '40:1:22', titleMatch: false };
    expect(hitTitle(hit, 'pt')).toBe('Mateus 1:22');
    expect(hitTitle({ ...hit, title: '1:6:1 · 1:6:7', reference: '1:6:1' }, 'pt')).toBe('Gênesis 6:1–7');
    expect(hitTitle({ ...hit, title: '1:6:12 — 1:7:3', reference: '1:6:12' }, 'en')).toBe('Genesis 6:12–7:3');
    expect(hitTitle({ ...hit, title: 'A graça de Deus' })).toBe('A graça de Deus');
    expect(hitTitle({ ...hit, category: 'topic', title: '' })).toBe('x');
  });
});

describe.skipIf(!hasData)('SearchPage', () => {
  it('pesquisa com debounce, filtra por categoria, destaca termos e abre resultados', async () => {
    app.translation = 'ARA';
    const noteId = await saveNote({ title: 'Minha nota sobre a graça', body: 'Efésios 2:8', tags: '' }, false);
    try {
      const view = render();
      expect(document.activeElement).toBe(view.querySelector('input'));
      type('graça');
      await until(() => /^\d+ resultados$/.test(status()));
      expect(results().length).toBeGreaterThan(0);
      // Chips: Todos + categorias presentes, com rótulos legíveis.
      const chips = buttons().filter((b) => b.hasAttribute('aria-pressed'));
      const labels = chips.map((b) => b.textContent!.replace(/\s*\d+$/, ''));
      expect(labels[0]).toBe('Todos');
      for (const label of ['Temas', 'Bíblia', 'Anotações', 'Comentários']) expect(labels).toContain(label);
      expect(view.querySelector('mark')?.textContent?.toLowerCase()).toMatch(/gra[cç]a/);
      expect(view.textContent).toContain('Temas · ');

      // Filtro.
      click(chips.find((b) => b.textContent!.startsWith('Anotações'))!);
      await until(() => results().length === 1);
      expect(results()[0].textContent).toContain('Minha nota sobre a graça');
      click(results()[0]);
      await until(() => sheets.length === 1);
      expect(sheets[0].title).toBe('Minha nota sobre a graça');
      sheets.length = 0;

      click(button((b) => b.textContent!.startsWith('Temas')));
      await until(() => results().length > 0 && results().every((r) => r.textContent!.includes('Temas · ')));
      const first = results()[0];
      const title = first.querySelector('span span')!.textContent!;
      click(first);
      expect(sheets.length).toBe(1);
      expect(sheets[0].title).toBe(title);
      sheets.length = 0;

      click(button((b) => b.textContent!.startsWith('Bíblia')));
      await until(() => results().length > 0 && results().every((r) => r.textContent!.includes('Bíblia · ARA')));
      click(results()[0]);
      expect(sheets.length).toBe(1);
      sheets.length = 0;

      // Limpar volta ao estado inicial.
      click(button((b) => b.getAttribute('aria-label') === 'Limpar pesquisa'));
      await until(() => results().length === 0);
      expect(view.querySelector('input')!.value).toBe('');
    } finally {
      await deleteNote(noteId);
    }
  }, 60_000);

  it('reconhece referências e sugere a grafia', async () => {
    app.translation = 'ARA';
    const view = render();
    type('João 3:16');
    await until(() => !!host!.querySelector('button[data-reference]'));
    const reference = host!.querySelector<HTMLButtonElement>('button[data-reference]')!;
    expect(reference.textContent).toBe('João 3:16');
    click(reference);
    expect(sheets.map((s) => s.title)).toEqual(['João 3:16']);
    sheets.length = 0;

    type('pricipio');
    const suggestion = await (async () => {
      await until(() => buttons().some((b) => b.textContent === 'Pesquisar: principio'));
      return button((b) => b.textContent === 'Pesquisar: principio');
    })();
    click(suggestion);
    expect(view.querySelector('input')!.value).toBe('principio');
    await until(() => results().length > 0);
  }, 60_000);

  it('mostra "Nenhum item encontrado." quando nada corresponde', async () => {
    app.translation = 'ARA';
    const view = render();
    type('xqzwv');
    await until(() => view.textContent!.includes('Nenhum item encontrado.'));
    expect(results().length).toBe(0);
  }, 60_000);
});

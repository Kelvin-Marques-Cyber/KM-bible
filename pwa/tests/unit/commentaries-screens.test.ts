// Teste de fumaça das telas de comentários, comparação, referências cruzadas e
// lugares salvos com o acervo real de public/data/v1 (fetch servido do disco).
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/lib/app';
import { ref } from '../../src/lib/domain';
import { savePlace } from '../../src/lib/store';
import CommentariesPage from '../../src/screens/Commentaries';
import ComparisonPage from '../../src/screens/Comparison';
import CrossReferencesPage from '../../src/screens/CrossReferences';
import SavedPlacesPage from '../../src/screens/SavedPlaces';

const dataDir = `${resolve(process.cwd(), 'public/data/v1')}/`;
/** Caminhos (relativos a data/v1) que simulam falta de conexão. */
const offline = new Set<string>();

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname.replace(/^.*\/data\/v1\//, ''));
    if (offline.has(path)) throw new TypeError('Failed to fetch');
    try {
      const body = await readFile(dataDir + path, 'utf8');
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    } catch {
      return new Response('', { status: 404 });
    }
  });
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  offline.clear();
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(element: ReactElement): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}

async function until(check: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Tempo esgotado. Conteúdo: ${host?.textContent?.slice(0, 600)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
}

const click = (element: Element | null | undefined) => {
  if (!element) throw new Error('Elemento não encontrado');
  act(() => (element as HTMLElement).click());
};
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));

/** Entradas do arquivo bruto que cobrem o versículo e não têm tradução em português. */
async function untranslated(module: string, book: number, chapter: number, verse: number): Promise<number> {
  const rows = JSON.parse(await readFile(`${dataDir}comm/${module}/${book}/${chapter}.json`, 'utf8')) as unknown[][];
  const key = book * 1_000_000 + chapter * 1000 + verse;
  return rows.filter((r) => (r[1] as number) <= key && (r[2] as number) >= key && !String(r[8] ?? '').trim()).length;
}

describe('CommentariesPage', () => {
  it('shows Portuguese entries first and English originals on demand', async () => {
    app.translation = 'BLN4';
    // Barnes ainda não tem tradução de estudo neste versículo; o teste se adapta se o acervo mudar.
    const englishOnly = await untranslated('Barnes', 43, 3, 1);
    const view = render(createElement(CommentariesPage, { reference: ref(43, 3, 1) }));
    await until(() => view.querySelectorAll('article').length > 0);
    const text = view.textContent ?? '';
    expect(text).toContain('Endereços numéricos não garantem equivalência textual');
    expect(text).toContain('João 3:1');
    expect(text).toContain('Guias de leitura e referências');
    expect(text).toContain('Os comentários integrais de Hernandes Dias Lopes ainda não constam desta edição');
    expect(text).toContain('Português (tradução de estudo)');
    // Na interface em português, só entradas em português ou com tradução de estudo.
    const headers = () => [...view.querySelectorAll('article h3')].map((h) => h.textContent ?? '');
    expect(headers().every((h) => /Português \(tradução de estudo\)$|· pt/.test(h))).toBe(true);
    if (englishOnly > 0) expect(text).not.toContain('Albert Barnes');
    const before = view.querySelectorAll('article').length;

    // Guias de leitura listam os módulos instalados.
    click(button(view, 'Guias de leitura e referências'));
    expect(view.textContent).toContain('Guia de leitura · Hernandes Dias Lopes (não oficial)');
    expect(view.textContent).toContain('Guia de leitura · Josemar Bessa (não oficial)');
    expect(view.textContent).toContain('Devocionais diários');

    // Originais em inglês: entradas sem tradução aparecem recolhidas.
    click(view.querySelector('input[role=switch]'));
    if (englishOnly > 0) {
      await until(() => view.querySelectorAll('article').length > before);
      expect(view.textContent).toContain('Texto original em inglês');
      expect(view.textContent).toContain('Albert Barnes · en');
    }

    // Filtro por autor.
    click(button(view, 'Matthew Henry'));
    const authors = headers();
    expect(authors.length).toBeGreaterThan(0);
    expect(authors.every((a) => a.startsWith('Matthew Henry'))).toBe(true);
  });

  it('keeps the other commentators when one pack is unavailable offline', async () => {
    app.translation = 'BLN4';
    offline.add('comm/CalvinCommentaries/45/8.json');
    const view = render(createElement(CommentariesPage, { reference: ref(45, 8, 28) }));
    await until(() => view.querySelector('[role=alert]') !== null);
    expect(view.querySelector('[role=alert]')?.textContent).toContain('João Calvino — comentários reunidos');
    expect(view.querySelectorAll('article').length).toBeGreaterThan(0);
    expect(view.textContent).toContain('Matthew Henry');
    // Ao reconectar, "Tentar novamente" recarrega só o que faltava.
    offline.clear();
    click(button(view.querySelector('[role=alert]') as HTMLElement, 'Tentar novamente'));
    await until(() => view.querySelector('[role=alert]') === null);
    await until(() => (view.textContent ?? '').includes('João Calvino; tradutores'));
  });

  it('hides the Hernandes notice when an HDL* entry is listed, like the original', async () => {
    app.translation = 'BLN4';
    const view = render(createElement(CommentariesPage, { reference: ref(40, 26, 36) }));
    await until(() => view.querySelectorAll('article').length > 0);
    expect(view.textContent).toContain('Redação independente · referências a Hernandes Dias Lopes');
    expect(view.textContent).not.toContain('Os comentários integrais de Hernandes Dias Lopes ainda não constam');
    // HDL* vem primeiro.
    expect(view.querySelector('article h3')?.textContent).toContain('Hernandes Dias Lopes');
  });
});

describe('ComparisonPage', () => {
  it('renders the chapter in the current edition and adds editions with mapping marks', async () => {
    // jsdom não mede elementos; a lista virtual precisa de uma área visível.
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800);
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(360);
    app.translation = 'BLN4';
    const view = render(createElement(ComparisonPage, { reference: ref(43, 3, 16) }));
    await until(() => (view.textContent ?? '').includes('BLN4 · João 3:'));
    expect(view.textContent).toContain('Linhas alternadas');
    click(button(view, 'ARA'));
    await until(() => (view.textContent ?? '').includes('ARA · João 3:'));
    click(button(view, 'Mostrar diferenças'));
    click(button(view, 'Colunas'));
    expect(view.querySelector('[role=group][aria-label^="Versículo"]')).not.toBeNull();
    expect(view.querySelector('mark')).not.toBeNull();
    height.mockRestore();
    width.mockRestore();
  });
});

describe('ComparisonPage offline', () => {
  it('keeps the available editions when one edition cannot be loaded', async () => {
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800);
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(360);
    app.translation = 'BLN4';
    offline.add('bible/ASV/19.json');
    const view = render(createElement(ComparisonPage, { reference: ref(19, 23, 1) }));
    await until(() => (view.textContent ?? '').includes('BLN4 · Salmos 23:'));
    click(button(view, 'ASV'));
    await until(() => view.querySelector('[role=alert]') !== null);
    expect(view.querySelector('[role=alert]')?.textContent).toContain('ASV');
    expect(view.textContent).toContain('Não foi possível carregar esta edição agora.');
    expect(view.textContent).toContain('BLN4 · Salmos 23:1');
    height.mockRestore();
    width.mockRestore();
  });
});

describe('CrossReferencesPage', () => {
  it('lists references, filters and loads more', async () => {
    app.translation = 'BLN4';
    const view = render(createElement(CrossReferencesPage, { reference: ref(43, 3, 16) }));
    await until(() => (view.textContent ?? '').includes('referências diretas cadastradas'));
    await until(() => view.querySelectorAll('article').length > 0);
    expect(view.querySelectorAll('article').length).toBe(20);
    expect(view.textContent).toContain('Romanos 5:8');
    expect(view.textContent).toContain('Referência editorial');
    expect(view.textContent).toContain('OpenBible.info / Treasury of Scripture Knowledge · CC BY 4.0');
    // Prévia na Bíblia Livre.
    await until(() => view.querySelectorAll('article p.font-reading').length > 0);

    click(button(view, 'Mostrar mais referências'));
    await until(() => view.querySelectorAll('article').length > 20);
    expect(button(view, 'Mostrar mais referências')).toBeUndefined();

    click(button(view, 'Citações'));
    expect(view.textContent).toContain('Não há referências neste filtro.');
  });

  it('includes curated relations in both directions', async () => {
    const view = render(createElement(CrossReferencesPage, { reference: ref(60, 2, 24) }));
    await until(() => (view.textContent ?? '').includes('Uso de Isaías na linguagem de 1 Pedro'));
    click(button(view, 'Citações'));
    expect(view.textContent).toContain('Isaías 53:5');
    expect(view.textContent).toContain('Citação textual');
  });
});

describe('SavedPlacesPage', () => {
  it('lists bookmarks and deletes them', async () => {
    await savePlace('bookmarks', '45:8:28', 'BLN4', 'Romanos 8:28', 'bm-1');
    const view = render(createElement(SavedPlacesPage, { kind: 'bookmarks' }));
    await until(() => (view.textContent ?? '').includes('Romanos 8:28'));
    click(view.querySelector('button[aria-label^="Excluir"]'));
    await until(() => !(view.textContent ?? '').includes('Romanos 8:28'));
  });

  it('opens a study tab and makes it active', async () => {
    await savePlace('study_tabs', '43:3:16', 'BLN4', 'João 3:16', 'tab-1');
    const view = render(createElement(SavedPlacesPage, { kind: 'study_tabs' }));
    await until(() => (view.textContent ?? '').includes('João 3:16'));
    click(button(view, 'João 3:16'));
    expect(app.activeTab).toBe('tab-1');
    expect(app.passage).toEqual(ref(43, 3, 16));
    app.activeTab = null;
  });
});

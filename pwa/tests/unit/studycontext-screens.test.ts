// Teste de fumaça das telas de estudo conectado, temas e documentos com o
// acervo real de public/data/v1 (fetch servido do disco). As aberturas de
// folhas (screens/open) são espionadas para conferir ações e parâmetros.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/lib/app';
import { document as findDocument, documents } from '../../src/lib/content';
import { ref } from '../../src/lib/domain';
import * as open from '../../src/screens/open';
import { DocumentPage, LongStudyText, StudyText } from '../../src/screens/Documents';
import { BibleTopicsPage, TopicPage } from '../../src/screens/Topics';
import VerseStudyPage from '../../src/screens/VerseStudy';

vi.mock('../../src/screens/open', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/screens/open')>();
  const spy = () => vi.fn();
  return {
    ...original,
    showPassage: spy(),
    openTopic: spy(),
    openTopics: spy(),
    openGraph: spy(),
    openCrossReferences: spy(),
    openCommentaries: spy(),
    openOriginal: spy(),
    openModels: spy(),
    openAtlas: spy(),
    openContextCompare: spy(),
    openConfessions: spy(),
    openStudiesBrowser: spy(),
    openStudy: spy(),
    openTimeline: spy(),
    openDocument: spy(),
    openLongText: spy(),
    openNewNote: spy(),
  };
});

const dataDir = `${resolve(process.cwd(), 'public/data/v1')}/`;
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const writeText = vi.fn(async () => undefined);

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
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  // jsdom não calcula layout: áreas de rolagem têm o tamanho de um celular e cada
  // linha virtual mede 48 px, para que o virtualizador desenhe só a janela visível.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.classList.contains('scroll-area')) return 800;
      return this.hasAttribute('data-index') ? 48 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('scroll-area') ? 360 : 0;
    },
  });
});

afterAll(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight);
  if (offsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth);
});

beforeEach(() => {
  vi.clearAllMocks();
  app.translation = 'BLN4';
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** Simula a área de rolagem de uma folha (como SheetHost em App.tsx). */
function render(element: ReactElement, height = 800): HTMLElement {
  host = document.createElement('div');
  host.className = 'scroll-area';
  host.style.overflowY = 'auto';
  host.style.height = `${height}px`;
  host.getBoundingClientRect = () => ({ top: 0, left: 0, right: 360, bottom: height, width: 360, height, x: 0, y: 0, toJSON: () => ({}) });
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}

async function until(check: () => boolean, timeout = 4000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Tempo esgotado. Conteúdo: ${host?.textContent?.slice(0, 800)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
}

const buttons = (container: HTMLElement, text: string) => [...container.querySelectorAll('button')].filter((b) => b.textContent?.includes(text));
const button = (container: HTMLElement, text: string) => buttons(container, text)[0];
const click = (element: Element | undefined) => {
  if (!element) throw new Error('Elemento não encontrado');
  act(() => (element as HTMLElement).click());
};

describe('VerseStudyPage', () => {
  it('renders every part progressively for João 3:16 and wires each action', async () => {
    const r = ref(43, 3, 16);
    const view = render(createElement(VerseStudyPage, { reference: r }));
    const text = () => view.textContent ?? '';
    // Partes estáticas aparecem de imediato.
    expect(view.querySelector('h3')?.textContent).toBe('João 3:16');
    expect(text()).toContain('Explorar todos os temas');
    expect(text()).toContain('Contexto histórico e literário');
    expect(text()).toContain('Teologia e diálogo');
    expect(text()).toContain('Padrões de Westminster');
    expect(text()).toContain('Mapas históricos');
    expect(text()).toContain('Comparar contextos');
    expect(text()).toContain('Conhecer outras tradições');
    expect(text()).toContain('Defesa presbiteriana');
    await until(() => text().includes('panorama do livro'));
    await until(() => /\d+ ligações diretas/.test(text()));
    await until(() => /\d+ entradas para a passagem/.test(text()));
    await until(() => text().includes('Temas ligados à passagem'));
    await until(() => text().includes('Estudos que citam'));
    expect(text()).toContain('Evangelho · panorama do livro');
    expect(text()).toContain('Introdução ao livro');
    expect(text()).toMatch(/Não há evento individual datado|associação pela perícope/);
    // Não há estudo que cite João 3:16: até 12 estudos que citam o livro.
    expect(text()).toContain('Estudos que citam o livro · associação temática ampla');
    expect(buttons(view, 'estudo com fontes').length).toBeGreaterThan(0);
    expect(buttons(view, 'estudo com fontes').length).toBeLessThanOrEqual(12);
    // Matthew Henry não comenta João 3:16 isoladamente (blocos 3:1-8 e 3:22-36): sem trecho clássico.
    expect(text()).not.toContain('Contexto literário do trecho');

    click(button(view, 'Explorar todos os temas'));
    expect(open.openTopics).toHaveBeenCalledWith(r);
    click(button(view, 'Ler no contexto'));
    expect(open.showPassage).toHaveBeenCalledWith(r);
    click(button(view, 'Rede de conexões'));
    expect(open.openGraph).toHaveBeenCalledWith(r);
    click(button(view, 'Referências cruzadas'));
    expect(open.openCrossReferences).toHaveBeenCalledWith(r);
    click(button(view, 'entradas para a passagem'));
    expect(open.openCommentaries).toHaveBeenCalledWith(r);
    click(button(view, 'Idioma original'));
    expect(open.openOriginal).toHaveBeenCalledWith(r);
    click(button(view, 'Modelos 3D'));
    expect(open.openModels).toHaveBeenCalledWith(r);
    click(button(view, 'Mapas históricos'));
    expect(open.openAtlas).toHaveBeenCalled();
    click(button(view, 'Comparar contextos'));
    expect(open.openContextCompare).toHaveBeenCalledWith(r);
    click(button(view, 'Padrões de Westminster'));
    expect(open.openConfessions).toHaveBeenCalled();
    click(button(view, 'Conhecer outras tradições'));
    expect(open.openStudiesBrowser).toHaveBeenCalledWith(false);
    click(button(view, 'Defesa presbiteriana'));
    expect(open.openStudiesBrowser).toHaveBeenLastCalledWith(true);
    click(button(view, 'estudo com fontes'));
    expect(open.openStudy).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }), true);
    // Panorama do livro: chips de referência na edição de origem BLN4.
    click(button(view, 'João 1:1'));
    expect(open.showPassage).toHaveBeenLastCalledWith(ref(43, 1, 1), { sourceEdition: 'BLN4' });
    // Tema ligado à passagem abre a página do tema.
    const themeHeading = [...view.querySelectorAll('h4')].find((h) => h.textContent === 'Temas ligados à passagem')!;
    click(themeHeading.parentElement!.querySelector('button')!);
    expect(open.openTopic).toHaveBeenCalledWith(expect.stringMatching(/^torrey-/), expect.any(String));
    // Introdução ao livro: busca o documento e abre DocumentPage.
    click(button(view, 'Introdução ao livro'));
    await until(() => (open.openDocument as ReturnType<typeof vi.fn>).mock.calls.length > 0);
    expect(open.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'EXP2-PAN-66:panorama-43' }));
  });

  it('shows the Matthew Henry excerpt and dated events for Gênesis 1:1', async () => {
    const r = ref(1, 1, 1);
    const view = render(createElement(VerseStudyPage, { reference: r }));
    await until(() => (view.textContent ?? '').includes('associação pela perícope'));
    click(button(view, 'Ver na cronologia'));
    expect(open.openTimeline).toHaveBeenCalledWith(r);
    // Trecho clássico: aberto por padrão e limitado a 1800 caracteres + "…".
    await until(() => (view.textContent ?? '').includes('Contexto literário do trecho'));
    const classic = button(view, 'Contexto literário do trecho');
    expect(classic.getAttribute('aria-expanded')).toBe('true');
    const excerpt = view.querySelector(`#${CSS.escape(classic.getAttribute('aria-controls')!)} .md`)!.textContent!;
    expect(excerpt.trim().endsWith('…')).toBe(true);
    expect(excerpt.length).toBeLessThan(1900);
    click(button(view, 'Ler comentário completo e fontes'));
    expect(open.openCommentaries).toHaveBeenLastCalledWith(r, 'Comentário da passagem');
    click(classic);
    expect(button(view, 'Ler comentário completo e fontes')).toBeUndefined();
  });
});

describe('BibleTopicsPage', () => {
  it('scopes topics to the passage and searches all topics', async () => {
    const view = render(createElement(BibleTopicsPage, { reference: ref(43, 3, 16) }));
    await until(() => /\d+ temas/.test(view.textContent ?? ''));
    expect(view.querySelector('input[type="search"]')).toBeNull();
    const scopedCount = Number(/(\d+) temas/.exec(view.textContent ?? '')![1]);
    expect(scopedCount).toBeGreaterThan(0);
    expect(view.querySelectorAll('li[data-index]').length).toBe(Math.min(scopedCount, view.querySelectorAll('li[data-index]').length));
    click(button(view, 'Passagens, aspectos do tema'));
    expect(open.openTopic).toHaveBeenCalledWith(expect.stringMatching(/^torrey-/), expect.any(String));

    click(button(view, 'Todos os temas'));
    await until(() => view.querySelector('input[type="search"]') !== null);
    await until(() => (view.textContent ?? '').includes('80 temas'));
    // Lista virtualizada: só a janela visível é desenhada.
    const rendered = view.querySelectorAll('li[data-index]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(80);
    click(button(view, 'Mostrar mais temas'));
    await until(() => (view.textContent ?? '').includes('160 temas'));
  });

  it('filters by title and original English title, with an empty state', async () => {
    const view = render(createElement(BibleTopicsPage, {}));
    const input = () => view.querySelector<HTMLInputElement>('input[type="search"]')!;
    await until(() => (view.textContent ?? '').includes('80 temas'));
    const type = (value: string) =>
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        setter.call(input(), value);
        input().dispatchEvent(new Event('input', { bubbles: true }));
      });
    type('POMEGRANATE');
    await until(() => /^1 temas?$/.test(view.querySelector('[aria-live="polite"]')?.textContent ?? ''));
    expect(button(view, 'Mostrar mais temas')).toBeUndefined();
    type('xyzxyz-inexistente');
    await until(() => (view.textContent ?? '').includes('Não há tema editorial indexado para esta busca.'));
  });
});

describe('TopicPage', () => {
  it('shows the topic body, status, original and references', async () => {
    const view = render(createElement(TopicPage, { id: 'torrey-842df70e8eaec932' }));
    await until(() => (view.textContent ?? '').includes('Consultar o índice original em inglês'));
    await until(() => view.querySelectorAll('[data-index]').length > 0);
    const text = view.textContent ?? '';
    expect(text).toContain('Torrey');
    expect(text).toContain('revisão especializada pendente');
    expect(text).toContain('O Egito abundou com');
    click(button(view, 'Consultar o índice original em inglês'));
    const [title, original] = (open.openLongText as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(title).toBe('Original histórico');
    expect(original).toContain('Egypt abounded with');
    expect(original).not.toMatch(/[<>]/);
    click(button(view, 'Passagens do tema (16)'));
    expect(view.textContent).toContain('Números 20:5');
    click(button(view, 'Números 20:5'));
    expect(open.showPassage).toHaveBeenCalledWith(ref(4, 20, 5), { sourceEdition: 'BLN4' });
  });
  it('reports a missing topic', async () => {
    const view = render(createElement(TopicPage, { id: 'inexistente' }));
    await until(() => (view.textContent ?? '').includes('Tema não instalado.'));
  });
});

describe('DocumentPage', () => {
  it('shows Westminster guide first, the support translation collapsed and the actions', async () => {
    const doc = (await documents({ moduleId: 'WSC' })).find((d) => d.id === 'WSC.1')!;
    const view = render(createElement(DocumentPage, { document: doc }));
    const text = view.textContent ?? '';
    expect(text).toContain('Assembleia de Westminster · en+pt');
    expect(text).toContain('Orientação temática em português');
    expect(text).not.toContain('Qual é o propósito principal do ser humano?');
    click(button(view, 'Tradução de apoio da redação histórica (revisão pendente)'));
    expect(view.textContent).toContain('Qual é o propósito principal do ser humano?');
    expect(view.textContent).toContain('Não é uma edição oficial da IPB.');
    expect(view.textContent).toContain('Fontes');
    expect(view.textContent).toContain('https://www.opc.org/sc.html');
    expect(view.textContent).toContain('Public Domain (original 1647); guias próprios');
    expect(view.textContent).toContain('entries: 107');
    // Referências de metadata.references abrem a prévia.
    click(button(view, '2 Timóteo 3:16'));
    expect(open.showPassage).toHaveBeenCalledWith(ref(55, 3, 16), {});
    click(button(view, 'Anotar'));
    expect(open.openNewNote).toHaveBeenCalledWith({ title: doc.title, body: '[[WSC.1]]\n\n', reference: 'WSC.1' });
    click(button(view, 'Copiar'));
    await until(() => writeText.mock.calls.length > 0);
    expect(writeText).toHaveBeenCalledWith(
      `${doc.body}\n\nAssembleia de Westminster; Breve Catecismo de Westminster — 107 perguntas; WSC.1; https://www.opc.org/sc.html`,
    );
  });

  it('does not invent reference chips for book introductions', async () => {
    const doc = (await findDocument('EXP2-PAN-66:panorama-43'))!;
    const view = render(createElement(DocumentPage, { document: doc }));
    expect(view.textContent).toContain('Panorama do livro — João');
    expect(button(view, 'João 1:1')).toBeUndefined();
  });

  it('shows the Portuguese text first for translated non-confessional documents', () => {
    const view = render(createElement(StudyText, { original: 'English original', pt: { title: 'T', body: 'Texto em português', status: 'Revisão pendente' } }));
    expect(view.textContent).toContain('Texto em português');
    expect(view.textContent).toContain('Revisão pendente');
    expect(view.textContent).not.toContain('English original');
    click(button(view, 'Consultar o original em inglês'));
    expect(view.textContent).toContain('English original');
  });

  it('shows only the original when there is no translation', () => {
    const view = render(createElement(StudyText, { original: 'Somente o original', pt: null }));
    expect(view.textContent).toContain('Somente o original');
    expect(button(view, 'Consultar o original em inglês')).toBeUndefined();
  });

  it('renders long texts in virtualized paragraphs', () => {
    const text = Array.from({ length: 2000 }, (_, i) => `Parágrafo ${i + 1}.`).join('\n\n');
    const view = render(createElement(LongStudyText, { text }));
    const rendered = view.querySelectorAll('[data-index]').length;
    expect(view.textContent).toContain('Parágrafo 1.');
    expect(view.textContent).not.toContain('Parágrafo 2000.');
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(200);
  });

  it('reports empty long texts', () => {
    const view = render(createElement(LongStudyText, { text: ' \n\n ' }));
    expect(view.textContent).toContain('Não há conteúdo instalado para este trecho.');
  });
});

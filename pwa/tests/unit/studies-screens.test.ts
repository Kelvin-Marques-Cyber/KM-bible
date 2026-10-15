// Teste de fumaça das telas de estudos (confissões, mesa de estudos, estudo,
// comparação, arena, apologistas, ciência, religiões), Agostinho e devocionais
// com o acervo real de public/data/v1 (fetch servido do disco). As aberturas de
// folhas (screens/open) são espionadas para conferir ações e parâmetros.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, sheets } from '../../src/lib/app';
import { catalog } from '../../src/lib/catalog';
import { allStudies, type Study } from '../../src/lib/content';
import { completed, isCompleted, notes, pref, setPref } from '../../src/lib/store';
import { loadCollection } from '../../src/lib/studies-data';
import * as open from '../../src/screens/open';
import AugustinePage from '../../src/screens/Augustine';
import DevotionalsPage, { DevotionalReader, ReadingList } from '../../src/screens/Devotionals';
import {
  ApologistsPage,
  ArenaPage,
  ArgumentComparison,
  ConfessionsPage,
  ReligionCoursePage,
  ReligionCurriculaPage,
  SciencePage,
  StudiesBrowser,
  StudyPage,
  topicTitles,
  traditionTitles,
} from '../../src/screens/Studies';

vi.mock('../../src/screens/open', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/screens/open')>();
  const spy = () => vi.fn();
  return {
    ...original,
    showPassage: spy(),
    openDocument: spy(),
    openAugustine: spy(),
    openStudy: spy(),
    openReligions: spy(),
    openScience: spy(),
    openApologists: spy(),
    openArena: spy(),
    openArgumentComparison: spy(),
    openReligionCourse: spy(),
    openNewNote: spy(),
    openDevotional: spy(),
    openLibrary: spy(),
  };
});

const dataDir = `${resolve(process.cwd(), 'public/data/v1')}/`;
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const writeText = vi.fn(async (_text: string) => undefined);
const fetched: string[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname.replace(/^.*\/data\/v1\//, ''));
    fetched.push(path);
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
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  app.translation = 'BLN4';
  fetched.length = 0;
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
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > timeout) throw new Error(`Tempo esgotado. Conteúdo: ${host?.textContent?.slice(0, 900)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
}
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });

const text = () => host?.textContent ?? '';
const buttons = (label: string) =>
  [...host!.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);
const buttonWith = (part: string) => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes(part));
const click = (element: Element | undefined | null) => {
  if (!element) throw new Error('Elemento não encontrado');
  act(() => (element as HTMLElement).click());
};
const fieldByLabel = (label: string) =>
  [...host!.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === label)?.querySelector('input, textarea, select') ?? null;
function type(element: Element | null, value: string) {
  if (!element) throw new Error('Campo não encontrado');
  const proto =
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

let studyList: Study[] = [];
const study = (id: string) => studyList.find((s) => s.id === id)!;

beforeAll(async () => {
  studyList = await allStudies();
});

// ===================================================================== Confissões
describe('ConfessionsPage', () => {
  it('lists the Westminster standards with the original labels, searches and opens documents', async () => {
    const view = render(createElement(ConfessionsPage));
    expect(text()).toContain('Escrituras como regra suprema.');
    for (const label of ['Confissão · 33', 'Breve · 107', 'Maior · 196', 'Agostinho · 13 livros']) expect(buttons(label)).toHaveLength(1);
    await until(() => text().includes('01 · As Escrituras Sagradas'));
    // Lista virtual: nem todos os 33 capítulos estão no DOM.
    expect(view.querySelectorAll('[role=listitem]').length).toBeLessThan(33);
    expect(text()).toContain('2 Timóteo 3:16 · 2 Pedro 1:21 · Salmos 19:1');

    click(buttons('Breve · 107')[0]);
    await until(() => text().includes('Pergunta 1'));
    expect(text()).toContain('Qual é o fim do homem?');

    type(view.querySelector('input[type=search]'), 'PROPOSITO PRINCIPAL');
    expect(text()).toContain('Pergunta 2'); // debounce: ainda sem filtrar
    await until(() => !text().includes('Pergunta 2') && text().includes('Pergunta 1'));
    click(buttonWith('Pergunta 1'));
    expect(open.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'WSC.1', module_id: 'WSC' }));
  });

  it('shows the Augustine index with lazy chapter titles and opens the reader at the 0-based position', async () => {
    render(createElement(ConfessionsPage));
    click(buttons('Agostinho · 13 livros')[0]);
    await until(() => text().includes('13 livros e 278 capítulos'));
    expect(text()).toContain('Confissões de Santo Agostinho: texto integral em português');
    expect(text()).toContain('Todos os 13 livros · 278 capítulos');
    expect(text()).toContain('Consultar edição integral em português');
    expect(text()).toContain('Tradução de J. Oliveira Santos e A. Ambrósio de Pina.');
    const edition = host!.querySelector('a[href="https://www.solusagape.com.br/obras-milenares/confiss%C3%B5es"]');
    expect(edition?.getAttribute('target')).toBe('_blank');
    expect(edition?.getAttribute('rel')).toContain('noopener');
    // Sem livros abertos, nenhum livro é baixado.
    await settle();
    expect(fetched.filter((p) => /^agostinho\/\d+\.json$/.test(p))).toEqual([]);

    click(buttonWith('Livro 2 · A adolescência e o roubo das peras'));
    await until(() => text().includes('Livro 2 · Capítulo 1') && text().includes('Desordens da juventude.'));
    expect(fetched.filter((p) => /^agostinho\/\d+\.json$/.test(p))).toEqual(['agostinho/2.json']);
    click(buttonWith('Livro 2 · Capítulo 1'));
    expect(open.openAugustine).toHaveBeenCalledWith({ book: 1, chapter: 0 });
    expect(pref('agostinho_livro', -1)).toBe(1);
    expect(pref('agostinho_capitulo', -1)).toBe(0);

    // Seleção de um livro mostra só os capítulos dele.
    type(fieldByLabel('Selecionar livro de Agostinho'), '1');
    await until(() => text().includes('Invocação ou louvor?'));
    expect(text()).not.toContain('Livro 2 · Capítulo 1');
  });

  it('searches chapter titles by loading the books one at a time', async () => {
    render(createElement(ConfessionsPage));
    click(buttons('Agostinho · 13 livros')[0]);
    await until(() => text().includes('13 livros e 278 capítulos'));
    type(host!.querySelector('input[type=search]'), 'magnificat');
    await until(() => text().includes('Livro 1 · Capítulo 20'), 6000);
    await until(() => !text().includes('Procurando também nos títulos'), 6000);
    expect(text()).toContain('Magnificat.');
  });

  it('falls back to the index when the build has no Augustine pack', async () => {
    const saved = catalog.agostinho;
    catalog.agostinho = null;
    try {
      render(createElement(ConfessionsPage));
      click(buttons('Agostinho · 13 livros')[0]);
      expect(text()).toContain('não está disponível nesta versão');
      expect(text()).toContain('Livro 13 · A criação e o descanso em Deus');
      act(() => root?.unmount());
      root = null;
    } finally {
      catalog.agostinho = saved;
    }
  });
});

// ================================================================ Mesa de estudos
describe('StudiesBrowser', () => {
  it('shows the quote, actions, filters and a virtual list of studies', async () => {
    const view = render(createElement(StudiesBrowser, { apologetic: true }));
    expect(text()).toContain('Estai sempre preparados para responder — 1 Pedro 3:15');
    click(buttons('Religiões por categoria')[0]);
    expect(open.openReligions).toHaveBeenCalledWith(true);
    click(buttons('Ciência e ateísmo')[0]);
    expect(open.openScience).toHaveBeenCalled();
    click(buttons('Grandes apologistas')[0]);
    expect(open.openApologists).toHaveBeenCalled();
    click(buttons('Arena e laboratório')[0]);
    expect(open.openArena).toHaveBeenCalled();
    await until(() => text().includes('Adventismo do Sétimo Dia · Introdução e história'));
    expect(view.querySelectorAll('[role=listitem]').length).toBeLessThan(60);
    expect(text()).toContain('Iniciante · Adventista do Sétimo Dia');

    type(fieldByLabel('Tema'), 'trinity');
    type(fieldByLabel('Tradição / perspectiva'), 'presbyterian');
    await until(() => text().includes('Trindade: unidade sem confusão'));
    expect(text()).not.toContain('Adventismo');
    click(buttonWith('Trindade: unidade sem confusão'));
    expect(open.openStudy).toHaveBeenCalledWith(expect.objectContaining({ id: 'trinity' }), true);

    // Nível + tradição: só os estudos avançados presbiterianos (Ética, Morte e Trindade).
    type(fieldByLabel('Tema'), '');
    click(buttons('Avançado')[0]);
    await until(() => text().includes('Presbiterianismo reformado · Ética e vida cotidiana'));
    expect(text()).not.toContain('Presbiterianismo reformado · Introdução e história');
    expect(view.querySelectorAll('[role=listitem]')).toHaveLength(3);
    click(buttons('Iniciante')[0]);
    type(fieldByLabel('Tema'), 'trinity');
    await until(() => text().includes('Este estudo não está registrado na biblioteca.'));
    const selects = [...view.querySelectorAll('select')].map((s) => s.options.length);
    expect(selects).toEqual([Object.keys(topicTitles).length + 1, Object.keys(traditionTitles).length + 1]);
  });

  it('uses the descriptive quote outside the apologetic mode', async () => {
    render(createElement(StudiesBrowser, { apologetic: false }));
    expect(text()).toContain('Conhecer cada posição por suas fontes e seus próprios argumentos.');
    await until(() => text().includes('Adventismo do Sétimo Dia'));
    click(buttonWith('Adventismo do Sétimo Dia'));
    expect(open.openStudy).toHaveBeenCalledWith(expect.objectContaining({ id: 'curriculum-seventh_day_adventist-origins' }), false);
  });
});

// ======================================================================== Estudo
describe('StudyPage', () => {
  it('impersonal mode shows the deep reading without refutation sections', async () => {
    const s = study('curriculum-presbyterian-origins');
    render(createElement(StudyPage, { study: s, apologetic: false }));
    expect(text()).toContain('Exposição impessoal · Presbiteriana reformada');
    await until(() => text().includes('panorama impessoal aprofundado'));
    expect(fetched).toContain('apologetica/presbyterian.json');
    expect(buttonWith('Examinar a objeção mais forte')).toBeUndefined();
    expect(buttonWith('Comparar argumentos')).toBeUndefined();
    expect(buttonWith('Ler argumentação presbiteriana')).toBeUndefined();
  });

  it('apologetic mode shows exposition, response, the dossier toggle, objections and actions', async () => {
    const s = study('curriculum-presbyterian-origins');
    const view = render(createElement(StudyPage, { study: s, apologetic: true }));
    expect(text()).toContain('Apologética presbiteriana · Presbiteriana reformada');
    expect(fetched).not.toContain('apologetica/presbyterian.json');
    click(buttonWith('Ler argumentação presbiteriana aprofundada'));
    await until(() => text().includes('argumentação presbiteriana aprofundada') && text().includes('Recolher fundamentação presbiteriana'));
    click(buttonWith('Recolher fundamentação presbiteriana'));
    expect(text()).not.toContain('Posicionamento confessional da tradição reformada');

    click(buttonWith('Examinar a objeção mais forte'));
    expect(text()).toContain(s.strongest.slice(0, 40));
    click(buttonWith('Responder à refutação'));
    expect(text()).toContain(s.rejoinder.slice(0, 40));
    click(buttonWith('Comparar argumentos'));
    expect(open.openArgumentComparison).toHaveBeenCalledWith(s);

    click(buttonWith('Gênesis 1:1'));
    expect(open.showPassage).toHaveBeenCalledWith({ book: 1, chapter: 1, verse: 1 });
    expect(view.querySelector('a[href="https://opc.org/confessions.html"]')).not.toBeNull();

    const box = view.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(box.checked).toBe(false);
    act(() => box.click());
    await until(() => isCompleted(s.id));
    expect((view.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(true);
    await act(async () => completed(s.id, false));

    click(buttons('Anotar')[0]);
    expect(open.openNewNote).toHaveBeenCalledWith({ title: s.title, body: `Estudo: ${s.id}\n\n`, reference: s.id });
  });

  it('switching modes while the dossier loads never leaves a spinner behind', async () => {
    const s = study('curriculum-presbyterian-origins');
    render(createElement(StudyPage, { study: s, apologetic: false }));
    click(buttons('Apologética presbiteriana')[0]);
    click(buttons('Exposição impessoal')[0]);
    await until(() => text().includes('panorama impessoal aprofundado'));
  });

  it('falls back to the study exposition when the dossier is unavailable', async () => {
    const s: Study = { ...study('curriculum-presbyterian-origins'), target: 'not_a_target', exposition: 'Exposição curta de reserva.' };
    render(createElement(StudyPage, { study: s, apologetic: false }));
    await until(() => text().includes('Panorama aprofundado indisponível nesta versão.'));
    expect(text()).toContain('Exposição curta de reserva.');
  });
});

describe('ArgumentComparison', () => {
  it('shows tradition vs apologetics for exposition/response and strongest/rejoinder, plus sources', () => {
    const s = study('trinity');
    const view = render(createElement(ArgumentComparison, { study: s }));
    expect(view.querySelector('[role=table]')).not.toBeNull();
    expect(view.querySelectorAll('[role=row]')).toHaveLength(3);
    expect(text()).toContain('Presbiteriana reformada');
    expect(text()).toContain(s.response.replace(/[*_#>`[\]]/g, '').slice(0, 30));
    expect(text()).toContain('Fontes');
  });
});

// ========================================================================= Arena
describe('ArenaPage', () => {
  it('evaluates the response like the original and saves to the laboratory notebook', async () => {
    render(createElement(ArenaPage));
    await until(() => !!fieldByLabel('Objeção a ser estudada'));
    expect(text()).toContain('Formule uma tese e duas premissas.');
    type(fieldByLabel('Objeção a ser estudada'), 'trinity');
    type(fieldByLabel('Abordagem'), 'evidential');
    click(buttons('2 · Responder')[0]);
    expect(text()).toContain('Represente a posição interlocutora e responda com fontes.');
    type(fieldByLabel('Sua resposta'), 'Conforme Mateus 28:19 e a CFW.');
    click(buttons('Examinar estrutura da resposta')[0]);
    expect(text()).toContain('Referências encontradas: Mateus 28:19.');
    expect(text()).toContain('Confira se a fonte citada sustenta sua afirmação.');
    expect(text()).toContain('Compare sua representação com a exposição descritiva do estudo.');
    expect(text()).not.toContain('Apresente a objeção mais forte');

    click(buttonWith('Comparar argumentos'));
    expect(open.openStudy).toHaveBeenCalledWith(expect.objectContaining({ id: 'trinity' }), true);

    click(buttons('Salvar')[0]);
    await until(() => isCompleted('arena:trinity:2'));
    const saved = (await notes()).find((n) => n.title === `Laboratório: ${study('trinity').title}`);
    expect(saved?.notebook).toBe('Laboratório');
    expect(saved?.reference).toBe('trinity');
    expect(saved?.body.startsWith('Abordagem: Histórica e evidencial\nEtapa: 2\n\nConforme Mateus 28:19 e a CFW.\n\n')).toBe(true);
  });
});

describe('ApologistsPage, SciencePage and religions', () => {
  it('lists the six apologists with sources and the protected-works note', () => {
    const view = render(createElement(ApologistsPage));
    expect(view.querySelectorAll('h3')).toHaveLength(6);
    expect(text()).toContain('Alvin Plantinga');
    expect(text().match(/Obras protegidas não são reproduzidas/g)).toHaveLength(6);
    expect(view.querySelector('a[href="https://labri.org/"]')).not.toBeNull();
  });

  it('lists science studies (atheism + science)', async () => {
    render(createElement(SciencePage));
    await until(() => text().includes('Ajuste fino: dados, hipóteses e limites'));
    expect(text()).toContain('Ciência, filosofia e fé');
    click(buttonWith('Ajuste fino'));
    expect(open.openStudy).toHaveBeenCalledWith(expect.objectContaining({ target: 'atheism', topic: 'science' }), true);
  });

  it('lists traditions with studies by category and opens a course', async () => {
    render(createElement(ReligionCurriculaPage, { apologetic: true }));
    await until(() => text().includes('Católica romana'));
    expect(text()).toContain('9 estudos instalados · fontes e comparação');
    type(fieldByLabel('Categoria'), 'Tradições da Índia');
    await until(() => !text().includes('Católica romana'));
    expect(text()).toContain('Sikhismo');
    type(host!.querySelector('input[type=search]'), 'sikh');
    await until(() => !text().includes('Jainismo'));
    click(buttonWith('Sikhismo'));
    expect(open.openReligionCourse).toHaveBeenCalledWith('sikhism', 'Sikhismo', true);
  });

  it('orders a course by the curriculum topics', async () => {
    const view = render(createElement(ReligionCoursePage, { target: 'presbyterian' }));
    await until(() => text().includes('Presbiterianismo reformado · Introdução e história'));
    const titles = [...view.querySelectorAll('li button')].map((b) => b.textContent ?? '');
    expect(titles[0]).toContain('Introdução e história');
    expect(titles[1]).toContain('Textos sagrados');
    expect(titles[titles.length - 1]).toContain('Trindade');
    expect(text()).toContain('Nível 1 · exposição e apologética');
  });
});

// ===================================================================== Agostinho
describe('AugustinePage', () => {
  it('reads a chapter with title, footnotes, actions and navigation across books', async () => {
    const view = render(createElement(AugustinePage, { initialBook: 0, initialChapter: 0 }));
    await until(() => text().includes('Invocação ou louvor?'));
    expect(view.querySelector('h4')?.textContent).toBe('Livro 1 · Capítulo 1');
    expect(text()).toContain('Texto integral em português. Leitura offline, sem resumos.');
    expect(text()).toContain('louvado¹');
    expect(text()).toContain('Notas da edição');
    expect(text()).toContain('1. Salmo 95: 4.');
    expect(text()).toContain('Fonte: https://www.solusagape.com.br/obras-milenares/confiss%C3%B5es');
    expect(text()).toContain('Tradução: J. Oliveira Santos, S.J.; A. Ambrosio de Pina, S.J.');
    expect(buttons('Anterior')[0].disabled).toBe(true);
    const body = view.querySelector('.font-reading[style]') as HTMLElement;
    expect(body.style.lineHeight).toBe('1.78');
    expect(body.style.fontSize).toBe('19px');
    click(buttons('Fonte maior')[0]);
    expect((view.querySelector('.font-reading[style]') as HTMLElement).style.fontSize).toBe('21px');

    click(buttons('Marcar leitura')[0]);
    await until(() => buttons('Marcado').length === 1);
    expect(pref('agostinho_favorito_1_1', false)).toBe(true);
    click(buttons('Marcado')[0]);
    await until(() => pref<boolean>('agostinho_favorito_1_1', true) === false);

    click(buttons('Copiar capítulo')[0]);
    await until(() => writeText.mock.calls.length > 0);
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied.startsWith('Confissões de Santo Agostinho — Livro 1, capítulo 1\n\nSois grande, Senhor')).toBe(true);
    expect(copied.endsWith('\n\nTradução: J. Oliveira Santos e A. Ambrósio de Pina. Fonte: Solus Ágape.')).toBe(true);

    type(fieldByLabel('Capítulo'), '19');
    await until(() => text().includes('Magnificat.'));
    expect(pref('agostinho_capitulo', -1)).toBe(19);
    click(buttons('Próximo')[0]);
    await until(() => text().includes('Desordens da juventude.'));
    expect(view.querySelector('h4')?.textContent).toBe('Livro 2 · Capítulo 1');
    expect(pref('agostinho_livro', -1)).toBe(1);
    expect(pref('agostinho_capitulo', -1)).toBe(0);
    click(buttons('Anterior')[0]);
    await until(() => text().includes('Magnificat.'));
  });

  it('resumes the saved position and disables Próximo at the very end', async () => {
    await setPref('agostinho_livro', 12, false);
    await setPref('agostinho_capitulo', 99, false);
    render(createElement(AugustinePage, {}));
    await until(() => text().includes('Livro 13 · Capítulo 38'));
    expect(buttons('Próximo')[0].disabled).toBe(true);
  });

  it('shows the index-only fallback when the pack is missing', () => {
    const saved = catalog.agostinho;
    catalog.agostinho = null;
    try {
      render(createElement(AugustinePage, {}));
      expect(text()).toContain('não está disponível nesta versão');
      expect(text()).toContain('Consultar edição integral em português');
      act(() => root?.unmount());
      root = null;
    } finally {
      catalog.agostinho = saved;
    }
  });
});

// ==================================================================== Devocionais
describe('Devotionals', () => {
  it('lists the installed collections with progress, the Josemar Bessa card and opens today’s reading', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2028, 1, 29, 8));
    try {
      await act(async () => completed('devocional:EXP-JORNADA-DIARIO:jornada-001', true));
      render(createElement(DevotionalsPage));
      expect(text()).toContain('Café da Manhã com Spurgeon');
      expect(text()).toContain('Jornada Reformada');
      expect(text()).toContain('366 dias · leitura por data');
      expect(text()).toContain('180 leituras');
      expect(text()).toContain('Devocionais de Josemar Bessa — importe o pacote autorizado (.biblepkg) em Biblioteca → Importar módulo');
      await until(() => text().includes('1 de 180 lidas'));
      expect(text()).toContain('0 de 366 lidas');
      // Nada das coleções é baixado só para mostrar o menu.
      expect(fetched.filter((p) => p.startsWith('docs/'))).toEqual([]);

      const today = buttons('Leitura de hoje');
      expect(today).toHaveLength(2);
      click(today[0]);
      await until(() => (open.openDevotional as ReturnType<typeof vi.fn>).mock.calls.length === 1);
      expect(open.openDevotional).toHaveBeenLastCalledWith('EXP-SPURGEON-DIARIO', 'Café da Manhã com Spurgeon', 'EXP-SPURGEON-DIARIO:cafe-060');
      click(today[1]);
      await until(() => (open.openDevotional as ReturnType<typeof vi.fn>).mock.calls.length === 2);
      expect(open.openDevotional).toHaveBeenLastCalledWith('EXP-JORNADA-DIARIO', 'Jornada Reformada', 'EXP-JORNADA-DIARIO:jornada-002');

      click(buttons('Abrir a Biblioteca')[0]);
      expect(open.openLibrary).toHaveBeenCalled();
      click(buttons('Todas as leituras')[0]);
      expect(sheets.at(-1)?.title).toBe('Todas as leituras · Café da Manhã com Spurgeon');
    } finally {
      vi.useRealTimers();
      await act(async () => completed('devocional:EXP-JORNADA-DIARIO:jornada-001', false));
      await settle();
    }
  });

  it('reads, marks, navigates, copies with credits, annotates and remembers the last reading', async () => {
    const view = render(createElement(DevotionalReader, { moduleId: 'EXP-SPURGEON-DIARIO', documentId: 'EXP-SPURGEON-DIARIO:cafe-001' }));
    await until(() => text().includes('01/01: Graça antes do mérito'));
    expect(text()).toContain('Dia 1 de 366');
    expect(view.querySelector('.font-reading')).not.toBeNull();
    expect(pref('devocional_ultimo_EXP-SPURGEON-DIARIO', '')).toBe('EXP-SPURGEON-DIARIO:cafe-001');
    click(buttonWith('Salmos 1:3'));
    expect(open.showPassage).toHaveBeenCalledWith({ book: 19, chapter: 1, verse: 3 }, { sourceEdition: 'BLN4' });

    const toggle = view.querySelector('input[role=switch]') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    act(() => toggle.click());
    await until(() => isCompleted('devocional:EXP-SPURGEON-DIARIO:cafe-001'));

    click(buttons('Copiar')[0]);
    await until(() => writeText.mock.calls.length > 0);
    const copied = String(writeText.mock.calls[0][0]);
    expect(copied.startsWith('Café da manhã com Spurgeon — 01/01: Graça antes do mérito\n\n**Dia 001')).toBe(true);
    expect(copied).toContain('Redação independente; Café da Manhã com Spurgeon — abrir por data (366 dias); EXP-SPURGEON-DIARIO:cafe-001; https://www.ccel.org/');
    expect(copied).toContain('CC BY 4.0');

    click(buttons('Anotar')[0]);
    expect(open.openNewNote).toHaveBeenCalledWith(
      expect.objectContaining({ body: '[[EXP-SPURGEON-DIARIO:cafe-001]]\n\n', reference: 'EXP-SPURGEON-DIARIO:cafe-001' }),
    );

    expect(buttons('Anterior')[0].disabled).toBe(true);
    click(buttons('Próxima')[0]);
    await until(() => text().includes('02/01: Santidade cotidiana'));
    expect((view.querySelector('input[role=switch]') as HTMLInputElement).checked).toBe(false);
    await until(() => pref<string>('devocional_ultimo_EXP-SPURGEON-DIARIO', '') === 'EXP-SPURGEON-DIARIO:cafe-002');
    await act(async () => completed('devocional:EXP-SPURGEON-DIARIO:cafe-001', false));
  });

  it('opens the last reading when no document is given', async () => {
    await setPref('devocional_ultimo_EXP-JORNADA-DIARIO', 'EXP-JORNADA-DIARIO:jornada-010', false);
    render(createElement(DevotionalReader, { moduleId: 'EXP-JORNADA-DIARIO' }));
    await until(() => text().includes('Leitura 10 de 180'));
  });

  it('lists every reading (virtualized), searches and filters by read state', async () => {
    await loadCollection('EXP-JORNADA-DIARIO');
    await act(async () => completed('devocional:EXP-JORNADA-DIARIO:jornada-002', true));
    try {
      const view = render(createElement(ReadingList, { moduleId: 'EXP-JORNADA-DIARIO', name: 'Jornada Reformada' }));
      await until(() => text().includes('Leitura 001: Arrependimento sincero'));
      expect(view.querySelectorAll('[role=listitem]').length).toBeLessThan(60);
      expect(text()).toContain('180 de 180 leituras');
      click(buttons('Lidas')[0]);
      await until(() => text().includes('1 de 180 leituras'));
      expect(text()).toContain('Leitura 002: Fé e obediência');
      click(buttons('Todos')[0]);
      type(host!.querySelector('input[type=search]'), 'esperanca na aflicao');
      await until(() => text().includes('Leitura 059: Esperança na aflição') && !text().includes('Leitura 001'));
      click(buttonWith('Leitura 059'));
      expect(open.openDevotional).toHaveBeenCalledWith('EXP-JORNADA-DIARIO', 'Jornada Reformada', 'EXP-JORNADA-DIARIO:jornada-059');
    } finally {
      await act(async () => completed('devocional:EXP-JORNADA-DIARIO:jornada-002', false));
      await settle();
    }
  });
});

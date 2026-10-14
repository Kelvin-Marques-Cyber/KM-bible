// Teste de fumaça das telas de Estudos (anotações) e Memorização com o
// IndexedDB em memória (fake-indexeddb).
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app, sheets } from '../../src/lib/app';
import { ref } from '../../src/lib/domain';
import { stopReminders } from '../../src/lib/notes-reminders';
import { addCard, backlinks, cards, deleteCard, note, notes, reviewStats, saveNote } from '../../src/lib/store';
import NotesPage, { NoteEditor } from '../../src/screens/Notes';
import MemoryPage, { CreateCard, ReviewPage } from '../../src/screens/Memory';

// O jsdom não calcula dimensões; o virtualizador precisa de uma viewport
// representativa de celular. Simulamos só a área rolável dos testes.
const originalBounds = HTMLElement.prototype.getBoundingClientRect;
const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
      if (this.hasAttribute('data-index')) return 112;
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
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  sheets.length = 0;
  stopReminders();
});

function render(element: ReactElement): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}

async function until(check: () => boolean | Promise<boolean>, timeout = 3000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeout) throw new Error(`Tempo esgotado. Conteúdo: ${host?.textContent?.slice(0, 600)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
}

function type(element: Element, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

const buttons = (label: string) => [...host!.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);
const click = (element: Element | undefined) => {
  if (!element) throw new Error('Elemento não encontrado');
  act(() => (element as HTMLElement).click());
};
const fieldByLabel = (label: string) =>
  [...host!.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === label)?.querySelector('input, textarea, select') ?? null;

describe('NotesPage', () => {
  it('mostra confissões, devocionais, ações, cadernos e filtra a lista', async () => {
    await saveNote({ title: 'Graça em Romanos', body: 'Justificação pela fé', notebook: 'Estudos', tags: 'soteriologia' });
    await saveNote({ title: 'Sermão de domingo', body: 'Esboço sobre a criação\nsegunda linha', notebook: 'Pregações', tags: 'gênesis' });
    const view = render(createElement(NotesPage));
    await until(() => view.textContent!.includes('Sermão de domingo'));
    const text = view.textContent!;
    expect(text.indexOf('Confissões e catecismos')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Devocionais')).toBeGreaterThan(text.indexOf('Confissões e catecismos'));
    for (const label of ['Apologética presbiteriana', 'Mesa de Estudos', 'Arena e laboratório', 'Grafo de estudos', 'Nova anotação']) {
      expect(buttons(label).length).toBe(1);
    }
    expect(text).toContain('Pregações · gênesis');
    expect(text).toContain('Esboço sobre a criação segunda linha');

    // Caderno.
    click(buttons('Pregações')[0]);
    await until(() => !view.textContent!.includes('Graça em Romanos'));
    expect(view.textContent).toContain('Sermão de domingo');
    click(buttons('Todos')[0]);
    await until(() => view.textContent!.includes('Graça em Romanos'));

    // Busca dobrada com debounce.
    type(view.querySelector('input[type=search]')!, 'GRACA');
    await until(() => !view.textContent!.includes('Sermão de domingo'));
    expect(view.textContent).toContain('Graça em Romanos');
    type(view.querySelector('input[type=search]')!, 'inexistente');
    await until(() => view.textContent!.includes('Nenhum item encontrado.'));
  });

  it('atualiza a lista quando uma anotação é salva em outra tela', async () => {
    const view = render(createElement(NotesPage));
    await until(() => view.querySelector('section') !== null && !view.textContent!.includes('Carregando'));
    await act(async () => {
      await saveNote({ title: 'Criada fora', body: '' });
    });
    await until(() => view.textContent!.includes('Criada fora'));
  });

  it('virtualiza listas grandes', async () => {
    for (let i = 0; i < 80; i++) await saveNote({ title: `Nota em massa ${i}`, body: 'x', notebook: 'Massa' }, false);
    const view = render(createElement(NotesPage));
    // Primeiro esperamos os dados carregarem; depois os itens visíveis
    // serem calculados pelo virtualizador (não há layout real no jsdom).
    await until(() => /\d+ anotações/.test(view.querySelector('[aria-live="polite"]')?.textContent ?? ''));
    await until(() => view.querySelectorAll('[data-index]').length > 0, 5000);
    const rendered = [...view.querySelectorAll('[data-index]')].length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(80);
  });
});

describe('NoteEditor', () => {
  it('salva automaticamente, alterna a prévia, mostra menções e exclui com confirmação', async () => {
    const id = await saveNote({ title: 'Original', body: 'corpo', notebook: 'Estudos', tags: '' });
    const other = await saveNote({ title: 'Quem menciona', body: `Veja [[note:${id}]]` });
    expect((await backlinks(id)).map((n) => n.id)).toEqual([other]);

    const view = render(createElement(NoteEditor, { noteId: id }));
    await until(() => fieldByLabel('Título') !== null);
    expect(view.textContent).toContain('Salvo automaticamente no dispositivo');
    const body = view.querySelector('textarea')!;
    expect(body.getAttribute('placeholder')).toBe('Markdown · [[João 3:16]] · [[note:identificador]]');
    expect(body.rows).toBe(14);
    await until(() => view.textContent!.includes('Mencionado por') && view.textContent!.includes('Quem menciona'));

    type(fieldByLabel('Título')!, 'Novo título');
    type(fieldByLabel('Etiquetas')!, 'graça, fé');
    type(body, 'Texto **forte** com [[João 3:16]]');
    await until(async () => (await note(id))?.title === 'Novo título', 2000);
    const saved = await note(id);
    expect(saved).toMatchObject({ title: 'Novo título', tags: 'graça, fé', body: 'Texto **forte** com [[João 3:16]]', notebook: 'Estudos' });

    click(buttons('Visualizar Markdown')[0]);
    expect(view.querySelector('.md strong')?.textContent).toBe('forte');
    click(buttons('Editar')[0]);
    expect(view.querySelector('textarea')).not.toBeNull();

    click(buttons('Excluir')[0]);
    expect(view.querySelector('[role=alertdialog]')).not.toBeNull();
    click(buttons('Cancelar')[0]);
    expect(view.querySelector('[role=alertdialog]')).toBeNull();
    expect(await note(id)).toBeDefined();
    click(buttons('Excluir')[0]);
    const confirm = view.querySelector('[role=alertdialog]')!.querySelectorAll('button');
    click(confirm[confirm.length - 1]);
    await until(async () => (await note(id)) === undefined);
  });

  it('grava a edição pendente ao fechar', async () => {
    const id = await saveNote({ title: 'Rascunho', body: '' });
    const view = render(createElement(NoteEditor, { noteId: id }));
    await until(() => view.querySelector('textarea') !== null);
    type(view.querySelector('textarea')!, 'digitado antes de fechar');
    act(() => root!.unmount());
    root = null;
    await until(async () => (await note(id))?.body === 'digitado antes de fechar', 2000);
  });

  it('anotação inexistente', async () => {
    const view = render(createElement(NoteEditor, { noteId: 'nao-existe' }));
    await until(() => view.textContent!.includes('Não há conteúdo'));
  });
});

describe('Memorização', () => {
  it('lista pendentes, acompanhamento, lembrete e exclui cartões', async () => {
    for (const c of await cards()) await deleteCard(c.id);
    await addCard('ARA', ref(43, 3, 16), 'Porque Deus amou o mundo de tal maneira', 'cloze', 'Amor de Deus');
    await addCard('ARA', ref(45, 8, 28), 'Sabemos que todas as coisas cooperam', 'reference_to_text', '');
    const view = render(createElement(MemoryPage));
    await until(() => view.textContent!.includes('Revisões pendentes: 2'));
    const text = view.textContent!;
    expect(text).toContain('Acompanhamento');
    expect(text).toContain('2 cartões · 0 revisões');
    expect(text).toContain('0% lembrados · 0 com intervalo ≥ 30 dias');
    expect(text).toContain('Lembrete diário opcional');
    expect(text).toContain('João 3:16 · ARA');
    expect(text).toContain('Completar palavras · Amor de Deus');
    expect(buttons('Revisar')[0].disabled).toBe(false);

    click(buttons('Revisar')[0]);
    expect(sheets.length).toBe(1);
    expect(sheets[0].title).toBe('Revisar');

    click(buttons('Excluir: Romanos 8:28')[0]);
    await until(() => view.textContent!.includes('Revisões pendentes: 1'));
    expect(view.textContent).toContain('1 cartões · 0 revisões');
  });

  it('revisa com cloze, revela e avalia até concluir', async () => {
    for (const c of await cards()) await deleteCard(c.id);
    await addCard('ARA', ref(43, 1, 1), 'No princípio era o Verbo', 'cloze', 'Cristologia');
    const [card] = await cards();
    const before = await reviewStats();
    const view = render(createElement(ReviewPage, { cardIds: [card.id] }));
    await until(() => view.textContent!.includes('1 / 1 · Completar palavras'));
    expect(view.textContent).toContain('No princípio era _____ Verbo');
    type(view.querySelector('textarea')!, 'o');
    click(buttons('Mostrar resposta')[0]);
    expect(view.textContent).toContain('João 1:1 · ARA');
    expect(view.textContent).toContain('No princípio era o Verbo');
    expect(view.textContent).toContain('Cristologia');
    for (const label of ['Rever amanhã', 'Difícil', 'Lembrei', 'Com facilidade']) expect(buttons(label).length).toBe(1);
    click(buttons('Lembrei')[0]);
    await until(() => view.textContent!.includes('Concluído'));
    const after = await reviewStats();
    expect(after.n).toBe(before.n + 1);
    const [updated] = await cards();
    expect(updated.repetitions).toBe(1);
    expect(updated.due).toBeGreaterThan(Date.now());
  });

  it('sem ids revisa todos os pendentes', async () => {
    for (const c of await cards()) await deleteCard(c.id);
    await addCard('ARA', ref(19, 23, 1), 'O Senhor é o meu pastor', 'recitation');
    const view = render(createElement(ReviewPage, { cardIds: null }));
    await until(() => view.textContent!.includes('1 / 1 · Recitação livre'));
    expect(view.textContent).toContain('Salmos 23:1');
  });

  it('cria cartão com modo e tema', async () => {
    for (const c of await cards()) await deleteCard(c.id);
    app.translation = 'ARA';
    const view = render(createElement(CreateCard, { reference: ref(43, 3, 16), text: 'Porque Deus amou o mundo' }));
    expect(view.textContent).toContain('João 3:16');
    expect(view.textContent).toContain('Porque Deus amou o mundo');
    const select = fieldByLabel('Modo do cartão') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Referência → texto',
      'Texto → referência',
      'Completar palavras',
      'Recitação livre',
      'Passagem e tema',
    ]);
    type(select, 'theme_card');
    type(fieldByLabel('Tema')!, 'Evangelho');
    click(buttons('Salvar')[0]);
    await until(async () => (await cards()).length === 1);
    const [created] = await cards();
    expect(created).toMatchObject({ reference: '43:3:16', translation: 'ARA', mode: 'theme_card', topic: 'Evangelho', text: 'Porque Deus amou o mundo' });
  });
});

describe('notas: ordem', () => {
  it('mais recentes primeiro', async () => {
    const list = await notes();
    for (let i = 1; i < list.length; i++) expect(list[i - 1].updated_at).toBeGreaterThanOrEqual(list[i].updated_at);
  });
});

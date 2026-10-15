import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ChroniclesCanvas from '../../src/games/chronicles/ChroniclesCanvas';
import { createGame, getMap } from '../../src/games/chronicles/engine';
import Chronicles from '../../src/screens/Chronicles';

const spies = vi.hoisted(() => ({
  load: vi.fn(), save: vi.fn(), verse: vi.fn(), createCard: vi.fn(), showPassage: vi.fn(), message: vi.fn(), draw: vi.fn(), reset: vi.fn(),
  sheets: [] as unknown[], subscribers: new Set<() => void>(), revision: 0,
}));
vi.mock('../../src/games/chronicles/persistence', () => ({ loadGame: spies.load, saveGame: spies.save }));
vi.mock('../../src/games/chronicles/renderer', () => ({ ChroniclesRenderer: class { draw = spies.draw; reset = spies.reset; } }));
vi.mock('../../src/lib/app', async () => {
  const { useSyncExternalStore } = await import('react');
  return { app: { translation: 'BLN4' }, sheets: spies.sheets, useApp: () => useSyncExternalStore(listener => { spies.subscribers.add(listener); return () => spies.subscribers.delete(listener); }, () => spies.revision) };
});
vi.mock('../../src/lib/content', () => ({ verse: spies.verse }));
vi.mock('../../src/screens/open', () => ({ createCard: spies.createCard, showPassage: spies.showPassage }));
vi.mock('../../src/components/ui', () => ({ message: spies.message, Spinner: () => 'Carregando…' }));

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
const disconnect = vi.fn();

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  vi.clearAllMocks();
  spies.sheets.length = 0;
  spies.revision = 0;
  frames.clear();
  spies.load.mockResolvedValue(null);
  spies.save.mockResolvedValue(undefined);
  spies.verse.mockResolvedValue({ text: 'O Senhor vê o coração.' });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform: vi.fn(), imageSmoothingEnabled: false } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect = disconnect; });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextFrame; frames.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null; root = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(element: ReturnType<typeof createElement>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}
function click(text: string) {
  const button = [...host!.querySelectorAll('button')].find(item => item.textContent?.trim() === text || item.getAttribute('aria-label') === text);
  expect(button, `Botão ${text}`).toBeDefined();
  act(() => button!.click());
}
async function until(check: () => boolean) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 3000) throw new Error(`Estado esperado não apareceu: ${host?.textContent?.slice(0, 800)}`);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
}
function advanceFrame(timestamp: number) {
  const callbacks = [...frames.values()]; frames.clear();
  act(() => { for (const callback of callbacks) callback(timestamp); });
}
function key(target: Element, type: 'keydown' | 'keyup', value: string) {
  act(() => { target.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true })); });
}
function sheet(open: boolean) {
  act(() => {
    if (open) spies.sheets.push({}); else spies.sheets.pop();
    spies.revision++;
    for (const listener of spies.subscribers) listener();
  });
}

describe('Crônicas da Aliança: tela e integração', () => {
  it('abre o piloto, apresenta a distinção de ficção e mantém missões e inventário acessíveis', async () => {
    render(createElement(Chronicles, { onBack: vi.fn() }));
    await until(() => host!.textContent!.includes('Começar episódio'));
    expect(host!.textContent).toContain('Neri, seus vizinhos e as tarefas de apoio foram criados para o jogo');
    click('Começar episódio');
    expect(host!.querySelector('[role="dialog"]')?.textContent).toContain('testemunha fictícia');
    expect(host!.querySelector('.pc-root [role="dialog"]')).not.toBeNull();
    expect(host!.querySelector('.pc-dialogue svg[role="img"]')).not.toBeNull();
    click('Continuar');
    expect(host!.querySelector('[role="dialog"]')).toBeNull();
    expect(host!.querySelector('canvas')?.getAttribute('aria-label')).toContain('Povoado das oliveiras');
    click('Missões');
    expect(host!.querySelector('[aria-label="Diário de missões"]')).not.toBeNull();
    click('← Voltar ao jogo');
    expect(host!.querySelector('[aria-label="Diário de missões"]')).toBeNull();
    click('Inventário');
    expect(host!.textContent).toContain('Sua bolsa está vazia');
    click('Mapa');
    expect(host!.querySelectorAll('svg[aria-label]').length).toBeGreaterThanOrEqual(3);
    click('← Voltar ao jogo');
    await until(() => spies.save.mock.calls.length > 0);
    expect(spies.save.mock.calls.at(-1)?.[0].flags).toContain('intro-read');
  });

  it('retoma progresso e reutiliza uma única criação de cartão enquanto a passagem carrega', async () => {
    const saved = { ...createGame(), dialogue: null, codex: ['witness', 'heart'], inventory: ['route-map'], x: 9.5 };
    spies.load.mockResolvedValue(saved);
    let resolveVerse: (value: { text: string }) => void = () => {};
    spies.verse.mockImplementation(() => new Promise(resolve => { resolveVerse = resolve; }));
    render(createElement(Chronicles, { onBack: vi.fn() }));
    await until(() => !!host!.querySelector('[data-pilot-screen="play"]'));
    expect(host!.textContent).not.toContain('Começar episódio');
    click('Inventário');
    expect(host!.textContent).toContain('Mapa do caminho');
    click('Códice');
    click('1 Samuel 16:7–13');
    expect(spies.showPassage).toHaveBeenCalledWith({ book: 9, chapter: 16, verse: 7 });
    click('Memorizar passagem');
    click('Memorizar passagem');
    expect(spies.verse).toHaveBeenCalledTimes(1);
    expect(spies.createCard).not.toHaveBeenCalled();
    await act(async () => resolveVerse({ text: 'O Senhor vê o coração.' }));
    expect(spies.createCard).toHaveBeenCalledExactlyOnceWith({ book: 9, chapter: 16, verse: 7 }, 'O Senhor vê o coração.');
  });

  it('informa falta da passagem offline e não cria um cartão com texto inventado', async () => {
    spies.load.mockResolvedValue({ ...createGame(), dialogue: null, codex: ['heart'] });
    spies.verse.mockResolvedValue(null);
    render(createElement(Chronicles, { onBack: vi.fn() }));
    await until(() => !!host!.querySelector('[data-pilot-screen="play"]'));
    click('Códice'); click('Memorizar passagem');
    await until(() => spies.message.mock.calls.length > 0);
    expect(spies.message.mock.calls[0][0]).toContain('Baixe esta passagem');
    expect(spies.createCard).not.toHaveBeenCalled();
  });

  it('mantém o mundo como palco, alterna overlays por atalhos e devolve o foco ao cenário', async () => {
    spies.load.mockResolvedValue({ ...createGame(), dialogue: null });
    render(createElement(Chronicles, { onBack: vi.fn(), slot: 2 }));
    await until(() => !!host!.querySelector('[data-pilot-screen="play"]'));
    expect(spies.load).toHaveBeenCalledWith(2);
    const canvas = host!.querySelector('canvas')!;
    expect(document.activeElement).toBe(canvas);
    for (const [shortcut, name] of [['i', 'Bolsa de Neri'], ['j', 'Diário de missões'], ['m', 'Mapa do episódio'], ['c', 'Códice dos Testemunhos']] as const) {
      key(document.activeElement!, 'keydown', shortcut);
      const dialog = host!.querySelector(`[role="dialog"][aria-label="${name}"]`)!;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.contains(document.activeElement)).toBe(true);
      key(document.activeElement!, 'keydown', 'Escape');
      expect(host!.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(canvas);
    }
    key(canvas, 'keydown', 'Escape');
    const pause = host!.querySelector('[role="dialog"][aria-label="Menu de pausa"]')!;
    expect(pause.textContent).toContain('Exportar progresso');
    const controls = [...pause.querySelectorAll('button')];
    act(() => controls.at(-1)!.focus());
    key(controls.at(-1)!, 'keydown', 'Tab');
    expect(document.activeElement).toBe(controls[0]);
    act(() => canvas.focus());
    advanceFrame(100); key(canvas, 'keydown', 'd'); advanceFrame(150);
    expect(spies.draw.mock.calls.at(-1)?.[2].x).toBe(6.5);
    click('Continuar');
    expect(document.activeElement).toBe(canvas);
    advanceFrame(200);
    expect(spies.draw.mock.calls.at(-1)?.[2].x).toBe(6.5);
    await until(() => spies.save.mock.calls.length > 0);
    expect(spies.save.mock.calls.at(-1)?.[1]).toBe(2);
  });

  it('pausa durante o diálogo sem perder a cena e exige confirmação para recomeçar', async () => {
    spies.load.mockResolvedValue(createGame());
    render(createElement(Chronicles, { onBack: vi.fn() }));
    await until(() => !!host!.querySelector('.pc-dialogue'));
    key(document.activeElement!, 'keydown', 'Escape');
    expect(host!.querySelector('.pc-dialogue')).toBeNull();
    click('Recomeçar episódio');
    expect(host!.querySelector('[aria-label="Recomeçar episódio"]')?.textContent).toContain('substituirá o progresso');
    click('Cancelar reinício');
    click('Continuar');
    expect(host!.querySelector('.pc-dialogue')?.textContent).toContain('testemunha fictícia');
  });

  it('preserva o códice e devolve foco ao abrir e fechar o leitor ou a criação de cartão', async () => {
    spies.load.mockResolvedValue({ ...createGame(), dialogue: null, codex: ['witness', 'heart'] });
    render(createElement(Chronicles, { onBack: vi.fn() }));
    await until(() => !!host!.querySelector('[data-pilot-screen="play"]'));
    click('Códice');
    const reference = [...host!.querySelectorAll('button')].find(button => button.textContent?.includes('1 Samuel 16:7–13'))!;
    act(() => reference.focus());
    click('1 Samuel 16:7–13');
    sheet(true);
    key(reference, 'keydown', 'Escape');
    expect(host!.querySelector('[aria-label="Códice dos Testemunhos"]')).not.toBeNull();
    act(() => reference.blur());
    sheet(false);
    expect(document.activeElement).toBe(reference);
    const memory = [...host!.querySelectorAll('button')].find(button => button.textContent === 'Memorizar passagem')!;
    act(() => memory.focus());
    click('Memorizar passagem');
    await until(() => spies.createCard.mock.calls.length > 0);
    sheet(true);
    act(() => memory.blur());
    sheet(false);
    expect(document.activeElement).toBe(memory);
    click('← Voltar ao jogo');
    const canvas = host!.querySelector('canvas')!;
    expect(document.activeElement).toBe(canvas);
    sheet(true);
    advanceFrame(100); key(canvas, 'keydown', 'd'); advanceFrame(150);
    expect(spies.draw.mock.calls.at(-1)?.[2].x).toBe(6.5);
    sheet(false);
    expect(document.activeElement).toBe(canvas);
  });
});

describe('Canvas: teclado, pausa e ciclo de vida', () => {
  it('move apenas com foco no cenário, limpa teclas no blur e cancela recursos no unmount', () => {
    const onMove = vi.fn(), onInteract = vi.fn();
    render(createElement(ChroniclesCanvas, { world: getMap('village'), player: { x: 6.5, y: 10.5, facing: 'down' }, paused: false, onMove, onInteract }));
    const canvas = host!.querySelector('canvas')!;
    key(document.body, 'keydown', 'd'); advanceFrame(100); advanceFrame(116);
    expect(onMove).not.toHaveBeenCalled();
    act(() => canvas.focus());
    key(canvas, 'keydown', 'd'); advanceFrame(132);
    expect(onMove).toHaveBeenLastCalledWith({ dx: 1, dy: 0, run: false }, 0.016);
    key(canvas, 'keydown', 'Shift'); advanceFrame(148);
    expect(onMove.mock.calls.at(-1)?.[0].run).toBe(true);
    key(canvas, 'keydown', 'e');
    expect(onInteract).toHaveBeenCalledTimes(1);
    const calls = onMove.mock.calls.length;
    act(() => canvas.blur()); advanceFrame(164);
    expect(onMove).toHaveBeenCalledTimes(calls);
    act(() => root!.unmount()); root = null;
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(spies.reset).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });

  it('combina o controle de toque, respeita pausa e interrompe frames ao ocultar a página', () => {
    const onMove = vi.fn(), onInteract = vi.fn();
    const props = { world: getMap('village'), player: { x: 6.5, y: 10.5, facing: 'down' as const }, paused: false, onMove, onInteract, touchInput: { dx: 0, dy: -1, run: false } };
    render(createElement(ChroniclesCanvas, props));
    advanceFrame(100); advanceFrame(120);
    expect(onMove).toHaveBeenLastCalledWith({ dx: 0, dy: -1, run: false }, 0.02);
    act(() => root!.render(createElement(ChroniclesCanvas, { ...props, paused: true })));
    const calls = onMove.mock.calls.length;
    advanceFrame(140); key(host!.querySelector('canvas')!, 'keydown', 'Enter');
    expect(onMove).toHaveBeenCalledTimes(calls);
    expect(onInteract).not.toHaveBeenCalled();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(frames.size).toBe(0);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(frames.size).toBe(1);
  });
});

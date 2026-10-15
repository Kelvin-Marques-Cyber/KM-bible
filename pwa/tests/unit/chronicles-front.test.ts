import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameFront from '../../src/games/chronicles/GameFront';
import SaveSlots from '../../src/games/chronicles/SaveSlots';
import { emptyProgress } from '../../src/games/chronicles/campaign-engine';
import type { SaveSlotSummary } from '../../src/games/chronicles/save-slots';

let host: HTMLDivElement, root: Root;
const slots: SaveSlotSummary[] = [1, 2, 3].map(id => ({id: id as 1 | 2 | 3, status: id === 1 ? 'saved' : 'empty', completed: 2, chapter: 'A Criação', kind: 'campaign', hasPilot: false}));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {act(() => root.unmount());host.remove();vi.restoreAllMocks();});
const click = (name: string) => {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === name || b.getAttribute('aria-label') === name);
  expect(button, name).toBeDefined();act(() => button!.click());
};
const key = (target: Element, value: string, shiftKey = false) => act(() => {
  target.dispatchEvent(new KeyboardEvent('keydown', {key: value, shiftKey, bubbles: true, cancelable: true}));
});
function front() {
  act(() => root.render(createElement(GameFront, {
    progress: emptyProgress(), saga: 0, onSaga: vi.fn(), onBegin: vi.fn(), onPilot: vi.fn(), onBack: vi.fn(), onExport: vi.fn(),
    slots, activeSlot: 1, slotBusy: false, onChooseSlot: vi.fn().mockResolvedValue(true), sound: false, onSound: vi.fn(), onReference: vi.fn(), onMemorize: vi.fn(),
  })));
}

describe('Menu do RPG e confirmação dos três livros', () => {
  it('percorre o menu com setas e mantém Escape de outra janela fora da navegação do jogo', () => {
    front();
    expect(document.activeElement?.textContent).toContain('Continuar');
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement?.textContent).toContain('Novo jogo');
    key(document.activeElement!, 'End');
    expect(document.activeElement?.textContent).toBe(' Voltar ');
    click('Aventuras');
    expect(host.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('world');
    const external = document.createElement('button'); document.body.append(external); external.focus();
    key(external, 'Escape');
    expect(host.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('world');
    external.remove();
    key(host.querySelector('.gf-back')!, 'Escape');
    expect(host.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('title');
  });

  it('cancela sobrescrita com Escape, restaura foco ao livro e exige confirmação explícita', async () => {
    const choose = vi.fn().mockResolvedValue(true);
    act(() => root.render(createElement(SaveSlots, {mode:'new', slots, busy:false, onBack:vi.fn(), onChoose:choose})));
    click('Selecionar save 1');
    const dialog = host.querySelector('[role=alertdialog]')!;
    expect(dialog).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Manter meu save');
    key(document.activeElement!, 'Tab');
    expect(document.activeElement?.textContent).toContain('Confirmar sobrescrita');
    key(document.activeElement!, 'Escape');
    expect(host.querySelector('[role=alertdialog]')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Selecionar save 1');
    expect(choose).not.toHaveBeenCalled();
    click('Selecionar save 1');
    await act(async () => click('Confirmar sobrescrita'));
    expect(choose).toHaveBeenCalledExactlyOnceWith(1, true, false);
  });

  it('bloqueia abertura repetida enquanto um save está sendo carregado', async () => {
    let finish!: (ok: boolean) => void;
    const choose = vi.fn(() => new Promise<boolean>(resolve => {finish = resolve;}));
    act(() => root.render(createElement(SaveSlots, {mode:'continue', slots, busy:false, onBack:vi.fn(), onChoose:choose})));
    click('Selecionar save 1');click('Selecionar save 1');
    expect(choose).toHaveBeenCalledTimes(1);
    await act(async () => finish(true));
  });
});

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import MezuzahClassic, { CLASSIC_SAVE_KEY, ClassicPlay } from '../../src/screens/MezuzahClassic';
import { chooseNumber, createClassicGame, drawCard, isClassicGame, resolveChallenge } from '../../src/games/mezuzah-classic/engine';

let host: HTMLDivElement | null = null;
let root: Root | null = null;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array.fill(0); return array;
  }) as typeof crypto.getRandomValues);
});
afterEach(() => {
  act(() => root?.unmount()); host?.remove(); root = null; host = null;
  vi.useRealTimers(); vi.restoreAllMocks();
});
function render(element: ReactNode = createElement(MezuzahClassic, { onBack: vi.fn() })) {
  host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
}
function unmount() {
  act(() => root?.unmount()); root = null; host?.remove(); host = null;
}
function button(text: string) {
  const found = [...host!.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  expect(found, `Botão “${text}” deve existir`).toBeDefined();
  return found!;
}
function click(text: string) { act(() => button(text).click()); }
function input(label: string, value: string) {
  const found = host!.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(found, `Campo “${label}” deve existir`).not.toBeNull();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(found, value);
    found!.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function select(element: HTMLSelectElement, value: string) {
  act(() => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); });
}
function configure() { input('Passos até a estrela', '3'); input('Passos na volta da estrela', '3'); }
function saved() { return JSON.parse(localStorage.getItem(CLASSIC_SAVE_KEY)!); }

describe('Mezuzá clássico: tela local e persistência', () => {
  it('oferece percurso autoral ajustável, recusa valores inválidos e preserva acesso sem WebGL', () => {
    render();
    expect(host!.querySelector('#mezuzah-classic-players')).not.toBeNull();
    expect(host!.querySelector('[aria-label="Resumo acessível da partida sem WebGL"]')).not.toBeNull();
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="Passos até a estrela"]')?.value).toBe('12');
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="Passos na volta da estrela"]')?.value).toBe('12');
    expect(button('Iniciar partida clássica').disabled).toBe(false);
    expect(host!.textContent).toContain('30 atividades desta versão são autorais');
    input('Passos até a estrela', ''); input('Passos na volta da estrela', '');
    expect(button('Iniciar partida clássica').disabled).toBe(true);
    input('Passos até a estrela', '2'); input('Passos na volta da estrela', '3');
    expect(button('Iniciar partida clássica').disabled).toBe(true);
    input('Passos até a estrela', '3');
    expect(button('Iniciar partida clássica').disabled).toBe(false);
  });

  it('usa equipe mais velha e leitor à direita, compra, escolhe e registra um acerto sem dado', () => {
    render();
    select(host!.querySelector<HTMLSelectElement>('#mezuzah-classic-players')!, '3');
    const oldest = [...host!.querySelectorAll('select')].find(el => el.id !== 'mezuzah-classic-players')!;
    select(oldest, '2'); configure(); click('Iniciar partida clássica');
    expect(host!.textContent).toContain('Vez de Equipe 3');
    expect(host!.textContent).toContain('Leitor à direita: Equipe 2');
    expect(host!.textContent).not.toMatch(/Lançar dado|pontos de sabedoria|49 casas|Classificação/);
    expect(host!.querySelector('#mezuzah-classic-players')).toBeNull();
    click('Comprar cartão');
    expect(host!.textContent).toContain('Equipe 3, escolha um número de 1 a 10');
    expect(host!.textContent).not.toContain('Quem recebeu a tarefa de construir a arca');
    click('1');
    expect(host!.textContent).toContain('Desafio individual · sem repasse');
    expect(host!.textContent).toContain('Quem recebeu a tarefa de construir a arca');
    expect([...host!.querySelectorAll('button')].filter(b => b.textContent?.includes('Confirmar acerto')).map(b => b.textContent?.trim())).toEqual(['Confirmar acerto de Equipe 3']);
    click('Leitor: conferir orientação e resposta');
    expect(host!.textContent).toContain('Noé.');
    click('Confirmar acerto de Equipe 3');
    expect(host!.textContent).toContain('Vez de Equipe 1');
    expect(host!.textContent).toContain('Equipe 3: +1 passo');
    expect(saved().players.map((p: { steps: number }) => p.steps)).toEqual([0, 0, 1]);
    expect(isClassicGame(saved())).toBe(true);
  });

  it('exclui a equipe leitora no coletivo e deixa outra equipe vencer sem alterar a ordem do turno', () => {
    render();
    select(host!.querySelector<HTMLSelectElement>('#mezuzah-classic-players')!, '4');
    configure(); click('Iniciar partida clássica'); click('Comprar cartão'); click('3');
    expect(host!.textContent).toContain('Desafio coletivo · leitor e equipe excluídos');
    const names = [...host!.querySelectorAll('button')].filter(b => b.textContent?.includes('Confirmar acerto')).map(b => b.textContent?.trim());
    expect(names).toEqual(['Confirmar acerto de Equipe 1', 'Confirmar acerto de Equipe 2', 'Confirmar acerto de Equipe 3']);
    click('Confirmar acerto de Equipe 3');
    expect(host!.textContent).toContain('Vez de Equipe 2');
    expect(saved().players.map((p: { steps: number }) => p.steps)).toEqual([0, 0, 1, 0]);
    expect(saved().history[0].readerId).toBe('p3');
  });

  it('passa a vez sem penalidade quando ninguém conclui e não aplica repasse', () => {
    render(); configure(); click('Iniciar partida clássica'); click('Comprar cartão'); click('1');
    click('Ninguém concluiu · passar a vez');
    expect(host!.textContent).toContain('Vez de Equipe 2');
    expect(host!.textContent).toContain('Sem avanço');
    expect(saved().players.map((p: { steps: number }) => p.steps)).toEqual([0, 0]);
    expect(saved().phase).toBe('draw');
  });

  it('restaura o cartão escolhido e seu histórico, mantendo o gabarito oculto inicialmente', () => {
    render(); configure(); click('Iniciar partida clássica'); click('Comprar cartão'); click('1');
    click('Confirmar acerto de Equipe 1'); click('Comprar cartão'); click('1');
    click('Leitor: conferir orientação e resposta');
    expect(host!.textContent).toContain('Noé.');
    const before = saved(); unmount(); render();
    expect(host!.querySelector('#mezuzah-classic-players')).toBeNull();
    expect(host!.textContent).toContain('Vez de Equipe 2');
    expect(host!.textContent).toContain('Quem recebeu a tarefa de construir a arca');
    expect(host!.textContent).not.toContain('Noé.');
    expect(host!.textContent).toContain('Equipe 1: +1 passo');
    expect(saved()).toEqual(before);
    click('Confirmar acerto de Equipe 2');
    expect(saved().players.map((p: { steps: number }) => p.steps)).toEqual([1, 1]);
  });

  it('exige confirmação para reiniciar, permite cancelar e preserva salvamento legado', () => {
    localStorage.setItem('km-mezuzah-v1', '{"legacy":"preservado"}');
    render(); configure(); click('Iniciar partida clássica'); click('Comprar cartão'); click('1');
    click('Confirmar acerto de Equipe 1');
    const before = localStorage.getItem(CLASSIC_SAVE_KEY);
    click('Nova partida / revanche');
    expect(button('Confirmar nova partida')).toBeDefined();
    expect(localStorage.getItem(CLASSIC_SAVE_KEY)).toBe(before);
    click('Cancelar');
    expect(host!.textContent).toContain('Equipe 1: +1 passo');
    click('Nova partida / revanche'); click('Confirmar nova partida');
    expect(host!.querySelector('#mezuzah-classic-players')).not.toBeNull();
    expect(localStorage.getItem(CLASSIC_SAVE_KEY)).toBeNull();
    expect(localStorage.getItem('km-mezuzah-v1')).toBe('{"legacy":"preservado"}');
    expect(button('Retomar adaptação anterior salva · regras diferentes')).toBeDefined();
  });

  it('recusa progresso adulterado na restauração e informa falha ao salvar', () => {
    const forged = createClassicGame(['Ana', 'Bia'], { oldestIndex: 0, outerSteps: 3, starSteps: 3 });
    forged.players[0].steps = 6;
    localStorage.setItem(CLASSIC_SAVE_KEY, JSON.stringify(forged));
    render();
    expect(host!.querySelector('#mezuzah-classic-players')).not.toBeNull();
    configure();
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    click('Iniciar partida clássica');
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain('Partida em memória');
    expect(button('Comprar cartão').disabled).toBe(false);
    save.mockRestore();
  });

  it('retoma uma vitória no centro com ações encerradas e permite preparar revanche', () => {
    let game = createClassicGame(['Ana', 'Bia'], { oldestIndex: 0, outerSteps: 3, starSteps: 3 });
    while (game.phase !== 'finished') {
      game = resolveChallenge(chooseNumber(drawCard(game, 0), 1), game.turn === 0 ? 'p0' : null);
    }
    localStorage.setItem(CLASSIC_SAVE_KEY, JSON.stringify(game));
    render();
    expect(host!.textContent).toContain('Ana chegou ao centro!');
    expect(host!.textContent).toContain('Percurso concluído conforme as etapas configuradas');
    expect([...host!.querySelectorAll('button')].some(b => b.textContent?.trim() === 'Comprar cartão')).toBe(false);
    expect(host!.querySelectorAll('progress[value="7"][max="7"]').length).toBeGreaterThan(0);
    click('Nova partida / revanche');
    expect(button('Confirmar nova partida')).toBeDefined();
    expect(saved().phase).toBe('finished');
  });

  it('oculta o gabarito e desativa a avaliação quando o participante não é o leitor autorizado', () => {
    const game = chooseNumber(drawCard(createClassicGame(['Ana', 'Bia', 'Caio'], { oldestIndex: 0, outerSteps: 3, starSteps: 3 }), 0), 3);
    const onResolve = vi.fn();
    render(createElement(ClassicPlay, { game, canResolve: false, onDraw: vi.fn(), onChoose: vi.fn(), onResolve }));
    expect(host!.textContent).toContain('Aguardando a avaliação do leitor');
    expect(host!.textContent).not.toContain('Leitor: conferir orientação e resposta');
    expect(button('Confirmar acerto de Ana').disabled).toBe(true);
    expect(button('Confirmar acerto de Bia').disabled).toBe(true);
    expect(button('Ninguém concluiu · passar a vez').disabled).toBe(true);
    act(() => button('Confirmar acerto de Ana').click());
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('o lembrete de um minuto não resolve o desafio nem derrota automaticamente', () => {
    const game = chooseNumber(drawCard(createClassicGame(['Ana', 'Bia'], { oldestIndex: 0, outerSteps: 3, starSteps: 3 }), 0), 1);
    const onResolve = vi.fn();
    render(createElement(ClassicPlay, { game, onDraw: vi.fn(), onChoose: vi.fn(), onResolve }));
    vi.useFakeTimers(); click('Lembrete opcional de 1 minuto');
    for (let i = 0; i < 60; i++) act(() => vi.advanceTimersByTime(1000));
    expect(host!.querySelector('[role="timer"]')?.textContent).toContain('o grupo decide');
    expect(onResolve).not.toHaveBeenCalled();
    expect(button('Confirmar acerto de Ana').disabled).toBe(false);
  });
});

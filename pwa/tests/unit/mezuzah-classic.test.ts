import { describe, expect, it } from 'vitest';
import {
  CLASSIC_CARDS, CLASSIC_KIND_LABELS, RULES_SOURCE, chooseNumber, createClassicGame,
  drawCard, eligiblePlayers, isClassicGame, isClassicSnapshot, resolveChallenge, routePhase, totalSteps,
  type ClassicGame,
} from '../../src/games/mezuzah-classic/engine';

const setup = (n = 2, oldestIndex = 0) => createClassicGame(
  ['Ana', 'Bia', 'Caio', 'Davi'].slice(0, n), { oldestIndex, outerSteps: 3, starSteps: 3 },
);
const challenge = (game: ClassicGame, number = 1, card = 0) => chooseNumber(drawCard(game, card), number);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function moveFirstPlayer(game: ClassicGame): ClassicGame {
  while (game.turn !== 0) game = resolveChallenge(challenge(game), null);
  return resolveChallenge(challenge(game), game.players[0].id);
}

describe('Mezuzá clássico: procedimentos publicados e mediação humana', () => {
  it('cria partidas válidas de duas a quatro equipes, começando pelo mais velho indicado', () => {
    for (let n = 2; n <= 4; n++) {
      const game = setup(n, n - 1);
      expect(game.turn).toBe(n - 1);
      expect(game.oldestIndex).toBe(n - 1);
      expect(game.players).toHaveLength(n);
      expect(game.players.every(p => p.steps === 0)).toBe(true);
      expect(game.version).toBe(2);
      expect(game.edition).toBe('classic');
      expect(game.phase).toBe('draw');
      expect(isClassicGame(game)).toBe(true);
    }
  });

  it('exige percurso explícito, limites inteiros e participante mais velho válido', () => {
    for (const options of [undefined, {}, { oldestIndex: 2, outerSteps: 3, starSteps: 3 },
      { oldestIndex: 0, outerSteps: 2, starSteps: 3 }, { oldestIndex: 0, outerSteps: 101, starSteps: 3 },
      { oldestIndex: 0, outerSteps: 3, starSteps: 2 }, { oldestIndex: 0, outerSteps: 3, starSteps: 100.5 },
      { oldestIndex: 0, outerSteps: 3, starSteps: 3, official: true }]) {
      expect(() => createClassicGame(['Ana', 'Bia'], options as never)).toThrow();
    }
    expect(totalSteps(createClassicGame(['A', 'B'], { oldestIndex: 0, outerSteps: 100, starSteps: 100 }))).toBe(201);
  });

  it('recusa equipes insuficientes, nomes duplicados e caracteres invisíveis', () => {
    for (const names of [[], ['Ana'], ['A', 'B', 'C', 'D', 'E'], ['Ana', 'ana'], ['A', ''],
      ['A', 'b'.repeat(25)], ['Ana', 'B\u0000ia'], ['José', 'Jose\u0301']]) {
      expect(() => createClassicGame(names, { oldestIndex: 0, outerSteps: 3, starSteps: 3 })).toThrow();
    }
    expect(createClassicGame([' Ana ', ' Bia '], { oldestIndex: 0, outerSteps: 3, starSteps: 3 }).players.map(p => p.name)).toEqual(['Ana', 'Bia']);
  });

  it('oferece três cartões autorais com dez atividades e as sete dinâmicas', () => {
    expect(CLASSIC_CARDS).toHaveLength(3);
    expect(new Set(CLASSIC_CARDS.map(c => c.id)).size).toBe(CLASSIC_CARDS.length);
    const activities = CLASSIC_CARDS.flatMap(c => [...c.activities]);
    expect(new Set(activities.map(a => a.kind)).size).toBe(7);
    expect(new Set(activities.map(a => a.scope))).toEqual(new Set(['individual', 'collective']));
    for (const card of CLASSIC_CARDS) {
      expect(card.activities.map(a => a.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const a of card.activities) {
        expect(CLASSIC_KIND_LABELS[a.kind]).toBeTruthy();
        expect(a.prompt.length).toBeGreaterThan(10);
        expect(a.answer.length).toBeGreaterThan(0);
        expect(a.reference.length).toBeGreaterThan(3);
      }
    }
    expect(Object.isFrozen(CLASSIC_CARDS[0].activities[0])).toBe(true);
    expect(RULES_SOURCE).toMatch(/^https:\/\/mezuzas\.blogspot\.com\//);
  });

  it('obriga comprar um cartão antes de escolher 1–10 e resolver o desafio', () => {
    const initial = setup();
    expect(() => chooseNumber(initial, 1)).toThrow();
    expect(() => resolveChallenge(initial, 'p0')).toThrow();
    expect(eligiblePlayers(initial)).toEqual([]);
    const drawn = drawCard(initial, 1);
    expect(drawn.phase).toBe('choose');
    expect(drawn.pending).toEqual({ cardId: CLASSIC_CARDS[1].id, number: null, kind: null, scope: null, prompt: '', answer: '', reference: '' });
    expect(isClassicGame(clone(drawn))).toBe(true);
    expect(() => drawCard(drawn, 0)).toThrow();
    expect(() => resolveChallenge(drawn, 'p0')).toThrow();
    const pending = chooseNumber(drawn, 10);
    expect(pending.pending).toEqual({ cardId: CLASSIC_CARDS[1].id, ...CLASSIC_CARDS[1].activities[9] });
    expect(isClassicGame(pending)).toBe(true);
    expect(() => chooseNumber(pending, 2)).toThrow();
  });

  it('recusa sorteios e números fora dos limites, fracionários ou não numéricos', () => {
    for (const index of [-1, CLASSIC_CARDS.length, 0.5, NaN, Infinity, '0']) expect(() => drawCard(setup(), index as number)).toThrow();
    const drawn = drawCard(setup(), 0);
    for (const number of [0, 11, -1, 1.5, NaN, '1']) expect(() => chooseNumber(drawn, number as number)).toThrow();
  });

  it('permite somente à equipe da vez cumprir o desafio individual, sem repasse', () => {
    const pending = challenge(setup(4, 2));
    expect(eligiblePlayers(pending).map(p => p.id)).toEqual(['p2']);
    for (const id of ['p0', 'p1', 'p3', 'invasor']) expect(() => resolveChallenge(pending, id)).toThrow();
    const done = resolveChallenge(pending, 'p2');
    expect(done.players.map(p => p.steps)).toEqual([0, 0, 1, 0]);
    expect(done.turn).toBe(3);
    expect(done.pending).toBeNull();
    expect(done.history[0].readerId).toBe('p1');
    expect(() => resolveChallenge(done, 'p0')).toThrow();
  });

  it('exclui o leitor à direita e toda sua equipe do desafio coletivo', () => {
    const pending = challenge(setup(4, 1), 3);
    expect(eligiblePlayers(pending).map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(() => resolveChallenge(pending, 'p0')).toThrow();
    const done = resolveChallenge(pending, 'p3');
    expect(done.history[0].readerId).toBe('p0');
    expect(done.players.map(p => p.steps)).toEqual([0, 0, 0, 1]);
  });

  it('avança o turno original no sentido horário mesmo quando outra equipe vence o coletivo', () => {
    const done = resolveChallenge(challenge(setup(4, 1), 3), 'p3');
    expect(done.turn).toBe(2);
    expect(done.roundId).toBe(1);
    expect(done.phase).toBe('draw');
    expect(done.history[0]).toMatchObject({ roundId: 0, turn: 1, readerId: 'p0', number: 3, scope: 'collective', winnerId: 'p3' });
    const wrapped = resolveChallenge(challenge(setup(4, 3)), null);
    expect(wrapped.turn).toBe(0);
    expect(wrapped.history[0].readerId).toBe('p2');
  });

  it('mantém apenas a equipe da vez elegível no coletivo com duas equipes', () => {
    const pending = challenge(setup(2, 0), 3);
    expect(eligiblePlayers(pending).map(p => p.id)).toEqual(['p0']);
    expect(() => resolveChallenge(pending, 'p1')).toThrow();
    expect(resolveChallenge(pending, 'p0').players[0].steps).toBe(1);
  });

  it('registra ninguém acertou sem avanço, recuo, pontos ou nova tentativa', () => {
    const pending = challenge(setup(3), 3);
    const done = resolveChallenge(pending, null);
    expect(done.players.every(p => p.steps === 0)).toBe(true);
    expect(done.history[0].winnerId).toBeNull();
    expect(done.turn).toBe(1);
    expect(done.phase).toBe('draw');
    expect(Object.keys(done.players[0])).not.toContain('score');
    expect(Object.keys(done)).not.toContain('roll');
  });

  it('preserva entradas e não devolve referências mutáveis em eligiblePlayers', () => {
    const initial = setup(3);
    const snapshot = clone(initial);
    const pending = challenge(initial);
    const before = clone(pending);
    const list = eligiblePlayers(pending);
    list[0].steps = 99;
    resolveChallenge(pending, 'p0');
    expect(initial).toEqual(snapshot);
    expect(pending).toEqual(before);
  });

  it('exige Israel, volta completa na estrela e um último avanço ao centro para vencer', () => {
    let game = setup();
    expect(totalSteps(game)).toBe(7);
    expect(routePhase(game, 'p0')).toBe('outer');
    for (let i = 0; i < 3; i++) game = moveFirstPlayer(game);
    expect(game.players[0].steps).toBe(3);
    expect(routePhase(game, game.players[0])).toBe('star');
    expect(game.winner).toBeNull();
    for (let i = 0; i < 3; i++) game = moveFirstPlayer(game);
    expect(game.players[0].steps).toBe(6);
    expect(game.phase).toBe('draw');
    expect(routePhase(game, 'p0')).toBe('star');
    game = moveFirstPlayer(game);
    expect(game.players[0].steps).toBe(7);
    expect(routePhase(game, 'p0')).toBe('center');
    expect(game.phase).toBe('finished');
    expect(game.winner).toBe('p0');
    expect(game.pending).toBeNull();
    expect(isClassicGame(clone(game))).toBe(true);
    expect(() => drawCard(game, 0)).toThrow();
    expect(() => chooseNumber(game, 1)).toThrow();
    expect(() => resolveChallenge(game, 'p0')).toThrow();
  });

  it('restaura cada fase e histórico completo, aceitando ordem diferente das propriedades', () => {
    const original = setup(4, 3);
    const completed = resolveChallenge(challenge(original, 3), 'p1');
    for (const state of [original, drawCard(completed, 2), challenge(completed, 7, 2), completed]) expect(isClassicGame(clone(state))).toBe(true);
    const reversed = Object.fromEntries(Object.entries(completed).reverse());
    expect(isClassicGame(reversed)).toBe(true);
  });

  it('atribui a vitória no centro à equipe vencedora do coletivo, mesmo fora de sua vez', () => {
    let game = setup(4);
    for (let i = 0; i < 6; i++) {
      while (game.turn !== 3) game = resolveChallenge(challenge(game), null);
      game = resolveChallenge(challenge(game), 'p3');
    }
    game = resolveChallenge(challenge(game), null); // A vez original passa de p0 para p1.
    expect(game.turn).toBe(1);
    const end = resolveChallenge(challenge(game, 3), 'p3');
    expect(end.winner).toBe('p3');
    expect(end.players[3].steps).toBe(7);
    expect(end.phase).toBe('finished');
    expect(end.turn).toBe(2);
    expect(isClassicGame(end)).toBe(true);
  });

  it('rejeita saves adulterados, campos extras, identidade e progresso falsificados', () => {
    const game = setup();
    for (const value of [null, [], {}, { ...game, version: 1 }, { ...game, edition: 'novo' },
      { ...game, turn: 99 }, { ...game, phase: 'finished', winner: 'p0' }, { ...game, roll: 6 },
      { ...game, id: 'outra' }, { ...game, roundId: 1 }, { ...game, winner: 'p1' },
      { ...game, players: [{ ...game.players[0], steps: 1 }, game.players[1]] },
      { ...game, players: [{ ...game.players[0], id: 'p1' }, game.players[1]] },
      { ...game, players: [{ ...game.players[0], score: 10 }, game.players[1]] },
      { ...game, route: { ...game.route, starSteps: 100 } },
      { ...game, route: { ...game.route, official: true } }]) expect(isClassicGame(value)).toBe(false);
    expect(() => drawCard({ ...game, turn: 99 }, 0)).toThrow();
  });

  it('rejeita gabarito, escopo e resultado de histórico forjados por replay canônico', () => {
    const pending = challenge(setup(4, 1), 3);
    for (const field of ['prompt', 'answer', 'reference', 'kind', 'scope', 'cardId']) {
      expect(isClassicGame({ ...pending, pending: { ...pending.pending, [field]: 'forjado' } })).toBe(false);
    }
    const done = resolveChallenge(pending, 'p3');
    for (const patch of [{ winnerId: 'p0' }, { readerId: 'p2' }, { turn: 3 }, { roundId: 20 }, { number: 1 },
      { kind: 'song' }, { scope: 'individual' }, { extra: true }]) {
      expect(isClassicGame({ ...done, history: [{ ...done.history[0], ...patch }] })).toBe(false);
    }
    expect(isClassicGame({ ...done, players: done.players.map(p => ({ ...p, steps: 0 })) })).toBe(false);
  });

  it('rejeita participantes inexistentes ou adulterados ao consultar o percurso', () => {
    const game = setup();
    expect(() => routePhase(game, 'invasor')).toThrow();
    expect(() => routePhase(game, { ...game.players[0], steps: 5 })).toThrow();
  });

  it('aceita snapshot com resposta ocultada para leitura, sem permitir usá-lo como save ou comando', () => {
    const full = challenge(setup(3), 3);
    const publicState: ClassicGame = { ...full, pending: { ...full.pending!, answer: '' } };
    expect(isClassicSnapshot(publicState)).toBe(true);
    expect(isClassicGame(publicState)).toBe(false);
    expect(eligiblePlayers(publicState).map(p => p.id)).toEqual(['p0', 'p1']);
    expect(totalSteps(publicState)).toBe(7);
    expect(routePhase(publicState, 'p0')).toBe('outer');
    expect(() => resolveChallenge(publicState, 'p0')).toThrow();
    expect(isClassicSnapshot({ ...publicState, pending: { ...publicState.pending, prompt: 'outra pergunta' } })).toBe(false);
    expect(isClassicSnapshot({ ...publicState, pending: { ...publicState.pending, answer: 'forjada' } })).toBe(false);
  });
});

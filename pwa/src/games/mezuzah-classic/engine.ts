import { CLASSIC_CARDS, type ClassicKind, type ClassicScope } from './content.ts';
export { CLASSIC_CARDS, CLASSIC_KIND_LABELS, RULES_SOURCE } from './content.ts';
export type { ClassicKind, ClassicScope, ClassicActivity, ClassicCard } from './content.ts';

export const CLASSIC_COLORS = ['#e6c176', '#69bfd1', '#da859a', '#97c779'] as const;
export const MAX_CLASSIC_ROUNDS = 10_000;
export type ClassicPlayer = { id: string; name: string; color: string; steps: number };
export type ClassicPending = {
  cardId: string; number: number | null; kind: ClassicKind | null; scope: ClassicScope | null;
  prompt: string; answer: string; reference: string;
};
export type ClassicResult = {
  roundId: number; turn: number; readerId: string; cardId: string; number: number;
  kind: ClassicKind; scope: ClassicScope; winnerId: string | null;
};
export type ClassicGame = {
  version: 2; edition: 'classic'; id: string; players: ClassicPlayer[];
  turn: number; oldestIndex: number; roundId: number;
  phase: 'draw' | 'choose' | 'challenge' | 'finished'; pending: ClassicPending | null;
  history: ClassicResult[]; route: { outerSteps: number; starSteps: number }; winner: string | null;
};
export type ClassicOptions = { oldestIndex: number; outerSteps: number; starSteps: number };

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function keys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return object(value) && Object.keys(value).length === expected.length &&
    Object.keys(value).every(k => expected.includes(k));
}
function integer(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}
function validName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 24 &&
    value.trim() === value && !/[\p{Cc}\p{Cf}]/u.test(value);
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (!object(a) || !object(b)) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
}
function gameId(names: string[], options: ClassicOptions): string {
  const text = JSON.stringify([names, options.oldestIndex, options.outerSteps, options.starSteps]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return 'classic-' + (hash >>> 0).toString(36);
}
function initial(names: string[], options: ClassicOptions): ClassicGame {
  return {
    version: 2, edition: 'classic', id: gameId(names, options),
    players: names.map((name, i) => ({ id: 'p' + i, name, color: CLASSIC_COLORS[i], steps: 0 })),
    turn: options.oldestIndex, oldestIndex: options.oldestIndex, roundId: 0,
    phase: 'draw', pending: null, history: [],
    route: { outerSteps: options.outerSteps, starSteps: options.starSteps }, winner: null,
  };
}
function readerId(state: ClassicGame): string {
  return state.players[(state.turn - 1 + state.players.length) % state.players.length].id;
}
function draw(state: ClassicGame, index: number): ClassicGame {
  return { ...state, phase: 'choose', pending: { cardId: CLASSIC_CARDS[index].id, number: null,
    kind: null, scope: null, prompt: '', answer: '', reference: '' } };
}
function choose(state: ClassicGame, number: number): ClassicGame {
  const card = CLASSIC_CARDS.find(c => c.id === state.pending!.cardId)!;
  const activity = card.activities[number - 1];
  return { ...state, phase: 'challenge', pending: { cardId: card.id, ...activity } };
}
function eligible(state: ClassicGame): ClassicPlayer[] {
  if (state.phase !== 'challenge' || !state.pending) return [];
  return state.pending.scope === 'individual' ? [state.players[state.turn]] : state.players.filter(p => p.id !== readerId(state));
}
function resolve(state: ClassicGame, winnerId: string | null): ClassicGame {
  const pending = state.pending!;
  const players = state.players.map(p => p.id === winnerId ? { ...p, steps: p.steps + 1 } : { ...p });
  const winner = players.find(p => p.steps === state.route.outerSteps + state.route.starSteps + 1)?.id ?? null;
  const result: ClassicResult = { roundId: state.roundId, turn: state.turn, readerId: readerId(state),
    cardId: pending.cardId, number: pending.number!, kind: pending.kind!, scope: pending.scope!, winnerId };
  return { ...state, players, turn: (state.turn + 1) % players.length, roundId: state.roundId + 1,
    phase: winner ? 'finished' : 'draw', pending: null, history: [...state.history, result], winner };
}

/** Replays canonical activities and results, rejecting forged prompts, progress or extra fields. */
export function isClassicGame(value: unknown): value is ClassicGame {
  try {
    if (!keys(value, ['version', 'edition', 'id', 'players', 'turn', 'oldestIndex', 'roundId', 'phase', 'pending', 'history', 'route', 'winner']) ||
      value.version !== 2 || value.edition !== 'classic' || typeof value.id !== 'string' ||
      !Array.isArray(value.players) || !integer(value.players.length, 2, 4) ||
      !integer(value.oldestIndex, 0, value.players.length - 1) || !integer(value.turn, 0, value.players.length - 1) ||
      !integer(value.roundId, 0, MAX_CLASSIC_ROUNDS) || !Array.isArray(value.history) || value.history.length !== value.roundId ||
      !keys(value.route, ['outerSteps', 'starSteps']) || !integer(value.route.outerSteps, 3, 100) || !integer(value.route.starSteps, 3, 100)) return false;
    const players = value.players;
    if (!players.every(p => keys(p, ['id', 'name', 'color', 'steps']) && validName(p.name))) return false;
    const names = players.map(p => p.name as string);
    if (new Set(names.map(n => n.normalize('NFC').toLocaleLowerCase('pt-BR'))).size !== names.length) return false;
    let expected = initial(names, { oldestIndex: value.oldestIndex, outerSteps: value.route.outerSteps, starSteps: value.route.starSteps });
    for (const result of value.history) {
      if (!keys(result, ['roundId', 'turn', 'readerId', 'cardId', 'number', 'kind', 'scope', 'winnerId']) || expected.phase === 'finished' ||
        !integer(result.number, 1, 10) || typeof result.cardId !== 'string') return false;
      const cardIndex = CLASSIC_CARDS.findIndex(c => c.id === result.cardId);
      if (cardIndex < 0) return false;
      expected = choose(draw(expected, cardIndex), result.number);
      if (result.winnerId !== null && !eligible(expected).some(p => p.id === result.winnerId)) return false;
      expected = resolve(expected, result.winnerId as string | null);
      if (!same(result, expected.history[expected.history.length - 1])) return false;
    }
    if (value.phase === 'choose' || value.phase === 'challenge') {
      if (expected.phase !== 'draw' || !keys(value.pending, ['cardId', 'number', 'kind', 'scope', 'prompt', 'answer', 'reference']) ||
        typeof value.pending.cardId !== 'string') return false;
      const pending = value.pending;
      const cardIndex = CLASSIC_CARDS.findIndex(c => c.id === pending.cardId);
      if (cardIndex < 0) return false;
      expected = draw(expected, cardIndex);
      if (value.phase === 'challenge') {
        if (!integer(pending.number, 1, 10)) return false;
        expected = choose(expected, pending.number);
      }
    }
    return same(value, expected);
  } catch { return false; }
}
/** A server snapshot may conceal the current answer; local saves must remain canonical. */
export function isClassicSnapshot(value: unknown): value is ClassicGame {
  if (isClassicGame(value)) return true;
  if (!object(value) || value.phase !== 'challenge' || !object(value.pending) || value.pending.answer !== '' ||
    typeof value.pending.cardId !== 'string' || !integer(value.pending.number, 1, 10)) return false;
  const pending = value.pending;
  const activity = CLASSIC_CARDS.find(c => c.id === pending.cardId)?.activities[(pending.number as number) - 1];
  return !!activity && isClassicGame({ ...value, pending: { ...value.pending, answer: activity.answer } });
}
function assertGame(state: ClassicGame): void {
  if (!isClassicGame(state)) throw new Error('Partida clássica inválida ou incompatível.');
}
function assertSnapshot(state: ClassicGame): void {
  if (!isClassicSnapshot(state)) throw new Error('Estado público da partida inválido.');
}
function assertPhase(state: ClassicGame, phase: ClassicGame['phase']): void {
  assertGame(state);
  if (state.phase !== phase) throw new Error(state.phase === 'finished' ? 'A partida terminou.' : 'Ação indisponível nesta etapa.');
}

export function createClassicGame(names: string[], options: ClassicOptions): ClassicGame {
  if (!Array.isArray(names) || !integer(names.length, 2, 4) || names.some(n => typeof n !== 'string')) throw new Error('Use de duas a quatro pessoas ou equipes.');
  const cleaned = names.map(n => n.trim().normalize('NFC'));
  if (!cleaned.every(validName) || new Set(cleaned.map(n => n.toLocaleLowerCase('pt-BR'))).size !== cleaned.length) throw new Error('Informe nomes distintos, com até 24 caracteres.');
  if (!keys(options, ['oldestIndex', 'outerSteps', 'starSteps']) || !integer(options.oldestIndex, 0, names.length - 1) ||
    !integer(options.outerSteps, 3, 100) || !integer(options.starSteps, 3, 100)) throw new Error('Configure o participante mais velho e os dois percursos do tabuleiro físico (3–100 passos cada).');
  return initial(cleaned, options);
}
export function drawCard(state: ClassicGame, cardIndex: number): ClassicGame {
  assertPhase(state, 'draw');
  if (!integer(cardIndex, 0, CLASSIC_CARDS.length - 1)) throw new Error('Cartão inválido.');
  if (state.roundId >= MAX_CLASSIC_ROUNDS) throw new Error('Limite de registros atingido; inicie outra partida.');
  return draw(state, cardIndex);
}
export function chooseNumber(state: ClassicGame, number: number): ClassicGame {
  assertPhase(state, 'choose');
  if (!integer(number, 1, 10)) throw new Error('Escolha um número inteiro de 1 a 10.');
  return choose(state, number);
}
/** The human monitor records the result; this engine never claims to assess speech or singing. */
export function resolveChallenge(state: ClassicGame, winnerId: string | null): ClassicGame {
  assertPhase(state, 'challenge');
  if (winnerId !== null && (typeof winnerId !== 'string' || !eligible(state).some(p => p.id === winnerId))) throw new Error('Esse participante não pode responder a este desafio.');
  return resolve(state, winnerId);
}
export function eligiblePlayers(state: ClassicGame): ClassicPlayer[] {
  assertSnapshot(state);
  return eligible(state).map(p => ({ ...p }));
}
export function totalSteps(state: ClassicGame): number {
  assertSnapshot(state);
  return state.route.outerSteps + state.route.starSteps + 1;
}
export function routePhase(state: ClassicGame, player: ClassicPlayer | string): 'outer' | 'star' | 'center' {
  assertSnapshot(state);
  const found = state.players.find(p => p.id === (typeof player === 'string' ? player : player?.id));
  if (!found || (typeof player !== 'string' && !same(found, player))) throw new Error('Participante inválido.');
  if (found.steps >= state.route.outerSteps + state.route.starSteps + 1) return 'center';
  return found.steps >= state.route.outerSteps ? 'star' : 'outer';
}

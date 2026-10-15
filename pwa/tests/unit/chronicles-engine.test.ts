import { beforeEach, describe, expect, it } from 'vitest';
import {
  BIBLE_REFERENCES, CODEX_ENTRIES, EPISODE, INVENTORY_ITEMS, MAPS, activeObjective,
  canOccupy, chooseDialogue, createGame, getMap, getNearbyActor, getQuestJournal,
  interact, isGameState, stepMovement, type GameState,
} from '../../src/games/chronicles/engine';
import { ChroniclesSaveError, SAVE_KEY, loadGame, resetGame, saveGame } from '../../src/games/chronicles/persistence';
import { del, get, put } from '../../src/lib/db';

function respond(g: GameState, id: string): GameState {
  expect(g.dialogue?.choices.some(c => c.id === id)).toBe(true);
  const next = chooseDialogue(g, id);
  expect(isGameState(next)).toBe(true);
  return next;
}
const close = (g: GameState) => respond(g, g.dialogue!.choices[0].id);
/** Dialogue tests use an actual adjacent free tile; full map reachability is tested below. */
function meet(g: GameState, mapId: string, actorId: string): GameState {
  expect(g.dialogue).toBeNull();
  const map = getMap(mapId);
  const actor = map.actors.find(a => a.id === actorId)!;
  const place = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dx, dy]) => ({ ...g, mapId, x: actor.x + dx, y: actor.y + dy }))
    .find(candidate => canOccupy(map, candidate.x, candidate.y) && getNearbyActor(candidate)?.id === actorId);
  expect(place, `Espaço acessível junto a ${actorId}`).toBeDefined();
  const next = interact(place!);
  expect(isGameState(next), `Estado válido depois de ${actorId}`).toBe(true);
  return next;
}
function accepted(): GameState {
  let g = respond(createGame(), 'continue');
  g = respond(meet(g, 'village', 'tirza'), 'accept');
  return respond(g, 'continue');
}
function packed(): GameState {
  let g = accepted();
  g = respond(meet(g, 'house', 'mica'), 'learn');
  g = respond(meet(g, 'house', 'packing-note'), 'read');
  g = respond(meet(g, 'house', 'cargo'), 'start');
  g = respond(g, 'grain');
  g = respond(g, 'bread');
  g = respond(g, 'cheese');
  return respond(g, 'continue');
}
function delivered(rush = false): GameState {
  let g = meet(packed(), 'camp', 'asael');
  if (rush) { g = respond(g, 'rush'); g = respond(g, 'apologize'); }
  else g = respond(g, 'listen');
  g = respond(g, 'explain');
  g = respond(g, 'continue');
  return respond(meet(g, 'camp', 'keeper'), 'deliver');
}
function complete(): GameState {
  let g = respond(meet(delivered(), 'camp', 'overlook'), 'watch');
  for (let i = 0; i < 4; i++) g = respond(g, 'continue');
  expect(g.dialogue?.id).toBe('epilogue');
  return respond(g, 'finish');
}

describe('Crônicas da Aliança · motor e piloto narrativo', () => {
  it('cria um episódio válido e distingue ficção de Escritura e revisão pendente', () => {
    const g = createGame();
    expect(isGameState(g)).toBe(true);
    expect(g.episode).toBe('vale-coragem');
    expect(g.dialogue?.kind).toBe('cutscene');
    expect(EPISODE.fictionNotice).toMatch(/fictícios/);
    expect(EPISODE.reviewNotice).toMatch(/pendente/);
    expect(activeObjective(g)).toMatch(/Tirza/);
    expect(g.codex).toContain('witness');
  });
  it('normaliza diagonal, oferece corrida e limita passos longos de tempo', () => {
    const start = { ...close(createGame()), x: 12.5, y: 13.5 };
    const straight = stepMovement(start, { dx: 1, dy: 0, run: false }, 0.1);
    const diagonal = stepMovement(start, { dx: 1, dy: -1, run: false }, 0.1);
    expect(Math.hypot(diagonal.x - start.x, diagonal.y - start.y)).toBeCloseTo(0.3);
    expect(straight.x - start.x).toBeCloseTo(0.3);
    expect(stepMovement(start, { dx: 1, dy: 0, run: true }, 999).x - start.x).toBeCloseTo(0.48);
    expect(stepMovement(start, { dx: NaN, dy: 1, run: false }, 0.1)).toBe(start);
    expect(stepMovement(start, { dx: 1, dy: 0, run: false }, -1)).toBe(start);
    expect(stepMovement(createGame(), { dx: 1, dy: 0, run: false }, 0.1).x).toBe(6.5);
  });
  it('impede atravessar água, paredes, árvores, habitações, NPCs e objetos', () => {
    const cases = [
      { mapId: 'village', x: 22.5, y: 13.5, dx: 1, dy: 0 },
      { mapId: 'house', x: 1.5, y: 1.5, dx: -1, dy: 0 },
      { mapId: 'village', x: 2.5, y: 14.5, dx: 1, dy: 0 },
      { mapId: 'village', x: 10.5, y: 4.5, dx: -1, dy: 0 },
      { mapId: 'village', x: 9.5, y: 10.5, dx: 1, dy: 0 },
      { mapId: 'house', x: 8.5, y: 4.5, dx: 1, dy: 0 },
    ];
    for (const c of cases) {
      let g: GameState = { ...close(createGame()), mapId: c.mapId, x: c.x, y: c.y };
      const original = { ...g };
      for (let i = 0; i < 20; i++) g = stepMovement(g, { dx: c.dx, dy: c.dy, run: true }, 20);
      expect(canOccupy(getMap(c.mapId), g.x, g.y)).toBe(true);
      expect(Math.hypot(g.x - original.x, g.y - original.y)).toBeLessThan(1);
    }
  });
  it('liga povoado, interior e acampamento por entradas sem retorno imediato', () => {
    let g = { ...close(createGame()), x: 6.5, y: 8.5 };
    for (let i = 0; i < 3; i++) g = stepMovement(g, { dx: 0, dy: -1, run: false }, 0.1);
    expect(g.mapId).toBe('house');
    expect(g.flags).toContain('visited-house');
    expect(isGameState(g)).toBe(true);
    g = { ...g, x: 7.5, y: 10.5 };
    for (let i = 0; i < 2; i++) g = stepMovement(g, { dx: 0, dy: 1, run: false }, 0.1);
    expect(g.mapId).toBe('village');
    g = { ...g, x: 26.5, y: 9.5 };
    for (let i = 0; i < 2; i++) g = stepMovement(g, { dx: 1, dy: 0, run: false }, 0.1);
    expect(g.mapId).toBe('camp');
    expect(g.flags).toContain('visited-camp');
    expect(isGameState(g)).toBe(true);
  });
  it('todos os atores e saídas têm caminho real a partir da entrada dos três mapas', () => {
    const starts: Record<string, [number, number]> = { village: [6, 10], house: [7, 9], camp: [2, 16] };
    for (const map of MAPS) {
      expect(map.tiles).toHaveLength(map.height);
      expect(map.tiles.every(line => line.length === map.width)).toBe(true);
      const queue = [starts[map.id]];
      const reached = new Set<string>();
      while (queue.length) {
        const [x, y] = queue.shift()!;
        const key = `${x}:${y}`;
        if (reached.has(key) || !canOccupy(map, x + 0.5, y + 0.5)) continue;
        reached.add(key);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      for (const actor of map.actors) expect([...reached].some(key => {
        const [x, y] = key.split(':').map(Number);
        return Math.hypot(x + 0.5 - actor.x, y + 0.5 - actor.y) < 1.65;
      }), `${map.id}: ${actor.id}`).toBe(true);
      for (const exit of map.exits) {
        expect([...reached].some(key => {
          const [x, y] = key.split(':').map(Number);
          return x >= exit.x && x < exit.x + exit.width && y >= exit.y && y < exit.y + exit.height;
        }), `${map.id}: saída ${exit.toMapId}`).toBe(true);
        expect(canOccupy(getMap(exit.toMapId), exit.toX, exit.toY)).toBe(true);
      }
    }
  });
  it('exige duas pistas, aceita solução do puzzle e permite reparar uma tentativa errada', () => {
    let g = accepted();
    expect(meet(g, 'house', 'cargo').dialogue?.id).toBe('cargo-clues');
    g = respond(meet(g, 'house', 'mica'), 'learn');
    expect(meet(g, 'house', 'cargo').dialogue?.id).toBe('cargo-clues');
    g = respond(meet(g, 'house', 'packing-note'), 'read');
    g = respond(meet(g, 'house', 'cargo'), 'start');
    g = respond(g, 'bread');
    expect(g.dialogue?.id).toBe('cargo-wrong');
    expect(g.inventory).not.toContain('supply-crate');
    g = respond(g, 'retry');
    g = respond(g, 'grain');
    g = respond(g, 'bread');
    g = respond(g, 'cheese');
    expect(g.inventory).toContain('supply-crate');
    const inventory = [...g.inventory];
    g = respond(g, 'continue');
    g = respond(meet(g, 'house', 'cargo'), 'close');
    expect(g.inventory).toEqual(inventory);
  });
  it('escolhas preservam consequências e resolvem tensão sem violência', () => {
    const calm = delivered();
    expect(calm.flags).toContain('sentry-cleared');
    expect(calm.flags).not.toContain('sentry-wary');
    expect(calm.inventory).toContain('delivery-receipt');
    expect(calm.inventory).not.toContain('supply-crate');
    expect(calm.codex).toContain('tension');
    const repaired = delivered(true);
    expect(repaired.flags).toContain('sentry-wary');
    expect(repaired.flags).toContain('sentry-apologized');
    expect(getQuestJournal(repaired).find(q => q.id === 'passage')?.objective).toMatch(/reparou/);
    expect(meet(packed(), 'camp', 'keeper').dialogue?.id).toBe('keeper-wait');
    expect(meet(calm, 'camp', 'keeper').dialogue?.id).toBe('keeper-thanks');
  });
  it('missão secundária opcional devolve objeto e não duplica recompensas', () => {
    let g = close(createGame());
    expect(meet(g, 'village', 'lost-seal').dialogue?.id).toBe('seal-before');
    g = respond(meet(g, 'village', 'adina'), 'help');
    g = respond(meet(g, 'village', 'lost-seal'), 'continue');
    expect(g.inventory).toEqual(['clay-seal']);
    g = respond(meet(g, 'village', 'lost-seal'), 'close');
    expect(g.inventory).toEqual(['clay-seal']);
    g = respond(meet(g, 'village', 'adina'), 'return-seal');
    expect(g.inventory).toEqual(['woven-cord']);
    expect(g.codex).toContain('solidarity');
    expect(getQuestJournal(g).find(q => q.id === 'seal')?.status).toBe('complete');
    g = respond(meet(g, 'village', 'adina'), 'close');
    expect(g.inventory).toEqual(['woven-cord']);
  });
  it('roteiro completo preserva Davi, fecha episódio e mantém a exploração', () => {
    expect(meet(close(createGame()), 'camp', 'overlook').dialogue?.id).toBe('overlook-wait');
    let g = complete();
    expect(g.status).toBe('complete');
    expect(g.codex).toContain('outcome');
    expect(g.codex).toContain('david');
    expect(getQuestJournal(g)[0].status).toBe('complete');
    expect(meet(g, 'camp', 'overlook').dialogue?.id).toBe('overlook-after');
    g = respond(meet(g, 'village', 'adina'), 'help');
    g = respond(meet(g, 'village', 'lost-seal'), 'continue');
    g = respond(meet(g, 'village', 'adina'), 'return-seal');
    expect(g.status).toBe('complete');
    expect(g.flags).toContain('side-complete');
    expect(chooseDialogue(g, 'unknown')).toBe(g);
  });
  it('não altera estado de entrada e recusa escolhas indisponíveis', () => {
    const g = createGame();
    const original = JSON.stringify(g);
    expect(chooseDialogue(g, 'finish')).toBe(g);
    expect(chooseDialogue(g, 'continue')).not.toBe(g);
    expect(JSON.stringify(g)).toBe(original);
    expect(interact(g)).toBe(g);
    expect(interact({ ...close(g), x: 1.5, y: 1.5 }).dialogue).toBeNull();
  });
  it('códice, itens e passagens têm referências existentes no leitor', () => {
    expect(BIBLE_REFERENCES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(BIBLE_REFERENCES.map(r => r.id)).size).toBe(BIBLE_REFERENCES.length);
    for (const ref of BIBLE_REFERENCES) {
      expect(ref.b).toBe(9);
      expect([16, 17]).toContain(ref.c);
      expect(ref.v).toBeGreaterThan(0);
      expect(ref.v).toBeLessThanOrEqual(ref.c === 16 ? 23 : 58);
      expect(ref.endV ?? ref.v).toBeGreaterThanOrEqual(ref.v);
    }
    for (const e of Object.values(CODEX_ENTRIES)) for (const id of e.referenceIds) expect(BIBLE_REFERENCES.some(r => r.id === id)).toBe(true);
    for (const id of complete().inventory) expect(INVENTORY_ITEMS[id]).toBeDefined();
    expect(CODEX_ENTRIES.witness.fiction).toBe(true);
    expect(CODEX_ENTRIES.outcome.fiction).toBe(false);
  });
  it('recusa saves corrompidos, posições bloqueadas e progresso inconsistente', () => {
    const g = createGame();
    const invalid: unknown[] = [null, [], {}, { ...g, version: 2 }, { ...g, x: Infinity }, { ...g, x: 0 }, { ...g, mapId: 'future' }, { ...g, flags: ['episode-started', 'invented'] }, { ...g, flags: ['episode-started', 'episode-started'] }, { ...g, inventory: ['supply-crate'] }, { ...g, codex: ['outcome'] }, { ...g, status: 'complete' }, { ...g, dialogue: { ...g.dialogue, choices: [{ id: 'finish', label: 'Saltar episódio' }] } }, { ...g, dialogue: { id: '__proto__', choices: [] } }];
    for (const value of invalid) expect(isGameState(value)).toBe(false);
    expect(isGameState(complete())).toBe(true);
    expect(() => getMap('unknown')).toThrow(/mapa/);
  });
});

describe('Crônicas da Aliança · persistência isolada no IndexedDB', () => {
  beforeEach(async () => { await resetGame(); await del('meta', 'mezuzah:save'); });
  it('salva, retoma diálogo intermediário e preserva outros jogos', async () => {
    expect(await loadGame()).toBeNull();
    await put('meta', { key: 'mezuzah:save', payload: 'preservado' });
    let g = packed();
    await saveGame(g);
    expect(await loadGame()).toEqual(g);
    g = respond(meet(g, 'camp', 'asael'), 'listen');
    await saveGame(g);
    const loaded = (await loadGame())!;
    expect(loaded.dialogue?.id).toBe('sentry-listen');
    expect(respond(loaded, 'explain').flags).toContain('sentry-cleared');
    await saveGame(complete());
    expect((await loadGame())?.status).toBe('complete');
    await resetGame();
    expect(await loadGame()).toBeNull();
    expect(await get('meta', 'mezuzah:save')).toEqual({ key: 'mezuzah:save', payload: 'preservado' });
  });
  it('erros legíveis preservam save inválido e bloqueiam gravações inválidas', async () => {
    await put('meta', { key: SAVE_KEY, state: { version: 99 } });
    await expect(loadGame()).rejects.toThrow(/incompatível ou danificado/);
    expect(await get('meta', SAVE_KEY)).toBeDefined();
    await expect(saveGame({ ...createGame(), x: NaN })).rejects.toBeInstanceOf(ChroniclesSaveError);
    await resetGame();
    await saveGame(createGame());
    expect(await loadGame()).toEqual(createGame());
  });
});

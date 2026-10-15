import { CODEX_ENTRIES, EPISODE, INVENTORY_ITEMS, MAPS, type Actor, type WorldMap } from './content';
export { BIBLE_REFERENCES, CODEX_ENTRIES, EPISODE, INVENTORY_ITEMS, MAPS, SAGAS } from './content';
export type { Actor, BibleReference, MapExit, WorldMap } from './content';

export type Dialogue = {
  id: string;
  speaker: string;
  text: string;
  choices: Array<{ id: string; label: string }>;
  portrait?: string;
  kind?: 'conversation' | 'puzzle' | 'cutscene';
  referenceId?: string;
};
export type GameState = {
  version: 1;
  episode: 'vale-coragem';
  mapId: string;
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
  status: 'playing' | 'complete';
  flags: string[];
  inventory: string[];
  codex: string[];
  dialogue: Dialogue | null;
  /** Distância percorrida, em tiles; serve também à animação dos passos. */
  steps: number;
  elapsedSeconds: number;
  message: string;
};
export type QuestEntry = { id: string; title: string; status: 'available' | 'active' | 'complete'; objective: string; optional: boolean };
const CONTINUE = [{ id: 'continue', label: 'Continuar' }];
const CLOSE = [{ id: 'close', label: 'Voltar à exploração' }];
const MATERIALS = [{ id: 'grain', label: 'Saco de grãos' }, { id: 'bread', label: 'Pães embrulhados' }, { id: 'cheese', label: 'Queijos protegidos' }, { id: 'cancel', label: 'Preparar depois' }];
const scene = (id: string, speaker: string, text: string, choices = CLOSE, extra: Partial<Dialogue> = {}): Dialogue => ({ id, speaker, text, choices, kind: 'conversation', ...extra });
/** IDs e textos fechados impedem que um save injete cenas ou escolhas desconhecidas. */
const SCENES: Record<string, Dialogue> = Object.fromEntries([
  scene('prologue', 'Crônicas da Aliança', `Você é Neri, uma testemunha fictícia. O vento alcança as oliveiras e traz notícias de um vale em tensão. Procure Tirza no caminho. ${EPISODE.fictionNotice} ${EPISODE.reviewNotice}`, CONTINUE, { kind: 'cutscene' }),
  scene('tirza-intro', 'Tirza · personagem fictícia', 'Precisamos levar uma cesta de apoio ao guardador das bagagens. Mica ajuda na casa dos mantimentos, ao norte. Você pode preparar a carga e seguir pelo caminho a leste?', [{ id: 'accept', label: 'Ajudar com a entrega' }, { id: 'identity', label: 'Qual é o meu papel nesta história?' }, { id: 'close', label: 'Explorar primeiro' }], { portrait: 'tirza' }),
  scene('neri-story', 'Neri · personagem fictícia', 'Sou alguém comum deste povoado imaginado. Posso ajudar, escutar e aprender. Não assumo o lugar de Davi nem mudo o resultado dos acontecimentos bíblicos.', [{ id: 'back', label: 'Voltar a Tirza' }]),
  scene('tirza-accepted', 'Tirza', 'Obrigada. Entre na casa ao norte, ouça Mica e leia as instruções perto da porta. Depois organize a cesta. O caminho leste atravessa o ribeiro até o acampamento.', CONTINUE, { portrait: 'tirza' }),
  scene('tirza-reminder', 'Tirza', 'Mica está na casa dos mantimentos. A mesa de preparação fica à direita. O caminho para o acampamento segue a leste; fale com a sentinela e procure o guardador das bagagens.'),
  scene('tirza-thanks', 'Tirza', 'A notícia de sua entrega já chegou. O trabalho discreto também sustenta a vida do povoado. Quando estiver pronto, observe os acontecimentos do mirante, no nordeste do acampamento.'),
  scene('tirza-after', 'Tirza', 'Você voltou como testemunha. Guarde o que aprendeu e confira o relato na Escritura. Nossos caminhos são inventados; o acontecimento de Davi está registrado em 1 Samuel.'),
  scene('mica-before', 'Mica · personagem fictícia', 'Tirza organiza as entregas no caminho do povoado. Fale com ela antes de separar uma carga.'),
  scene('mica-clues', 'Mica · personagem fictícia', 'Uma cesta firme começa com a carga mais pesada embaixo. O saco de grãos pesa mais que os outros volumes. Para o restante, leia a tábua de instruções perto da porta.', [{ id: 'learn', label: 'Guardar a primeira pista' }], { portrait: 'mica' }),
  scene('mica-repeat', 'Mica', 'Os grãos vão na base. A tábua perto da porta explica como proteger os outros alimentos. Há uma ordem que mantém tudo seguro.'),
  scene('packing-note', 'Tábua de instruções · ficção complementar', 'Os pães não podem receber o peso do saco de grãos. Os queijos ficam por cima, cobertos com tecido, para serem retirados primeiro ao chegar. Combine esta pista com a orientação de Mica.', [{ id: 'read', label: 'Guardar a segunda pista' }]),
  scene('cargo-locked', 'Mesa de preparação', 'Esta carga precisa de uma tarefa combinada com Tirza. Converse com ela no caminho do povoado.'),
  scene('cargo-clues', 'Mesa de preparação', 'Antes de acomodar a carga, escute Mica e leia as instruções junto à porta. Há duas pistas sobre peso e ordem de retirada.'),
  scene('cargo-start', 'Preparar a cesta', 'Você reuniu duas pistas. Acomode os três volumes, da base ao topo. Uma ordem inadequada pode esmagar ou dificultar a retirada dos alimentos.', [{ id: 'start', label: 'Organizar os volumes' }, { id: 'close', label: 'Rever as pistas' }], { kind: 'puzzle' }),
  scene('cargo-0', 'Cesta · 1 de 3', 'O que você coloca na base?', MATERIALS, { kind: 'puzzle' }),
  scene('cargo-1', 'Cesta · 2 de 3', 'O saco de grãos está na base. Qual volume vai no meio?', MATERIALS.filter(c => c.id !== 'grain'), { kind: 'puzzle' }),
  scene('cargo-2', 'Cesta · 3 de 3', 'Os pães estão protegidos acima dos grãos. O que vai no topo?', MATERIALS.filter(c => c.id === 'cheese' || c.id === 'cancel'), { kind: 'puzzle' }),
  scene('cargo-wrong', 'A cesta precisa de cuidado', 'Essa ordem deixaria a carga instável ou os alimentos mal protegidos. Nada se perdeu. Lembre: maior peso na base; o primeiro volume a retirar fica no topo.', [{ id: 'retry', label: 'Tentar outra organização' }, { id: 'close', label: 'Consultar as pistas' }], { kind: 'puzzle' }),
  scene('cargo-success', 'Cesta pronta', 'Grãos na base, pães no meio e queijos protegidos no topo. A cesta foi acrescentada ao inventário. Siga a leste para o acampamento.', CONTINUE, { kind: 'puzzle', referenceId: 'provisions' }),
  scene('cargo-done', 'Mesa de preparação', 'A sua cesta já foi preparada. Não é preciso retirar outros mantimentos.'),
  scene('adina-intro', 'Adina · personagem fictícia', 'Meu selo de argila caiu quando atravessei o pomar, a sudeste. Ele tem valor para minha família. Você poderia procurá-lo?', [{ id: 'help', label: 'Procurar o selo' }, { id: 'close', label: 'Agora preciso seguir' }]),
  scene('adina-looking', 'Adina', 'O selo deve estar perto das oliveiras, no sudeste do povoado, antes do ribeiro. Sua atenção já me ajuda.'),
  scene('adina-return', 'Adina', 'Você encontrou o selo! Posso guardá-lo de novo. Aceite este cordão como lembrança do cuidado que teve.', [{ id: 'return-seal', label: 'Devolver o selo' }]),
  scene('adina-thanks', 'Adina', 'Meu selo está comigo. Nosso povoado também é feito de pequenos gestos. Obrigada, Neri.'),
  scene('seal-before', 'Entre as folhas', 'Um pequeno selo de argila aparece entre as folhas. Talvez alguém no povoado esteja procurando por ele.'),
  scene('seal-found', 'Selo reencontrado', 'Você recolhe o selo de Adina com cuidado. Volte à artesã, ao norte do caminho.', CONTINUE),
  scene('seal-gone', 'Entre as folhas', 'Você já recolheu o selo. Não há outro objeto perdido aqui.'),
  scene('elder', 'Memória do povoado', 'O relato de Samuel lembra que a aparência não revela tudo. Consulte 1 Samuel 16:7–13 para conhecer a escolha e a unção de Davi. Esta conversa é ficção complementar.', CONTINUE, { referenceId: 'heart' }),
  scene('well', 'Poço do povoado', 'À sombra do poço, Neri escuta a vida comum: água, passos, trabalho. Um instante de calma antes de seguir ao vale.'),
  scene('village-sign', 'Marco do caminho', 'Leste → Acampamento no vale de Elá. Norte do povoado → Casa dos mantimentos. O pomar fica a sudeste.'),
  scene('camp-sign', 'Estacas de orientação', 'Siga a estrada: sentinela à frente, bagagens ao centro e mirante a nordeste. O caminho a oeste volta ao povoado.'),
  scene('sentry-empty', 'Asael · personagem fictícia', 'O acampamento está tenso. Se veio ajudar na entrega, prepare primeiro a cesta no povoado. Não é preciso entrar na linha de batalha.'),
  scene('sentry-intro', 'Asael · personagem fictícia', 'Pare um instante. Todos parecem correr quando o desafio ecoa do vale. Preciso saber quem atravessa e para onde leva essa cesta.', [{ id: 'listen', label: 'Escutar a preocupação dele' }, { id: 'rush', label: 'Exigir passagem imediatamente' }], { portrait: 'asael' }),
  scene('sentry-refusal', 'Asael', 'A pressa torna mais difícil entender você. Não vou discutir. Podemos recomeçar com calma?', [{ id: 'apologize', label: 'Reconhecer a pressa e ouvir' }, { id: 'close', label: 'Voltar depois' }]),
  scene('sentry-listen', 'Asael', 'Eu cuido desta passagem para que os carregadores não se aproximem da linha de batalha. O guardador das bagagens fica no centro. Qual é sua tarefa?', [{ id: 'explain', label: 'Explicar a entrega e seguir pelo caminho seguro' }, { id: 'close', label: 'Pensar antes de responder' }]),
  scene('sentry-success', 'Asael', 'Entendi. Você veio apoiar quem está aqui. Siga até o guardador, pelo caminho central. Obrigado por escutar.', CONTINUE),
  scene('sentry-repaired', 'Asael', 'Agora nos entendemos. Sua mudança de atitude fez diferença. Siga pelo caminho central até o guardador das bagagens.', CONTINUE),
  scene('sentry-cleared', 'Asael', 'A passagem está combinada. Mantenha-se no caminho seguro. O mirante permite observar o vale à distância.'),
  scene('keeper-wait', 'Guardador das bagagens · personagem fictícia', 'Antes da entrega, combine a passagem com Asael na estrada oeste. Precisamos manter os caminhos organizados.'),
  scene('keeper-empty', 'Guardador das bagagens', 'Você está sem a cesta. Mica ajuda na casa dos mantimentos do povoado.'),
  scene('keeper-deliver', 'Guardador das bagagens', 'Recebo a cesta de apoio. Agora os carregadores podem distribuir os alimentos. Guarde esta marca de entrega e permaneça longe da linha de batalha.', [{ id: 'deliver', label: 'Entregar a cesta' }], { referenceId: 'provisions' }),
  scene('keeper-thanks', 'Guardador das bagagens', 'A carga já foi recebida. Para observar o vale, siga o caminho ao norte e depois a leste até o mirante.'),
  scene('camp-witness', 'Testemunha fictícia do acampamento', 'O desafio que vem do vale assusta muita gente. A história bíblica descreve esse medo. Leia o relato, em vez de confiar apenas nos rumores do acampamento.', CONTINUE, { referenceId: 'fear' }),
  scene('david', 'Narrador', 'À distância, Neri vê Davi entre os homens do acampamento. O jovem que veio de junto das ovelhas escuta o desafio. Neri observa; o relato bíblico não lhe pertence.', CONTINUE, { referenceId: 'provisions' }),
  scene('overlook-wait', 'Mirante do vale', 'Antes de observar o vale, conclua a entrega ao guardador das bagagens, com a passagem combinada junto à sentinela.'),
  scene('overlook-ready', 'Mirante do vale', 'A entrega terminou. Deste lugar seguro, Neri pode testemunhar o que acontece. A cena seguinte preserva o resultado de 1 Samuel 17.', [{ id: 'watch', label: 'Observar o vale' }, { id: 'close', label: 'Explorar mais um pouco' }]),
  scene('cutscene-fear', 'O vale · 1 Samuel 17', 'Os exércitos se observam de lados opostos. A voz do desafio percorre o vale, e o medo pesa no acampamento. Neri permanece longe da batalha.', CONTINUE, { kind: 'cutscene', referenceId: 'fear' }),
  scene('cutscene-stones', 'Cinco pedras · 1 Samuel 17:40', 'Davi escolhe cinco pedras lisas do ribeiro. Leva seu cajado e sua funda. O jogo não concede a Neri o controle de seus atos.', CONTINUE, { kind: 'cutscene', referenceId: 'stones' }),
  scene('cutscene-trust', 'Diante do desafio · 1 Samuel 17:45–47', 'Davi declara sua confiança no Senhor diante de Golias. O narrador resume o acontecimento; confira suas palavras na passagem bíblica.', CONTINUE, { kind: 'cutscene', referenceId: 'victory' }),
  scene('cutscene-victory', 'O desfecho · 1 Samuel 17:49–50', 'Uma pedra lançada pela funda de Davi atinge Golias, que cai. Davi vence. A cena é apresentada sem violência gráfica e seu resultado permanece o mesmo em todas as escolhas.', CONTINUE, { kind: 'cutscene', referenceId: 'victory' }),
  scene('epilogue', 'O Vale e a Coragem', 'Neri chegou para ajudar e termina como testemunha. A entrega, o selo e a conversa pertencem à ficção complementar. Davi venceu Golias conforme o relato de 1 Samuel 17. Consulte o Códice dos Testemunhos para separar cada parte.', [{ id: 'finish', label: 'Concluir o episódio' }], { kind: 'cutscene', referenceId: 'victory' }),
  scene('overlook-after', 'Mirante do vale', 'O episódio foi concluído. A vitória de Davi foi registrada no códice. Você pode continuar explorando e concluir a ajuda a Adina.'),
].map(d => [d.id, d]));

const KNOWN_FLAGS = new Set([
  'episode-started', 'intro-read', 'mission-accepted', 'heard-clues', 'read-note', 'supplies-packed',
  'side-accepted', 'seal-found', 'side-complete', 'heart-learned', 'visited-house', 'visited-camp',
  'sentry-wary', 'sentry-listened', 'sentry-apologized', 'sentry-cleared', 'supplies-delivered',
  'saw-david', 'saw-valley', 'episode-complete',
]);
const has = (state: GameState, flag: string) => state.flags.includes(flag);
function add(values: string[], ...next: string[]): string[] { return [...new Set([...values, ...next])]; }
function show(state: GameState, id: string): GameState {
  const d = SCENES[id];
  if (!d) return state;
  return { ...state, dialogue: { ...d, choices: d.choices.map(c => ({ ...c })) } };
}
function close(state: GameState): GameState { return { ...state, dialogue: null }; }
function flag(state: GameState, ...flags: string[]): GameState { return { ...state, flags: add(state.flags, ...flags) }; }
function learn(state: GameState, ...entries: string[]): GameState { return { ...state, codex: add(state.codex, ...entries) }; }

export function createGame(): GameState {
  return show({ version: 1, episode: 'vale-coragem', mapId: 'village', x: 6.5, y: 10.5, facing: 'right', status: 'playing', flags: ['episode-started'], inventory: [], codex: ['witness', 'village'], dialogue: null, steps: 0, elapsedSeconds: 0, message: 'Procure Tirza no caminho do povoado.' }, 'prologue');
}
export function getMap(mapId: string): WorldMap {
  const map = MAPS.find(m => m.id === mapId);
  if (!map) throw new Error('Este mapa não pertence ao episódio disponível.');
  return map;
}
export function isWalkableTile(tile: string | undefined): boolean {
  return tile === '.' || tile === ':' || tile === 's' || tile === 'f';
}
/** Colisão com volume real (raio de 0,22 tile), incluindo NPCs e objetos. */
export function canOccupy(map: WorldMap, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = 0.22;
  for (const px of [x - r, x + r]) for (const py of [y - r, y + r]) {
    if (!isWalkableTile(map.tiles[Math.floor(py)]?.[Math.floor(px)])) return false;
  }
  return !map.actors.some(a => Math.hypot(a.x - x, a.y - y) < 0.64);
}
export function getNearbyActor(state: GameState): Actor | null {
  let actor: Actor | null = null;
  let distance = 1.65;
  for (const candidate of getMap(state.mapId).actors) {
    const d = Math.hypot(candidate.x - state.x, candidate.y - state.y);
    if (d < distance) { actor = candidate; distance = d; }
  }
  return actor;
}
export function stepMovement(state: GameState, input: { dx: number; dy: number; run: boolean }, dtSeconds: number): GameState {
  if (state.dialogue || !Number.isFinite(dtSeconds) || !Number.isFinite(input.dx) || !Number.isFinite(input.dy)) return state;
  const dt = Math.max(0, Math.min(0.1, dtSeconds));
  const length = Math.hypot(input.dx, input.dy);
  if (!length || !dt) return state;
  const facing = Math.abs(input.dx) > Math.abs(input.dy) ? (input.dx > 0 ? 'right' : 'left') : (input.dy > 0 ? 'down' : 'up');
  const distance = dt * (input.run ? 4.8 : 3);
  const dx = input.dx / length * distance;
  const dy = input.dy / length * distance;
  const segments = Math.ceil(distance / 0.1);
  const map = getMap(state.mapId);
  let x = state.x;
  let y = state.y;
  let walked = 0;
  for (let i = 0; i < segments; i++) {
    const previousX = x, previousY = y;
    if (canOccupy(map, x + dx / segments, y)) x += dx / segments;
    if (canOccupy(map, x, y + dy / segments)) y += dy / segments;
    walked += Math.hypot(x - previousX, y - previousY);
    const exit = map.exits.find(e => x >= e.x && x < e.x + e.width && y >= e.y && y < e.y + e.height);
    if (exit) {
      const visited = exit.toMapId === 'house' ? ['visited-house'] : exit.toMapId === 'camp' ? ['visited-camp'] : [];
      return { ...state, mapId: exit.toMapId, x: exit.toX, y: exit.toY, facing, flags: add(state.flags, ...visited), steps: state.steps + walked, elapsedSeconds: state.elapsedSeconds + dt, message: `Chegada: ${getMap(exit.toMapId).name}` };
    }
  }
  return { ...state, x, y, facing, steps: state.steps + walked, elapsedSeconds: state.elapsedSeconds + dt };
}

export function interact(state: GameState): GameState {
  if (state.dialogue) return state;
  const actor = getNearbyActor(state);
  if (!actor) return { ...state, message: 'Aproxime-se de alguém ou de um objeto para interagir.' };
  switch (actor.id) {
    case 'tirza': return show(state, state.status === 'complete' ? 'tirza-after' : has(state, 'supplies-delivered') ? 'tirza-thanks' : has(state, 'mission-accepted') ? 'tirza-reminder' : 'tirza-intro');
    case 'mica': return show(state, !has(state, 'mission-accepted') ? 'mica-before' : has(state, 'heard-clues') ? 'mica-repeat' : 'mica-clues');
    case 'packing-note': return show(state, 'packing-note');
    case 'cargo': return show(state, has(state, 'supplies-packed') ? 'cargo-done' : !has(state, 'mission-accepted') ? 'cargo-locked' : !has(state, 'heard-clues') || !has(state, 'read-note') ? 'cargo-clues' : 'cargo-start');
    case 'adina': return show(state, has(state, 'side-complete') ? 'adina-thanks' : state.inventory.includes('clay-seal') ? 'adina-return' : has(state, 'side-accepted') ? 'adina-looking' : 'adina-intro');
    case 'lost-seal': {
      if (!has(state, 'side-accepted')) return show(state, 'seal-before');
      if (has(state, 'seal-found')) return show(state, 'seal-gone');
      return show({ ...flag(state, 'seal-found'), inventory: add(state.inventory, 'clay-seal'), message: 'Selo de Adina adicionado ao inventário.' }, 'seal-found');
    }
    case 'elder': return show(learn(flag(state, 'heart-learned'), 'heart'), 'elder');
    case 'asael': return show(state, has(state, 'sentry-cleared') ? 'sentry-cleared' : !state.inventory.includes('supply-crate') ? 'sentry-empty' : has(state, 'sentry-listened') ? 'sentry-listen' : has(state, 'sentry-wary') ? 'sentry-refusal' : 'sentry-intro');
    case 'keeper': return show(state, has(state, 'supplies-delivered') ? 'keeper-thanks' : !has(state, 'sentry-cleared') ? 'keeper-wait' : !state.inventory.includes('supply-crate') ? 'keeper-empty' : 'keeper-deliver');
    case 'camp-witness': return show(learn(state, 'camp'), 'camp-witness');
    case 'david': return show(flag(state, 'saw-david'), 'david');
    case 'overlook': return show(state, state.status === 'complete' ? 'overlook-after' : has(state, 'supplies-delivered') ? 'overlook-ready' : 'overlook-wait');
    default: return show(state, actor.id);
  }
}

export function chooseDialogue(state: GameState, choiceId: string): GameState {
  const dialogue = state.dialogue;
  if (!dialogue || !dialogue.choices.some(c => c.id === choiceId)) return state;
  if (choiceId === 'close' || choiceId === 'cancel') return close(state);
  switch (dialogue.id) {
    case 'prologue': return close(flag(state, 'intro-read'));
    case 'tirza-intro':
      if (choiceId === 'identity') return show(state, 'neri-story');
      return show(learn({ ...flag(state, 'mission-accepted'), inventory: add(state.inventory, 'route-map'), message: 'Missão iniciada: uma cesta para o acampamento.' }, 'provisions'), 'tirza-accepted');
    case 'neri-story': return show(state, 'tirza-intro');
    case 'mica-clues': return close(flag(state, 'heard-clues'));
    case 'packing-note': return close(flag(state, 'read-note'));
    case 'cargo-start': return show(state, 'cargo-0');
    case 'cargo-0': return show(state, choiceId === 'grain' ? 'cargo-1' : 'cargo-wrong');
    case 'cargo-1': return show(state, choiceId === 'bread' ? 'cargo-2' : 'cargo-wrong');
    case 'cargo-2': return show(learn({ ...flag(state, 'supplies-packed'), inventory: add(state.inventory, 'supply-crate'), message: 'Cesta preparada. Siga a leste para o acampamento.' }, 'provisions'), 'cargo-success');
    case 'cargo-wrong': return show(state, 'cargo-0');
    case 'adina-intro': return close({ ...flag(state, 'side-accepted'), message: 'Ajuda opcional: procure o selo no pomar a sudeste.' });
    case 'adina-return': return close(learn({ ...flag(state, 'side-complete'), inventory: add(state.inventory.filter(i => i !== 'clay-seal'), 'woven-cord'), message: 'Selo devolvido. Adina agradece sua ajuda.' }, 'solidarity'));
    case 'sentry-intro': return choiceId === 'listen' ? show(flag(state, 'sentry-listened'), 'sentry-listen') : show(flag(state, 'sentry-wary'), 'sentry-refusal');
    case 'sentry-refusal': return show(flag(state, 'sentry-listened', 'sentry-apologized'), 'sentry-listen');
    case 'sentry-listen': return show(learn({ ...flag(state, 'sentry-cleared'), message: 'Passagem combinada sem violência. Procure o guardador das bagagens.' }, 'tension'), has(state, 'sentry-apologized') ? 'sentry-repaired' : 'sentry-success');
    case 'keeper-deliver': return close(learn({ ...flag(state, 'supplies-delivered'), inventory: add(state.inventory.filter(i => i !== 'supply-crate'), 'delivery-receipt'), message: 'Entrega concluída. O mirante fica a nordeste.' }, 'camp'));
    case 'overlook-ready': return show(flag(state, 'saw-valley'), 'cutscene-fear');
    case 'cutscene-fear': return show(learn(state, 'david'), 'cutscene-stones');
    case 'cutscene-stones': return show(state, 'cutscene-trust');
    case 'cutscene-trust': return show(state, 'cutscene-victory');
    case 'cutscene-victory': return show(learn(state, 'outcome'), 'epilogue');
    case 'epilogue': return close(learn({ ...flag(state, 'episode-complete'), status: 'complete', message: has(state, 'side-complete') ? 'Episódio concluído. A entrega e a ajuda a Adina foram registradas no códice.' : 'Episódio concluído. Você ainda pode explorar e ajudar Adina.' }, 'outcome'));
    default: return close(state);
  }
}
export function activeObjective(state: GameState): string {
  if (state.status === 'complete') return has(state, 'side-complete') ? 'Episódio concluído. Explore o códice e confira as passagens.' : 'Episódio concluído. Você ainda pode ajudar Adina no povoado.';
  if (!has(state, 'mission-accepted')) return 'Converse com Tirza no caminho do povoado.';
  if (!has(state, 'heard-clues')) return 'Entre na casa ao norte e escute a orientação de Mica.';
  if (!has(state, 'read-note')) return 'Leia as instruções da cesta perto da porta da casa.';
  if (!has(state, 'supplies-packed')) return 'Organize a cesta na mesa de preparação: use as duas pistas.';
  if (!has(state, 'sentry-cleared')) return 'Siga a leste até o acampamento e converse com Asael.';
  if (!has(state, 'supplies-delivered')) return 'Entregue a cesta ao guardador das bagagens no centro do acampamento.';
  return 'Siga ao mirante no nordeste do acampamento para testemunhar o vale.';
}
export function getQuestJournal(state: GameState): QuestEntry[] {
  const mainComplete = state.status === 'complete';
  const sideComplete = has(state, 'side-complete');
  return [
    { id: 'valley', title: 'Uma cesta para o acampamento', status: mainComplete ? 'complete' : has(state, 'mission-accepted') ? 'active' : 'available', objective: activeObjective(state), optional: false },
    { id: 'seal', title: 'O selo de Adina', status: sideComplete ? 'complete' : has(state, 'side-accepted') ? 'active' : 'available', objective: sideComplete ? 'Você devolveu o selo. Adina se lembra de sua ajuda.' : state.inventory.includes('clay-seal') ? 'Devolva o selo a Adina, ao norte do caminho do povoado.' : has(state, 'side-accepted') ? 'Procure o selo no pomar a sudeste, antes do ribeiro.' : 'Converse com Adina, ao norte do caminho do povoado.', optional: true },
    { id: 'passage', title: 'Uma passagem sem confronto', status: has(state, 'sentry-cleared') ? 'complete' : has(state, 'supplies-packed') ? 'active' : 'available', objective: has(state, 'sentry-apologized') ? 'Você reconheceu sua pressa e reparou a conversa com Asael.' : has(state, 'sentry-cleared') ? 'Você ouviu Asael e combinou a passagem sem violência.' : 'Escute a sentinela e explique sua tarefa no acampamento.', optional: false },
  ];
}

function knownUniqueStrings(value: unknown, known: ReadonlySet<string>): value is string[] {
  return Array.isArray(value) && value.length <= known.size && value.every(v => typeof v === 'string' && known.has(v)) && new Set(value).size === value.length;
}
const inventoryKeys = new Set(Object.keys(INVENTORY_ITEMS));
const codexKeys = new Set(Object.keys(CODEX_ENTRIES));
function validDialogue(value: unknown): value is Dialogue | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const d = value as Dialogue;
  if (typeof d.id !== 'string' || !Object.hasOwn(SCENES, d.id)) return false;
  const expected = SCENES[d.id];
  return !!expected && d.speaker === expected.speaker && d.text === expected.text && d.kind === expected.kind && d.portrait === expected.portrait && d.referenceId === expected.referenceId && Array.isArray(d.choices) && d.choices.length === expected.choices.length && d.choices.every((c, i) => !!c && c.id === expected.choices[i].id && c.label === expected.choices[i].label);
}
/** Valida versão, conteúdo, posição, limites e invariantes antes de aceitar um save. */
export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const g = value as GameState;
  if (g.version !== 1 || g.episode !== 'vale-coragem' || !MAPS.some(m => m.id === g.mapId) || !['up', 'down', 'left', 'right'].includes(g.facing) || !['playing', 'complete'].includes(g.status)) return false;
  if (!knownUniqueStrings(g.flags, KNOWN_FLAGS) || !knownUniqueStrings(g.inventory, inventoryKeys) || !knownUniqueStrings(g.codex, codexKeys) || !validDialogue(g.dialogue)) return false;
  if (!Number.isFinite(g.steps) || g.steps < 0 || g.steps > 1e9 || !Number.isFinite(g.elapsedSeconds) || g.elapsedSeconds < 0 || g.elapsedSeconds > 1e9 || typeof g.message !== 'string' || g.message.length > 600) return false;
  if (!canOccupy(getMap(g.mapId), g.x, g.y)) return false;
  const f = (id: string) => g.flags.includes(id);
  const item = (id: string) => g.inventory.includes(id);
  if (!f('episode-started') || !g.codex.includes('witness') || !g.codex.includes('village')) return false;
  if (item('route-map') !== f('mission-accepted')) return false;
  if (f('supplies-packed') && (!f('mission-accepted') || !f('heard-clues') || !f('read-note'))) return false;
  if (item('supply-crate') !== (f('supplies-packed') && !f('supplies-delivered'))) return false;
  if (f('supplies-delivered') && (!f('supplies-packed') || !f('sentry-cleared'))) return false;
  if (item('delivery-receipt') !== f('supplies-delivered')) return false;
  if (f('sentry-cleared') && (!f('sentry-listened') || !f('supplies-packed'))) return false;
  if (f('sentry-apologized') && (!f('sentry-wary') || !f('sentry-listened'))) return false;
  if (f('seal-found') && !f('side-accepted')) return false;
  if (f('side-complete') && !f('seal-found')) return false;
  if (item('clay-seal') !== (f('seal-found') && !f('side-complete')) || item('woven-cord') !== f('side-complete')) return false;
  if ((g.status === 'complete') !== f('episode-complete')) return false;
  if (g.status === 'complete' && (!f('supplies-delivered') || !f('saw-valley') || !g.codex.includes('outcome'))) return false;
  if (g.dialogue?.id.startsWith('cargo-') && ['cargo-0', 'cargo-1', 'cargo-2', 'cargo-start', 'cargo-wrong'].includes(g.dialogue.id) && (!f('heard-clues') || !f('read-note') || !f('mission-accepted') || f('supplies-packed'))) return false;
  if (g.dialogue && ['cutscene-fear', 'cutscene-stones', 'cutscene-trust', 'cutscene-victory', 'epilogue'].includes(g.dialogue.id) && (!f('supplies-delivered') || !f('saw-valley') || g.status === 'complete')) return false;
  return true;
}

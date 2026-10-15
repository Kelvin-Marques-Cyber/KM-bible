/** Conteúdo autoral do piloto. As tarefas de Neri são ficção complementar explícita. */
export type Actor = {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: 'npc' | 'object';
  palette?: string;
};
export type MapExit = {
  x: number;
  y: number;
  width: number;
  height: number;
  toMapId: string;
  toX: number;
  toY: number;
  label: string;
};
export type WorldMap = {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Cada string é uma linha inteira de tiles. */
  tiles: string[];
  actors: Actor[];
  exits: MapExit[];
};
export type BibleReference = { id: string; label: string; b: 9; c: number; v: number; endV?: number };
export const BIBLE_REFERENCES: BibleReference[] = [
  { id: 'heart', label: '1 Samuel 16:7–13', b: 9, c: 16, v: 7, endV: 13 },
  { id: 'provisions', label: '1 Samuel 17:17–22', b: 9, c: 17, v: 17, endV: 22 },
  { id: 'fear', label: '1 Samuel 17:4–11', b: 9, c: 17, v: 4, endV: 11 },
  { id: 'stones', label: '1 Samuel 17:40', b: 9, c: 17, v: 40 },
  { id: 'victory', label: '1 Samuel 17:45–50', b: 9, c: 17, v: 45, endV: 50 },
];
export const EPISODE = {
  id: 'vale-coragem',
  title: 'O Vale e a Coragem',
  subtitle: 'Uma testemunha no vale de Elá · 1 Samuel 16–17',
  protagonist: 'Neri',
  fictionNotice: 'Neri, Tirza, Mica, Adina e Asael são personagens fictícios. Suas tarefas e conversas são ficção complementar. O resultado do relato bíblico permanece fixo.',
  reviewNotice: 'Roteiro conferido com as passagens indicadas. Revisão teológica humana ainda pendente.',
  sourceUrl: 'https://www.biblegateway.com/passage/?search=1SAMUEL17&version=KJV',
} as const;
export const SAGAS = [
  { id: 'origins', title: 'Origens e Promessa', episodesPlanned: 6, available: false },
  { id: 'exodus', title: 'Libertação e Caminho', episodesPlanned: 6, available: false },
  { id: 'kings', title: 'Reis, Profetas e Ruínas', episodesPlanned: 6, available: true },
  { id: 'return', title: 'Exílio e Retorno', episodesPlanned: 6, available: false },
  { id: 'messiah', title: 'O Caminho do Messias', episodesPlanned: 6, available: false },
  { id: 'witnesses', title: 'Testemunhas e Esperança', episodesPlanned: 6, available: false },
] as const;
export const INVENTORY_ITEMS: Record<string, { name: string; description: string }> = {
  'route-map': { name: 'Mapa do caminho', description: 'Croqui de Tirza: o caminho para o acampamento sai a leste do povoado.' },
  'supply-crate': { name: 'Cesta de apoio', description: 'Grãos, pães e queijos preparados na tarefa fictícia de Neri. Leve ao guardador das bagagens.' },
  'delivery-receipt': { name: 'Marca de entrega', description: 'Confirmação de que o guardador recebeu a cesta. Objeto criado para o jogo.' },
  'clay-seal': { name: 'Selo de argila', description: 'Selo perdido de Adina, encontrado junto ao pomar. Ficção complementar.' },
  'woven-cord': { name: 'Cordão de Adina', description: 'Lembrança oferecida por Adina. Não concede poderes ou vantagens espirituais.' },
};
export const CODEX_ENTRIES: Record<string, { title: string; text: string; referenceIds: string[]; fiction: boolean }> = {
  witness: { title: 'Neri, uma testemunha fictícia', text: EPISODE.fictionNotice, referenceIds: [], fiction: true },
  village: { title: 'Um povoado de apoio', text: 'O povoado e sua casa de mantimentos foram criados para a exploração. Não são uma reconstrução arqueológica de Belém.', referenceIds: ['provisions'], fiction: true },
  heart: { title: 'O olhar sobre o coração', text: 'Antes dos acontecimentos do vale, Samuel ungiu Davi. O relato destaca o olhar do Senhor para o coração.', referenceIds: ['heart'], fiction: false },
  provisions: { title: 'Provisões no caminho', text: 'Jessé enviou Davi com alimento aos irmãos e queijos ao comandante. A organização da cesta por Neri é uma tarefa inventada para o jogo.', referenceIds: ['provisions'], fiction: true },
  camp: { title: 'O acampamento no vale', text: 'Os exércitos se posicionavam em lados opostos. O desafio de Golias causava medo entre os israelitas.', referenceIds: ['fear'], fiction: false },
  tension: { title: 'Escutar antes de responder', text: 'O encontro com Asael é fictício. Escutar e explicar a tarefa permite atravessar sem violência; apressá-lo exige reparar a conversa.', referenceIds: [], fiction: true },
  solidarity: { title: 'O selo reencontrado', text: 'O selo e o agradecimento de Adina são ficção complementar. A escolha de ajudar transforma a relação de Neri com o povoado.', referenceIds: [], fiction: true },
  david: { title: 'Davi diante do desafio', text: 'Davi tomou sua funda e escolheu cinco pedras lisas no ribeiro. A narrativa atribui sua confiança ao Senhor.', referenceIds: ['stones', 'victory'], fiction: false },
  outcome: { title: 'O desfecho preservado', text: 'Davi atingiu Golias com uma pedra lançada pela funda e venceu. Nenhuma decisão de Neri altera esse acontecimento.', referenceIds: ['victory'], fiction: false },
};

type Grid = string[][];
const grid = (width: number, height: number, tile: string): Grid => Array.from({ length: height }, () => Array(width).fill(tile));
function rect(g: Grid, x: number, y: number, width: number, height: number, tile: string) {
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) g[yy][xx] = tile;
}
function border(g: Grid, tile: string) {
  rect(g, 0, 0, g[0].length, 1, tile);
  rect(g, 0, g.length - 1, g[0].length, 1, tile);
  rect(g, 0, 0, 1, g.length, tile);
  rect(g, g[0].length - 1, 0, 1, g.length, tile);
}
function villageMap(): WorldMap {
  const g = grid(28, 20, '.');
  border(g, 't');
  rect(g, 1, 9, 27, 2, ':');
  rect(g, 6, 7, 2, 10, ':');
  rect(g, 3, 3, 7, 5, 'h');
  rect(g, 6, 7, 2, 1, 'f');
  rect(g, 16, 3, 5, 4, 'h');
  rect(g, 3, 14, 3, 3, 't');
  rect(g, 9, 15, 3, 2, 't');
  rect(g, 18, 16, 4, 2, 't');
  rect(g, 23, 1, 2, 18, '~');
  rect(g, 22, 8, 4, 4, 's');
  rect(g, 23, 9, 2, 2, ':');
  return {
    id: 'village', name: 'Povoado das oliveiras', width: 28, height: 20, tiles: g.map(r => r.join('')),
    actors: [
      { id: 'tirza', name: 'Tirza · ajudante', x: 10.5, y: 10.5, kind: 'npc', palette: '#d5a861' },
      { id: 'adina', name: 'Adina · artesã', x: 13.5, y: 6.5, kind: 'npc', palette: '#b48bd0' },
      { id: 'elder', name: 'Memória do povoado', x: 19.5, y: 8.5, kind: 'npc', palette: '#94b18c' },
      { id: 'well', name: 'Poço do povoado', x: 15.5, y: 11.5, kind: 'object', palette: '#a0b4b0' },
      { id: 'lost-seal', name: 'Algo entre as folhas', x: 20.5, y: 14.5, kind: 'object', palette: '#e6bf70' },
      { id: 'village-sign', name: 'Marco do caminho', x: 25.5, y: 8.5, kind: 'object', palette: '#b78a55' },
    ],
    exits: [
      { x: 6, y: 7, width: 2, height: 1, toMapId: 'house', toX: 7.5, toY: 9.5, label: 'Casa dos mantimentos' },
      { x: 27, y: 9, width: 1, height: 2, toMapId: 'camp', toX: 2.5, toY: 16.5, label: 'Caminho do acampamento' },
    ],
  };
}
function houseMap(): WorldMap {
  const g = grid(16, 12, 'f');
  border(g, '#');
  rect(g, 2, 2, 3, 1, 'h');
  rect(g, 10, 2, 4, 1, 'h');
  rect(g, 2, 7, 2, 2, 'h');
  rect(g, 12, 6, 2, 3, 'h');
  rect(g, 7, 11, 2, 1, 'f');
  return {
    id: 'house', name: 'Casa dos mantimentos', width: 16, height: 12, tiles: g.map(r => r.join('')),
    actors: [
      { id: 'mica', name: 'Mica · guardião da despensa', x: 4.5, y: 4.5, kind: 'npc', palette: '#83a6b5' },
      { id: 'cargo', name: 'Mesa de preparação', x: 9.5, y: 4.5, kind: 'object', palette: '#d1ae71' },
      { id: 'packing-note', name: 'Instruções da cesta', x: 10.5, y: 8.5, kind: 'object', palette: '#e1cf9e' },
    ],
    exits: [{ x: 7, y: 11, width: 2, height: 1, toMapId: 'village', toX: 6.5, toY: 8.5, label: 'Voltar ao povoado' }],
  };
}
function campMap(): WorldMap {
  const g = grid(32, 22, 's');
  border(g, '#');
  rect(g, 0, 16, 20, 2, ':');
  rect(g, 14, 6, 3, 12, ':');
  rect(g, 16, 5, 14, 2, ':');
  rect(g, 4, 5, 6, 4, 'h');
  rect(g, 5, 11, 5, 3, 'h');
  rect(g, 19, 9, 5, 3, 'h');
  rect(g, 24, 16, 5, 3, 'h');
  rect(g, 2, 2, 20, 1, '#');
  rect(g, 27, 1, 3, 3, '~');
  rect(g, 28, 7, 2, 6, '~');
  return {
    id: 'camp', name: 'Acampamento · vale de Elá', width: 32, height: 22, tiles: g.map(r => r.join('')),
    actors: [
      { id: 'asael', name: 'Asael · sentinela', x: 8.5, y: 16.5, kind: 'npc', palette: '#aa8372' },
      { id: 'keeper', name: 'Guardador das bagagens', x: 15.5, y: 11.5, kind: 'npc', palette: '#c8a45b' },
      { id: 'camp-witness', name: 'Testemunha do acampamento', x: 22.5, y: 13.5, kind: 'npc', palette: '#8ba08f' },
      { id: 'david', name: 'À distância · Davi', x: 21.5, y: 6.5, kind: 'npc', palette: '#d8c18a' },
      { id: 'overlook', name: 'Mirante do vale', x: 26.5, y: 5.5, kind: 'object', palette: '#d8cfad' },
      { id: 'camp-sign', name: 'Estacas de orientação', x: 3.5, y: 15.5, kind: 'object', palette: '#ac8052' },
    ],
    exits: [{ x: 0, y: 16, width: 1, height: 2, toMapId: 'village', toX: 26.5, toY: 9.5, label: 'Voltar ao povoado' }],
  };
}
export const MAPS: WorldMap[] = [villageMap(), houseMap(), campMap()];

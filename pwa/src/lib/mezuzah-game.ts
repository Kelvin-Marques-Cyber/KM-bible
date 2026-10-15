/**
 * Mezuzá 3D — jogo bíblico original, não representação de uma prática ritual.
 * Regras determinísticas e puras: as mesmas ações produzem o mesmo estado.
 * A rolagem do dado, fora desta camada, usa crypto.getRandomValues.
 */
export const BOARD_SIZE = 7;
export const LAST_SQUARE = BOARD_SIZE * BOARD_SIZE - 1;
export type SquareKind = 'start' | 'scripture' | 'challenge' | 'wisdom' | 'advance' | 'return' | 'finish' | 'ordinary';
export type Player = { id: string; name: string; color: string; position: number; score: number };
export type PendingQuestion = { question: number; square: number };
export type GameState = {
  version: 1;
  status: 'playing' | 'finished';
  players: Player[];
  turn: number;
  actions: number;
  roll: number | null;
  pending: PendingQuestion | null;
  winner: string | null;
  message: string;
};
export const COLORS = ['#edc36c', '#75c6da', '#e994a1', '#a5d992'] as const;

export type Question = {
  text: string;
  choices: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  reference: string;
  explanation: string;
};

export const QUESTIONS: readonly Question[] = [
  { text: 'Quem construiu a arca antes do dilúvio?', choices: ['Abraão', 'Noé', 'Moisés', 'Josué'], correct: 1, reference: 'Gênesis 6:13-22', explanation: 'Noé obedeceu à ordem de Deus para construir a arca.' },
  { text: 'Qual foi o primeiro livro da Bíblia?', choices: ['Êxodo', 'Salmos', 'Gênesis', 'Mateus'], correct: 2, reference: 'Gênesis 1:1', explanation: 'Gênesis abre a narrativa bíblica da criação.' },
  { text: 'Quem recebeu as tábuas da Lei no Sinai?', choices: ['Samuel', 'Moisés', 'Davi', 'Elias'], correct: 1, reference: 'Êxodo 31:18', explanation: 'As tábuas do testemunho foram entregues a Moisés.' },
  { text: 'Qual cidade teve suas muralhas derrubadas no tempo de Josué?', choices: ['Jericó', 'Nínive', 'Belém', 'Éfeso'], correct: 0, reference: 'Josué 6:20', explanation: 'Após o toque das trombetas e o clamor do povo, a muralha de Jericó caiu.' },
  { text: 'Quem derrotou Golias?', choices: ['Salomão', 'Sansão', 'Davi', 'Gideão'], correct: 2, reference: '1 Samuel 17:49-50', explanation: 'Davi venceu Golias com uma funda e uma pedra.' },
  { text: 'Quem pediu sabedoria a Deus para governar?', choices: ['Salomão', 'Saul', 'Absalão', 'Acabe'], correct: 0, reference: '1 Reis 3:9-12', explanation: 'Salomão pediu um coração compreensivo para julgar o povo.' },
  { text: 'Quem foi lançado na cova dos leões?', choices: ['Isaías', 'Daniel', 'Jeremias', 'Ezequiel'], correct: 1, reference: 'Daniel 6:16-23', explanation: 'Daniel foi preservado na cova dos leões.' },
  { text: 'Quem foi engolido por um grande peixe?', choices: ['Jonas', 'Naum', 'Habacuque', 'Amós'], correct: 0, reference: 'Jonas 1:17', explanation: 'Jonas permaneceu três dias e três noites no peixe.' },
  { text: 'Em qual cidade Jesus nasceu?', choices: ['Nazaré', 'Jerusalém', 'Belém', 'Jericó'], correct: 2, reference: 'Mateus 2:1', explanation: 'Jesus nasceu em Belém da Judeia.' },
  { text: 'Quem batizou Jesus no Jordão?', choices: ['Pedro', 'João Batista', 'André', 'Tiago'], correct: 1, reference: 'Mateus 3:13-17', explanation: 'João batizou Jesus no rio Jordão.' },
  { text: 'Quantos apóstolos Jesus escolheu?', choices: ['Sete', 'Dez', 'Doze', 'Quatorze'], correct: 2, reference: 'Lucas 6:12-16', explanation: 'Jesus escolheu doze e os chamou apóstolos.' },
  { text: 'Qual parábola fala de um homem ferido ajudado por um samaritano?', choices: ['O semeador', 'O bom samaritano', 'As dez virgens', 'O tesouro oculto'], correct: 1, reference: 'Lucas 10:30-37', explanation: 'A parábola mostra como agir com misericórdia para com o próximo.' },
  { text: 'Quem negou Jesus três vezes?', choices: ['Tomé', 'Pedro', 'Filipe', 'Bartolomeu'], correct: 1, reference: 'Lucas 22:54-62', explanation: 'Pedro negou conhecer Jesus e depois chorou amargamente.' },
  { text: 'Quem saiu do túmulo ao chamado de Jesus?', choices: ['Lázaro', 'Estevão', 'Nicodemos', 'Barnabé'], correct: 0, reference: 'João 11:43-44', explanation: 'Jesus chamou Lázaro, que saiu do sepulcro.' },
  { text: 'Qual discípulo disse querer ver as marcas dos cravos?', choices: ['João', 'Simão', 'Tomé', 'Mateus'], correct: 2, reference: 'João 20:24-29', explanation: 'Tomé recebeu de Jesus o convite a crer.' },
  { text: 'Em qual livro está o relato do Pentecostes?', choices: ['Romanos', 'Atos', 'Hebreus', 'Gálatas'], correct: 1, reference: 'Atos 2:1-4', explanation: 'Atos dos Apóstolos relata a vinda do Espírito em Pentecostes.' },
  { text: 'Quem foi o primeiro mártir cristão mencionado em Atos?', choices: ['Estevão', 'Timóteo', 'Silas', 'Áquila'], correct: 0, reference: 'Atos 7:54-60', explanation: 'Estevão foi apedrejado após seu testemunho.' },
  { text: 'Quem se converteu a caminho de Damasco?', choices: ['Cornélio', 'Saulo', 'Apolo', 'Barnabé'], correct: 1, reference: 'Atos 9:1-19', explanation: 'Saulo encontrou o Cristo ressurreto no caminho de Damasco.' },
  { text: 'Segundo Efésios 2, a salvação é pela graça mediante o quê?', choices: ['Força', 'Fé', 'Riqueza', 'Genealogia'], correct: 1, reference: 'Efésios 2:8-10', explanation: 'A passagem afirma que a salvação é pela graça mediante a fé, para boas obras.' },
  { text: 'Em qual capítulo de 1 Coríntios Paulo discute a ressurreição?', choices: ['3', '7', '11', '15'], correct: 3, reference: '1 Coríntios 15', explanation: 'O capítulo 15 apresenta a importância da ressurreição de Cristo.' },
  { text: 'Qual capítulo é conhecido como o salmo do Bom Pastor?', choices: ['Salmo 1', 'Salmo 23', 'Salmo 90', 'Salmo 150'], correct: 1, reference: 'Salmo 23', explanation: 'O Senhor é apresentado como o pastor do salmista.' },
  { text: 'Qual livro diz: "O temor do Senhor é o princípio do conhecimento"?', choices: ['Provérbios', 'Rute', 'Cantares', 'Jonas'], correct: 0, reference: 'Provérbios 1:7', explanation: 'Provérbios apresenta o temor do Senhor como fundamento do conhecimento.' },
  { text: 'Quem interpretou sonhos no Egito e se tornou governador?', choices: ['Jacó', 'José', 'Levi', 'Benjamim'], correct: 1, reference: 'Gênesis 41:37-44', explanation: 'José recebeu autoridade no Egito após interpretar o sonho do faraó.' },
  { text: 'Qual profeta foi alimentado por corvos?', choices: ['Eliseu', 'Elias', 'Oséias', 'Miquéias'], correct: 1, reference: '1 Reis 17:4-6', explanation: 'Corvos levavam pão e carne a Elias.' },
  { text: 'Quem foi a rainha que intercedeu por seu povo?', choices: ['Jezabel', 'Vasti', 'Ester', 'Mical'], correct: 2, reference: 'Ester 4:14-16', explanation: 'Ester arriscou-se ao apresentar o pedido diante do rei.' },
  { text: 'Qual livro encerra o Novo Testamento?', choices: ['Judas', 'Apocalipse', 'Atos', 'Hebreus'], correct: 1, reference: 'Apocalipse 22', explanation: 'Apocalipse é o último livro do cânon do Novo Testamento.' },
  { text: 'Quem escreveu a carta a Filemom?', choices: ['Pedro', 'João', 'Paulo', 'Tiago'], correct: 2, reference: 'Filemom 1:1', explanation: 'A carta começa identificando Paulo como seu autor.' },
  { text: 'Qual personagem foi mãe do profeta Samuel?', choices: ['Ana', 'Débora', 'Sara', 'Rebeca'], correct: 0, reference: '1 Samuel 1:20', explanation: 'Ana deu à luz Samuel depois de orar ao Senhor.' },
  { text: 'Quem liderou a reconstrução dos muros de Jerusalém?', choices: ['Esdras', 'Neemias', 'Zorobabel', 'Ageu'], correct: 1, reference: 'Neemias 6:15', explanation: 'O muro foi concluído durante a liderança de Neemias.' },
  { text: 'A quem Jesus disse: "Hoje estarás comigo no paraíso"?', choices: ['A Nicodemos', 'A Pedro', 'A um dos malfeitores crucificados', 'A Pilatos'], correct: 2, reference: 'Lucas 23:39-43', explanation: 'Jesus prometeu o paraíso ao malfeitor que o reconheceu.' },
];

export function squareKind(square: number): SquareKind {
  if (square <= 0) return 'start';
  if (square >= LAST_SQUARE) return 'finish';
  if ([8, 19, 34].includes(square)) return 'advance';
  if ([13, 27, 41].includes(square)) return 'return';
  if (square % 7 === 4) return 'wisdom';
  if (square % 5 === 0) return 'challenge';
  if (square % 3 === 0) return 'scripture';
  return 'ordinary';
}

/** O caminho serpenteia as sete fileiras do tabuleiro (0–48). */
export function squarePosition(square: number): { col: number; row: number } {
  const i = Math.min(LAST_SQUARE, Math.max(0, Math.trunc(square)));
  const rowFromBottom = Math.floor(i / BOARD_SIZE);
  const col = rowFromBottom % 2 ? BOARD_SIZE - 1 - (i % BOARD_SIZE) : i % BOARD_SIZE;
  return { col, row: BOARD_SIZE - 1 - rowFromBottom };
}

export function startGame(names: string[]): GameState {
  const chosen = names.map((s) => s.trim().slice(0, 24)).filter(Boolean);
  if (chosen.length < 2 || chosen.length > 4) throw new Error('São necessários entre 2 e 4 jogadores.');
  return {
    version: 1,
    status: 'playing',
    players: chosen.map((name, i) => ({ id: 'p' + i, name, color: COLORS[i], position: 0, score: 0 })),
    turn: 0,
    actions: 0,
    roll: null,
    pending: null,
    winner: null,
    message: 'Partida iniciada. Lance o dado!',
  };
}

/** Sorteio uniforme sem Math.random para jogadas reais. */
export function secureDie(): number {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / 6) * 6;
  let value: number;
  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= limit);
  return (value % 6) + 1;
}
export function questionFor(square: number, actions: number): number {
  return (square * 7 + actions * 11) % QUESTIONS.length;
}
function nextTurn(state: GameState): GameState {
  return { ...state, turn: (state.turn + 1) % state.players.length, pending: null };
}
function withPlayer(state: GameState, change: (p: Player) => Player): GameState {
  return { ...state, players: state.players.map((p, i) => i === state.turn ? change(p) : p) };
}
export function rollDie(state: GameState, die: number): GameState {
  if (state.status !== 'playing' || state.pending) throw new Error('Espere a pergunta ou o fim da partida.');
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error('Valor inválido no dado.');
  const current = state.players[state.turn];
  const landing = Math.min(LAST_SQUARE, current.position + die);
  let next = withPlayer(state, p => ({ ...p, position: landing }));
  next = { ...next, roll: die, actions: state.actions + 1 };
  if (landing === LAST_SQUARE) return { ...next, status: 'finished', winner: current.id, message: current.name + ' concluiu a jornada!' };
  const kind = squareKind(landing);
  if (kind === 'advance' || kind === 'return') {
    const move = kind === 'advance' ? 2 : -2;
    const to = Math.min(LAST_SQUARE, Math.max(0, landing + move));
    next = withPlayer(next, p => ({ ...p, position: to }));
    if (to === LAST_SQUARE) return { ...next, status: 'finished', winner: current.id, message: current.name + ' concluiu a jornada!' };
    return nextTurn({ ...next, message: current.name + (move > 0 ? ' avançou duas casas!' : ' recuou duas casas.') });
  }
  if (kind === 'scripture' || kind === 'challenge' || kind === 'wisdom') {
    const question = questionFor(landing, next.actions);
    return { ...next, pending: { square: landing, question }, message: current.name + ': responda à pergunta bíblica.' };
  }
  return nextTurn({ ...next, message: current.name + ' avançou ' + die + (die === 1 ? ' casa.' : ' casas.') });
}
export function answerQuestion(state: GameState, choice: number): GameState {
  if (state.status !== 'playing' || !state.pending) throw new Error('Não há pergunta pendente.');
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new Error('Resposta inválida.');
  const question = QUESTIONS[state.pending.question];
  const correct = question.correct === choice;
  const kind = squareKind(state.pending.square);
  const reward = kind === 'wisdom' ? 3 : kind === 'challenge' ? 2 : 1;
  const player = state.players[state.turn];
  const next = withPlayer(state, p => ({
    ...p,
    score: p.score + (correct ? reward : 0),
    position: correct ? p.position : Math.max(0, p.position - (kind === 'challenge' ? 2 : 1)),
  }));
  return nextTurn({
    ...next,
    message: (correct ? 'Correto! +' + reward + ' pontos de sabedoria. ' : 'Resposta incorreta. ' + player.name + ' recuou. ') + question.reference + ': ' + question.explanation,
  });
}
export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as GameState;
  return s.version === 1 && (s.status === 'playing' || s.status === 'finished') &&
    Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= 4 &&
    Number.isInteger(s.turn) && s.turn >= 0 && s.turn < s.players.length &&
    s.players.every(p => typeof p.name === 'string' && Number.isInteger(p.position) && p.position >= 0 && p.position <= LAST_SQUARE &&
      typeof p.score === 'number' && p.score >= 0 && typeof p.color === 'string') &&
    Number.isInteger(s.actions) && s.actions >= 0 &&
    (!s.pending || (Number.isInteger(s.pending.question) && s.pending.question >= 0 && s.pending.question < QUESTIONS.length));
}

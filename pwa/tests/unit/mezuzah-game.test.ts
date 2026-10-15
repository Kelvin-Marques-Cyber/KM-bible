import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE, LAST_SQUARE, QUESTIONS, answerQuestion, isGameState, questionFor,
  rollDie, squareKind, squarePosition, startGame, type GameState,
} from '../../src/lib/mezuzah-game';

describe('Mezuzá 3D: regras', () => {
  it('cria partidas válidas para dois a quatro jogadores', () => {
    for(let n=2;n<=4;n++) {
      const state=startGame(Array.from({length:n},(_,i)=>'Pessoa '+(i+1)));
      expect(isGameState(state)).toBe(true);
      expect(state.players).toHaveLength(n);
      expect(state.players.every(p=>p.position===0&&p.score===0)).toBe(true);
    }
    expect(()=>startGame(['Sozinho'])).toThrow();
    expect(()=>startGame(['A','B','C','D','E'])).toThrow();
  });
  it('tabuleiro tem 49 posições únicas, percorre 7 fileiras em serpentina', () => {
    const places=new Set<string>();
    for(let i=0;i<=LAST_SQUARE;i++){
      const {col,row}=squarePosition(i);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(BOARD_SIZE);
      places.add(col+':'+row);
    }
    expect(places.size).toBe(49);
    expect(squarePosition(0)).toEqual({col:0,row:6});
    expect(squarePosition(7)).toEqual({col:6,row:5});
    expect(squarePosition(48)).toEqual({col:6,row:0});
  });
  it('usa referências bíblicas e perguntas com alternativas verificáveis',()=>{
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(30);
    for(const q of QUESTIONS){
      expect(q.choices).toHaveLength(4);
      expect(q.choices[q.correct].length).toBeGreaterThan(0);
      expect(q.reference).not.toBe('');
      expect(q.explanation.length).toBeGreaterThan(12);
    }
    expect(questionFor(3,1)).toBe(questionFor(3,1));
  });
  it('não permite dado inválido ou novo lançamento antes da resposta',()=>{
    const original=startGame(['A','B']);
    expect(()=>rollDie(original,0)).toThrow();
    expect(()=>rollDie(original,7)).toThrow();
    const asking=rollDie(original,3);
    expect(squareKind(3)).toBe('scripture');
    expect(asking.pending).not.toBeNull();
    expect(()=>rollDie(asking,2)).toThrow();
    expect(original.players[0].position).toBe(0);
    expect(original.pending).toBeNull();
  });
  it('resposta certa recompensa, resposta errada recua e ambas passam o turno',()=>{
    const g=rollDie(startGame(['A','B']),3);
    const q=QUESTIONS[g.pending!.question];
    const yes=answerQuestion(g,q.correct);
    const no=answerQuestion(g,(q.correct+1)%4);
    expect(yes.turn).toBe(1);
    expect(yes.pending).toBeNull();
    expect(yes.players[0].score).toBeGreaterThan(0);
    expect(yes.players[0].position).toBe(3);
    expect(no.players[0].score).toBe(0);
    expect(no.players[0].position).toBe(2);
    expect(()=>answerQuestion(yes,0)).toThrow();
  });
  it('aplica casa de avanço e casa de retorno',()=>{
    let game=startGame(['A','B']);
    // Exemplo: a casa 8 avança duas posições.
    game={...game,players:game.players.map((p,i)=>i===0?{...p,position:6}:p)};
    const advance=rollDie(game,2);
    expect(advance.players[0].position).toBe(10);
    expect(advance.turn).toBe(1);
    expect(advance.pending).toBeNull();
    game={...game,players:game.players.map((p,i)=>i===0?{...p,position:10}:p)};
    const backwards=rollDie(game,3);
    expect(backwards.players[0].position).toBe(11);
    expect(backwards.turn).toBe(1);
  });
  it('declara vitória ao atingir o final e bloqueia jogadas posteriores',()=>{
    const start=startGame(['A','B']);
    const almost:GameState={...start,players:start.players.map((p,i)=>i===0?{...p,position:47}:p)};
    const end=rollDie(almost,6);
    expect(end.status).toBe('finished');
    expect(end.winner).toBe('p0');
    expect(end.players[0].position).toBe(LAST_SQUARE);
    expect(()=>rollDie(end,2)).toThrow();
  });
  it('recusa saves malformados e preserva saves válidos',()=>{
    const original=startGame(['Ana','Lia']);
    expect(isGameState(original)).toBe(true);
    expect(isGameState({...original,turn:9})).toBe(false);
    expect(isGameState({...original,players:[]})).toBe(false);
    expect(isGameState({...original,players:[{...original.players[0],position:99},original.players[1]]})).toBe(false);
    expect(isGameState(null)).toBe(false);
  });
});

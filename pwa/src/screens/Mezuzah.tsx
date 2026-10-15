// Mezuzá: partida bíblica original, local e jogável (2–4 pessoas).
// O multiplayer remoto será conectado apenas quando houver serviço de salas
// configurado: não simulamos uma partida em rede num site estático.
import { ArrowLeft, Award, BookOpen, Check, Dices, RotateCcw, ScrollText, ShieldCheck, Trophy, Users, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MezuzahBoard3D from '../components/MezuzahBoard3D';
import {
  LAST_SQUARE, QUESTIONS, answerQuestion, isGameState, rollDie, secureDie,
  squareKind, startGame, type GameState,
} from '../lib/mezuzah-game';
import { tr } from '../lib/i18n';

const STORAGE_KEY='km-mezuzah-v1';
function restore(): GameState | null {
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    const data: unknown=raw?JSON.parse(raw):null;
    return isGameState(data)?data:null;
  } catch { return null; }
}
const demo=startGame(['Jogador 1','Jogador 2']);
const labelFor=(kind:ReturnType<typeof squareKind>)=>({
  start:'Início', ordinary:'Caminho', scripture:'Escrituras',
  challenge:'Desafio',wisdom:'Sabedoria',advance:'Avanço',
  return:'Retorno',finish:'Chegada',
})[kind];

export default function MezuzahPage({onBack}:{onBack:()=>void}) {
  const [game,setGame]=useState<GameState|null>(restore);
  const [players,setPlayers]=useState(2);
  const [names,setNames]=useState(['Jogador 1','Jogador 2','Jogador 3','Jogador 4']);
  const [restart,setRestart]=useState(false);
  useEffect(()=>{
    try {
      if(game)localStorage.setItem(STORAGE_KEY,JSON.stringify(game));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* Navegação privada: a partida continua em memória. */ }
  },[game]);
  const active=game?.players[game.turn];
  const pending=game?.pending?QUESTIONS[game.pending.question]:null;
  const winner=game?.winner?game.players.find(p=>p.id===game.winner):null;
  const sorted=useMemo(()=>[...(game?.players??[])].sort((a,b)=>b.score-a.score),[game]);
  const launch=()=>{setGame(startGame(names.slice(0,players)));setRestart(false);};
  const roll=()=>{
    if(!game||game.status!=='playing'||game.pending)return;
    setGame(rollDie(game,secureDie()));
  };
  const answer=(choice:number)=>{
    if(!game||!game.pending)return;
    setGame(answerQuestion(game,choice));
  };
  const reset=()=>{
    if(!restart){setRestart(true);return;}
    setGame(null);setRestart(false);
  };

  return (
    <div className="scroll-area h-full bg-[#11191b] text-[#f4e8d6]">
      <div className="mx-auto max-w-[1390px] px-3 py-4 sm:px-5 sm:py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#bfa886]/30 bg-[#252d2e] px-4 text-sm hover:bg-[#374042]"><ArrowLeft size={17}/> Ferramentas e Games</button>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[.32em] text-[#c9b88d]">Bíblia Reformada · Jogos</p>
            <h2 className="font-reading text-3xl tracking-wide sm:text-4xl">Mezuzá <span className="text-[#d6ad63]">3D</span></h2>
          </div>
        </header>
        <p className="my-4 max-w-3xl text-sm leading-relaxed text-[#bfc8c2]">Uma jornada bíblica original sobre um tabuleiro tridimensional. Lance o dado, estude as Escrituras e acumule sabedoria. Sem apostas, sem compras e com perguntas acompanhadas de referências.</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(285px,.95fr)]">
          <section aria-label="Tabuleiro Mezuzá 3D" className="min-w-0">
            <div className="h-[350px] sm:h-[540px] lg:h-[min(70vh,700px)]">
              <MezuzahBoard3D game={game??demo} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#e0d0ad]" aria-label="Legenda das casas">
              {(['scripture','challenge','wisdom','advance','return','finish'] as const).map(type=>(
                <span key={type} className="rounded-full border border-[#e2c9a1]/20 bg-[#253032] px-3 py-2">{labelFor(type)}</span>
              ))}
            </div>
          </section>
          <div className="flex flex-col gap-4">
            {!game ? (
              <section className="rounded-[22px] border border-[#c8a468]/30 bg-[#283032] p-5 shadow-xl">
                <div className="mb-3 flex items-center gap-2 text-[#e4c88d]"><Users size={21}/><h3 className="text-xl font-semibold">Nova partida</h3></div>
                <p className="mb-4 text-sm text-[#c5cdc7]">Jogue com amigos no mesmo aparelho. A partida é salva neste navegador.</p>
                <label className="block text-sm font-medium" htmlFor="mezuzah-players">Jogadores</label>
                <select id="mezuzah-players" value={players} onChange={e=>setPlayers(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#c8a468]/40 bg-[#161e20] px-3 py-3">
                  {[2,3,4].map(n=><option value={n} key={n}>{n} jogadores</option>)}
                </select>
                <div className="mt-4 space-y-3">
                  {names.slice(0,players).map((name,i)=>(
                    <label key={i} className="flex items-center gap-3 text-sm">
                      <span className="h-5 w-5 shrink-0 rounded-full ring-2 ring-white/20" style={{background:['#edc36c','#75c6da','#e994a1','#a5d992'][i]}}/>
                      <span className="sr-only">Nome do jogador {i+1}</span>
                      <input maxLength={24} value={name} onChange={e=>setNames(prev=>prev.map((n,j)=>j===i?e.target.value:n))} className="min-w-0 flex-1 rounded-lg border border-[#c8a468]/30 bg-[#161e20] px-3 py-3" placeholder={'Jogador '+(i+1)}/>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={launch} disabled={names.slice(0,players).some(n=>!n.trim())} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#dec28e] px-4 font-bold text-[#29201b] shadow-lg hover:bg-[#f3dcae] disabled:opacity-40"><Dices size={19}/> Iniciar jornada</button>
                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#c5cdc7]"><WifiOff size={17} className="shrink-0"/> Jogo local disponível offline. Para salas online reais será necessário configurar um servidor de partidas.</p>
              </section>
            ) : (
              <>
                <section className="rounded-[22px] border border-[#d9b871]/35 bg-[#283032] p-5 shadow-xl" aria-live="polite">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-lg font-semibold"><Dices size={21} className="text-[#f3d393]"/> {game.status==='finished'?'Partida concluída':'Sua vez'}</h3>
                    <span className="rounded-full bg-[#151d1e] px-3 py-1 text-xs text-[#e8d5ae]">Rodada {Math.floor(game.actions/game.players.length)+1}</span>
                  </div>
                  {winner ? (
                    <div className="mt-4 rounded-xl border border-[#dcb873]/30 bg-[#3a3628] p-4">
                      <Trophy size={38} className="text-[#e6c179]"/>
                      <p className="mt-2 text-2xl font-semibold">{winner.name} venceu!</p>
                      <p className="mt-1 text-sm text-[#e0d0b8]">{winner.score} pontos de sabedoria.</p>
                      <button type="button" className="mt-4 rounded-xl bg-[#dcb873] px-4 py-3 font-semibold text-[#29201b]" onClick={()=>setGame(null)}>Nova partida</button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#151d1f] p-3">
                        <span className="h-11 w-11 rounded-full border-4 border-[#ffffff]/20 shadow-inner" style={{background:active?.color}}/>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xl font-semibold">{active?.name}</div>
                          <p className="text-xs text-[#c3cbc5]">Casa {active?.position} de {LAST_SQUARE} · {active?.score} pontos</p>
                        </div>
                        {game.roll!==null&&<span aria-label={'Último dado '+game.roll} className="grid h-12 w-12 place-items-center rounded-lg border-2 border-[#dec28e] bg-[#e9d8b6] text-2xl font-black text-[#29201b]">{game.roll}</span>}
                      </div>
                      {pending ? (
                        <div className="mt-4 rounded-xl border border-[#cfb17e]/40 bg-[#171f20] p-4">
                          <div className="flex items-center gap-2 text-[#d5b476]"><BookOpen size={19}/><span className="text-xs uppercase tracking-wider">{labelFor(squareKind(game.pending!.square))}</span></div>
                          <p className="mt-3 text-lg font-semibold leading-snug">{pending.text}</p>
                          <div className="mt-4 grid gap-2">
                            {pending.choices.map((choice,i)=><button key={i} type="button" onClick={()=>answer(i)} className="min-h-12 rounded-lg border border-[#dbc398]/25 bg-[#313c3c] px-4 py-3 text-left text-sm transition hover:border-[#e7ca96] hover:bg-[#475251] focus-visible:outline focus-visible:outline-amber-300"><span className="mr-2 font-semibold text-[#d6b47d]">{String.fromCharCode(65+i)}.</span>{choice}</button>)}
                          </div>
                          <p className="mt-3 text-xs text-[#ccd6d0]">Referência para conferir: {pending.reference}</p>
                        </div>
                      ) : (
                        <button type="button" onClick={roll} className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#dabb7b] text-lg font-bold text-[#22201a] shadow-lg transition hover:bg-[#f0d9a9]"><Dices size={23}/> Lançar dado</button>
                      )}
                    </>
                  )}
                  <p role="status" className="mt-4 text-sm leading-relaxed text-[#d7dfda]">{game.message}</p>
                </section>
                <section className="rounded-[22px] border border-[#c8a468]/25 bg-[#283032] p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold"><Award size={20} className="text-[#e2bc75]"/> Classificação</h3>
                  <ol className="space-y-2">{sorted.map((p,i)=>(
                    <li key={p.id} className="flex items-center gap-2 rounded-lg bg-[#192223] px-3 py-2 text-sm">
                      <span className="w-5 text-[#e5ca9d]">{i+1}.</span><span className="h-3 w-3 rounded-full" style={{background:p.color}}/><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="tabular-nums text-[#e5ca9d]">{p.score} pts</span><span className="text-[#bcc9c2]">· {p.position}</span>
                    </li>
                  ))}</ol>
                </section>
                <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5b477]/30 bg-[#293130] px-4 text-sm hover:bg-[#374442]">
                  {restart ? <><Check size={17}/> Confirmar reinício</> : <><RotateCcw size={17}/> Reiniciar partida</>}
                </button>
              </>
            )}
            <aside className="rounded-xl border border-[#b9c6c1]/15 bg-[#212b2c] p-4 text-sm text-[#c4ceca]">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-[#e8d9bc]"><ShieldCheck size={18}/> Regras e acessibilidade</h3>
              <p>2–4 participantes · dado de seis faces · 49 casas. Casas de Escrituras, desafios e sabedoria concedem pontos ao responder; avanço e retorno modificam o percurso. Ganha quem alcança a última casa.</p>
              <p className="mt-2 flex items-center gap-2"><ScrollText size={16}/> Questões: {QUESTIONS.length} com referências bíblicas.</p>
              <p className="mt-2 text-xs">Se o dispositivo não oferecer WebGL2, o tabuleiro passa para uma versão 2D navegável. As perguntas permanecem acessíveis por teclado.</p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

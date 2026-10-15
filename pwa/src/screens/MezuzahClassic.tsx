import { ArrowLeft, BookOpen, Check, RotateCcw, ScrollText, Trophy, Users } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import MezuzahClassicBoard3D from '../components/MezuzahClassicBoard3D';
import { CLASSIC_CARDS, CLASSIC_KIND_LABELS, chooseNumber, createClassicGame, drawCard, eligiblePlayers, isClassicGame, resolveChallenge, routePhase, RULES_SOURCE, totalSteps, type ClassicGame, type ClassicOptions } from '../games/mezuzah-classic/engine';

export const CLASSIC_SAVE_KEY = 'km-mezuzah-classic-v2';
const Legacy = lazy(() => import('./Mezuzah'));
export const classicButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ccb17f]/35 bg-[#293b38] px-4 py-3 text-sm text-[#f2e6cd] hover:bg-[#3c5149] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200';
const field = 'mt-1 min-h-12 w-full rounded-xl border border-[#ccb17f]/35 bg-[#132522] px-3 py-2 text-sm text-[#f2e6cd]';
export const classicReader = (game: ClassicGame) => game.players[(game.turn - 1 + game.players.length) % game.players.length];

/** An original digital route, adjustable for a physical board; never claimed as the official count. */
export function ClassicRouteFields({ count, options, onChange }: { count: number; options: { oldestIndex: number; outerSteps: string; starSteps: string }; onChange: (value: typeof options) => void }) {
  return <div className="space-y-3">
    <label className="block text-sm">Participante ou monitor de maior idade<select className={field} value={Math.min(count - 1, options.oldestIndex)} onChange={e => onChange({ ...options, oldestIndex: Number(e.target.value) })}>{Array.from({ length: count }, (_, i) => <option key={i} value={i}>Equipe {i + 1}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-sm">Passos até a estrela<input aria-label="Passos até a estrela" className={field} type="number" inputMode="numeric" min="3" max="100" placeholder="Conferir tabuleiro" value={options.outerSteps} onChange={e => onChange({ ...options, outerSteps: e.target.value })} /></label><label className="block text-sm">Passos na volta da estrela<input aria-label="Passos na volta da estrela" className={field} type="number" inputMode="numeric" min="3" max="100" placeholder="Conferir tabuleiro" value={options.starSteps} onChange={e => onChange({ ...options, starSteps: e.target.value })} /></label></div>
    <p className="text-xs leading-relaxed text-[#b9cabb]">Percurso digital autoral: 12 passos por Israel, 12 na estrela e 1 até o centro. Você pode ajustar as etapas para jogar com seu tabuleiro físico. A quantidade original de casas não foi confirmada na fonte consultada.</p>
  </div>;
}
export function routeOptions(value: { oldestIndex: number; outerSteps: string; starSteps: string }): ClassicOptions | null {
  const outerSteps = Number(value.outerSteps), starSteps = Number(value.starSteps);
  return Number.isInteger(outerSteps) && outerSteps >= 3 && outerSteps <= 100 && Number.isInteger(starSteps) && starSteps >= 3 && starSteps <= 100 ? { oldestIndex: value.oldestIndex, outerSteps, starSteps } : null;
}
export function ClassicRules() {
  return <aside className="rounded-2xl border border-[#ccb17f]/25 bg-[#1b302b] p-4 text-xs leading-relaxed text-[#c1d0c0]">
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#e4c88f]"><BookOpen size={17} />Mezuzá Clássico · regras consultadas</h3>
    <p>O mais velho começa. O leitor à direita compra o cartão e o jogador da vez escolhe de 1 a 10. Após o desafio, a vez segue no sentido horário. No individual, só a equipe da vez participa, sem repasse. No coletivo, o leitor e sua equipe ficam de fora. O acerto ou a vitória no coletivo avança um passo; vencer exige percorrer Israel, dar a volta na estrela e chegar ao centro.</p>
    <p className="mt-2">São sete dinâmicas. A avaliação da fala, leitura e canto é feita pelo leitor ou monitor. Um minuto é uma sugestão, sem derrota automática. Empates coletivos devem ser resolvidos pelo grupo antes de registrar o vencedor.</p>
    <p className="mt-2">As {CLASSIC_CARDS.length * 10} atividades desta versão são autorais. O percurso 3D é autoral e ajustável. Esta é uma adaptação baseada nos procedimentos publicados, com cartões e arte próprios.</p>
    <a className="mt-3 inline-block min-h-9 text-[#e4c88f] underline underline-offset-4" href={RULES_SOURCE} target="_blank" rel="noreferrer">Procedimentos publicados pela Bible Toys</a>
  </aside>;
}

export function ClassicPlay({ game, canDraw = true, canChoose = true, canResolve = true, onDraw, onChoose, onResolve }: { game: ClassicGame; canDraw?: boolean; canChoose?: boolean; canResolve?: boolean; onDraw: () => void; onChoose: (number: number) => void; onResolve: (winnerId: string | null) => void }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  useEffect(() => { setShowAnswer(false); setTimer(null); }, [game.roundId, game.phase]);
  useEffect(() => { if (timer === null || timer <= 0) return; const id = setTimeout(() => setTimer(n => n === null ? null : Math.max(0, n - 1)), 1000); return () => clearTimeout(id); }, [timer]);
  const player = game.players[game.turn], reader = classicReader(game), pending = game.pending;
  return <>
    <section className="rounded-2xl border border-[#d4b87d]/40 bg-[#233b33] p-5" aria-label="Turno do Mezuzá Clássico">
      {game.phase === 'finished' ? <><Trophy size={34} className="text-[#e4c586]" /><h3 className="mt-2 font-reading text-3xl">{game.players.find(p => p.id === game.winner)?.name} chegou ao centro!</h3><p className="mt-2 text-sm">Percurso concluído conforme as etapas configuradas nesta partida.</p></> : <>
        <p className="text-[10px] uppercase tracking-[.2em] text-[#d6bd88]">Rodada {game.roundId + 1} · sentido horário</p>
        <h3 className="mt-2 font-reading text-2xl">Vez de {player.name}</h3>
        <p className="mt-1 text-xs text-[#c2d1c2]">Leitor à direita: <strong>{reader.name}</strong></p>
        {game.phase === 'draw' && <div className="mt-4"><p className="mb-3 text-sm leading-relaxed text-[#d7dfcf]">O leitor compra um cartão. Depois, {player.name} escolhe um número, sem ver as atividades.</p><button type="button" className={classicButton} disabled={!canDraw} onClick={onDraw}><ScrollText size={17} />Comprar cartão</button>{!canDraw && <p className="mt-2 text-xs text-[#b9cabb]">Aguardando o leitor comprar o cartão.</p>}</div>}
        {game.phase === 'choose' && <div className="mt-4"><p className="text-sm">{player.name}, escolha um número de 1 a 10.</p><div className="mt-3 grid grid-cols-5 gap-2">{Array.from({ length: 10 }, (_, i) => <button type="button" className={`${classicButton} !px-1`} key={i} disabled={!canChoose} onClick={() => onChoose(i + 1)}>{i + 1}</button>)}</div></div>}
        {game.phase === 'challenge' && pending?.kind && <div className="mt-4 rounded-xl border border-[#d9ba77]/25 bg-[#12281f] p-4">
          <p className="text-[10px] uppercase tracking-widest text-[#d6bd88]">{pending.scope === 'collective' ? 'Desafio coletivo · leitor e equipe excluídos' : 'Desafio individual · sem repasse'}</p>
          <h4 className="mt-2 text-lg font-semibold text-[#ead2a0]">{CLASSIC_KIND_LABELS[pending.kind]}</h4><p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{pending.prompt}</p>
          {canResolve && <><button type="button" className={`${classicButton} mt-4 w-full !text-xs`} onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? 'Ocultar orientação do leitor' : 'Leitor: conferir orientação e resposta'}</button>{showAnswer && <div className="mt-3 rounded-lg bg-[#344833] p-3 text-sm"><p>{pending.answer}</p><p className="mt-2 text-xs text-[#d6bd88]">Referência: {pending.reference}</p></div>}</>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className={`${classicButton} !text-xs`} onClick={() => setTimer(timer === null ? 60 : null)}>{timer === null ? 'Lembrete opcional de 1 minuto' : 'Desligar lembrete'}</button>{timer !== null && <span role="timer" className="text-sm tabular-nums">{timer > 0 ? `${timer}s` : 'Tempo sugerido atingido — o grupo decide'}</span>}</div>
          <p className="mb-2 mt-4 text-xs text-[#c2d1c2]">{canResolve ? 'O leitor registra quem concluiu corretamente:' : 'Aguardando a avaliação do leitor.'}</p><div className="grid gap-2">{eligiblePlayers(game).map(p => <button type="button" key={p.id} disabled={!canResolve} className={classicButton} onClick={() => onResolve(p.id)}><Check size={15} />Confirmar acerto de {p.name}</button>)}<button type="button" disabled={!canResolve} className={classicButton} onClick={() => onResolve(null)}>Ninguém concluiu · passar a vez</button></div>
        </div>}
      </>}
    </section>
    <section className="rounded-2xl border border-[#ccb17f]/25 bg-[#1b302b] p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold"><Users size={18} className="text-[#dfc189]" />Equipes e percurso</h3><ol className="space-y-3">{game.players.map(p => <li key={p.id}><div className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full" style={{ background: p.color }} /><span className="mr-auto">{p.name}</span><span className="text-xs text-[#d3bd8b]">{p.steps}/{totalSteps(game)} · {routePhase(game, p) === 'outer' ? 'Israel' : routePhase(game, p) === 'star' ? 'Estrela' : 'Centro'}</span></div><progress className="mt-1 h-2 w-full accent-[#d6b774]" value={p.steps} max={totalSteps(game)} /></li>)}</ol></section>
    <details className="rounded-xl border border-[#ccb17f]/25 p-4 text-xs text-[#c4d2c1]"><summary className="cursor-pointer font-semibold text-[#e1c58d]">Histórico · {game.history.length} desafios</summary><ol className="mt-3 max-h-52 space-y-2 overflow-y-auto">{game.history.slice(-30).map(item => <li key={item.roundId}>{item.roundId + 1}. {CLASSIC_KIND_LABELS[item.kind]} · {item.winnerId ? `${game.players.find(p => p.id === item.winnerId)?.name}: +1 passo` : 'Sem avanço'}</li>)}</ol></details>
  </>;
}
function restore(): ClassicGame | null { try { const value: unknown = JSON.parse(localStorage.getItem(CLASSIC_SAVE_KEY) ?? 'null'); return isClassicGame(value) ? value : null; } catch { return null; } }
function randomCard() { const values = new Uint32Array(1), count = CLASSIC_CARDS.length, limit = Math.floor(0x1_0000_0000 / count) * count; do { crypto.getRandomValues(values); } while (values[0] >= limit); return values[0] % count; }

export default function MezuzahClassic({ onBack }: { onBack: () => void }) {
  const [game, setGame] = useState<ClassicGame | null>(restore);
  const [count, setCount] = useState(2), [names, setNames] = useState(['Equipe 1', 'Equipe 2', 'Equipe 3', 'Equipe 4']);
  const [options, setOptions] = useState({ oldestIndex: 0, outerSteps: '12', starSteps: '12' });
  const [error, setError] = useState(''), [restart, setRestart] = useState(false), [legacy, setLegacy] = useState(false);
  const [hasLegacy] = useState(() => { try { return !!localStorage.getItem('km-mezuzah-v1'); } catch { return false; } });
  useEffect(() => { if (!game) return; try { localStorage.setItem(CLASSIC_SAVE_KEY, JSON.stringify(game)); } catch { setError('Partida em memória: o navegador não permitiu salvar o progresso.'); } }, [game]);
  const act = (action: (value: ClassicGame) => ClassicGame) => { if (!game) return; try { setGame(action(game)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar a ação.'); } };
  const launch = () => { const route = routeOptions(options); if (!route) return; try { setGame(createClassicGame(names.slice(0, count), { ...route, oldestIndex: Math.min(count - 1, route.oldestIndex) })); setError(''); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } };
  if (legacy) return <div className="h-full"><div className="bg-[#674a26] p-3 text-center text-sm text-white">Adaptação anterior · regras diferentes do Clássico. <button type="button" className="ml-2 underline" onClick={() => setLegacy(false)}>Voltar ao Clássico</button></div><Suspense fallback={<p>Carregando partida anterior…</p>}><Legacy onBack={() => setLegacy(false)} /></Suspense></div>;
  return <div className="scroll-area h-full bg-[#10231e] text-[#f1e6cd]"><div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><button type="button" className={classicButton} onClick={onBack}><ArrowLeft size={17} />Ferramentas e Games</button><div className="text-right"><p className="text-[10px] tracking-[.28em] text-[#d3b578]">MEZUZÁ CLÁSSICO</p><h2 className="font-reading text-3xl sm:text-4xl">Mezuzá <span className="text-[#e5c486]">3D</span></h2></div></header>
    <p className="mb-4 max-w-3xl text-sm leading-relaxed text-[#c4d3c2]">Conhecimento, leitura, busca, significado, cânticos e versículos. Jogue em equipes, com desafios mediados pelo leitor e avanço de um passo por acerto.</p>
    {error && <p role="alert" className="mb-4 rounded-xl bg-[#653c2c] p-3 text-sm">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]"><div className="min-w-0"><div className="h-[380px] sm:h-[600px]"><MezuzahClassicBoard3D game={game ?? createClassicGame(['Equipe 1', 'Equipe 2'], { oldestIndex: 0, outerSteps: 12, starSteps: 12 })} /></div><p className="mt-3 text-xs leading-relaxed text-[#b9cabb]">{game ? `Percurso configurado pelo anfitrião: ${game.route.outerSteps} passos por Israel, ${game.route.starSteps} na estrela e 1 até o centro.` : 'Prévia do percurso digital autoral. Você pode ajustar as etapas antes de começar.'} Arte geográfica original; não reproduz o desenho do tabuleiro comercial.</p><div className="mt-4"><ClassicRules /></div></div>
      <div className="space-y-4">{game ? <><ClassicPlay game={game} onDraw={() => act(state => drawCard(state, randomCard()))} onChoose={number => act(state => chooseNumber(state, number))} onResolve={winner => act(state => resolveChallenge(state, winner))} /><p className="text-xs text-[#b9cabb]">Partida salva neste aparelho. A avaliação é feita pelo leitor, como no jogo de mesa.</p><button type="button" className={classicButton} onClick={() => { if (!restart) { setRestart(true); return; } setGame(null); setRestart(false); try { localStorage.removeItem(CLASSIC_SAVE_KEY); } catch {} }}><RotateCcw size={16} />{restart ? 'Confirmar nova partida' : 'Nova partida / revanche'}</button>{restart && <button type="button" className={classicButton} onClick={() => setRestart(false)}>Cancelar</button>}</> : <section className="rounded-2xl border border-[#ccb17f]/35 bg-[#233b33] p-5"><h3 className="font-reading text-2xl">Nova partida</h3><p className="mb-4 mt-2 text-sm text-[#c3d2c0]">De 2 a 4 equipes, com qualquer número de pessoas em cada equipe.</p><label className="block text-sm" htmlFor="mezuzah-classic-players">Equipes<select id="mezuzah-classic-players" className={field} value={count} onChange={e => setCount(Number(e.target.value))}>{[2, 3, 4].map(n => <option key={n} value={n}>{n} equipes</option>)}</select></label><div className="my-4 space-y-2">{names.slice(0, count).map((name, i) => <label key={i} className="block text-xs text-[#c3d2c0]">Nome da equipe {i + 1}<input className={field} value={name} maxLength={24} onChange={e => setNames(prev => prev.map((v, j) => j === i ? e.target.value : v))} /></label>)}</div><ClassicRouteFields count={count} options={options} onChange={setOptions} /><button type="button" className={`${classicButton} mt-5 w-full !bg-[#dfc38e] font-semibold !text-[#243325]`} disabled={!routeOptions(options) || names.slice(0, count).some(name => !name.trim())} onClick={launch}>Iniciar partida clássica</button></section>}
      {hasLegacy && <button type="button" className={`${classicButton} w-full !text-xs`} onClick={() => setLegacy(true)}>Retomar adaptação anterior salva · regras diferentes</button>}
      </div></div>
  </div></div>;
}

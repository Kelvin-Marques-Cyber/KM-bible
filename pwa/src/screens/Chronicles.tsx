import { ArrowLeft, Backpack, BookOpen, Compass, Flag, Map, Pause, Play, ScrollText, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ChroniclesCanvas from '../games/chronicles/ChroniclesCanvas';
import { activeObjective, BIBLE_REFERENCES, chooseDialogue, CODEX_ENTRIES, createGame, getMap, getQuestJournal, interact, INVENTORY_ITEMS, SAGAS, stepMovement, type GameState } from '../games/chronicles/engine';
import { loadGame, saveGame } from '../games/chronicles/persistence';
import { app } from '../lib/app';
import { verse } from '../lib/content';
import type { Ref } from '../lib/domain';
import { createCard, showPassage } from './open';
import { message, Spinner } from '../components/ui';

type Panel = 'play' | 'journal' | 'inventory' | 'codex' | 'map';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d3bc87]/30 bg-[#222e2a] px-3 py-2 text-sm text-[#f3e6c8] hover:bg-[#34453b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f3d195]';
const emptyInput = { dx: 0, dy: 0, run: false };
const reference = (r: (typeof BIBLE_REFERENCES)[number]): Ref => ({ book: r.b, chapter: r.c, verse: r.v });

/** Episode UI only: movement, narrative and rendering remain independent modules. */
export default function Chronicles({ onBack, backLabel = 'Ferramentas e Games' }: { onBack: () => void; backLabel?: string }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [panel, setPanel] = useState<Panel>('play');
  const [sceneHost, setSceneHost] = useState<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [restart, setRestart] = useState(false);
  const [touch, setTouch] = useState(emptyInput);
  const [music, setMusic] = useState(false);
  const [busyMemory, setBusyMemory] = useState(false);
  const latest = useRef(game);
  latest.current = game;
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    let mounted = true;
    loadGame().then(value => { if (mounted) setGame(value); }).catch(e => { if (mounted) setError(String(e instanceof Error ? e.message : e)); }).finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; if (latest.current) void saveGame(latest.current).catch(() => {}); };
  }, []);
  useEffect(() => {
    if (!game || !loaded) return;
    setSaved('Salvando…');
    const timer = setTimeout(() => {
      void saveGame(game).then(() => setSaved('Progresso salvo neste aparelho')).catch(() => { setSaved('Não foi possível salvar'); setError('O armazenamento está indisponível. Continue nesta sessão ou exporte o save antes de sair.'); });
    }, 400);
    return () => clearTimeout(timer);
  }, [game, loaded]);
  // Ao caminhar continuamente, o debounce de 400 ms nunca dispara.
  // Um checkpoint periódico mantém o progresso protegido mesmo durante
  // longas travessias, sem gravar 60 vezes por segundo no IndexedDB.
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => {
      const current = latest.current;
      if (!current) return;
      void saveGame(current).then(() => setSaved('Progresso salvo neste aparelho')).catch(() => {
        setSaved('Não foi possível salvar');
        setError('O armazenamento está indisponível. Continue nesta sessão ou exporte o save antes de sair.');
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [loaded]);

  useEffect(() => {
    const stop = () => setTouch(emptyInput);
    const visibility = () => { setHidden(document.hidden); stop(); if (document.hidden && latest.current) void saveGame(latest.current).catch(() => {}); };
    window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop); window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!music || paused || hidden || panel !== 'play') return;
    const context = new AudioContext(); audio.current = context;
    // Original, quiet pentatonic ambience; no samples or protected recordings.
    const notes = [146.83, 196, 220, 293.66, 261.63, 220, 196, 164.81];
    let index = 0;
    const note = () => {
      if (context.state === 'closed') return;
      const now = context.currentTime;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = 'triangle'; oscillator.frequency.value = notes[index++ % notes.length];
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.035, now + .08); gain.gain.exponentialRampToValueAtTime(.001, now + 2.4);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(now + 2.5);
    };
    note(); const timer = setInterval(note, 1800);
    return () => { clearInterval(timer); void context.close(); audio.current = null; };
  }, [music, paused, hidden, panel]);
  const move = useCallback((input: typeof emptyInput, dt: number) => setGame(previous => previous ? stepMovement(previous, input, dt) : previous), []);
  const interactNow = useCallback(() => setGame(previous => previous ? interact(previous) : previous), []);
  const newGame = () => { setGame(createGame()); setError(''); setRestart(false); setPanel('play'); setPaused(false); };
  const openRef = (id: string) => { const r = BIBLE_REFERENCES.find(item => item.id === id); if (r) showPassage(reference(r)); };
  const memorize = async (id: string) => {
    if (busyMemory) return;
    const r = BIBLE_REFERENCES.find(item => item.id === id); if (!r) return;
    setBusyMemory(true);
    try {
      const text = await verse(app.translation, reference(r));
      if (!text) { message('Baixe esta passagem na Biblioteca para criar um cartão com o texto da sua tradução.'); return; }
      createCard(reference(r), text.text);
    } catch { message('A passagem precisa estar disponível na Biblioteca. Baixe 1 Samuel e tente novamente.'); }
    finally { setBusyMemory(false); }
  };
  const exportSave = () => {
    if (!game) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cronicas-da-alianca-vale-coragem.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!loaded) return <Spinner />;
  const world = getMap(game?.mapId ?? 'village');
  const locked = paused || hidden || panel !== 'play' || !!game?.dialogue;
  return (
    <div className="chron-pilot scroll-area h-full bg-[#101b1a] text-[#f2e8ce]">
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={button} onClick={onBack}><ArrowLeft size={17} /> {backLabel}</button>
          <div className="text-right"><p className="text-[10px] tracking-[.28em] text-[#d7b77a]">UMA JORNADA ENTRE TESTEMUNHOS</p><h2 className="font-reading text-2xl sm:text-4xl">Crônicas da Aliança</h2></div>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-[#e3a387]/40 bg-[#4c2b22] p-3 text-sm">{error}</p>}
        {!game ? (
          <section className="overflow-hidden rounded-3xl border border-[#c8af7e]/30 bg-[#1d302a]">
            <div className="relative h-[290px] sm:h-[420px]">
              <ChroniclesCanvas world={world} player={{ x: 6.5, y: 10.5, facing: 'down' }} onMove={() => {}} onInteract={() => {}} paused />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#172720] via-transparent to-transparent" />
              <div className="absolute bottom-6 left-5 right-5 sm:left-10"><span className="text-xs font-semibold tracking-[.24em] text-[#eed6a1]">EPISÓDIO PILOTO · 1 SAMUEL 16–17</span><h3 className="mt-2 font-reading text-4xl sm:text-6xl">O Vale e a Coragem</h3></div>
            </div>
            <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[1.5fr_1fr]">
              <div><p className="max-w-2xl leading-relaxed text-[#d1dccc]">Antes de um confronto lembrado por gerações, há gente preparando alimento, carregando provisões e cuidando de quem sente medo. Caminhe como Neri, uma testemunha fictícia, entre um povoado de Judá e o acampamento israelita.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-[#e5cd98]">{['Exploração livre', 'Escolhas e missões', 'Teclado e toque', 'Save automático'].map(label => <span key={label} className="rounded-full border border-[#c8af7e]/30 px-3 py-2">{label}</span>)}</div><button type="button" className="mt-6 inline-flex min-h-14 items-center gap-3 rounded-xl bg-[#e7c58a] px-7 font-semibold text-[#222e26] hover:bg-[#f8dca8]" onClick={newGame}><Play size={20} /> Começar episódio</button></div>
              <aside className="rounded-2xl bg-[#11221d] p-5 text-sm leading-relaxed text-[#c4d1c0]"><h4 className="mb-2 font-semibold text-[#efdab0]">Escritura e ficção complementar</h4><p>Neri, seus vizinhos e as tarefas de apoio foram criados para o jogo. O resultado do confronto entre Davi e Golias segue 1 Samuel 17. O códice distingue essas duas camadas e abre as passagens no leitor do KM-Bible.</p><button type="button" className="mt-3 underline decoration-[#c9ab70]/50 underline-offset-4" onClick={() => showPassage({ book: 9, chapter: 17, verse: 1 })}>Ler 1 Samuel 17</button></aside>
            </div>
          </section>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="mr-auto inline-flex items-center gap-2 text-sm text-[#e7c990]"><Compass size={18} />{world.name}</span>
              <button type="button" aria-pressed={paused} className={button} onClick={() => { setPaused(!paused); setTouch(emptyInput); }}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? 'Continuar' : 'Pausar'}</button>
              <button type="button" aria-label={music ? 'Desligar trilha' : 'Ligar trilha'} aria-pressed={music} className={button} onClick={() => { if (typeof AudioContext === 'undefined') { message('Áudio não disponível neste navegador.'); return; } setMusic(!music); }}>{music ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            </div>
            <div className="chron-pilot-layout grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
              <div className="chron-pilot-stage min-w-0">
                <div ref={setSceneHost} className="chron-pilot-viewport relative overflow-hidden rounded-2xl border border-[#c8af7e]/35 bg-[#233b2f] shadow-2xl">
                  <div className="chron-pilot-view h-[46vh] min-h-[260px] sm:h-[58vh] sm:min-h-[360px]">
                    <ChroniclesCanvas world={world} player={game} onMove={move} onInteract={interactNow} paused={locked} touchInput={touch} />
                  </div>
                  <p className="absolute left-3 right-3 top-3 rounded-xl bg-[#10231b]/90 px-3 py-2 text-xs text-[#f0dbb0]"><Flag size={13} className="mr-2 inline" />{activeObjective(game)}</p>
                  {(paused || hidden) && !game.dialogue && <div className="absolute inset-0 grid place-items-center bg-[#0c1914]/70"><p className="rounded-xl border border-[#d9c293]/40 bg-[#1c3026] px-8 py-5 font-reading text-3xl">Jornada pausada</p></div>}
                </div>
                <nav aria-label="Diário da aventura" className="chron-pilot-nav mt-3 flex flex-wrap gap-2">{([
                  ['play', Play, 'Explorar'], ['journal', ScrollText, 'Missões'], ['inventory', Backpack, 'Inventário'], ['codex', BookOpen, 'Códice'], ['map', Map, 'Mapa'],
                ] as const).map(([id, Icon, label]) => <button type="button" key={id} className={button} aria-pressed={panel === id} onClick={() => { setPanel(id); setTouch(emptyInput); }}><Icon size={16} />{label}</button>)}</nav>
                {panel === 'play' && !game.dialogue && <div className="chron-pilot-controls mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c8af7e]/20 bg-[#192a23] p-3">
                  <div className="grid grid-cols-3 gap-1" aria-label="Controles de movimento">{[{ label: 'Caminhar para cima', dx: 0, dy: -1, pos: 'col-start-2' }, { label: 'Caminhar para esquerda', dx: -1, dy: 0, pos: 'row-start-2' }, { label: 'Caminhar para baixo', dx: 0, dy: 1, pos: 'row-start-2' }, { label: 'Caminhar para direita', dx: 1, dy: 0, pos: 'row-start-2' }].map(({ label, dx, dy, pos }, i) => <button type="button" aria-label={label} key={label} disabled={paused} className={`${button} ${pos} w-12 touch-none select-none`} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTouch({ dx, dy, run: false }); }} onPointerUp={() => setTouch(emptyInput)} onPointerCancel={() => setTouch(emptyInput)} onContextMenu={event => event.preventDefault()}>{['↑', '←', '↓', '→'][i]}</button>)}</div>
                  <p className="max-w-[230px] text-xs leading-relaxed text-[#bacbb9]">No cenário: WASD ou setas para caminhar, Shift para correr e E ou Enter para interagir. Use as setas de toque no celular.</p>
                  <button type="button" className={`${button} !bg-[#d7b77b] !text-[#18291e]`} disabled={paused} onClick={interactNow}>Interagir <span className="rounded border border-black/20 px-1 text-xs">E</span></button>
                </div>}
              </div>
              <aside className="chron-pilot-extras space-y-3">
                {game.dialogue && sceneHost && createPortal(<section role="dialog" aria-modal="false" aria-label={`Conversa com ${game.dialogue.speaker}`} className="chron-pilot-dialog rounded-2xl border border-[#d8b978]/50 bg-[#23352b] p-5 shadow-xl">
                  <div className="mb-3 flex items-center gap-3"><span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-[#cfb680]/50 bg-[#74634b] font-reading text-2xl">{game.dialogue.speaker.slice(0, 1)}</span><div><p className="text-[10px] uppercase tracking-[.2em] text-[#cfb680]">{game.dialogue.kind === 'cutscene' ? 'Testemunho' : game.dialogue.kind === 'puzzle' ? 'Observe e decida' : 'Conversa'}</p><h3 className="font-reading text-xl">{game.dialogue.speaker}</h3></div></div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#e4e6d3]">{game.dialogue.text}</p>
                  <div className="mt-4 grid gap-2">{game.dialogue.choices.map(choice => <button type="button" className={`${button} !justify-start text-left`} key={choice.id} onClick={() => setGame(previous => previous ? chooseDialogue(previous, choice.id) : previous)}>{choice.label}</button>)}</div>
                </section>, sceneHost)}
                {game.status === 'complete' && !game.dialogue && <section className="rounded-2xl border border-[#e3c488]/60 bg-[#344634] p-5"><Flag className="text-[#e3c488]" /><h3 className="mt-2 font-reading text-2xl">Episódio concluído</h3><p className="mt-2 text-sm leading-relaxed">Seu testemunho está guardado no códice. Esta é a campanha piloto; os próximos episódios ainda serão construídos.</p><button type="button" className={`${button} mt-3`} onClick={() => setPanel('codex')}>Consultar testemunhos</button></section>}
                <section className="rounded-2xl border border-[#c8af7e]/20 bg-[#1d2d25] p-4"><p className="text-[10px] tracking-[.2em] text-[#bfa778]">PRÓXIMO PASSO</p><h3 className="mt-2 text-sm leading-relaxed">{activeObjective(game)}</h3><p role="status" className="mt-3 text-xs leading-relaxed text-[#b8cbb7]">{game.message}</p><p className="mt-3 border-t border-[#c8af7e]/15 pt-3 text-[11px] text-[#b8cbb7]">{saved}</p><button type="button" onClick={exportSave} className="mt-2 min-h-9 text-xs text-[#e4c68b] underline underline-offset-4">Exportar progresso</button></section>
                <section className="rounded-2xl border border-[#c8af7e]/20 p-4 text-xs leading-relaxed text-[#b8cbb7]"><h3 className="font-semibold text-[#e0c690]">1 Samuel 16–17</h3><p className="mt-2">Personagens e tarefas de Neri são ficção complementar. O resultado bíblico permanece fixo. Revisão teológica humana ainda pendente.</p><button type="button" className="mt-3 min-h-9 underline underline-offset-4" onClick={() => setPanel('codex')}>Abrir Códice dos Testemunhos</button></section>
              </aside>
            </div>
            {panel !== 'play' && <section aria-label={panel === 'journal' ? 'Diário de missões' : panel === 'inventory' ? 'Bolsa de Neri' : panel === 'codex' ? 'Códice dos Testemunhos' : 'Mapa do episódio'} className="mt-4 rounded-2xl border border-[#c8af7e]/30 bg-[#1d3027] p-5">
              {panel === 'journal' && <><h3 className="mb-4 font-reading text-2xl">Diário de missões</h3><div className="grid gap-3 md:grid-cols-2">{getQuestJournal(game).map(quest => <article key={quest.id} className="rounded-xl bg-[#12251b] p-4"><p className="text-[10px] uppercase tracking-widest text-[#d3b87f]">{quest.optional ? 'Missão secundária' : 'Missão principal'} · {quest.status === 'complete' ? 'Concluída' : quest.status === 'active' ? 'Em andamento' : 'A descobrir'}</p><h4 className="mt-2 font-semibold">{quest.title}</h4><p className="mt-2 text-sm text-[#c0d1bd]">{quest.objective}</p></article>)}</div></>}
              {panel === 'inventory' && <><h3 className="mb-4 font-reading text-2xl">Bolsa de Neri</h3>{game.inventory.length ? <ul className="grid gap-3 md:grid-cols-2">{game.inventory.map(id => <li key={id} className="rounded-xl bg-[#12251b] p-4"><h4 className="font-semibold text-[#e4c68b]">{INVENTORY_ITEMS[id]?.name ?? id}</h4><p className="mt-2 text-sm text-[#c0d1bd]">{INVENTORY_ITEMS[id]?.description}</p></li>)}</ul> : <p className="text-sm text-[#c0d1bd]">Sua bolsa está vazia. Converse com os moradores e observe os objetos pelo caminho.</p>}</>}
              {panel === 'codex' && <><h3 className="font-reading text-2xl">Códice dos Testemunhos</h3><p className="mb-4 mt-2 text-sm text-[#c0d1bd]">As referências abrem o leitor original. Os cartões opcionais usam a memorização e a revisão espaçada já existentes no KM-Bible.</p><div className="grid gap-3 md:grid-cols-2">{game.codex.map(id => { const entry = CODEX_ENTRIES[id]; return entry && <article key={id} className="rounded-xl bg-[#12251b] p-4"><span className="text-[10px] uppercase tracking-widest text-[#d3b87f]">{entry.fiction ? 'Ficção complementar' : 'Contexto e Escritura'}</span><h4 className="mt-2 font-semibold">{entry.title}</h4><p className="mt-2 text-sm leading-relaxed text-[#c0d1bd]">{entry.text}</p><div className="mt-3 grid gap-2">{entry.referenceIds.map(refId => <div key={refId} className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => openRef(refId)}><BookOpen size={15} />{BIBLE_REFERENCES.find(r => r.id === refId)?.label}</button><button type="button" className={button} disabled={busyMemory} onClick={() => void memorize(refId)}>Memorizar passagem</button></div>)}</div></article>; })}</div></>}
              {panel === 'map' && <><h3 className="font-reading text-2xl">Povoado, casa e acampamento</h3><p className="mt-2 text-sm text-[#c0d1bd]">O caminho principal atravessa o povoado e leva ao acampamento. As entradas sinalizadas abrem os interiores. Este mapa representa o cenário fictício do episódio.</p><div className="mt-4 grid gap-2 md:grid-cols-3">{['village', 'house', 'camp'].map(id => { const map = getMap(id); return <div className="rounded-xl bg-[#12251b] p-3" key={id}><h4 className="mb-2 text-sm font-semibold">{map.name} {id === game.mapId ? '· Você está aqui' : ''}</h4><svg aria-label={map.name} viewBox={`0 0 ${map.width} ${map.height}`} className="w-full rounded" shapeRendering="crispEdges">{map.tiles.flatMap((row, y) => [...row].map((tile, x) => <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill={tile === '~' ? '#578e9a' : tile === '#' ? '#857661' : tile === 't' ? '#244a2b' : tile === 'h' ? '#ba936c' : tile === ':' || tile === 's' ? '#baab79' : tile === 'f' ? '#8f7958' : '#658452'} />))}{id === game.mapId && <circle cx={game.x} cy={game.y} r=".7" fill="#ffe0a0" stroke="#1d3027" strokeWidth=".25" />}</svg></div>; })}</div></>}
            </section>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#c8af7e]/20 pt-4"><p className="text-xs text-[#adc2ae]">Episódio disponível offline após instalar e carregar esta versão da PWA.</p><button type="button" className={button} onClick={() => restart ? newGame() : setRestart(true)}>{restart ? 'Confirmar nova aventura' : 'Recomeçar episódio'}</button>{restart && <button type="button" className={button} onClick={() => setRestart(false)}>Cancelar reinício</button>}</div>
          </>
        )}
        <details className="mt-6 rounded-xl border border-[#c8af7e]/20 p-4 text-xs text-[#b7c8b4]"><summary className="cursor-pointer font-semibold text-[#d8bf8c]">As seis sagas · expansões planejadas</summary><p className="mt-3">Somente “O Vale e a Coragem” está implementado. As seis sagas e aproximadamente 36 episódios são o plano de expansão.</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{SAGAS.map((saga, i) => <li key={i}>{typeof saga === 'string' ? saga : saga.title}</li>)}</ul></details>
      </div>
    </div>
  );
}

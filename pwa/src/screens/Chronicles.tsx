import { ArrowLeft, Backpack, BookOpen, Compass, Flag, Map, Pause, Play, ScrollText, Settings, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import ChroniclesCanvas from '../games/chronicles/ChroniclesCanvas';
import { CampaignAudio } from '../games/chronicles/campaign-audio';
import { activeObjective, BIBLE_REFERENCES, chooseDialogue, CODEX_ENTRIES, createGame, EPISODE, getMap, getNearbyActor, getQuestJournal, interact, INVENTORY_ITEMS, MAPS, stepMovement, type Dialogue, type GameState } from '../games/chronicles/engine';
import { loadGame, saveGame } from '../games/chronicles/persistence';
import type { SaveSlot } from '../games/chronicles/save-slot-key';
import { app, sheets, useApp } from '../lib/app';
import { verse } from '../lib/content';
import type { Ref } from '../lib/domain';
import { createCard, showPassage } from './open';
import { message } from '../components/ui';
import '../games/chronicles/pilot.css';
import { useGameSheetAccess } from '../games/chronicles/useGameSheetAccess';

type Panel = 'play' | 'journal' | 'inventory' | 'codex' | 'map' | 'pause' | 'settings' | 'restart';
const idle = { dx: 0, dy: 0, run: false };
const reference = (r: (typeof BIBLE_REFERENCES)[number]): Ref => ({ book: r.b, chapter: r.c, verse: r.v });
const labels: Record<Exclude<Panel, 'play'>, string> = { journal: 'Diário de missões', inventory: 'Bolsa de Neri', codex: 'Códice dos Testemunhos', map: 'Mapa do episódio', pause: 'Menu de pausa', settings: 'Configurações do episódio', restart: 'Recomeçar episódio' };
const shortcuts: Record<string, Panel> = { i: 'inventory', j: 'journal', m: 'map', c: 'codex' };
const quickMenu = [['journal', ScrollText, 'Missões', 'J'], ['inventory', Backpack, 'Inventário', 'I'], ['map', Map, 'Mapa', 'M'], ['codex', BookOpen, 'Códice', 'C']] as const;

/** Original pixel portraits; presentation never changes the validated saved dialogue. */
function Portrait({ dialogue }: { dialogue: Dialogue }) {
  const identity = dialogue.portrait ?? dialogue.speaker.toLowerCase();
  const isPerson = /tirza|mica|neri|adina|asael|guardador|testemunha/.test(identity);
  const cloth = identity.includes('tirza') ? '#bc9a5f' : identity.includes('mica') ? '#7396a4' : identity.includes('adina') ? '#a88bbd' : '#8d9e7b';
  return <svg className="pc-portrait" viewBox="0 0 40 44" role="img" aria-label={isPerson ? `Retrato de ${dialogue.speaker}` : 'Emblema do testemunho'} shapeRendering="crispEdges">
    <rect width="40" height="44" fill="#1c3635" />
    {isPerson ? <><path d="M6 44V33h7v-7h14v7h7v11z" fill={cloth} /><path d="M10 10h20v18H10z" fill="#bb896a" /><path d="M10 10h16v16H10z" fill="#dfb48b" /><path d="M8 9h24v7h-5V9H13v11H8zM12 5h16v5H12z" fill="#554338" /><path d="M7 10h5v21H7zM28 10h5v19h-5z" fill="#6d5741" /><path d="M13 17h3v3h-3zM23 17h3v3h-3z" fill="#273c3a" /><path d="M18 24h5v1h-5z" fill="#995f4c" /><path d="M11 29h18v4H11z" fill="#d9c18e" /></> : <><path d="M8 13h11v23H8zM21 13h11v23H21z" fill="#e4c997" /><path d="M10 16h6v2h-6zM10 21h6v2h-6zM24 16h6v2h-6zM24 21h6v2h-6zM19 13h2v25h-2z" fill="#897650" /><path d="M19 3h3v7h-3zM16 6h9v2h-9z" fill="#f5dc9d" /></>}
    <path d="M0 0h40v2H0zM0 42h40v2H0zM0 0h2v44H0zM38 0h2v44h-2z" fill="#d6b97e" />
  </svg>;
}

/** Only the stage and menus live here; the pilot engine, content and saves stay independent. */
export default function Chronicles({ onBack, backLabel = 'Ferramentas e Games', slot = 1 }: { onBack: () => void; backLabel?: string; slot?: SaveSlot }) {
  useApp();
  const externalOpen = sheets.length > 0;
  useGameSheetAccess(sheets.length);
  const [game, setGame] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [panel, setPanel] = useState<Panel>('play');
  const [hidden, setHidden] = useState(document.hidden);
  const [touch, setTouch] = useState(idle);
  const [music, setMusic] = useState(false);
  const [voice, setVoice] = useState(false);
  const [busyMemory, setBusyMemory] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const latest = useRef(game);
  const sound = useRef<CampaignAudio | null>(null);
  const voiceContext = useRef<AudioContext | null>(null);
  const memoryLock = useRef(false);
  const sheetFocus = useRef<HTMLElement | null>(null);
  const previousSheets = useRef(false);
  latest.current = game;

  useEffect(() => {
    let mounted = true;
    setLoaded(false);
    loadGame(slot).then(value => { if (mounted) { latest.current = value; setGame(value); } }).catch(e => { if (mounted) setError(e instanceof Error ? e.message : String(e)); }).finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; if (latest.current) void saveGame(latest.current, slot).catch(() => {}); };
  }, [slot]);
  useEffect(() => {
    if (!game || !loaded) return;
    setSaved('Salvando…');
    const timer = setTimeout(() => { void saveGame(game, slot).then(() => setSaved('Progresso salvo neste aparelho')).catch(() => { setSaved('Não foi possível salvar'); setError('O armazenamento está indisponível. Exporte o progresso no menu de pausa antes de sair.'); }); }, 400);
    return () => clearTimeout(timer);
  }, [game, loaded, slot]);
  useEffect(() => {
    if (!loaded) return;
    const checkpoint = () => { const current = latest.current; if (current) void saveGame(current, slot).then(() => setSaved('Progresso salvo neste aparelho')).catch(() => setError('Não foi possível salvar. Exporte o progresso pelo menu de pausa.')); };
    const timer = setInterval(checkpoint, 5000);
    const stop = () => setTouch(idle);
    const visibility = () => { setHidden(document.hidden); stop(); if (document.hidden) checkpoint(); };
    window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop); window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); };
  }, [loaded, slot]);
  useEffect(() => { sound.current = new CampaignAudio(); return () => { sound.current?.close(); sound.current = null; const context = voiceContext.current; voiceContext.current = null; if (context) void context.close().catch(() => {}); }; }, []);
  useEffect(() => { sound.current?.setActive(music && !hidden && !externalOpen && panel === 'play', 2); }, [music, hidden, panel, externalOpen]);
  useEffect(() => {
    const context = voiceContext.current;
    if (!context) return;
    if (!voice || hidden || externalOpen || panel !== 'play') void context.suspend().catch(() => {});
    else void context.resume().catch(() => {});
  }, [voice, hidden, panel, externalOpen]);
  useEffect(() => {
    if (!voice || hidden || externalOpen || panel !== 'play' || !game?.dialogue || !voiceContext.current) return;
    const context = voiceContext.current;
    if (context.state !== 'running') return;
    // Brief synthesized speech blips; no recordings or biblical quotations are generated.
    for (let n = 0; n < 5; n++) {
      const oscillator = context.createOscillator(), gain = context.createGain(), time = context.currentTime + n * .065;
      oscillator.type = 'triangle'; oscillator.frequency.value = 190 + n % 3 * 35;
      gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.012, time + .008); gain.gain.exponentialRampToValueAtTime(.0001, time + .04);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; oscillator.start(time); oscillator.stop(time + .05);
    }
  }, [game?.dialogue?.id, voice, hidden, panel, externalOpen]);
  useEffect(() => {
    if (!loaded) return;
    const root = stage.current;
    setTouch(idle);
    if (externalOpen) { previousSheets.current = true; return; }
    if (previousSheets.current) {
      previousSheets.current = false;
      const origin = sheetFocus.current;
      sheetFocus.current = null;
      if (origin?.isConnected && root?.contains(origin)) { origin.focus({ preventScroll: true }); return; }
    }
    const target = panel !== 'play' || game?.dialogue ? root?.querySelector<HTMLButtonElement>('[data-pilot-window] button:not(:disabled)') : game ? root?.querySelector<HTMLCanvasElement>('canvas') : root?.querySelector<HTMLButtonElement>('[data-pilot-start]');
    target?.focus({ preventScroll: true });
  }, [loaded, !!game, game?.dialogue?.id, panel, externalOpen]);

  const move = useCallback((input: typeof idle, dt: number) => setGame(previous => previous ? stepMovement(previous, input, dt) : previous), []);
  const interactNow = useCallback(() => setGame(previous => previous ? interact(previous) : previous), []);
  const openPanel = (next: Panel) => { setTouch(idle); setPanel(previous => previous === next ? 'play' : next); };
  const newGame = () => { const fresh = createGame(); latest.current = fresh; setGame(fresh); setError(''); setPanel('play'); };
  const choose = (id: string) => setGame(previous => previous ? chooseDialogue(previous, id) : previous);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try { if (latest.current) await saveGame(latest.current, slot); onBack(); }
    catch { setError('Não foi possível salvar antes de sair. Exporte o progresso no menu de pausa ou tente novamente.'); setLeaving(false); }
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing || !loaded || sheets.length > 0) return;
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' && event.repeat) return;
    if (key === 'escape') { event.preventDefault(); event.stopPropagation(); setTouch(idle); setPanel(previous => previous === 'play' ? 'pause' : 'play'); return; }
    if (game && shortcuts[key] && !event.repeat) { event.preventDefault(); event.stopPropagation(); openPanel(shortcuts[key]); return; }
    if (key === 'tab') {
      const dialog = stage.current?.querySelector<HTMLElement>('[data-pilot-window]');
      if (!dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled), [tabindex="0"]')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  const openRef = (id: string) => {
    const r = BIBLE_REFERENCES.find(item => item.id === id);
    if (!r) return;
    sheetFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showPassage(reference(r));
  };
  const memorize = async (id: string) => {
    if (memoryLock.current) return;
    const r = BIBLE_REFERENCES.find(item => item.id === id); if (!r) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    memoryLock.current = true; setBusyMemory(true);
    try { const text = await verse(app.translation, reference(r)); if (!text) { message('Baixe esta passagem na Biblioteca para criar um cartão com o texto da sua tradução.'); return; } sheetFocus.current = origin; createCard(reference(r), text.text); }
    catch { message('A passagem precisa estar disponível na Biblioteca. Baixe 1 Samuel e tente novamente.'); }
    finally { memoryLock.current = false; setBusyMemory(false); }
  };
  const exportSave = () => {
    if (!game) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cronicas-da-alianca-vale-coragem-slot-${slot}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const toggleMusic = async () => { if (music) { setMusic(false); return; } if (await sound.current?.enable()) setMusic(true); else message('Áudio não disponível neste navegador.'); };
  const toggleVoice = async () => {
    if (voice) { setVoice(false); return; }
    try { const Context = window.AudioContext; if (!Context) throw new Error(); voiceContext.current ??= new Context(); await voiceContext.current.resume(); setVoice(true); }
    catch { message('Áudio não disponível neste navegador.'); }
  };
  const world = getMap(game?.mapId ?? 'village');
  const locked = !loaded || panel !== 'play' || hidden || externalOpen || !!game?.dialogue;
  const nearby = game ? getNearbyActor(game) : null;

  return <div className="pc-root" ref={stage} onKeyDownCapture={onKeyDown} aria-label="O Vale e a Coragem" data-pilot-screen={!loaded ? 'loading' : game ? 'play' : 'intro'}>
    <div className="pc-world chron-pilot-viewport">
      <ChroniclesCanvas world={world} player={game ?? { x: 6.5, y: 10.5, facing: 'down' }} onMove={move} onInteract={interactNow} paused={locked || !game} touchInput={touch} />
    </div>
    <div className="pc-vignette" aria-hidden="true" />
    <div className="pc-arrival" key={world.id} aria-hidden="true" />
    {!loaded ? <div className="pc-loading"><span aria-hidden="true">✦</span><p role="status">Abrindo seu testemunho…</p></div> : <>
      {error && <div role="alert" className="pc-error"><span>{error}</span><button aria-label="Fechar aviso" onClick={() => setError('')}><X size={17} /></button></div>}
      {!game ? <div className="pc-intro">
        <div className="pc-intro-title"><span>CRÔNICAS DA ALIANÇA · 1 SAMUEL 16–17</span><h2>O Vale<br />e a Coragem</h2><p>Uma testemunha entre as oliveiras e o vale de Elá.</p></div>
        <section className="pc-intro-window pc-window" aria-label="Prólogo da aventura">
          <p>Neri, seus vizinhos e as tarefas de apoio foram criados para o jogo. Explore, ajude e testemunhe o relato de Davi, preservando o resultado bíblico.</p>
          <div className="pc-actions"><button className="pc-button pc-primary" data-pilot-start onClick={newGame}><Play size={17} />Começar episódio</button><button className="pc-button" onClick={() => void leave()}><ArrowLeft size={17} />{backLabel}</button></div>
          <small><span>Escritura e ficção complementar</span> · progresso automático no espaço {slot}</small>
        </section>
      </div> : <>
        <header className="pc-hud">
          <div className="pc-location"><Compass size={18} /><div><span>O VALE E A CORAGEM · ESPAÇO {slot}</span><strong>{world.name}</strong></div></div>
          <button className="pc-button pc-pause" aria-label="Pausar" onClick={() => openPanel('pause')}><Pause size={18} /><kbd>Esc</kbd></button>
          <div className="pc-objective"><Flag size={15} /><span>{activeObjective(game)}</span></div>
        </header>
        <nav aria-label="Diário da aventura" className="pc-quick-menu">{quickMenu.map(([id, Icon, label, key]) => <button key={id} aria-label={label} className="pc-button" aria-pressed={panel === id} onClick={() => openPanel(id)}><Icon size={18} /><span>{label}</span><kbd>{key}</kbd></button>)}</nav>
        {panel === 'play' && !game.dialogue && !hidden && <>
          <div className="pc-context" role="status">{game.status === 'complete' ? '✦ Episódio concluído · seu testemunho está no códice' : game.message}</div>
          <div className="pc-directions" aria-label="Controles de movimento">{[{ label: 'Caminhar para cima', dx: 0, dy: -1, mark: '↑', area: 'up' }, { label: 'Caminhar para esquerda', dx: -1, dy: 0, mark: '←', area: 'left' }, { label: 'Caminhar para baixo', dx: 0, dy: 1, mark: '↓', area: 'down' }, { label: 'Caminhar para direita', dx: 1, dy: 0, mark: '→', area: 'right' }].map(({ label, dx, dy, mark, area }) => <button key={label} aria-label={label} style={{ gridArea: area }} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTouch({ dx, dy, run: false }); }} onPointerUp={() => setTouch(idle)} onPointerCancel={() => setTouch(idle)} onContextMenu={event => event.preventDefault()}>{mark}</button>)}</div>
          <button className="pc-button pc-interact" onClick={interactNow} aria-label="Interagir"><span>{nearby ? nearby.name.split(' · ')[0] : 'Interagir'}</span><kbd>E</kbd></button>
          <p className="pc-key-hint">WASD / SETAS · SHIFT CORRER · E INTERAGIR</p>
        </>}
        {hidden && panel === 'play' && <div className="pc-shade"><p className="pc-window">Jornada pausada</p></div>}
        {game.dialogue && panel === 'play' && !hidden && <section data-pilot-window className="pc-dialogue pc-window" role="dialog" aria-modal="true" aria-label={`Conversa com ${game.dialogue.speaker}`}>
          <Portrait dialogue={game.dialogue} />
          <div className="pc-dialogue-body"><span className="pc-eyebrow">{game.dialogue.kind === 'cutscene' ? 'TESTEMUNHO' : game.dialogue.kind === 'puzzle' ? 'OBSERVE E DECIDA' : 'CONVERSA'}</span><h3>{game.dialogue.speaker}</h3><p>{game.dialogue.text}</p><div className="pc-choices">{game.dialogue.choices.map(choice => <button className="pc-button" aria-label={choice.label} key={choice.id} onClick={() => choose(choice.id)}><span>{choice.label}</span><span aria-hidden="true">▸</span></button>)}</div></div>
        </section>}
      </>}
      {panel !== 'play' && <div className="pc-shade" onPointerDown={event => { if (event.target === event.currentTarget) setPanel('play'); }}>
        <section data-pilot-window className={`pc-window pc-menu pc-menu-${panel}`} role="dialog" aria-modal="true" aria-label={labels[panel]}>
          <header className="pc-menu-header"><div><span className="pc-eyebrow">CRÔNICAS DA ALIANÇA</span><h3>{labels[panel]}</h3></div><button className="pc-button pc-close" aria-label="Fechar menu" onClick={() => setPanel('play')}><X size={18} /></button></header>
          <div className="pc-menu-body">
            {panel === 'pause' && <><p className="pc-menu-lead">Jornada pausada</p><p className="pc-muted">O Vale e a Coragem · espaço {slot}</p><div className="pc-menu-options"><button className="pc-button pc-primary" onClick={() => setPanel('play')}><Play size={17} />Continuar</button>{game && <><button className="pc-button" onClick={() => setPanel('journal')}><ScrollText size={17} />Missões</button><button className="pc-button" onClick={() => setPanel('settings')}><Settings size={17} />Configurações</button><button className="pc-button" onClick={exportSave}>Exportar progresso</button><button className="pc-button" onClick={() => setPanel('restart')}>Recomeçar episódio</button></>}<button className="pc-button" disabled={leaving} onClick={() => void leave()}><ArrowLeft size={17} />{leaving ? 'Guardando a jornada…' : backLabel}</button></div><p className="pc-save" role="status">{saved || 'Seu progresso é guardado neste aparelho.'}</p></>}
            {panel === 'settings' && <><div className="pc-menu-options"><button className="pc-button" aria-pressed={music} onClick={() => void toggleMusic()}>{music ? <Volume2 size={18} /> : <VolumeX size={18} />}Música ambiente: {music ? 'ligada' : 'desligada'}</button><button className="pc-button" aria-pressed={voice} onClick={() => void toggleVoice()}>Som de diálogo: {voice ? 'ligado' : 'desligado'}</button></div><p className="pc-muted">Caminhar: WASD ou setas · correr: Shift · interagir: E ou Enter. I: inventário · J: missões · M: mapa · C: códice · Esc: pausa.</p></>}
            {panel === 'restart' && <><p>Recomeçar este episódio substituirá o progresso de O Vale e a Coragem no espaço {slot}.</p><p className="pc-muted">As outras aventuras e seus cartões de memorização continuam preservados.</p><div className="pc-actions"><button className="pc-button pc-primary" onClick={newGame}>Confirmar nova aventura</button><button className="pc-button" onClick={() => setPanel('pause')}>Cancelar reinício</button></div></>}
            {game && panel === 'journal' && <ol className="pc-journal">{getQuestJournal(game).map(quest => <li key={quest.id} data-status={quest.status}><span className="pc-quest-mark" aria-hidden="true">{quest.status === 'complete' ? '✓' : quest.status === 'active' ? '◆' : '◇'}</span><div><span className="pc-eyebrow">{quest.optional ? 'MISSÃO SECUNDÁRIA' : 'MISSÃO PRINCIPAL'} · {quest.status === 'complete' ? 'CONCLUÍDA' : quest.status === 'active' ? 'EM ANDAMENTO' : 'A DESCOBRIR'}</span><h4>{quest.title}</h4><p>{quest.objective}</p></div></li>)}</ol>}
            {game && panel === 'inventory' && <>{game.inventory.length ? <ul className="pc-inventory">{game.inventory.map(id => <li key={id}><span className="pc-item-icon" aria-hidden="true">{id === 'route-map' ? '▧' : id === 'supply-crate' ? '▤' : id === 'clay-seal' ? '◉' : '✦'}</span><div><h4>{INVENTORY_ITEMS[id]?.name ?? id}</h4><p>{INVENTORY_ITEMS[id]?.description}</p></div></li>)}</ul> : <p className="pc-empty">Sua bolsa está vazia. Converse com os moradores e observe os objetos pelo caminho.</p>}<p className="pc-muted">Objetos da jornada de Neri · ficção complementar.</p></>}
            {game && panel === 'codex' && <><p className="pc-muted">{EPISODE.reviewNotice} Consulte as passagens no leitor e guarde cartões na Memorização.</p><div className="pc-codex">{game.codex.map(id => { const entry = CODEX_ENTRIES[id]; return entry && <article key={id}><span className="pc-eyebrow">{entry.fiction ? 'Ficção complementar' : 'Contexto e Escritura'}</span><h4>{entry.title}</h4><p>{entry.text}</p><div className="pc-reference-actions">{entry.referenceIds.map(refId => <div key={refId}><button className="pc-button" onClick={() => openRef(refId)}><BookOpen size={15} />{BIBLE_REFERENCES.find(r => r.id === refId)?.label}</button><button className="pc-button" disabled={busyMemory} onClick={() => void memorize(refId)}>Memorizar passagem</button></div>)}</div></article>; })}</div></>}
            {game && panel === 'map' && <><p className="pc-muted">Povoado → caminho leste → acampamento. A casa dos mantimentos fica ao norte do povoado.</p><div className="pc-maps">{MAPS.map(map => <figure key={map.id} data-current={map.id === game.mapId}><figcaption>{map.name}{map.id === game.mapId && <span>✦ Você está aqui</span>}</figcaption><svg aria-label={map.name} viewBox={`0 0 ${map.width} ${map.height}`} shapeRendering="crispEdges">{map.tiles.flatMap((row, y) => [...row].map((tile, x) => <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill={tile === '~' ? '#578e9a' : tile === '#' ? '#857661' : tile === 't' ? '#244a2b' : tile === 'h' ? '#ba936c' : tile === ':' || tile === 's' ? '#baab79' : tile === 'f' ? '#8f7958' : '#658452'} />))}{map.id === game.mapId && <circle cx={game.x} cy={game.y} r=".7" fill="#ffe0a0" stroke="#1d3027" strokeWidth=".25" />}</svg></figure>)}</div></>}
          </div>
          <footer className="pc-menu-footer"><button className="pc-button" onClick={() => setPanel('play')}>← Voltar ao jogo</button><span>Esc</span></footer>
        </section>
      </div>}
    </>}
  </div>;
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, Compass, Gamepad2, Map, Play, Settings, Volume2, VolumeX } from 'lucide-react';
import { CAMPAIGN_EPISODES, CAMPAIGN_SAGAS, type ChronicleEpisode } from './campaign-content';
import type { CampaignProgress } from './campaign-engine';
import SaveSlots from './SaveSlots';
import type { SaveSlot } from './save-slot-key';
import type { SaveSlotSummary } from './save-slots';
import './game-front.css';

type Screen = 'title' | 'world' | 'chapters' | 'settings' | 'chronicle' | 'saves';
type Props = {
  progress: CampaignProgress;
  saga: number;
  onSaga: (next: number) => void;
  onBegin: (episodeId: string) => void;
  onPilot: () => void;
  onBack: () => void;
  onExport: () => void;
  initialScreen?: 'title' | 'world';
  slots: SaveSlotSummary[];
  activeSlot: SaveSlot;
  slotBusy: boolean;
  onChooseSlot: (slot: SaveSlot, overwrite: boolean, resume: boolean) => Promise<boolean>;
  sound: boolean;
  onSound: () => void;
  onReference: (episode: ChronicleEpisode) => void;
  onMemorize: (episode: ChronicleEpisode) => void;
};
const REGION_POSITIONS = [[21, 34], [45, 21], [72, 32], [80, 67], [45, 78], [16, 69]] as const;
const CHAPTER_POSITIONS = [[16, 29], [36, 18], [66, 22], [80, 50], [60, 73], [28, 74]] as const;

/** Pixel-art painted behind menus; no external art, font, music or sprite downloads. */
export function GameFrontBackdrop({ mode, seed = 0, chapters = false }: { mode: 'title' | 'atlas'; seed?: number; chapters?: boolean }) {
  const node = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = node.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const W = 480, H = 270;
    let frame = 0, alive = true, last = -100, hidden = document.hidden;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduceMotion = preference?.matches ?? false;
    const random = (n: number) => {
      let a = Math.imul(n + seed * 3217 + 713, 1597334677);
      a ^= a >>> 13;
      return (a >>> 0) / 4294967296;
    };
    const box = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
    };
    const triangle = (p: number[], color: string) => {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    const paint = (ms: number) => {
      ctx.imageSmoothingEnabled = false;
      if (mode === 'title') {
        box(0, 0, W, H, '#3b697c');
        for (let y = 0; y < 115; y += 3) box(0, y, W, 3, y < 30 ? '#254b65' : y < 75 ? '#517d8b' : '#8ba6a3');
        // The sun, clouds and far hills.
        box(352, 39, 23, 23, '#fff0c1'); box(348, 45, 31, 11, '#f4cf90');
        for (let i = 0; i < 17; i++) {
          const x = (random(i) * 520 - 20 + ms * (.001 + i % 3 * .0005)) % 525;
          const y = 19 + random(i + 40) * 70;
          box(x, y, 19 + i % 4 * 7, 3, '#c0cebf66'); box(x + 7, y - 3, 14, 3, '#c6d3c8bb');
        }
        for (let i = 0; i < 12; i++) {
          const x = i * 49 - 22;
          triangle([x, 156, x + 42, 82 - random(i + 13) * 30, x + 88, 156], '#587f77');
          triangle([x + 5, 171, x + 34, 116 - random(i + 21) * 25, x + 75, 171], '#386759');
        }
        box(0, 164, W, 106, '#577653');
        // Winding pathway leading to the village.
        triangle([205, 158, 256, 158, 412, H, 72, H], '#c3ae83');
        triangle([230, 157, 246, 157, 289, H, 191, H], '#d2bf93');
        for (let i = 0; i < 125; i++) {
          const x = random(i + 60) * W, y = 168 + random(i + 180) * 102;
          box(x, y, 2 + i % 2, 2, i % 3 ? '#809669' : '#d3bd83');
        }
        for (let i = 0; i < 20; i++) {
          const x = random(i + 321) * W, y = 150 + random(i + 422) * 90;
          if (x > 166 && x < 310) continue;
          box(x - 2, y + 7, 5, 18, '#534937');
          box(x - 11, y - 7, 23, 17, '#274d3e');
          box(x - 8, y - 12, 17, 14, i % 3 ? '#48745b' : '#395f4b');
          box(x - 3, y - 17, 8, 8, '#5f8760');
        }
        // Village buildings: roofs, doorways, golden torch flicker.
        for (let i = 0; i < 5; i++) {
          const x = 130 + i * 49, y = 126 + i % 2 * 8;
          box(x, y, 37, 29, '#a89269');
          triangle([x - 5, y, x + 18, y - 17, x + 43, y], '#6a493e');
          box(x + 9, y + 11, 10, 18, '#4f4b3b');
          box(x + 25, y + 8, 5, 7, '#e0c990');
        }
        const glow = Math.sin(ms / 270) * 3;
        box(353, 151, 3, 18, '#654a30'); box(350, 145 + glow, 9, 9, '#f3b765');
        // A lone walker moves slowly along the foreground path.
        const walker = Math.round(Math.sin(ms / 1750) * 8);
        box(240 + walker, 220, 12, 4, '#1d302a80');
        box(244 + walker, 198, 7, 9, '#ddae89');
        box(243 + walker, 206, 10, 15, '#35535b');
        box(244 + walker, 220, 3, 5, '#283a35'); box(249 + walker, 220, 3, 5, '#283a35');
        // Foreground vignette for strong legibility, without a static page backdrop.
        const vignette = ctx.createLinearGradient(0, 0, 0, H);
        vignette.addColorStop(0, '#0a1b2640'); vignette.addColorStop(.5, '#071b2440'); vignette.addColorStop(1, '#061219c9');
        ctx.fillStyle = vignette;ctx.fillRect(0, 0, W, H);
      } else {
        // Ancient pixel parchment: winding rivers, reliefs and routes.
        box(0, 0, W, H, '#243c3b');
        for (let y = 8; y < H; y += 8) for (let x = 8; x < W; x += 8) {
          const n = random(y * 23 + x * 19);
          box(x, y, 8, 8, n < .15 ? '#2b4b46' : n < .35 ? '#31544c' : '#35584d');
        }
        // Mediterranean shore.
        for (let y = 0; y < H; y += 6) {
          const shore = 46 + Math.sin(y / 18) * 19 + Math.sin(y / 5) * 6;
          box(0, y, shore, 6, '#346578');
          if (y % 18 === 0) box(shore - 8, y + 2, 8, 2, '#a4b7a6');
        }
        // Desert reaches toward the east.
        for (let y = 0; y < H; y += 8) {
          const edge = 394 + Math.sin(y / 12) * 20;
          box(edge, y, W - edge, 8, y % 16 ? '#a1845a' : '#ae9065');
        }
        // Mountains and woodlands.
        for (let i = 0; i < 52; i++) {
          const x = 55 + random(i + 200) * 350, y = random(i + 312) * H;
          if (i % 4 === 0) {
            triangle([x - 9, y + 8, x, y - 10, x + 10, y + 8], '#84927c');
            triangle([x - 4, y - 2, x, y - 10, x + 5, y - 2], '#c0bba1');
          } else {
            box(x - 1, y, 3, 5, '#584c36'); box(x - 5, y - 7, 11, 9, i % 2 ? '#1d4237' : '#285047');
          }
        }
        const pins = (chapters ? CHAPTER_POSITIONS : REGION_POSITIONS).map(([x,y])=>[x*4.8,y*2.7]);
        ctx.strokeStyle = '#d8bc80aa';ctx.lineWidth = 2;ctx.setLineDash([5, 5]);
        ctx.beginPath();pins.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
        pins.forEach(([x,y],i)=>{
          const pulse = Math.sin(ms/450+i)*2.5;
          box(x - 5, y - 5 + pulse, 10, 10, '#18302a');box(x - 3,y - 3 + pulse,6,6,'#e9c990');
          box(x - 1, y - 8 + pulse, 2, 17, '#f2d8a0');
        });
        for(let i=0;i<180;i++){
          const x=random(i+812)*W,y=random(i+913)*H;
          box(x,y,1,1,'#e2d0a014');
        }
        box(0, 0, W, 9, '#12252a99');
      }
    };
    const tick = (time: number) => {
      if (!alive || hidden || reduceMotion) return;
      if (time - last > 55) { paint(time);last = time; }
      frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      last = -100;
      paint(0);
      if (!hidden && !reduceMotion) frame = requestAnimationFrame(tick);
    };
    const visibility = () => {hidden = document.hidden;schedule();};
    const motion = (event: MediaQueryListEvent) => {reduceMotion = event.matches;schedule();};
    document.addEventListener('visibilitychange',visibility);
    preference?.addEventListener('change',motion);
    schedule();
    return () => {alive = false;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);preference?.removeEventListener('change',motion);};
  }, [mode,seed,chapters]);
  return <canvas ref={node} width={480} height={270} className="gf-pixel-background" aria-hidden="true"/>;
}

export default function GameFront({progress,saga,onSaga,onBegin,onPilot,onBack,onExport,initialScreen='title',slots,activeSlot,slotBusy,onChooseSlot,sound,onSound,onReference,onMemorize}:Props) {
  const [screen,setScreen] = useState<Screen>(initialScreen);
  const [chapter,setChapter] = useState(0);
  const [saveMode,setSaveMode] = useState<'new' | 'continue'>('continue');
  const [full,setFull] = useState(false);
  const [codexId,setCodexId] = useState<string | null>(null);
  const stage=useRef<HTMLDivElement>(null);
  const chapters=useMemo(()=>CAMPAIGN_EPISODES.filter(e=>e.saga===saga),[saga]);
  const current = chapters[chapter] ?? chapters[0];
  const known = progress.activeEpisodeId ? progress.episodes[progress.activeEpisodeId] : undefined;
  const fallback = Object.values(progress.episodes).reverse().find(x=>x.phase!=='complete');
  const toContinue = known?.episodeId ?? fallback?.episodeId ?? null;
  const completed=progress.completed.length;
  const discoveries = CAMPAIGN_EPISODES.filter(e => progress.episodes[e.id]?.visited.length);
  const codexEpisode = discoveries.find(e => e.id === codexId) ?? discoveries[0];
  const openSaves = (mode: 'new' | 'continue') => { setSaveMode(mode); setScreen('saves'); };
  useEffect(() => { const change = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', change); return () => document.removeEventListener('fullscreenchange', change); }, []);
  useEffect(() => {
    const target = stage.current?.querySelector<HTMLButtonElement>('[data-primary-menu]:not(:disabled), [data-screen-focus], .gf-main-menu button:not(:disabled), .gf-screen-heading button, .gf-save-screen button, .gf-book-heading button, .gf-overlay-screen button');
    target?.focus({preventScroll:true});
  }, [screen]);
  const selectSaga=(n:number)=>{onSaga(n);setChapter(0);setScreen('chapters');};
  const openChapter=(e:ChronicleEpisode)=>onBegin(e.id);
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if(e.altKey || e.ctrlKey || e.metaKey || !(e.target instanceof Element) || e.target.closest('input,textarea,select,[contenteditable=true]')) return;
      if(e.key==='Escape'){
        // The confirmation owns Escape so it cancels without leaving the save screen.
        if (e.target.closest('[role=alertdialog]')) return;
        e.preventDefault();e.stopPropagation();
        if(screen==='chapters')setScreen('world');
        else if(screen!=='title')setScreen('title');
        return;
      }
      if(screen==='title' && ['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
        e.preventDefault();e.stopPropagation();
        const buttons = [...(stage.current?.querySelectorAll<HTMLButtonElement>('.gf-main-menu button:not(:disabled)') ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key==='Home' ? 0 : e.key==='End' ? buttons.length-1 : (index + (e.key==='ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus({preventScroll:true});
      }
      if(screen==='chapters'){
        if(e.key==='ArrowLeft'||e.key==='ArrowUp'||e.key==='ArrowRight'||e.key==='ArrowDown') {
          e.preventDefault();e.stopPropagation();
          const next = (chapter + (e.key==='ArrowLeft'||e.key==='ArrowUp' ? 5 : 1)) % 6;
          setChapter(next);
          stage.current?.querySelectorAll<HTMLButtonElement>('.gf-chapter-pin')[next]?.focus({preventScroll:true});
        }
      }
  };
  const toggleFullscreen=async()=>{
    try {
      if(!document.fullscreenElement){await (stage.current?.closest<HTMLElement>('.chronicles-viewport') ?? stage.current)?.requestFullscreen();setFull(true);}
      else {await document.exitFullscreen();setFull(false);}
    }catch { setFull(false); }
  };
  return <div className="gf-root" ref={stage} data-screen={screen} onKeyDown={handleKey}>
    <GameFrontBackdrop mode={screen==='title'||screen==='settings'?'title':'atlas'} seed={saga}/>
    <div className="gf-grain" aria-hidden="true"/>
    <div className="gf-topbar">
      <span className="gf-top-brand"><Gamepad2 size={17}/> KM-BIBLE <span>·</span> CRÔNICAS DA ALIANÇA</span>
      <span className="gf-progress"><span className="gf-progress-icon">✦</span> {completed}/36 <span className="gf-progress-word">capítulos</span></span>
      <button type="button" className="gf-mini gf-sound" aria-label={sound?'Desligar música ambiente':'Ligar música ambiente'} aria-pressed={sound} onClick={onSound}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>
      <button type="button" className="gf-mini" onClick={onBack} aria-label="Voltar para Ferramentas e Games"><ArrowLeft size={17}/> <span>Sair</span></button>
    </div>

    {screen==='title' && <div className="gf-title gf-screen-enter">
      <div className="gf-title-emblem" aria-hidden="true">✦</div>
      <span className="gf-kicker">UMA JORNADA ENTRE TESTEMUNHOS</span>
      <h2>Crônicas <span>da Aliança</span></h2>
      <p className="gf-subtitle">Uma aventura bíblica em pixel art · de Gênesis a Apocalipse</p>
      <nav aria-label="Menu principal do jogo" className="gf-main-menu">
        <button className="gf-menu-action gf-menu-primary" data-primary-menu disabled={!toContinue && !slots.some(s => s.status !== 'empty')} onClick={()=>openSaves('continue')}><Play size={19}/> Continuar <ChevronRight size={17}/></button>
        <button className="gf-menu-action" onClick={()=>openSaves('new')}><BookOpen size={18}/> Novo jogo <ChevronRight size={17}/></button>
        <button className="gf-menu-action" onClick={()=>setScreen('world')}><Compass size={18}/> Aventuras <ChevronRight size={17}/></button>
        <button className="gf-menu-action" onClick={()=>setScreen('chronicle')}><BookOpen size={18}/> Códice <ChevronRight size={17}/></button>
        <button className="gf-menu-action" onClick={()=>setScreen('settings')}><Settings size={18}/> Configurações <ChevronRight size={17}/></button>
        <button className="gf-menu-action" onClick={onBack}><ArrowLeft size={18}/> Voltar <ChevronRight size={17}/></button>
      </nav>
      <button className="gf-pilot-entry" onClick={onPilot}><Gamepad2 size={16}/><span>O Vale e a Coragem<small>Campanha original ampliada</small></span><ChevronRight size={16}/></button>
      <div className="gf-title-foot">WASD / SETAS PARA EXPLORAR <span>✧</span> SAVE AUTOMÁTICO</div>
    </div>}

    {screen==='saves' && <SaveSlots mode={saveMode} slots={slots} busy={slotBusy} onBack={()=>setScreen('title')} onChoose={async (id, overwrite, resume) => {
      const opened = await onChooseSlot(id, overwrite, resume);
      if (opened && !resume) setScreen('world');
      return opened;
    }}/>}

    {screen==='world'  && <div className="gf-map-layer gf-screen-enter">
      <div className="gf-screen-heading">
        <button className="gf-back" onClick={()=>setScreen('title')}><ArrowLeft size={17}/> Menu principal</button>
        <span>ATLAS DA ALIANÇA</span>
        <h2>Escolha sua jornada</h2>
        <p>Seis regiões. Trinta e seis testemunhos.</p>
      </div>
      <div className="gf-region-map" aria-label="Mapa das seis sagas">
        <GameFrontBackdrop mode="atlas" seed={saga}/>
        {CAMPAIGN_SAGAS.map((e,i)=>{
          const done=progress.completed.filter(id=>CAMPAIGN_EPISODES.some(c=>c.id===id&&c.saga===i)).length;
          return <button type="button" key={e.id} className="gf-region-pin"
            style={{'--pin-x':REGION_POSITIONS[i][0]+'%','--pin-y':REGION_POSITIONS[i][1]+'%','--region-color':e.color} as CSSProperties}
            aria-label={'Escolher saga '+e.title} onClick={()=>selectSaga(i)}>
            <span className="gf-map-marker">{i+1}</span>
            <span className="gf-map-legend"><strong>{e.title}</strong><small>{done}/6 testemunhos</small></span>
          </button>;
        })}
      </div>
      <div className="gf-map-foot"><Map size={16}/> Selecione uma região no mapa para explorar os capítulos</div>
    </div>}

    {screen==='chapters' && <div className="gf-map-layer gf-chapter-layer gf-screen-enter">
      <div className="gf-screen-heading">
        <button className="gf-back" onClick={()=>setScreen('world')}><ArrowLeft size={17}/> Atlas das sagas</button>
        <span>SAGA {saga+1} DE 6</span>
        <h2>{CAMPAIGN_SAGAS[saga].title}</h2>
        <p>{CAMPAIGN_SAGAS[saga].caption}</p>
      </div>
      <div className="gf-region-map gf-chapter-map" aria-label={'Capítulos de '+CAMPAIGN_SAGAS[saga].title}>
        <GameFrontBackdrop mode="atlas" seed={saga} chapters/>
        {chapters.map((e,i)=><button key={e.id} type="button"
          className={'gf-chapter-pin'+(i===chapter?' gf-selected':'')}
          aria-label={(progress.episodes[e.id]?'Continuar ':'Explorar ')+e.title}
          style={{'--pin-x':CHAPTER_POSITIONS[i][0]+'%','--pin-y':CHAPTER_POSITIONS[i][1]+'%'} as CSSProperties}
          onClick={()=>setChapter(i)}>
          <span>{progress.completed.includes(e.id)?<Check size={18}/>:i+1}</span>
          <small>{e.title}</small>
        </button>)}
      </div>
      <div className="gf-chapter-inspector" role="group" aria-label="Capítulo selecionado">
        <div className="gf-chapter-number">CAPÍTULO {String(current.number).padStart(2,'0')} · {current.reference.label}</div>
        <h3>{current.title}</h3>
        <p>{progress.episodes[current.id] ? progress.completed.includes(current.id)?'Testemunho registrado · você pode revisitar':'A aventura está salva neste aparelho': 'Explore o cenário e descubra os testemunhos desta história.'}</p>
        <button type="button" className="gf-menu-action gf-menu-primary" onClick={()=>openChapter(current)}>
          <Play size={18}/> {progress.episodes[current.id]?'Continuar capítulo':'Entrar na aventura'} <ChevronRight size={18}/>
        </button>
        <div className="gf-chapter-arrows">
          <button onClick={()=>setChapter((chapter+5)%6)} aria-label="Capítulo anterior">←</button>
          <span>{chapter+1} / 6</span>
          <button onClick={()=>setChapter((chapter+1)%6)} aria-label="Próximo capítulo">→</button>
        </div>
      </div>
    </div>}

    {screen==='chronicle'&&<section className="gf-codex-book" aria-label="Códice da jornada">
      <div className="gf-book-heading"><button className="gf-back" onClick={()=>setScreen('title')}><ArrowLeft size={17}/> Voltar ao menu</button><span>ESPAÇO {activeSlot} · {completed}/36</span><h2>Códice da jornada</h2></div>
      {codexEpisode ? <div className="gf-book-pages">
        <nav aria-label="Testemunhos registrados">{discoveries.map(e => <button key={e.id} aria-current={e.id===codexEpisode.id?'page':undefined} onClick={()=>setCodexId(e.id)}><span>{String(e.number).padStart(2,'0')}</span>{e.title}</button>)}</nav>
        <article><span className="gf-kicker">{codexEpisode.reference.label}</span><h3>{codexEpisode.title}</h3>{progress.episodes[codexEpisode.id].visited.map(i => <section key={i}><h4>{codexEpisode.stations[i].name}</h4><p>{codexEpisode.stations[i].discovery}</p></section>)}
          <button className="gf-menu-action" onClick={()=>onReference(codexEpisode)}><BookOpen size={17}/> Ler passagem</button>
          <button className="gf-menu-action" onClick={()=>onMemorize(codexEpisode)}>Criar cartão de memorização</button>
        </article>
      </div> : <div className="gf-book-empty"><BookOpen size={40}/><h3>As primeiras páginas esperam por você</h3><p>Investigue lugares no cenário para registrar seus testemunhos neste livro.</p><button className="gf-menu-action gf-menu-primary" onClick={()=>setScreen('world')}>Abrir o atlas <ChevronRight size={17}/></button></div>}
      <button className="gf-export" onClick={onExport}>Exportar saves e cópias de segurança</button>
    </section>}

    {screen==='settings'&&<div className="gf-overlay-screen">
      <button className="gf-back" onClick={()=>setScreen('title')}><ArrowLeft size={17}/> Voltar ao menu</button>
      <Settings size={34} className="gf-large-symbol"/>
      <h2>Opções do jogo</h2>
      <p>Os capítulos continuam salvos automaticamente neste dispositivo.</p>
      <button className="gf-menu-action" onClick={()=>void toggleFullscreen()}><Gamepad2 size={18}/>{full?'Sair da tela cheia':'Tela cheia'}<ChevronRight size={18}/></button>
      <button className="gf-menu-action" onClick={onSound} aria-pressed={sound}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>} {sound?'Som e trilha: ligados':'Som e trilha: desligados'}<ChevronRight size={18}/></button>
      <small className="gf-settings-note">Música original sintetizada, sem arquivos externos. A preferência acompanha esta sessão e pode ser alterada no menu de pausa. Atalhos: Esc pausa · J missões · I inventário · M mapa · C códice.</small>
    </div>}
  </div>;
}

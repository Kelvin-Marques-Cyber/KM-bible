import { ArrowLeft, Copy, Link, Users, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MezuzahClassicBoard3D from '../components/MezuzahClassicBoard3D';
import { isClassicSnapshot, type ClassicGame } from '../games/mezuzah-classic/engine';
import { ClassicPlay, ClassicRouteFields, ClassicRules, classicButton, classicReader, routeOptions } from './MezuzahClassic';

type Member = { id: string; name: string; online: boolean };
type Room = { code: string; hostId: string | null; maxPlayers: number; players: Member[]; game: ClassicGame | null; revision: number; readerId: string | null };
type Session = { url: string; code: string; token: string; started: boolean };
const SESSION_KEY = 'km-mezuzah-classic-room-v2';
const field = 'mt-1 min-h-12 w-full rounded-xl border border-[#ccb17f]/35 bg-[#132522] px-3 py-2 text-sm text-[#f2e6cd]';
const validUrl = (value: string) => { try { const url = new URL(value); return !url.username && !url.password && (url.protocol === 'wss:' || (url.protocol === 'ws:' && ['localhost', '127.0.0.1'].includes(url.hostname))); } catch { return false; } };
function savedSession(): Session | null { try { const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); return value && validUrl(value.url) && /^[A-Z2-9]{6}$/.test(value.code) && /^[a-f0-9]{48}$/.test(value.token) ? { ...value, started: value.started === true } : null; } catch { return null; } }
export function isClassicRoom(value: unknown): value is Room {
  if (!value || typeof value !== 'object') return false;
  const r = value as Room;
  if (typeof r.code !== 'string' || !/^[A-Z2-9]{6}$/.test(r.code) || !Number.isSafeInteger(r.revision) || r.revision < 0 || !Number.isInteger(r.maxPlayers) || r.maxPlayers < 2 || r.maxPlayers > 4 || !Array.isArray(r.players) || r.players.length < 1 || r.players.length > r.maxPlayers) return false;
  if (r.players.some((p, i) => !p || p.id !== 'p' + i || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 24 || typeof p.online !== 'boolean') || !r.players.some(p => p.id === r.hostId)) return false;
  if (r.game === null) return r.readerId === null;
  return isClassicSnapshot(r.game) && r.game.players.length === r.players.length && r.game.players.every((p, i) => p.id === r.players[i].id && p.name === r.players[i].name) && r.readerId === classicReader(r.game).id;
}

/** All game decisions come from authoritative room snapshots; callbacks only send intents. */
export default function MezuzahClassicOnline({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState(savedSession);
  const [url, setUrl] = useState(() => savedSession()?.url ?? (import.meta.env.VITE_MEZUZAH_WS_URL as string | undefined) ?? '');
  const [name, setName] = useState('Equipe 1'), [code, setCode] = useState(''), [maxPlayers, setMaxPlayers] = useState(4);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'disconnected'>('idle');
  const [identity, setIdentity] = useState(''), [room, setRoom] = useState<Room | null>(null), [error, setError] = useState('');
  const [options, setOptions] = useState({ oldestIndex: 0, outerSteps: '12', starSteps: '12' });
  const socket = useRef<WebSocket | null>(null), timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimeoutRef = () => { if (timeout.current) clearTimeout(timeout.current); timeout.current = null; };
  useEffect(() => () => { clearTimeoutRef(); const ws = socket.current; socket.current = null; ws?.close(); }, []);
  const connect = (operation: 'create' | 'join' | 'resume') => {
    const target = (operation === 'resume' ? session?.url ?? url : url).trim();
    if (!validUrl(target)) { setError('Informe um endereço wss://; ws:// é permitido somente em localhost.'); return; }
    if (operation !== 'resume' && !name.trim()) { setError('Informe o nome da equipe.'); return; }
    if (operation === 'join' && !/^[A-Z2-9]{6}$/.test(code.trim().toUpperCase())) { setError('O código deve ter seis caracteres.'); return; }
    const old = socket.current; socket.current = null; old?.close(); clearTimeoutRef();
    setRoom(null); setIdentity(''); setError(''); setStatus('connecting');
    let ws: WebSocket;
    try { ws = new WebSocket(target); } catch { setStatus('idle'); setError('Não foi possível abrir este endereço.'); return; }
    socket.current = ws;
    let authenticated = false;
    timeout.current = setTimeout(() => { if (socket.current === ws && !authenticated) { setError('O servidor não respondeu. Confira o endereço e a conexão.'); ws.close(); } }, 12000);
    ws.onopen = () => {
      if (socket.current !== ws) return;
      ws.send(JSON.stringify(operation === 'resume' && session ? { type: 'resume', code: session.code, token: session.token } : operation === 'create' ? { type: 'create', name, maxPlayers } : { type: 'join', name, code: code.trim().toUpperCase() }));
    };
    ws.onmessage = event => {
      if (socket.current !== ws) return;
      let data: Record<string, unknown>; try { data = JSON.parse(String(event.data)); } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (data.type === 'welcome' && typeof data.id === 'string' && /^p[0-3]$/.test(data.id) && typeof data.token === 'string' && /^[a-f0-9]{48}$/.test(data.token) && typeof data.code === 'string' && /^[A-Z2-9]{6}$/.test(data.code)) {
        authenticated = true; clearTimeoutRef(); setIdentity(data.id); setStatus('ready');
        const saved = { url: target, code: data.code, token: data.token, started: false }; setSession(saved);
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved)); } catch { /* Session can still be used until this page closes. */ }
      } else if (data.type === 'room') {
        if (!isClassicRoom(data)) { setError('O servidor enviou uma partida incompatível. Use o servidor atualizado do Mezuzá Clássico.'); return; }
        setRoom(previous => previous?.code === data.code && previous.revision > data.revision ? previous : data);
        setSession(previous => {
          if (!previous || previous.started === !!data.game) return previous;
          const saved = { ...previous, started: !!data.game };
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved)); } catch {}
          return saved;
        });
      } else if (data.type === 'error') { setError(String(data.message ?? 'Não foi possível registrar a ação.')); if (!authenticated) ws.close(); }
    };
    ws.onerror = () => { if (socket.current === ws) setError('Não foi possível conectar ao servidor de partidas.'); };
    ws.onclose = () => { if (socket.current === ws) { clearTimeoutRef(); socket.current = null; setStatus('disconnected'); } };
  };
  const send = (type: string, payload: Record<string, unknown> = {}) => {
    if (!room || status !== 'ready' || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify({ ...payload, type, expectedRevision: room.revision, expectedRoundId: room.game?.roundId ?? 0 }));
    setError('');
  };
  const leave = () => { clearTimeoutRef(); const ws = socket.current; socket.current = null; ws?.close(); setRoom(null); setIdentity(''); setSession(null); setStatus('idle'); try { sessionStorage.removeItem(SESSION_KEY); } catch {} };
  const ready = status === 'ready', host = room?.hostId === identity, game = room?.game;
  return <div className="scroll-area h-full bg-[#10231e] text-[#f1e6cd]"><div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><button type="button" className={classicButton} onClick={onBack}><ArrowLeft size={17} />Ferramentas e Games</button><div className="text-right"><p className="text-[10px] tracking-[.25em] text-[#d3b578]">MEZUZÁ CLÁSSICO</p><h2 className="font-reading text-3xl">Salas pela internet</h2></div></header>
    {error && <p role="alert" className="mb-4 rounded-xl bg-[#653c2c] p-3 text-sm">{error}</p>}
    {status === 'disconnected' && <p role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[#5a4827] p-3 text-sm"><WifiOff size={18} />Conexão encerrada. As ações ficam desativadas até retomar.{session?.started && <button type="button" className={classicButton} onClick={() => connect('resume')}>Retomar sala {session.code}</button>}</p>}
    {!room ? <section className="mx-auto max-w-xl rounded-2xl border border-[#ccb17f]/35 bg-[#233b33] p-5 sm:p-7"><h3 className="font-reading text-2xl">Conectar ao servidor</h3><p className="mb-5 mt-3 text-sm leading-relaxed text-[#c0d1be]">Para jogar entre aparelhos, use um servidor de salas em execução. O servidor valida turnos, compra de cartões, escolhas e avanço; o leitor avalia as respostas e registra o resultado. Uma sala pode representar de 2 a 4 equipes.</p><label className="block text-sm">Endereço do servidor WebSocket<input className={field} value={url} onChange={e => setUrl(e.target.value)} placeholder="wss://seu-servidor.example" spellCheck={false} /></label><label className="mt-3 block text-sm">Nome da equipe<input className={field} value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label><label className="mt-3 block text-sm">Vagas<select className={field} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))}>{[2, 3, 4].map(n => <option key={n} value={n}>{n} equipes</option>)}</select></label><button type="button" disabled={status === 'connecting' || !validUrl(url)} className={`${classicButton} mt-4 w-full !bg-[#d9bc82] !text-[#223326]`} onClick={() => connect('create')}><Users size={17} />Criar sala</button><label className="mt-5 block text-sm">Código de convite<input className={`${field} font-mono uppercase tracking-[.3em]`} maxLength={6} value={code} placeholder="ABC234" onChange={e => setCode(e.target.value.toUpperCase())} /></label><button type="button" disabled={status === 'connecting' || !validUrl(url)} className={`${classicButton} mt-3 w-full`} onClick={() => connect('join')}><Link size={17} />Entrar na sala</button>{session?.started && status !== 'connecting' && <button type="button" className={`${classicButton} mt-3 w-full`} onClick={() => connect('resume')}>Retomar sala {session.code}</button>}{status === 'connecting' && <p role="status" className="mt-3 text-sm">Conectando…</p>}<p className="mt-4 text-xs text-[#b9cabb]">A hospedagem da PWA não inclui um servidor WebSocket. Depois de iniciada, a partida pode ser retomada com a sessão deste navegador. Sair da sala de espera libera sua vaga. As partidas ficam na memória do servidor e expiram após inatividade.</p></section> : <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]"><div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#233b33] p-3"><span className="mr-auto text-sm">Convite <strong className="ml-2 font-mono text-xl tracking-[.2em] text-[#e4c587]">{room.code}</strong></span><button type="button" className={classicButton} onClick={() => { void navigator.clipboard?.writeText(room.code).catch(() => setError(`Copie o código manualmente: ${room.code}`)); }}><Copy size={16} />Copiar convite</button></div>{game ? <div className="h-[380px] sm:h-[600px]"><MezuzahClassicBoard3D game={game} /></div> : <section className="rounded-2xl border border-[#ccb17f]/25 bg-[#1b302b] p-6"><h3 className="font-reading text-2xl">Aguardando as equipes</h3><p className="mt-3 text-sm">Compartilhe o código. O anfitrião escolhe o percurso digital ou ajusta as etapas para seu tabuleiro físico e indica o monitor mais velho.</p></section>}<div className="mt-4"><ClassicRules /></div></div><div className="space-y-4"><section className="rounded-2xl border border-[#ccb17f]/35 bg-[#233b33] p-5"><h3 className="font-semibold">Participantes</h3><ul className="my-4 space-y-2">{room.players.map(p => <li className="flex items-center gap-2 text-sm" key={p.id}><span className="mr-auto">{p.name}{p.id === identity ? ' · você' : ''}</span><span className={p.online ? 'text-[#afd7a1]' : 'text-[#d6bb86]'}>{p.online ? 'Online' : 'Ausente'}</span></li>)}</ul>{!game && host && <><ClassicRouteFields count={room.players.length} options={options} onChange={setOptions} /><button type="button" className={`${classicButton} mt-4 w-full`} disabled={!ready || room.players.length < 2 || room.players.some(p => !p.online) || !routeOptions(options)} onClick={() => { const o = routeOptions(options); if (o) send('start', { oldestIndex: Math.min(room.players.length - 1, o.oldestIndex), route: { outerSteps: o.outerSteps, starSteps: o.starSteps } }); }}>Iniciar partida online</button></>}{!game && !host && <p className="text-sm text-[#c0d1be]">Aguardando o anfitrião iniciar.</p>}</section>{game && <><ClassicPlay game={game} canDraw={ready && room.readerId === identity} canChoose={ready && game.players[game.turn].id === identity} canResolve={ready && room.readerId === identity} onDraw={() => send('draw')} onChoose={number => send('choose', { number })} onResolve={winnerId => send('resolve', { winnerId })} />{host && game.phase === 'finished' && <button type="button" className={classicButton} disabled={!ready || room.players.some(p => !p.online)} onClick={() => send('restart', { oldestIndex: game.oldestIndex, route: game.route })}><RotateLabel />Revanche com as mesmas equipes</button>}</>}<button type="button" className={classicButton} onClick={leave}>Sair da sala</button></div></div>}
  </div></div>;
}
function RotateLabel() { return <span aria-hidden>↻</span>; }

// Modo online REAL por WebSocket. Só é disponibilizado se um servidor foi
// configurado. O servidor sorteia o dado e valida turno/resposta; não confie
// no estado do navegador para decidir a jogada de outro participante.
import { ArrowLeft, Check, Copy, Dices, Globe2, Link, LoaderCircle, RotateCcw, Shield, Trophy, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import MezuzahBoard3D from '../components/MezuzahBoard3D';
import { QUESTIONS, isGameState, startGame, type GameState } from '../lib/mezuzah-game';

type Member={id:string;name:string;online:boolean};
type Room={code:string;hostId:string|null;maxPlayers:number;players:Member[];game:GameState|null};
type Identity={id:string;code:string;token:string};
type SavedSession={url:string;code:string;token:string};
const SESSION='km-mezuzah-room';
const DEFAULT_URL=(import.meta.env.VITE_MEZUZAH_WS_URL as string|undefined)??'';
const demo=startGame(['Anfitrião','Convidado']);
function savedSession():SavedSession|null{
  try{
    const value=JSON.parse(sessionStorage.getItem(SESSION)||'null') as SavedSession|null;
    return value&&typeof value.url==='string'&&typeof value.token==='string'&&typeof value.code==='string'?value:null;
  }catch{return null;}
}
const validUrl=(value:string)=>{
  try {
    const u=new URL(value);
    return u.protocol==='wss:'||(u.protocol==='ws:'&&['localhost','127.0.0.1'].includes(u.hostname));
  }catch{return false;}
};

export default function MezuzahOnline({onBack}:{onBack:()=>void}){
  const [url,setUrl]=useState(()=>savedSession()?.url||DEFAULT_URL);
  const [name,setName]=useState('Jogador');
  const [code,setCode]=useState('');
  const [maxPlayers,setMaxPlayers]=useState(4);
  const [status,setStatus]=useState<'idle'|'connecting'|'ready'|'disconnected'>('idle');
  const [error,setError]=useState('');
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [room,setRoom]=useState<Room|null>(null);
  const socket=useRef<WebSocket|null>(null);
  const saved=useRef<SavedSession|null>(savedSession());
  const myTurn=!!room?.game&&room.game.players[room.game.turn]?.id===identity?.id;
  const isHost=!!room&&room.hostId===identity?.id;
  const question=room?.game?.pending?QUESTIONS[room.game.pending.question]:null;
  const canAct=status==='ready'&&myTurn&&room?.game?.status==='playing';
  const send=(message:unknown)=>{
    if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify(message));
  };
  const connect=useCallback((operation:'create'|'join'|'resume')=>{
    const target=url.trim();
    if(!validUrl(target)){setError('Use um endereço seguro wss:// do servidor de partidas. ws:// somente para localhost.');return;}
    if(operation!=='resume'&&!name.trim()){setError('Informe seu nome.');return;}
    if(operation==='join'&&!/^[A-Z2-9]{6}$/.test(code.trim().toUpperCase())){setError('O código da sala deve ter seis caracteres.');return;}
    const previous=socket.current;
    socket.current=null;previous?.close();
    setError('');setStatus('connecting');setRoom(null);setIdentity(null);
    let ws:WebSocket;
    try{ws=new WebSocket(target);}catch{setStatus('disconnected');setError('Endereço de servidor inválido.');return;}
    socket.current=ws;
    ws.onopen=()=>{
      const action=operation==='resume'&&saved.current?
        {type:'resume',code:saved.current.code,token:saved.current.token}:
        operation==='create'?{type:'create',name,maxPlayers}:{type:'join',name,code:code.trim().toUpperCase()};
      ws.send(JSON.stringify(action));
    };
    ws.onmessage=event=>{
      let data:Record<string,unknown>;
      try{data=JSON.parse(String(event.data)) as Record<string,unknown>;}catch{return;}
      if(data.type==='error'){setError(String(data.message||'Erro no servidor.'));return;}
      if(data.type==='welcome'&&typeof data.id==='string'&&typeof data.token==='string'&&typeof data.code==='string'){
        const value={id:data.id,token:data.token,code:data.code};
        setIdentity(value);
        saved.current={url:target,code:value.code,token:value.token};
        try{sessionStorage.setItem(SESSION,JSON.stringify(saved.current));}catch{}
        setStatus('ready');setError('');return;
      }
      if(data.type==='room'&&typeof data.code==='string'&&Array.isArray(data.players)){
        const state:unknown=data.game;
        if(state!==null&&!isGameState(state))return;
        setRoom({code:data.code,hostId:typeof data.hostId==='string'?data.hostId:null,
          maxPlayers:Number(data.maxPlayers)||4,
          players:(data.players as Member[]).filter(m=>typeof m.id==='string'&&typeof m.name==='string'),
          game:state});
      }
    };
    ws.onerror=()=>setError('Não foi possível estabelecer conexão com o servidor.');
    ws.onclose=()=>{
      if(socket.current===ws){socket.current=null;setStatus('disconnected');}
    };
  },[url,name,code,maxPlayers]);
  useEffect(()=>()=>{socket.current?.close();socket.current=null;},[]);
  const leave=()=>{
    const active=socket.current;
    socket.current=null;active?.close();
    setRoom(null);setIdentity(null);setStatus('idle');setError('');
    saved.current=null;
    try{sessionStorage.removeItem(SESSION);}catch{}
  };
  const copy=async()=>{
    if(!room)return;
    try{await navigator.clipboard.writeText(room.code);}catch{setError('Código: '+room.code+' — copie manualmente.');}
  };
  return (
    <div className="scroll-area h-full bg-[#11191b] text-[#f5e9d5]">
      <div className="mx-auto max-w-[1370px] px-3 py-4 sm:px-5 sm:py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dcbf8d]/30 px-4 text-sm hover:bg-white/10"><ArrowLeft size={17}/> Ferramentas e Games</button>
          <div className="text-right"><p className="text-xs tracking-[.25em] text-[#e0bf82]">JOGAR COM AMIGOS</p><h2 className="font-reading text-3xl">Mezuzá 3D <Globe2 size={24} className="inline-block text-[#e4bb72]"/></h2></div>
        </header>
        {!room ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-[#bd9c69]/35 bg-[#263132] p-5 shadow-2xl sm:p-7">
            <div className="mb-4 flex items-center gap-3 text-[#e8ca8c]"><Shield size={25}/><h3 className="text-xl font-semibold">Conectar ao servidor</h3></div>
            <p className="mb-4 text-sm leading-relaxed text-[#d1d9d0]">As salas são partidas online reais, com turnos sincronizados e dado sorteado pelo servidor. É necessário hospedar o serviço <code>mezuzah-server</code> antes de criar partidas entre dispositivos.</p>
            <label className="block text-sm">Endereço do servidor WebSocket
              <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="wss://seu-servidor.example" className="mt-1 w-full rounded-xl border border-[#c6ae87]/35 bg-[#11191b] px-3 py-3 text-sm" spellCheck={false} />
            </label>
            <label className="mt-4 block text-sm">Seu nome
              <input value={name} maxLength={24} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-[#c6ae87]/35 bg-[#11191b] px-3 py-3"/>
            </label>
            <label className="mt-4 block text-sm">Quantidade de vagas
              <select value={maxPlayers} onChange={e=>setMaxPlayers(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-[#c6ae87]/35 bg-[#11191b] px-3 py-3">
                {[2,3,4].map(n=><option key={n} value={n}>{n} participantes</option>)}
              </select>
            </label>
            <button disabled={status==='connecting'||!validUrl(url)} type="button" onClick={()=>connect('create')} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e5c68e] font-semibold text-[#221a12] disabled:opacity-40"><Users size={18}/> Criar sala</button>
            <div className="my-5 flex items-center gap-3 text-xs text-[#c2cbc2]"><span className="h-px flex-1 bg-white/20"/> ou entrar com convite <span className="h-px flex-1 bg-white/20"/></div>
            <label className="block text-sm">Código de seis caracteres
              <input value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABC234" className="mt-1 w-full rounded-xl border border-[#c6ae87]/35 bg-[#11191b] px-3 py-3 font-mono text-lg uppercase tracking-[.3em]"/>
            </label>
            <button disabled={status==='connecting'||!validUrl(url)} onClick={()=>connect('join')} type="button" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e4c384]/50 font-semibold disabled:opacity-40"><Link size={18}/> Entrar na sala</button>
            {saved.current && status!=='connecting'&&<button type="button" className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#334743] text-sm font-medium" onClick={()=>connect('resume')}>Retomar sala {saved.current.code}</button>}
            {status==='connecting'&&<p role="status" className="mt-3 flex items-center gap-2 text-sm"><LoaderCircle size={16} className="animate-spin"/> Conectando...</p>}
            {error&&<p role="alert" className="mt-3 rounded-lg bg-[#72392b] p-3 text-sm">{error}</p>}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(285px,.95fr)]">
            <div className="min-w-0">
              <div className="h-[350px] sm:h-[540px] lg:h-[min(70vh,700px)]"><MezuzahBoard3D game={room.game||demo}/></div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d6bb80]/20 bg-[#243031] p-3">
                <div><span className="text-xs text-[#c8cfcb]">Código da sala</span><strong className="ml-3 font-mono text-lg tracking-[.3em] text-[#e8c986]">{room.code}</strong></div>
                <button type="button" onClick={()=>void copy()} className="flex items-center gap-2 rounded-lg bg-[#374441] px-3 py-2 text-sm"><Copy size={16}/> Copiar convite</button>
              </div>
            </div>
            <div className="space-y-4">
              <section className="rounded-2xl border border-[#d6bb80]/30 bg-[#263132] p-5">
                <h3 className="flex items-center gap-2 text-lg font-semibold"><Users size={20} className="text-[#e4c283]"/> Participantes</h3>
                <ol className="mt-3 space-y-2">{room.players.map((p,i)=>(
                  <li key={p.id} className="flex items-center gap-2 rounded-lg bg-[#161f20] p-3 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{background:['#edc36c','#75c6da','#e994a1','#a5d992'][i]}}/>
                    <span className="min-w-0 flex-1 truncate">{p.name} {p.id===identity?.id?'(você)':''}</span>
                    <span className={p.online?'text-[#a8ddb1]':'text-[#ecc59b]'}>{p.online?'Online':'Ausente'}</span>
                  </li>
                ))}</ol>
                {!room.game&&<p className="mt-3 text-sm text-[#d2d8d3]">Aguardando de 2 a {room.maxPlayers} participantes. O anfitrião inicia a partida.</p>}
                {!room.game&&isHost&&<button type="button" onClick={()=>send({type:'start'})} disabled={status!=='ready'||room.players.length<2||room.players.some(p=>!p.online)} className="mt-4 w-full rounded-xl bg-[#e5c68e] px-4 py-3 font-semibold text-[#221a12] disabled:opacity-40">Iniciar partida online</button>}
              </section>
              {room.game&&(
                <section className="rounded-2xl border border-[#d6bb80]/30 bg-[#263132] p-5" aria-live="polite">
                  {room.game.status==='finished' ? (
                    <><Trophy size={34} className="text-[#e5c68e]"/><h3 className="mt-2 text-2xl font-semibold">{room.game.players.find(p=>p.id===room.game!.winner)?.name} venceu!</h3>{isHost&&<button className="mt-4 flex items-center gap-2 rounded-lg bg-[#e5c68e] px-4 py-3 text-[#221a12]" type="button" onClick={()=>send({type:'restart'})}><RotateCcw size={18}/> Nova partida</button>}</>
                  ) : (
                    <>
                      <p className="text-xs text-[#e4c283]">{myTurn?'É SUA VEZ':'AGUARDE SUA VEZ'}</p>
                      <h3 className="mt-1 text-xl font-semibold">{room.game.players[room.game.turn]?.name}</h3>
                      {question ? (
                        <div className="mt-4">
                          <p className="text-lg font-medium">{question.text}</p>
                          <div className="mt-3 space-y-2">{question.choices.map((x,i)=><button type="button" disabled={!canAct} key={i} onClick={()=>send({type:'answer',choice:i})} className="block min-h-12 w-full rounded-lg border border-[#e2c488]/30 bg-[#344040] p-3 text-left text-sm hover:bg-[#485655] disabled:opacity-60"><span className="mr-2 text-[#e4c283]">{String.fromCharCode(65+i)}.</span>{x}</button>)}</div>
                          <p className="mt-2 text-xs text-[#cdd6cf]">{question.reference}</p>
                        </div>
                      ) : <button type="button" disabled={!canAct} onClick={()=>send({type:'roll'})} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#e5c68e] font-semibold text-[#221a12] disabled:opacity-40"><Dices size={20}/> Lançar dado</button>}
                      <p className="mt-4 text-sm leading-relaxed text-[#d1dad3]">{room.game.message}</p>
                      <div className="mt-3 space-y-1 text-sm text-[#d1dad3]">{room.game.players.map(p=><p key={p.id}>{p.name}: casa {p.position} · {p.score} pontos</p>)}</div>
                    </>
                  )}
                </section>
              )}
              {status!=='ready'&&<div role="status" className="rounded-xl border border-[#e6a78a]/40 bg-[#683b32] p-4 text-sm">Conexão perdida. Sua vaga foi reservada temporariamente. <button type="button" className="ml-2 underline" onClick={()=>connect('resume')}>Reconectar</button></div>}
              {error&&<p role="alert" className="rounded-xl bg-[#683b32] p-3 text-sm">{error}</p>}
              <button type="button" onClick={leave} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d6bb80]/30 px-4 py-3 text-sm"><Check size={16}/> Sair da sala</button>
              <p className="text-xs leading-relaxed text-[#c2cdc8]">As salas ficam na memória do servidor: se ele reiniciar, será preciso criar outra. Somente o participante do turno pode jogar; a conexão usa WSS em produção.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

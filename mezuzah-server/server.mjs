// Servidor de salas do Mezuzá 3D. A GitHub Pages permanece estática;
// execute este serviço numa hospedagem Node 22+ para partidas online reais.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { startGame, rollDie, answerQuestion, secureDie } from '../pwa/src/lib/mezuzah-game.ts';

const PORT = Number(process.env.PORT || 8787);
const origins = (process.env.ALLOWED_ORIGINS || 'https://kelvin-marques-cyber.github.io,http://localhost:5173').split(',').map(x=>x.trim()).filter(Boolean);
const rooms = new Map();
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS=200;
const GRACE_MS=10*60_000;
const ROOM_TTL=4*60*60_000;

function code() {
  for(let retries=0;retries<12;retries++){
    const b=randomBytes(6);
    const id=Array.from(b,x=>ALPHABET[x%ALPHABET.length]).join('');
    if(!rooms.has(id)) return id;
  }
  throw new Error('Não foi possível criar sala');
}
const token=()=>randomBytes(24).toString('hex');
function send(ws,data){
  if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));
}
function broadcast(room){
  const members=room.members.map(p=>({id:p.id,name:p.name,online:p.socket?.readyState===WebSocket.OPEN}));
  const message={type:'room',code:room.code,hostId:room.hostId,maxPlayers:room.maxPlayers,players:members,game:room.game};
  for(const m of room.members)send(m.socket,message);
}
function fail(ws,message){send(ws,{type:'error',message});}
function safeName(value){
  return typeof value==='string'?value.replace(/[\p{Cc}\p{Cf}]/gu,'').trim().slice(0,24):'';
}
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':origins[0]||'null'});
    res.end(JSON.stringify({status:'ok',rooms:rooms.size}));
  }else {
    res.writeHead(404);res.end('Not found');
  }
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
  if(!origins.includes(req.headers.origin||'')){
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;
  }
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
  let bound=null; // { room, member }
  let messages=0,windowStart=Date.now();
  ws.on('message',raw=>{
    try {
      const now=Date.now();
      if(now-windowStart>1000){windowStart=now;messages=0;}
      if(++messages>12)throw new Error('Muitas ações por segundo.');
      const action=JSON.parse(raw.toString());
      if(!action||typeof action!=='object'||typeof action.type!=='string')throw new Error('Mensagem inválida.');
      if(action.type==='create'){
        if(bound)throw new Error('Já conectado a uma sala.');
        if(rooms.size>=MAX_ROOMS)throw new Error('Servidor de salas lotado.');
        const name=safeName(action.name);
        const max=Number(action.maxPlayers);
        if(!name||!Number.isInteger(max)||max<2||max>4)throw new Error('Informe o nome e escolha de 2 a 4 vagas.');
        const id=code();
        const member={id:'p0',name,token:token(),socket:ws,awaySince:null};
        const room={code:id,maxPlayers:max,members:[member],hostId:member.id,game:null,updated:now};
        rooms.set(id,room);bound={room,member};
        send(ws,{type:'welcome',code:id,token:member.token,id:member.id});broadcast(room);return;
      }
      if(action.type==='join'){
        if(bound)throw new Error('Já conectado a uma sala.');
        const id=String(action.code||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
        const room=rooms.get(id);
        if(!room)throw new Error('Sala inexistente ou expirada.');
        const name=safeName(action.name);
        if(!name)throw new Error('Informe seu nome.');
        if(room.game||room.members.length>=room.maxPlayers)throw new Error('Sala em andamento ou lotada.');
        const member={id:'p'+room.members.length,name,token:token(),socket:ws,awaySince:null};
        room.members.push(member);room.updated=now;bound={room,member};
        send(ws,{type:'welcome',code:id,token:member.token,id:member.id});broadcast(room);return;
      }
      if(action.type==='resume'){
        if(bound)throw new Error('Já conectado.');
        const room=rooms.get(String(action.code||'').toUpperCase());
        const member=room?.members.find(m=>m.token===action.token);
        if(!room||!member)throw new Error('Não foi possível retomar esta sala.');
        if(member.socket&&member.socket!==ws){try{member.socket.close(4000,'Sessão retomada');}catch{}}
        member.socket=ws;member.awaySince=null;
        bound={room,member};room.updated=now;
        send(ws,{type:'welcome',code:room.code,token:member.token,id:member.id});broadcast(room);return;
      }
      if(!bound)throw new Error('Crie ou entre numa sala.');
      const {room,member}=bound;
      if(member.socket!==ws)throw new Error('Sessão desatualizada.');
      room.updated=now;
      if(action.type==='start'){
        if(room.hostId!==member.id)throw new Error('Somente o anfitrião pode iniciar.');
        if(room.game)throw new Error('Partida já iniciada.');
        if(room.members.length<2||room.members.some(m=>!m.socket||m.socket.readyState!==WebSocket.OPEN))throw new Error('Aguarde pelo menos dois jogadores conectados.');
        room.game=startGame(room.members.map(m=>m.name));broadcast(room);return;
      }
      if(action.type==='roll'){
        if(!room.game||room.game.status!=='playing')throw new Error('Não há partida em andamento.');
        if(room.game.players[room.game.turn].id!==member.id)throw new Error('Aguarde sua vez.');
        room.game=rollDie(room.game,secureDie());broadcast(room);return;
      }
      if(action.type==='answer'){
        if(!room.game||!room.game.pending)throw new Error('Não há pergunta pendente.');
        if(room.game.players[room.game.turn].id!==member.id)throw new Error('Aguarde sua vez.');
        room.game=answerQuestion(room.game,action.choice);broadcast(room);return;
      }
      if(action.type==='restart'){
        if(room.hostId!==member.id)throw new Error('Somente o anfitrião pode reiniciar.');
        room.game=startGame(room.members.map(m=>m.name));broadcast(room);return;
      }
      throw new Error('Ação desconhecida.');
    }catch(error){fail(ws,error instanceof Error?error.message:'Ação inválida.');}
  });
  ws.on('close',()=>{
    if(!bound)return;
    const {room,member}=bound;
    if(member.socket!==ws)return; // Sessão já retomada.
    member.socket=null;member.awaySince=Date.now();room.updated=Date.now();
    if(!room.game){
      room.members=room.members.filter(m=>m!==member);
      if(room.hostId===member.id)room.hostId=room.members[0]?.id??null;
      if(room.members.length===0)rooms.delete(room.code);
    }
    if(rooms.has(room.code))broadcast(room);
  });
  ws.on('error',()=>{});
});
setInterval(()=>{
  const now=Date.now();
  for(const [id,room] of rooms){
    const anyOnline=room.members.some(m=>m.socket?.readyState===WebSocket.OPEN);
    if(now-room.updated>ROOM_TTL || (!anyOnline&&room.members.every(m=>m.awaySince&&now-m.awaySince>GRACE_MS)))rooms.delete(id);
  }
},60_000).unref();
server.listen(PORT,()=>console.log('Mezuzá rooms listening on :'+PORT+' ('+origins.join(', ')+')'));

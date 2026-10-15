// Salas autoritativas do Mezuzá clássico. O servidor legado está preservado em legacy-server.mjs.
import http from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { CLASSIC_CARDS, createClassicGame, drawCard, chooseNumber, resolveChallenge } from '../pwa/src/games/mezuzah-classic/engine.ts';

const DEFAULT_ORIGINS = ['https://kelvin-marques-cyber.github.io', 'http://localhost:5173'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => randomBytes(24).toString('hex');
const safeName = value => typeof value === 'string' ? value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().normalize('NFC').slice(0, 24) : '';
const readerId = game => game ? game.players[(game.turn - 1 + game.players.length) % game.players.length].id : null;
function send(ws, value) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}
function safeCode(value) {
  return typeof value === 'string' && /^[A-Z2-9]{6}$/.test(value.toUpperCase()) ? value.toUpperCase() : null;
}
/** A resposta fica restrita ao monitor. Tokens nunca fazem parte de snapshots. */
function snapshot(room, recipientId) {
  const game = room.game && {
    ...room.game,
    pending: room.game.pending && { ...room.game.pending, answer: recipientId === readerId(room.game) ? room.game.pending.answer : '' },
  };
  return {
    type: 'room', code: room.code, hostId: room.hostId, maxPlayers: room.maxPlayers,
    players: room.members.map(m => ({ id: m.id, name: m.name, online: m.socket?.readyState === WebSocket.OPEN })),
    game, revision: room.revision, readerId: readerId(room.game),
  };
}

export function createRoomServer(options = {}) {
  const origins = options.origins ?? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_ORIGINS);
  const now = options.now ?? Date.now;
  const pickCard = options.pickCard ?? (() => randomInt(CLASSIC_CARDS.length));
  const graceMs = options.graceMs ?? 10 * 60_000;
  const roomTtl = options.roomTtl ?? 4 * 60 * 60_000;
  const maxRooms = options.maxRooms ?? 200;
  const rooms = new Map();
  function newCode() {
    for (let retry = 0; retry < 12; retry++) {
      const id = Array.from(randomBytes(6), n => ALPHABET[n % ALPHABET.length]).join('');
      if (!rooms.has(id)) return id;
    }
    throw new Error('Não foi possível criar uma sala.');
  }
  const broadcast = room => { for (const member of room.members) send(member.socket, snapshot(room, member.id)); };
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': origins[0] || 'null' });
      res.end(JSON.stringify({ status: 'ok', rules: 'mezuzah-classic-v2', rooms: rooms.size }));
    } else { res.writeHead(404); res.end('Not found'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (!origins.includes(req.headers.origin || '')) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    let bound = null;
    let messages = 0, windowStart = now();
    ws.on('message', raw => {
      try {
        const time = now();
        if (time - windowStart > 1000) { windowStart = time; messages = 0; }
        if (++messages > 12) throw new Error('Muitas ações por segundo.');
        const action = JSON.parse(raw.toString());
        if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.type !== 'string') throw new Error('Mensagem inválida.');
        if (action.type === 'create') {
          if (bound) throw new Error('Já conectado a uma sala.');
          if (rooms.size >= maxRooms) throw new Error('Servidor de salas lotado.');
          const name = safeName(action.name), max = action.maxPlayers;
          if (!name || !Number.isInteger(max) || max < 2 || max > 4) throw new Error('Informe o nome e escolha de 2 a 4 vagas.');
          const code = newCode();
          const member = { id: 'p0', name, token: token(), socket: ws, awaySince: null };
          const room = { code, maxPlayers: max, members: [member], hostId: member.id, game: null, revision: 0, updated: time };
          rooms.set(code, room); bound = { room, member };
          send(ws, { type: 'welcome', code, token: member.token, id: member.id }); broadcast(room); return;
        }
        if (action.type === 'join') {
          if (bound) throw new Error('Já conectado a uma sala.');
          const room = rooms.get(safeCode(action.code));
          if (!room) throw new Error('Sala inexistente ou expirada.');
          const name = safeName(action.name);
          if (!name) throw new Error('Informe seu nome.');
          if (room.game || room.members.length >= room.maxPlayers) throw new Error('Sala em andamento ou lotada.');
          if (room.members.some(m => m.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw new Error('Escolha um nome diferente dos demais participantes.');
          const member = { id: 'p' + room.members.length, name, token: token(), socket: ws, awaySince: null };
          room.members.push(member); room.updated = time; bound = { room, member };
          send(ws, { type: 'welcome', code: room.code, token: member.token, id: member.id }); broadcast(room); return;
        }
        if (action.type === 'resume') {
          if (bound) throw new Error('Já conectado a uma sala.');
          const room = rooms.get(safeCode(action.code));
          const member = typeof action.token === 'string' && action.token.length === 48 ? room?.members.find(m => m.token === action.token) : null;
          if (!room || !member) throw new Error('Não foi possível retomar esta sala.');
          if (member.socket && member.socket !== ws) { try { member.socket.close(4000, 'Sessão retomada'); } catch {} }
          member.socket = ws; member.awaySince = null; bound = { room, member }; room.updated = time;
          send(ws, { type: 'welcome', code: room.code, token: member.token, id: member.id }); broadcast(room); return;
        }
        if (!bound || !rooms.has(bound.room.code)) throw new Error('Crie ou entre numa sala válida.');
        const { room, member } = bound;
        if (member.socket !== ws) throw new Error('Sessão desatualizada.');
        if (!['start', 'restart', 'draw', 'choose', 'resolve'].includes(action.type)) throw new Error('Ação desconhecida.');
        if (!Number.isSafeInteger(action.expectedRevision) || action.expectedRevision !== room.revision || !Number.isSafeInteger(action.expectedRoundId) || action.expectedRoundId !== (room.game?.roundId ?? 0)) throw new Error('A sala foi atualizada. Confira a etapa atual antes de repetir a ação.');
        if (action.type === 'start' || action.type === 'restart') {
          if (room.hostId !== member.id) throw new Error('Somente o anfitrião pode iniciar ou reiniciar.');
          if (action.type === 'start' && room.game) throw new Error('Partida já iniciada.');
          if (action.type === 'restart' && !room.game) throw new Error('Inicie a primeira partida antes de pedir revanche.');
          if (room.members.length < 2 || room.members.some(m => m.socket?.readyState !== WebSocket.OPEN)) throw new Error('Aguarde pelo menos dois participantes conectados.');
          if (!action.route || typeof action.route !== 'object' || Array.isArray(action.route)) throw new Error('Configure os percursos do tabuleiro físico.');
          room.game = createClassicGame(room.members.map(m => m.name), { oldestIndex: action.oldestIndex, outerSteps: action.route.outerSteps, starSteps: action.route.starSteps });
        } else {
          if (!room.game || room.game.phase === 'finished') throw new Error('Não há partida em andamento.');
          if (action.type === 'draw') {
            if (member.id !== readerId(room.game)) throw new Error('Somente o leitor desta rodada pode retirar um cartão.');
            room.game = drawCard(room.game, pickCard());
          } else if (action.type === 'choose') {
            if (member.id !== room.game.players[room.game.turn].id) throw new Error('Somente o participante da vez escolhe o número.');
            room.game = chooseNumber(room.game, action.number);
          } else {
            if (member.id !== readerId(room.game)) throw new Error('Somente o leitor pode registrar o resultado observado.');
            if (action.winnerId !== null && typeof action.winnerId !== 'string') throw new Error('Informe um participante elegível ou nenhum acerto.');
            room.game = resolveChallenge(room.game, action.winnerId);
          }
        }
        room.revision++; room.updated = time; broadcast(room);
      } catch (error) {
        send(ws, { type: 'error', message: error instanceof Error ? error.message : 'Ação inválida.' });
        if (bound && rooms.has(bound.room.code) && bound.member.socket === ws) send(ws, snapshot(bound.room, bound.member.id));
      }
    });
    ws.on('close', () => {
      if (!bound) return;
      const { room, member } = bound;
      if (member.socket !== ws) return;
      member.socket = null; member.awaySince = now(); room.updated = now();
      if (!room.game) {
        room.members = room.members.filter(m => m !== member);
        const host = room.members.find(m => m.id === room.hostId) ?? room.members[0];
        room.members.forEach((m, i) => { m.id = 'p' + i; }); room.hostId = host?.id ?? null;
        for (const m of room.members) send(m.socket, { type: 'welcome', code: room.code, token: m.token, id: m.id });
        if (!room.members.length) rooms.delete(room.code);
      }
      if (rooms.has(room.code)) broadcast(room);
    });
    ws.on('error', () => {});
  });
  function expireRooms() {
    const time = now();
    for (const [code, room] of rooms) {
      const anyOnline = room.members.some(m => m.socket?.readyState === WebSocket.OPEN);
      if (time - room.updated > roomTtl || (!anyOnline && room.members.every(m => m.awaySince !== null && time - m.awaySince > graceMs))) {
        rooms.delete(code);
        for (const member of room.members) { try { member.socket?.close(4001, 'Sala expirada'); } catch {} }
      }
    }
  }
  const cleanup = setInterval(expireRooms, options.cleanupIntervalMs ?? 60_000);
  cleanup.unref();
  return {
    server,
    async listen(port = Number(process.env.PORT || 8787), host) {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); });
      return server.address();
    },
    async close() {
      clearInterval(cleanup);
      for (const client of wss.clients) client.terminate();
      await new Promise(resolve => wss.close(resolve));
      if (server.listening) await new Promise(resolve => server.close(resolve));
    },
    expireRooms,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const service = createRoomServer();
  const address = await service.listen();
  console.log('Mezuzá clássico: salas na porta ' + address.port);
  const stop = async () => { await service.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createRoomServer } from './server.mjs';
import { CLASSIC_CARDS, isClassicGame, isClassicSnapshot } from '../pwa/src/games/mezuzah-classic/engine.ts';

const ORIGIN = 'http://localhost:5173';
class Peer {
  constructor(ws) {
    this.ws = ws; this.inbox = []; this.waiters = []; this.room = null; this.welcome = null;
    ws.on('message', raw => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'room') this.room = data;
      if (data.type === 'welcome') this.welcome = data;
      const index = this.waiters.findIndex(w => w.match(data));
      if (index >= 0) { const waiter = this.waiters.splice(index, 1)[0]; clearTimeout(waiter.timer); waiter.resolve(data); }
      else this.inbox.push(data);
    });
  }
  send(action) { this.ws.send(JSON.stringify(action)); }
  next(type, predicate = () => true) {
    const match = data => data.type === type && predicate(data);
    const index = this.inbox.findIndex(match);
    if (index >= 0) return Promise.resolve(this.inbox.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve, timer: null };
      waiter.timer = setTimeout(() => { this.waiters = this.waiters.filter(w => w !== waiter); reject(new Error('Esperava mensagem ' + type)); }, 3000);
      this.waiters.push(waiter);
    });
  }
  action(type, extra = {}) {
    this.send({ type, expectedRevision: this.room?.revision ?? 0, expectedRoundId: this.room?.game?.roundId ?? 0, ...extra });
  }
  async error(type, extra = {}) { this.action(type, extra); return (await this.next('error')).message; }
}
async function fixture(t, count = 2, extra = {}) {
  let clock = 0;
  const service = createRoomServer({ origins: [ORIGIN], pickCard: () => 0, now: () => (clock += 1100), ...extra });
  const address = await service.listen(0, '127.0.0.1');
  const url = `ws://127.0.0.1:${address.port}`;
  const peers = [];
  async function connect() {
    const ws = new WebSocket(url, { origin: ORIGIN });
    const peer = new Peer(ws); peers.push(peer); await once(ws, 'open'); return peer;
  }
  t.after(async () => { for (const p of peers) for (const w of p.waiters) clearTimeout(w.timer); await service.close(); });
  const host = await connect();
  host.send({ type: 'create', name: 'Ana', maxPlayers: Math.max(2, count) });
  const welcome = await host.next('welcome'); await host.next('room');
  const users = [host];
  for (let i = 1; i < count; i++) {
    const peer = await connect();
    peer.send({ type: 'join', code: welcome.code, name: ['Ana', 'Bia', 'Caio', 'Davi'][i] });
    await peer.next('welcome'); await peer.next('room', r => r.players.length === i + 1);
    await host.next('room', r => r.players.length === i + 1); users.push(peer);
  }
  async function started(oldestIndex = 0, route = { outerSteps: 3, starSteps: 3 }) {
    host.action('start', { oldestIndex, route });
    await Promise.all(users.map(p => p.next('room', r => r.revision === 1)));
  }
  async function mutation(peer, type, data = {}) {
    const revision = peer.room.revision + 1;
    peer.action(type, data);
    return Promise.all(users.filter(p => p.ws.readyState === WebSocket.OPEN).map(p => p.next('room', r => r.revision === revision)));
  }
  return { host, users, url, connect, welcome, started, mutation, service };
}

test('salas reais criam, entram e configuram o mais velho; snapshots não expõem tokens', async t => {
  const f = await fixture(t);
  assert.equal(f.host.welcome.code.length, 6);
  assert.equal(f.users[1].welcome.id, 'p1');
  assert.equal(JSON.stringify(f.users[1].room).includes(f.host.welcome.token), false);
  assert.equal(f.users[1].room.game, null);
  await f.started(1);
  assert.equal(f.host.room.game.turn, 1);
  assert.equal(f.host.room.readerId, 'p0');
  assert.equal(isClassicGame(f.host.room.game), true);
  const stranger = await f.connect();
  stranger.send({ type: 'join', code: f.welcome.code, name: 'Extra' });
  assert.match((await stranger.next('error')).message, /andamento ou lotada/);
});

test('autoridade do servidor bloqueia turno, monitor, fase, configuração e vencedor inválidos', async t => {
  const f = await fixture(t); const [host, guest] = f.users;
  assert.match(await guest.error('start', { oldestIndex: 0, route: { outerSteps: 3, starSteps: 3 } }), /anfitrião/);
  assert.match(await host.error('start', { oldestIndex: 0, route: { outerSteps: 1, starSteps: 3 } }), /percursos/);
  await f.started();
  assert.match(await host.error('draw'), /leitor/);
  assert.match(await guest.error('resolve', { winnerId: 'p0' }), /etapa/);
  await f.mutation(guest, 'draw');
  assert.equal(host.room.game.phase, 'choose');
  assert.match(await guest.error('choose', { number: 1 }), /participante da vez/);
  assert.match(await host.error('choose', { number: 11 }), /1 a 10/);
  await f.mutation(host, 'choose', { number: 1 });
  assert.match(await host.error('resolve', { winnerId: 'p0' }), /leitor/);
  assert.match(await guest.error('resolve', { winnerId: 'p1' }), /não pode responder/);
  assert.match(await guest.error('resolve', { winnerId: undefined }), /elegível/);
  await f.mutation(guest, 'resolve', { winnerId: 'p0' });
  assert.equal(host.room.game.players[0].steps, 1);
  assert.equal(host.room.game.history.length, 1);
});

test('só o leitor recebe o gabarito e o cliente recebe snapshot público canônico', async t => {
  const f = await fixture(t); const [host, guest] = f.users;
  await f.started(); await f.mutation(guest, 'draw'); await f.mutation(host, 'choose', { number: 1 });
  assert.equal(guest.room.game.pending.answer, CLASSIC_CARDS[0].activities[0].answer);
  assert.equal(host.room.game.pending.answer, '');
  assert.equal(isClassicGame(guest.room.game), true);
  assert.equal(isClassicGame(host.room.game), false);
  assert.equal(isClassicSnapshot(host.room.game), true);
  assert.equal(host.room.game.pending.prompt, guest.room.game.pending.prompt);
  assert.equal(JSON.stringify(host.room).includes('Noé.'), false);
});

test('desafio coletivo premia elegível fora da vez e exclui o leitor', async t => {
  const f = await fixture(t, 3); const [host, guest, reader] = f.users;
  await f.started(); await f.mutation(reader, 'draw'); await f.mutation(host, 'choose', { number: 3 });
  assert.equal(host.room.game.pending.scope, 'collective');
  assert.match(await reader.error('resolve', { winnerId: 'p2' }), /não pode responder/);
  await f.mutation(reader, 'resolve', { winnerId: guest.welcome.id });
  assert.equal(host.room.game.players[1].steps, 1);
  assert.equal(host.room.game.players[0].steps, 0);
  assert.equal(host.room.game.turn, 1);
});

test('revision e round bloqueiam mensagens repetidas, respostas antigas e ações de antes da revanche', async t => {
  const f = await fixture(t); const [host, guest] = f.users;
  await f.started();
  const oldRevision = guest.room.revision;
  await f.mutation(guest, 'draw');
  assert.match(await guest.error('draw', { expectedRevision: oldRevision }), /atualizada/);
  const chooseRevision = host.room.revision;
  await f.mutation(host, 'choose', { number: 1 });
  assert.match(await guest.error('resolve', { winnerId: 'p0', expectedRevision: chooseRevision }), /atualizada/);
  await f.mutation(guest, 'resolve', { winnerId: null });
  assert.match(await host.error('draw', { expectedRoundId: 0 }), /atualizada/);
  assert.match(await guest.error('restart', { oldestIndex: 0, route: { outerSteps: 3, starSteps: 3 } }), /anfitrião/);
  const beforeRestart = host.room.revision;
  await f.mutation(host, 'restart', { oldestIndex: 1, route: { outerSteps: 3, starSteps: 4 } });
  assert.equal(host.room.game.roundId, 0);
  assert.equal(host.room.game.turn, 1);
  assert.match(await host.error('draw', { expectedRevision: beforeRestart, expectedRoundId: 0 }), /atualizada/);
});

test('sessões podem ser retomadas; token inválido falha e conexão antiga é revogada', async t => {
  const f = await fixture(t); const [host, guest] = f.users;
  await f.started();
  const invalid = await f.connect();
  invalid.send({ type: 'resume', code: f.welcome.code, token: '0'.repeat(48) });
  assert.match((await invalid.next('error')).message, /retomar/);
  const resumed = await f.connect();
  const closed = once(guest.ws, 'close');
  resumed.send({ type: 'resume', code: f.welcome.code, token: guest.welcome.token });
  const welcome = await resumed.next('welcome'); await resumed.next('room');
  assert.equal(welcome.id, 'p1');
  assert.equal(welcome.token, guest.welcome.token);
  assert.equal((await closed)[0], 4000);
  const gone = once(resumed.ws, 'close'); resumed.ws.close(); await gone;
  await host.next('room', r => r.players[1].online === false);
  assert.match(await host.error('restart', { oldestIndex: 0, route: { outerSteps: 3, starSteps: 3 } }), /conectados/);
  const again = await f.connect();
  again.send({ type: 'resume', code: f.welcome.code, token: welcome.token });
  await again.next('welcome'); await again.next('room');
  assert.equal(again.room.game.roundId, 0);
});

test('vitória ao centro encerra novas ações e revanche cria outra partida autoritativa', async t => {
  const f = await fixture(t); const [host, guest] = f.users;
  await f.started();
  while (host.room.game.phase !== 'finished') {
    const current = host.room.game.players[host.room.game.turn].id === 'p0' ? host : guest;
    const reader = current === host ? guest : host;
    await f.mutation(reader, 'draw');
    await f.mutation(current, 'choose', { number: 1 });
    await f.mutation(reader, 'resolve', { winnerId: current === host ? 'p0' : null });
  }
  assert.equal(host.room.game.winner, 'p0');
  assert.equal(host.room.game.players[0].steps, 7);
  assert.equal(isClassicGame(host.room.game), true);
  assert.match(await guest.error('draw'), /andamento/);
  await f.mutation(host, 'restart', { oldestIndex: 0, route: { outerSteps: 3, starSteps: 3 } });
  assert.equal(host.room.game.phase, 'draw');
  assert.equal(host.room.game.players[0].steps, 0);
  assert.equal(host.room.game.history.length, 0);
});

test('saída do anfitrião no lobby reorganiza assentos para o motor', async t => {
  const f = await fixture(t); const [host, guest] = f.users;
  const closed = once(host.ws, 'close'); host.ws.close(); await closed;
  await guest.next('welcome', m => m.id === 'p0');
  await guest.next('room', m => m.hostId === 'p0' && m.players.length === 1);
  const joined = await f.connect();
  joined.send({ type: 'join', code: f.welcome.code, name: 'Nova' });
  await joined.next('welcome'); await guest.next('room', m => m.players.length === 2);
  guest.action('start', { oldestIndex: 0, route: { outerSteps: 3, starSteps: 3 } });
  const room = await guest.next('room', m => m.revision === 1);
  assert.equal(room.game.players[0].name, 'Bia');
  assert.equal(room.game.players[1].id, 'p1');
});

test('origens não autorizadas e salas expiradas não aceitam ações', async t => {
  const f = await fixture(t, 2, { roomTtl: 1500 });
  const refused = new WebSocket(f.url, { origin: 'https://unauthorized.invalid' });
  const err = await new Promise(resolve => refused.once('error', resolve));
  assert.match(err.message, /403/);
  f.service.expireRooms();
  // The injected clock advances on every received action; force stale room expiry.
  f.service.expireRooms();
  const expired = await f.connect();
  expired.send({ type: 'resume', code: f.welcome.code, token: f.welcome.token });
  assert.match((await expired.next('error')).message, /retomar/);
});

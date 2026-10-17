import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

// Outgoing clients only: this check never starts or exposes a local server.
const endpoint = process.argv[2];
assert(endpoint && new URL(endpoint).protocol === 'wss:', 'Pass the deployed WSS endpoint');
const clients = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function client(hello) {
  const socket = new WebSocket(endpoint, { handshakeTimeout: 10000 });
  socket.received = [];
  socket.on('message', data => socket.received.push(data.toString()));
  clients.push(socket);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  socket.send(hello);
  return socket;
}
async function expect(socket, prefix) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const index = socket.received.findIndex(message => message.startsWith(prefix));
    if (index >= 0) return socket.received.splice(index, 1)[0];
    await pause(20);
  }
  throw new Error('Missing public packet: ' + prefix);
}
try {
  const healthUrl = new URL('/health', endpoint.replace(/^wss:/, 'https:'));
  const response = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
  const health = await response.json();
  assert(response.ok && health.ready && health.protocol === 5, 'Actual relay health');
  const host = await client('CREATE|05');
  const code = (await expect(host, 'WELCOME|')).split('|')[1];
  assert.match(code, /^[A-F0-9]{8}$/);
  host.send('P|host|Host|0|0|0|0|0|0|1|3|1');
  const a = await client('JOIN|' + code);
  const b = await client('JOIN|' + code);
  const c = await client('JOIN|' + code);
  for (const socket of [a, b, c]) await expect(socket, 'WELCOME|' + code);
  const full = await client('JOIN|' + code);
  await expect(full, 'ERROR|La sala está llena');
  a.send('P|alice|Alice|1|2|0|0|0|0|1|2|1');
  await expect(host, 'P|alice');
  await expect(b, 'P|alice');
  a.send('M|alice|4');
  await expect(host, 'M|alice|4');
  // Synthetic silent PCM validates transport only, not a microphone conversation.
  a.send('V|alice|0|' + Buffer.alloc(960).toString('base64'));
  await expect(b, 'V|alice|0|');
  a.send('E|forged');
  a.send('M|host|2');
  host.send('H|15|3');
  await expect(b, 'H|15|3');
  await pause(300);
  assert(!b.received.some(message => message === 'E|forged' || message === 'M|host|2'));
  const other = await client('CREATE|05');
  const otherCode = (await expect(other, 'WELCOME|')).split('|')[1];
  assert.notEqual(code, otherCode);
  host.send('H|ROOM_ISOLATION');
  await expect(a, 'H|ROOM_ISOLATION');
  await pause(300);
  assert(!other.received.includes('H|ROOM_ISOLATION'), 'Rooms stay isolated');
  await pause(12000);
  a.send('M|alice|5');
  await expect(host, 'M|alice|5');
  host.close();
  await expect(a, 'ERROR|Se perdió la conexión con el anfitrión');
  console.log('UMBRAL_PUBLIC_RELAY_PASS: HTTPS health, WSS/TLS, four seats, room isolation, PCM relay, emojis, authority, identity, idle recovery, host disconnect');
} finally {
  for (const socket of clients) socket.terminate();
}

import { WebSocket } from 'ws';
const endpoint = process.argv[2];
if (!endpoint || new URL(endpoint).protocol !== 'wss:') throw new Error('Pass WSS endpoint');
const url = new URL('/health', endpoint.replace(/^wss:/, 'https:'));
const health = async () => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    return { status: response.status, body: (await response.text()).slice(0, 500) };
  } catch (error) { return { error: error.message }; }
};
const websocket = () => new Promise(resolve => {
  const socket = new WebSocket(endpoint, { handshakeTimeout: 12000 });
  socket.once('open', () => { socket.close(); resolve({ connected: true }); });
  socket.once('unexpected-response', (_, response) => {
    response.resume(); socket.terminate();
    resolve({ connected: false, status: response.statusCode });
  });
  socket.once('error', error => resolve({ connected: false, error: error.message }));
});
const [http, ws] = await Promise.all([health(), websocket()]);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), endpoint, http, websocket: ws }, null, 2));
if (http.status !== 200 || !ws.connected) process.exitCode = 1;

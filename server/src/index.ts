import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { TICK_MS, decodeClient, encode, type ServerMsg } from '@magicka/shared';
import { Auth, type AuthOk } from './auth';
import { Db } from './db';
import type { Player } from './types';
import { World } from './world';
const env = process.env, prod = env.NODE_ENV === 'production', dev = env.MAGICKA_DEV === '1';
if (prod && dev) { console.error('MAGICKA_DEV must not be set in production.'); process.exit(1); }
const PORT = Number(env.PORT ?? 3000);
const origins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : null;
const db = new Db(env.DB_PATH ?? 'magicka.db'), auth = new Auth(db), world = new World(db, Math.random, dev, dev ? 200 : undefined);
const root = resolve(env.CLIENT_DIR ?? 'client/dist');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const http = createServer((req, res) => {
  let path: string; try { path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])); } catch { res.writeHead(400).end(); return; }
  if (path === '/health') { res.end('ok'); return; }
  let f = resolve(join(root, path)); if (f !== root && !f.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  if (f === root) f = join(root, 'index.html');
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
  createReadStream(f).pipe(res);
});
const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 4096, verifyClient: ({ req, origin }: { req: import('node:http').IncomingMessage; origin: string }) => {
  if (origins) return origins.includes(origin);
  if (!prod) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
} });
const tries = new Map<string, { n: number; reset: number }>();
function authLimited(ip: string) { const now = Date.now(); let t = tries.get(ip); if (!t || t.reset < now) tries.set(ip, (t = { n: 0, reset: now + 60_000 })); return ++t.n > (dev ? 1000 : 12); }
setInterval(() => { for (const [k, t] of tries) if (t.reset < Date.now()) tries.delete(k); }, 60_000).unref();
wss.on('connection', (ws, req) => {
  let player: Player | null = null, token = '', busy = false, tokens = 30, last = Date.now();
  const ip = req.socket.remoteAddress ?? '?';
  const send = (m: ServerMsg) => { if (ws.readyState !== WebSocket.OPEN) return; if (ws.bufferedAmount > 2_000_000) return ws.terminate(); ws.send(encode(m)); if (m.t === 'kicked') ws.close(); };
  const enter = (r: AuthOk | string) => {
    if (typeof r === 'string') return send({ t: 'error', msg: r });
    if (ws.readyState !== WebSocket.OPEN) return;
    token = r.token; send({ t: 'welcome', token, id: `p${r.account}` });
    player = world.join(r.account, r.name, db.load(r.account), send);
  };
  const timeout = setTimeout(() => { if (!player) ws.close(); }, 300_000);
  ws.on('message', async raw => {
    const now = Date.now(); tokens = Math.min(30, tokens + ((now - last) / 1000) * 15); last = now;
    if (tokens < 1) return; tokens--;
    const m = decodeClient(raw.toString()); if (!m) return;
    if (m.t === 'register' || m.t === 'login' || m.t === 'resume') {
      if (player || busy) return;
      if (authLimited(ip)) return send({ t: 'error', msg: 'Too many attempts. Wait a minute.' });
      busy = true;
      try { enter(m.t === 'register' ? await auth.register(m.name, m.pw) : m.t === 'login' ? await auth.login(m.name, m.pw) : auth.resume(m.token)); }
      catch (e) { console.error(e); send({ t: 'error', msg: 'Something went wrong.' }); } finally { busy = false; }
      return;
    }
    if (!player || player.send !== send) return;
    if (m.t === 'logout') { auth.revoke(token); ws.close(); return; }
    world.enqueue(player.id, m);
  });
  ws.on('close', () => { clearTimeout(timeout); if (player) world.leave(player, send); });
  ws.on('error', () => ws.terminate());
});
export const tickTimes: number[] = [];
let next = Date.now() + TICK_MS;
function loop() {
  const t = performance.now();
  try { world.step(); } catch (e) { console.error('tick failed', e); }
  tickTimes.push(performance.now() - t); if (tickTimes.length > 500) tickTimes.shift();
  if (env.TICK_STATS && world.tick % 50 === 0) { const s = [...tickTimes].sort((a, b) => a - b); console.log(`tick p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)}ms max ${s.at(-1)!.toFixed(1)}ms players ${world.players.size}`); }
  next += TICK_MS; if (next < Date.now()) next = Date.now() + TICK_MS;
  setTimeout(loop, next - Date.now());
}
http.listen(PORT, () => { console.log(`listening on http://localhost:${PORT}${dev ? ' (dev commands on)' : ''}`); setTimeout(loop, TICK_MS); });
let down = false;
function shutdown() { if (down) return; down = true; world.save(world.players.values()); db.close(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

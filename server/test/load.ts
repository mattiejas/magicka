// 100 headless clients: npm run loadtest [-- seconds]. Starts its own server on a temporary database.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { MAPS } from '@magicka/shared';
const secs = Number(process.argv[2] ?? 300), N = 100, PORT = '3999', dir = mkdtempSync(join(tmpdir(), 'magicka-'));
const srv = spawn('npx', ['tsx', 'server/src/index.ts'], { env: { ...process.env, NODE_ENV: '', PORT, DB_PATH: join(dir, 'l.db'), MAGICKA_DEV: '1', TICK_STATS: '1' } });
let last = '', errs = 0; srv.stdout.on('data', d => { last = String(d).trim(); }); srv.stderr.on('data', d => { errs++; console.error(String(d)); });
await new Promise(r => setTimeout(r, 3000));
let bytes = 0, joined = 0; const island = MAPS.island, pick = <X>(a: X[]) => a[Math.floor(Math.random() * a.length)], socks: WebSocket[] = [];
for (let i = 0; i < N; i++) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`); socks.push(ws);
  ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name: `bot_${i}`, pw: 'load-test-bot' })));
  ws.on('message', d => { bytes += (d as Buffer).length; if (String(d).startsWith('{"t":"welcome"')) joined++; });
  setInterval(() => { if (ws.readyState !== 1) return; const r = Math.random(); ws.send(JSON.stringify(r < 0.4 ? { t: 'gather', id: pick(island.nodes).id } : r < 0.8 ? { t: 'move', x: 10 + Math.floor(Math.random() * 44), y: 10 + Math.floor(Math.random() * 44) } : { t: 'attack', id: `island:m${Math.floor(Math.random() * 15)}` })); }, 2000);
  await new Promise(r => setTimeout(r, 40));
}
const start = bytes; await new Promise(r => setTimeout(r, secs * 1000));
const p95 = Number(/p95 ([\d.]+)/.exec(last)?.[1]);
console.log(`joined ${joined}/${N}; ${last}; ${((bytes - start) / secs / N / 1024).toFixed(1)} KB/s per client; server errors ${errs}`);
srv.kill('SIGTERM'); await new Promise(r => setTimeout(r, 500)); rmSync(dir, { recursive: true });
process.exit(joined === N && p95 < 50 && !errs ? 0 : 1);

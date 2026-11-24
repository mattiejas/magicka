import type { ClientMsg, Ent, SelfState, ServerMsg } from '@magicka/shared';
import type { Entity } from './pb/driftwake/v1/game_pb';
import { decode, encode, idOf, mergeEntity } from './wire';
export interface Track {
  e: Ent;
  from: [number, number];
  path: [number, number][];
  at: number;
  seen: number;
}
export const state = {
  me: '',
  self: null as SelfState | null,
  ents: new Map<string, Track>(),
  tick: 0,
  tickAt: 0,
  boss: { alive: false, next: 0, contrib: 0, online: 0, at: 0 },
  connected: false,
};
type Handler = (m: ServerMsg) => void;
const handlers: Handler[] = [];
export const onMsg = (h: Handler) => {
  handlers.push(h);
};
let ws: WebSocket | null = null,
  token = sessionStorage.getItem('token') ?? '',
  retry = 0,
  stopped = false,
  closed: (why: string) => void = () => {};
export const onClosed = (f: (why: string) => void) => {
  closed = f;
};
export const hasToken = () => !!token;
export function connect(first: ClientMsg) {
  ws?.close();
  stopped = false;
  const s = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`));
  s.binaryType = 'arraybuffer';
  s.onopen = () => s.send(encode(first));
  s.onmessage = ev => {
    if (s !== ws) return;
    const m = decode(ev.data);
    if (m) receive(m);
  };
  s.onclose = () => {
    if (s !== ws) return;
    state.connected = false;
    if (stopped || !token || !state.me) {
      state.me = '';
      closed('');
      return;
    }
    closed('Connection lost. Reconnecting.');
    if (retry++ < 20) setTimeout(() => connect({ t: 'resume', token }), Math.min(5000, 500 * retry));
  };
}
export const resume = () => connect({ t: 'resume', token });
export const send = (m: ClientMsg) => {
  if (ws?.readyState === 1 && state.connected) ws.send(encode(m));
};
export function forget() {
  token = '';
  sessionStorage.removeItem('token');
  stopped = true;
  state.me = '';
  state.self = null;
  state.ents.clear();
}
export function logout() {
  send({ t: 'logout' });
  forget();
  ws?.close();
}
export const tickNow = () => state.tick + Math.min(1, (performance.now() - state.tickAt) / 600);
function receive(m: ServerMsg) {
  if (m.t === 'welcome') {
    state.me = m.id;
    token = m.token;
    sessionStorage.setItem('token', token);
    state.connected = true;
    retry = 0;
    state.ents.clear();
  } else if (m.t === 'kicked') forget();
  else if (m.t === 'error' && !state.connected) {
    if (state.me || m.msg === 'Session expired.') forget();
  } else if (m.t === 'self') state.self = m.s;
  else if (m.t === 'boss') state.boss = { ...m, at: performance.now() };
  else if (m.t === 'snap') {
    const now = performance.now();
    state.tick = m.tick;
    state.tickAt = now;
    if (m.reset) state.ents.clear();
    for (const id of m.gone) state.ents.delete(id);
    for (const raw of m.raw as Entity[]) {
      const o = state.ents.get(idOf(raw.id));
      if (!o && !raw.full) continue;
      const e = mergeEntity(o?.e, raw);
      const moved = o && (o.e.x !== e.x || o.e.y !== e.y),
        far = o && Math.max(Math.abs(o.e.x - e.x), Math.abs(o.e.y - e.y)) > 3;
      if (!o) state.ents.set(e.id, { e, from: [e.x, e.y], path: [], at: now, seen: now });
      else {
        if (moved) {
          o.from = far ? [e.x, e.y] : [o.e.x, o.e.y];
          o.path = far ? [] : (e.via ?? [[e.x, e.y]]);
          o.at = now;
        }
        o.e = e;
      }
    }
  }
  for (const h of handlers) h(m);
}
/** Interpolated tile position. */
export function posOf(t: Track): [number, number] {
  if (!t.path.length) return [t.e.x, t.e.y];
  const k = Math.min(1, (performance.now() - t.at) / 600) * t.path.length,
    i = Math.min(t.path.length - 1, Math.floor(k)),
    f = Math.min(1, k - i);
  const a = i ? t.path[i - 1] : t.from,
    b = t.path[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
export const moving = (t: Track) => t.path.length > 0 && performance.now() - t.at < 640;

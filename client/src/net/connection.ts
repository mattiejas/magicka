// The WebSocket connection: signing in, reconnecting, and applying what the server sends to the state.
import type { ClientMsg, Entity, ServerMsg } from '@driftwake/shared';
import type { Entity as PbEntity } from '../pb/driftwake/v1/game_pb';
import { state, type Track } from './state';
import { clientId, decode, encode, mergeEntity } from './wire';

const TOKEN_KEY = 'token';
const MAX_RETRIES = 20;
/** A jump further than this is a teleport, not a walk. */
const MAX_WALK_TILES = 3;

let socket: WebSocket | null = null;
let token = sessionStorage.getItem(TOKEN_KEY) ?? '';
let retries = 0;
let signedOut = false;

const listeners: ((msg: ServerMsg) => void)[] = [];
let onClose: (reason: string) => void = () => {};

/** Called after the state has been updated. */
export const onMessage = (listener: (msg: ServerMsg) => void) => void listeners.push(listener);
/** Called with a reason while reconnecting, or with nothing when there is no session to go back to. */
export const onClosed = (handler: (reason: string) => void) => {
  onClose = handler;
};

export const hasSession = () => !!token;
export const resume = () => connect({ type: 'resume', token });

export function connect(first: ClientMsg) {
  socket?.close();
  signedOut = false;
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const current = new WebSocket(`${scheme}://${location.host}/ws`);
  socket = current;
  current.binaryType = 'arraybuffer';
  current.onopen = () => current.send(encode(first));
  current.onmessage = event => {
    if (current !== socket) return;
    const msg = decode(event.data);
    if (msg) receive(msg);
  };
  current.onclose = () => {
    if (current === socket) handleClose();
  };
}

function handleClose() {
  state.connected = false;
  if (signedOut || !token || !state.me) {
    state.me = '';
    onClose('');
    return;
  }
  onClose('Connection lost. Reconnecting.');
  if (retries++ < MAX_RETRIES) setTimeout(resume, Math.min(5000, 500 * retries));
}

export function send(msg: ClientMsg) {
  if (socket?.readyState === WebSocket.OPEN && state.connected) socket.send(encode(msg));
}

export function logout() {
  send({ type: 'logout' });
  forgetSession();
  socket?.close();
}

function forgetSession() {
  token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  signedOut = true;
  state.me = '';
  state.self = null;
  state.entities.clear();
}

function receive(msg: ServerMsg) {
  switch (msg.type) {
    case 'welcome':
      state.me = msg.id;
      state.connected = true;
      state.entities.clear();
      token = msg.token;
      sessionStorage.setItem(TOKEN_KEY, token);
      retries = 0;
      break;
    case 'kicked':
      forgetSession();
      break;
    case 'error':
      if (!state.connected && (state.me || msg.text === 'Session expired.')) forgetSession();
      break;
    case 'self':
      state.self = msg.self;
      break;
    case 'boss':
      state.boss = { ...msg, receivedAt: performance.now() };
      break;
    case 'snapshot':
      applySnapshot(msg);
      break;
  }
  for (const listener of listeners) listener(msg);
}

function applySnapshot(snapshot: Extract<ServerMsg, { type: 'snapshot' }>) {
  const now = performance.now();
  state.tick = snapshot.tick;
  state.tickAt = now;
  if (snapshot.reset) state.entities.clear();
  for (const id of snapshot.gone) state.entities.delete(id);
  for (const delta of snapshot.entities as PbEntity[]) {
    const track = state.entities.get(clientId(delta.id));
    if (!track && !delta.full) continue; // nothing to apply it to
    const entity = mergeEntity(track?.entity, delta);
    if (track) moveTrack(track, entity, now);
    else state.entities.set(entity.id, { entity, from: [entity.x, entity.y], path: [], movedAt: now });
  }
}

function moveTrack(track: Track, entity: Entity, now: number) {
  const dx = Math.abs(track.entity.x - entity.x);
  const dy = Math.abs(track.entity.y - entity.y);
  if (dx || dy) {
    const teleported = Math.max(dx, dy) > MAX_WALK_TILES;
    track.from = teleported ? [entity.x, entity.y] : [track.entity.x, track.entity.y];
    track.path = teleported ? [] : (entity.via ?? [[entity.x, entity.y]]);
    track.movedAt = now;
  }
  track.entity = entity;
}

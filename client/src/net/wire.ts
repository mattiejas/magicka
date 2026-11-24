// Translates between the protobuf messages on the wire and the types the rest of the client uses.
import { create, fromBinary, toBinary, toJsonString } from '@bufbuild/protobuf';
import {
  type ClientMsg,
  type Entity,
  type EntityKind,
  type GameEvent,
  INV_SIZE,
  MAPS,
  type MapId,
  type SelfState,
  type ServerMsg,
  SKILLS,
  type Skill,
  SLOTS,
  type Stack,
  type StationType,
  type TilePos,
} from '@magicka/shared';
import {
  BossState,
  ClientMessageSchema,
  type BossView as PbBossView,
  type Entity as PbEntity,
  type Event as PbEvent,
  InfoKind as PbInfo,
  EntityKind as PbKind,
  MapId as PbMap,
  type Self as PbSelf,
  type Snapshot as PbSnapshot,
  type Stack as PbStack,
  ServerMessageSchema,
} from '../pb/driftwake/v1/game_pb';

const logMessages = import.meta.env.DEV && new URLSearchParams(location.search).has('messages');

// --- ids
// On the wire an id is a number whose low three bits are its kind. In the client, nodes and stations keep their
// map id, the grave is "grave", and everything else is the number as text.
const NODE_IDS = Object.values(MAPS).flatMap(map => map.nodes.map(node => node.id));
const STATION_IDS = Object.values(MAPS).flatMap(map => map.stations.map(station => station.id));

const wireId = (kind: PbKind, index: number) => ((index << 3) | kind) >>> 0;

export function clientId(id: number): string {
  switch (id & 7) {
    case PbKind.NODE:
      return NODE_IDS[id >>> 3];
    case PbKind.STATION:
      return STATION_IDS[id >>> 3];
    case PbKind.GRAVE:
      return 'grave';
    default:
      return String(id);
  }
}

// --- enums
const KINDS: Record<number, EntityKind> = {
  [PbKind.PLAYER]: 'player',
  [PbKind.MONSTER]: 'monster',
  [PbKind.NODE]: 'node',
  [PbKind.DROP]: 'drop',
  [PbKind.GRAVE]: 'grave',
};
const BOSS_STATES = {
  [BossState.UNSPECIFIED]: 'choose',
  [BossState.CHOOSE]: 'choose',
  [BossState.WINDUP]: 'windup',
  [BossState.EXECUTE]: 'execute',
} as const;
const INFO_KINDS = {
  [PbInfo.UNSPECIFIED]: undefined,
  [PbInfo.UNIQUE]: 'unique',
  [PbInfo.BOSS]: 'boss',
  [PbInfo.LEVEL]: 'level',
  [PbInfo.BAD]: 'bad',
} as const;
const mapId = (map: PbMap): MapId => (map === PbMap.MAINLAND ? 'mainland' : 'island');

// --- client to server
/** The message's case and value, as the generated code names them. */
function payload(msg: ClientMsg): { case: string; value: unknown } {
  switch (msg.type) {
    case 'register':
    case 'login':
      return { case: msg.type, value: { name: msg.name, password: msg.password } };
    case 'resume':
      return { case: 'resumeToken', value: msg.token };
    case 'logout':
    case 'grave':
    case 'claim':
    case 'depositAll':
      return { case: msg.type, value: {} };
    case 'move':
      return { case: 'move', value: { x: msg.x, y: msg.y } };
    case 'gather':
      return { case: 'gather', value: wireId(PbKind.NODE, NODE_IDS.indexOf(msg.id)) };
    case 'station':
      return { case: 'station', value: wireId(PbKind.STATION, STATION_IDS.indexOf(msg.id)) };
    case 'attack':
    case 'pickup':
      return { case: msg.type, value: Number(msg.id) };
    case 'craft':
      return { case: 'craft', value: { recipe: msg.recipe, qty: msg.qty } };
    case 'equip':
      return { case: 'equipSlot', value: msg.slot };
    case 'eat':
      return { case: 'eatSlot', value: msg.slot };
    case 'drop':
      return { case: 'dropSlot', value: msg.slot };
    case 'unequip':
      return { case: 'unequip', value: SLOTS.indexOf(msg.slot) + 1 };
    case 'swap':
      return { case: 'swap', value: { a: msg.a, b: msg.b } };
    case 'bank':
      return { case: 'bank', value: { withdraw: msg.op === 'withdraw', item: msg.item, qty: msg.qty } };
    case 'boat':
      return { case: 'boat', value: { sail: msg.op === 'sail' } };
    case 'look':
      return { case: 'look', value: msg.look };
    case 'chat':
      return { case: 'chat', value: msg.text };
  }
}

const SECRET = new Set<string>(['login', 'register', 'resume']);

export function encode(msg: ClientMsg): Uint8Array<ArrayBuffer> {
  const message = create(ClientMessageSchema, { msg: payload(msg) } as never);
  if (logMessages && !SECRET.has(msg.type)) console.log('->', toJsonString(ClientMessageSchema, message));
  return toBinary(ClientMessageSchema, message) as Uint8Array<ArrayBuffer>;
}

// --- server to client
function tilePairs(flat: number[]): TilePos[] {
  const out: TilePos[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

function bossView(boss: PbBossView): Entity['boss'] {
  return {
    state: BOSS_STATES[boss.state],
    attack: boss.attack || undefined,
    tiles: tilePairs(boss.tiles),
    start: boss.start,
    end: boss.end,
    target: boss.target ? clientId(boss.target) : undefined,
  };
}

/** Applies what changed to what is already known about an entity. Always returns a new object. */
export function mergeEntity(known: Entity | undefined, delta: PbEntity): Entity {
  const isNew = delta.full || !known;
  const entity: Entity = isNew
    ? { id: clientId(delta.id), kind: KINDS[delta.id & 7], x: 0, y: 0 }
    : { ...known };
  for (const field of ['x', 'y', 'name', 'type', 'hp', 'maxHp', 'level', 'rooted', 'qty'] as const)
    if (delta[field] !== undefined) Object.assign(entity, { [field]: delta[field] });
  // An empty text or zero target means "none".
  if (delta.act !== undefined) entity.action = delta.act || undefined;
  if (delta.tool !== undefined) entity.tool = delta.tool || undefined;
  if (delta.target !== undefined) entity.target = delta.target ? clientId(delta.target) : undefined;
  if (delta.gear) {
    const { weapon, head, body, legs } = delta.gear;
    entity.gear = [weapon, head, body, legs].map(item => item || null);
  }
  if (delta.look) entity.look = { cut: delta.look.cut, color: delta.look.color };
  if (delta.boss) entity.boss = bossView(delta.boss);
  entity.via = delta.via.length ? tilePairs(delta.via) : undefined;
  return entity;
}

const stack = (s: PbStack): Stack => ({ id: s.item, qty: s.qty });

function selfState(self: PbSelf): SelfState {
  const inv: (Stack | null)[] = Array(INV_SIZE).fill(null);
  for (const slot of self.inventory) if (slot.stack) inv[slot.index] = stack(slot.stack);
  const equip: SelfState['equip'] = {};
  for (const slot of self.equipment) if (slot.stack) equip[SLOTS[slot.slot - 1]] = stack(slot.stack);
  return {
    id: clientId(self.id),
    name: self.name,
    map: mapId(self.map),
    xp: Object.fromEntries(SKILLS.map(skill => [skill, self.xp[skill] ?? 0])) as Record<Skill, number>,
    inv,
    equip,
    bank: self.bank.map(stack),
    boat: { ...self.boat },
    boatDone: self.boatDone,
    reaper: self.reaper.map(stack),
    look: { cut: self.look?.cut ?? 0, color: self.look?.color ?? 0 },
  };
}

function gameEvent({ event }: PbEvent): GameEvent[] {
  switch (event.case) {
    case 'hit': {
      const { from, to, damage, style } = event.value;
      return [{ type: 'hit', from: clientId(from), to: clientId(to), damage, style }];
    }
    case 'impact': {
      const { boss, attack, tiles } = event.value;
      return [{ type: 'impact', boss: clientId(boss), attack, tiles: tilePairs(tiles) }];
    }
    case 'death':
      return [{ type: 'death', id: clientId(event.value) }];
    default:
      return [];
  }
}

function snapshot(s: PbSnapshot): ServerMsg {
  return {
    type: 'snapshot',
    tick: s.tick,
    map: mapId(s.map),
    reset: s.reset,
    entities: s.entities,
    gone: s.gone.map(clientId),
    events: s.events.flatMap(gameEvent),
  };
}

/** Returns null for messages this client does not know. */
export function decode(data: ArrayBuffer): ServerMsg | null {
  const message = fromBinary(ServerMessageSchema, new Uint8Array(data));
  const { msg } = message;
  if (logMessages && msg.case !== 'welcome') console.log('<-', toJsonString(ServerMessageSchema, message));
  switch (msg.case) {
    case 'welcome':
      return { type: 'welcome', token: msg.value.token, id: clientId(msg.value.id) };
    case 'error':
    case 'kicked':
      return { type: msg.case, text: msg.value };
    case 'self':
      return { type: 'self', self: selfState(msg.value) };
    case 'snapshot':
      return snapshot(msg.value);
    case 'chat':
      return { type: 'chat', from: msg.value.from, text: msg.value.text };
    case 'info':
      return { type: 'info', text: msg.value.text, kind: INFO_KINDS[msg.value.kind] };
    case 'xp':
      return { type: 'xp', skill: msg.value.skill as Skill, amount: msg.value.amount };
    case 'openStation':
      return { type: 'open', station: msg.value as StationType };
    case 'boss': {
      const { alive, nextTicks, contribution, online } = msg.value;
      return { type: 'boss', alive, nextTicks, contribution, online };
    }
    default:
      return null;
  }
}

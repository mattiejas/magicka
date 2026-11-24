// Translates between the protobuf messages on the wire and the types the rest of the client uses.
import { create, fromBinary, toBinary, toJsonString } from '@bufbuild/protobuf';
import { MAPS, SKILLS, SLOTS, type ClientMsg, type Ent, type GameEvent, type MapId, type SelfState, type ServerMsg, type Skill, type Slot, type Stack, type StationType } from '@magicka/shared';
import { BossState, ClientMessageSchema, EntityKind, InfoKind, MapId as PbMap, ServerMessageSchema, type Entity, type Self, type Snapshot } from './pb/driftwake/v1/game_pb';
const debug = import.meta.env.DEV && new URLSearchParams(location.search).has('messages');
// Nodes and stations are numbered across all maps, in the order of the data file.
const NODE_IDS = Object.values(MAPS).flatMap(m => m.nodes.map(n => n.id)), STATION_IDS = Object.values(MAPS).flatMap(m => m.stations.map(s => s.id));
const index = (ids: string[]) => new Map(ids.map((id, i) => [id, i])), nodeIndex = index(NODE_IDS), stationIndex = index(STATION_IDS);
const num = (kind: EntityKind, n: number) => ((n << 3) | kind) >>> 0;
/** Ids are kept as text in the client: map ids for nodes and stations, "grave", and the plain number for everything else. */
export function idOf(n: number): string {
  switch (n & 7) { case EntityKind.NODE: return NODE_IDS[n >>> 3]; case EntityKind.STATION: return STATION_IDS[n >>> 3]; case EntityKind.GRAVE: return 'grave'; default: return String(n); }
}
const KIND: Record<number, Ent['k']> = { [EntityKind.PLAYER]: 'p', [EntityKind.MONSTER]: 'm', [EntityKind.NODE]: 'n', [EntityKind.DROP]: 'd', [EntityKind.GRAVE]: 'g' };
const mapId = (m: PbMap): MapId => (m === PbMap.MAINLAND ? 'mainland' : 'island');
const pairs = (l: number[]) => { const out: [number, number][] = []; for (let i = 0; i + 1 < l.length; i += 2) out.push([l[i], l[i + 1]]); return out; };
const BOSS = { [BossState.UNSPECIFIED]: 'choose', [BossState.CHOOSE]: 'choose', [BossState.WINDUP]: 'windup', [BossState.EXECUTE]: 'execute' } as const;
const INFO = { [InfoKind.UNSPECIFIED]: undefined, [InfoKind.UNIQUE]: 'unique', [InfoKind.BOSS]: 'boss', [InfoKind.LEVEL]: 'level', [InfoKind.BAD]: 'bad' } as const;

export function encode(m: ClientMsg): Uint8Array<ArrayBuffer> {
  const empty = {}, at = <T extends string, V>(c: T, value: V) => ({ case: c, value });
  const msg = (() => {
    switch (m.t) {
      case 'register': case 'login': return at(m.t, { name: m.name, password: m.pw });
      case 'resume': return at('resumeToken', m.token);
      case 'logout': case 'grave': case 'claim': case 'depositAll': return at(m.t, empty);
      case 'move': return at('move', { x: m.x, y: m.y });
      case 'gather': return at('gather', num(EntityKind.NODE, nodeIndex.get(m.id)!));
      case 'station': return at('station', num(EntityKind.STATION, stationIndex.get(m.id)!));
      case 'attack': case 'pickup': return at(m.t, Number(m.id));
      case 'craft': return at('craft', { recipe: m.id, qty: m.qty });
      case 'equip': return at('equipSlot', m.slot);
      case 'unequip': return at('unequip', SLOTS.indexOf(m.slot) + 1);
      case 'eat': return at('eatSlot', m.slot);
      case 'drop': return at('dropSlot', m.slot);
      case 'swap': return at('swap', { a: m.a, b: m.b });
      case 'bank': return at('bank', { withdraw: m.op === 'withdraw', item: m.item, qty: m.qty });
      case 'boat': return at('boat', { sail: m.op === 'sail' });
      case 'look': return at('look', { cut: m.cut, color: m.color });
      case 'chat': return at('chat', m.text);
    }
  })();
  const out = create(ClientMessageSchema, { msg } as never);
  if (debug && m.t !== 'login' && m.t !== 'register' && m.t !== 'resume') console.log('->', toJsonString(ClientMessageSchema, out));
  return toBinary(ClientMessageSchema, out) as Uint8Array<ArrayBuffer>;
}

/** Applies a delta to what is already known about an entity. Always returns a new object. */
export function mergeEntity(old: Ent | undefined, e: Entity): Ent {
  const id = idOf(e.id), base: Ent = e.full || !old ? { id, k: KIND[e.id & 7], x: 0, y: 0 } : { ...old };
  base.via = e.via.length ? pairs(e.via) : undefined;
  if (e.x !== undefined) base.x = e.x;
  if (e.y !== undefined) base.y = e.y;
  if (e.name !== undefined) base.name = e.name;
  if (e.type !== undefined) base.type = e.type;
  if (e.hp !== undefined) base.hp = e.hp;
  if (e.maxHp !== undefined) base.mhp = e.maxHp;
  if (e.act !== undefined) base.act = e.act || undefined;
  if (e.tool !== undefined) base.tool = e.tool || undefined;
  if (e.target !== undefined) base.tgt = e.target ? idOf(e.target) : undefined;
  if (e.gear) base.gear = [e.gear.weapon, e.gear.head, e.gear.body, e.gear.legs].map(g => g || null);
  if (e.look) base.look = { cut: e.look.cut, color: e.look.color };
  if (e.level !== undefined) base.lvl = e.level;
  if (e.rooted !== undefined) base.rooted = e.rooted;
  if (e.qty !== undefined) base.qty = e.qty;
  if (e.boss) base.boss = { st: BOSS[e.boss.state], atk: e.boss.attack || undefined, tiles: pairs(e.boss.tiles), start: e.boss.start, end: e.boss.end, tgt: e.boss.target ? idOf(e.boss.target) : undefined };
  return base;
}
const stack = (s?: { item: string; qty: number }): Stack | null => (s ? { id: s.item, qty: s.qty } : null);
function self(s: Self): SelfState {
  const inv: (Stack | null)[] = Array(24).fill(null), equip: Partial<Record<Slot, Stack>> = {};
  for (const i of s.inventory) inv[i.index] = stack(i.stack);
  for (const e of s.equipment) equip[SLOTS[e.slot - 1]] = stack(e.stack)!;
  return { id: idOf(s.id), name: s.name, map: mapId(s.map), xp: Object.fromEntries(SKILLS.map(k => [k, s.xp[k] ?? 0])) as Record<Skill, number>, inv, equip, bank: s.bank.map(b => stack(b)!), boat: { ...s.boat }, boatDone: s.boatDone, reaper: s.reaper.map(b => stack(b)!), look: { cut: s.look?.cut ?? 0, color: s.look?.color ?? 0 } };
}
function snapshot(s: Snapshot): ServerMsg {
  const ev: GameEvent[] = [];
  for (const { event: e } of s.events) {
    if (e.case === 'hit') ev.push({ e: 'hit', from: idOf(e.value.from), to: idOf(e.value.to), dmg: e.value.damage, style: e.value.style });
    else if (e.case === 'impact') ev.push({ e: 'impact', boss: idOf(e.value.boss), atk: e.value.attack, tiles: pairs(e.value.tiles) });
    else if (e.case === 'death') ev.push({ e: 'death', id: idOf(e.value) });
  }
  return { t: 'snap', tick: s.tick, map: mapId(s.map), reset: s.reset, raw: s.entities, gone: s.gone.map(idOf), ev };
}
export function decode(data: ArrayBuffer): ServerMsg | null {
  const p = fromBinary(ServerMessageSchema, new Uint8Array(data)), m = p.msg;
  if (debug && m.case !== 'welcome') console.log('<-', toJsonString(ServerMessageSchema, p));
  switch (m.case) {
    case 'welcome': return { t: 'welcome', token: m.value.token, id: idOf(m.value.id) };
    case 'error': case 'kicked': return { t: m.case, msg: m.value };
    case 'self': return { t: 'self', s: self(m.value) };
    case 'snapshot': return snapshot(m.value);
    case 'chat': return { t: 'chat', from: m.value.from, text: m.value.text };
    case 'info': return { t: 'info', text: m.value.text, kind: INFO[m.value.kind] };
    case 'xp': return { t: 'xp', skill: m.value.skill as Skill, amount: m.value.amount };
    case 'openStation': return { t: 'open', station: m.value as StationType };
    case 'boss': return { t: 'boss', alive: m.value.alive, next: m.value.nextTicks, contrib: m.value.contribution, online: m.value.online };
    default: return null;
  }
}

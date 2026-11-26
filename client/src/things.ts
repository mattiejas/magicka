// What things in the world are called, and what can be done with them.
import {
  type ClientMsg,
  type Entity,
  ITEMS,
  MAPS,
  type MapId,
  MONSTERS,
  NODES,
  type StationType,
} from '@driftwake/shared';
import { state, tickNow } from './net/state';

/** A fixed part of a map. */
export type FixedThing =
  | { kind: 'node'; id: string; type: string }
  | { kind: 'station'; id: string; type: StationType; map: MapId };
/** Something in the world that players can look at or use. */
export type Thing = FixedThing | { kind: 'entity'; entity: Entity };

export type Option = [label: string, action: () => void];

/** What the options act through. Handed in, because the connection and the interface need a browser. */
export interface Means {
  send: (msg: ClientMsg) => void;
  playerOptions: (name: string, id: string) => Option[];
}

const GATHER_VERBS = { rock: 'Mine', tree: 'Chop', plant: 'Pick', spot: 'Fish' };
const NPC_NAMES: Record<string, string> = { trader: 'Stranded trader', genie: 'Genie' };
const STATION_NAMES: Record<StationType, string> = {
  bank: 'Bank chest',
  furnace: 'Furnace',
  anvil: 'Anvil',
  workbench: 'Workbench',
  fire: 'Cooking fire',
  reaper: 'Reaper',
  shop: 'Shopkeeper',
  mine: 'Old mine',
  dock: 'Shipwright',
};
/** Stations that are a person, so players talk to them rather than use them. */
const PEOPLE = new Set<StationType>(['reaper', 'shop', 'dock']);

export function nameOf(thing: Thing): string {
  if (thing.kind === 'node') return NODES[thing.type].name;
  if (thing.kind === 'entity') return entityName(thing.entity);
  if (thing.type === 'mine' && MAPS[thing.map].cave) return 'Daylight';
  return STATION_NAMES[thing.type];
}

function entityName(entity: Entity): string {
  switch (entity.kind) {
    case 'monster':
      return MONSTERS[entity.type!].name;
    case 'drop':
      return ITEMS[entity.type!].name + (entity.qty! > 1 ? ` (${entity.qty})` : '');
    case 'npc':
      return NPC_NAMES[entity.type!];
    case 'grave':
      return 'Your grave';
    default:
      return entity.name ?? '';
  }
}

/** Name and, where it matters, level. */
function nameWithLevel(thing: Thing): string {
  const name = nameOf(thing);
  if (thing.kind === 'entity' && thing.entity.kind === 'monster')
    return `${name}  level ${MONSTERS[thing.entity.type!].level}`;
  if (thing.kind === 'node' && NODES[thing.type].skill)
    return `${name}  ${NODES[thing.type].skill} ${NODES[thing.type].level}`;
  return name;
}

/** A verb, and the message that carries it out. */
type Deed = [verb: string, msg: ClientMsg];

function mainDeed(thing: Thing): Deed | null {
  switch (thing.kind) {
    case 'node':
      return [gatherVerb(thing.id, thing.type), { type: 'gather', id: thing.id }];
    case 'station':
      return [stationVerb(thing.type), { type: 'station', id: thing.id }];
    case 'entity':
      return entityDeed(thing.entity);
  }
}

function stationVerb(type: StationType): string {
  if (type === 'mine') return 'Enter';
  return PEOPLE.has(type) ? 'Talk to' : 'Use';
}

function gatherVerb(id: string, type: string): string {
  const node = state.entities.get(id)?.entity;
  const special = node?.rich ? ' rich' : node?.glowing ? ' glowing' : '';
  return GATHER_VERBS[NODES[type].kind] + special;
}

function entityDeed({ kind, id }: Entity): Deed | null {
  switch (kind) {
    case 'monster':
      return ['Attack', { type: 'attack', id }];
    case 'drop':
      return ['Take', { type: 'pickup', id }];
    case 'npc':
      return ['Talk to', { type: 'npc', id }];
    case 'grave':
      return ['Recover', { type: 'grave' }];
    default:
      return null;
  }
}

/** What choosing a thing does, if anything. */
export function mainAction(thing: Thing, { send }: Pick<Means, 'send'>): Option | null {
  const deed = mainDeed(thing);
  if (!deed) return null;
  const [verb, msg] = deed;
  return [`${verb} ${nameWithLevel(thing)}`, () => send(msg)];
}

/** The drops lying on the same tile as this one. */
function pileOf(drop: Entity): Entity[] {
  return [...state.entities.values()]
    .map(track => track.entity)
    .filter(e => e.kind === 'drop' && e.x === drop.x && e.y === drop.y);
}

/** Still private, so the player's own; once public the browser cannot tell whose it was. */
const isOwn = ({ publicAt }: Entity) => !publicAt || publicAt > tickNow();

/** A drop that lies with others, or null. */
function dropInPile(thing: Thing): Entity | null {
  if (thing.kind !== 'entity' || thing.entity.kind !== 'drop') return null;
  return pileOf(thing.entity).length > 1 ? thing.entity : null;
}

const takeAll = (drop: Entity, { send }: Pick<Means, 'send'>): Option => [
  'Take all',
  () => send({ type: 'pickupAll', id: drop.id }),
];

/** What clicking a thing in the world does: a pile of the player's own is taken whole. */
export function clickAction(thing: Thing, means: Pick<Means, 'send'>): Option | null {
  const drop = dropInPile(thing);
  if (drop && pileOf(drop).every(isOwn)) return takeAll(drop, means);
  return mainAction(thing, means);
}

/** Everything that can be done with these things, taking all of each pile first. */
export function optionsForAll(things: Thing[], means: Means): Option[] {
  const piles = new Map<string, Option>();
  for (const thing of things) {
    const drop = dropInPile(thing);
    if (drop && !piles.has(`${drop.x},${drop.y}`)) piles.set(`${drop.x},${drop.y}`, takeAll(drop, means));
  }
  return [...piles.values(), ...things.flatMap(thing => optionsFor(thing, means))];
}

/** Everything that can be done with a thing. */
export function optionsFor(thing: Thing, means: Means): Option[] {
  if (thing.kind === 'entity' && thing.entity.kind === 'player')
    return means.playerOptions(nameOf(thing), thing.entity.id);
  const action = mainAction(thing, means);
  return action ? [action] : [];
}

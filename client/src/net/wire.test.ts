import { clearField, fromBinary } from '@bufbuild/protobuf';
import type { Entity } from '@driftwake/shared';
import { describe, expect, it, vi } from 'vitest';
import { EntitySchema, type Entity as PbEntity } from '../pb/driftwake/v1/game_pb';
import recorded from './entities.recorded.json';

vi.stubGlobal('location', { search: '' }); // wire.ts reads it when it loads, to see whether to log messages
const { clientId, mergeEntity } = await import('./wire');

const received = (bytes: string): PbEntity => fromBinary(EntitySchema, Buffer.from(bytes, 'hex'));

function message(name: string): PbEntity {
  const found = recorded.find(r => r.name === name);
  if (!found) throw new Error(`No recording of ${name}. See record_test.go.`);
  return received(found.bytes);
}

/** What a browser knows about an entity after a number of messages. */
const after = (...names: string[]) =>
  names.reduce<Entity | undefined>((known, name) => mergeEntity(known, message(name)), undefined);

const PLAYER = '57'; // 7 << 3 | player
const NODE = clientId((1 << 3) | 3);

const plainPlayer = {
  id: PLAYER,
  kind: 'player',
  x: 10,
  y: 11,
  name: 'Robin',
  hp: 10,
  maxHp: 10,
  level: 1,
  gear: ['sword_1', null, null, null, null],
  look: { cut: 1, color: 2 },
};
const busyPlayer = {
  id: PLAYER,
  kind: 'player',
  x: 12,
  y: 10,
  name: 'Robin',
  hp: 9,
  maxHp: 12,
  level: 3,
  gear: ['sword_2', 'head_2', 'body_2', 'legs_2', 'cape_magic'],
  look: { cut: 2, color: 0 },
  action: 'mining',
  tool: 'pickaxe_1',
  target: NODE,
  rooted: true,
};
const boss = { id: '26', kind: 'monster', x: 3, y: 4, type: 'gnashclaw', hp: 300, maxHp: 300 };
const depletedNode = { id: NODE, kind: 'node', x: 20, y: 21 };
const drop = { id: '76', kind: 'drop', x: 8, y: 9, type: 'coin', qty: 40, until: 500, publicAt: 400 };

describe('mergeEntity, with bytes recorded from the server', () => {
  it('keeps what did not change about a player', () => {
    expect(after('plain player')).toEqual(plainPlayer);
    expect(after('plain player', 'player becomes busy')).toEqual({
      ...busyPlayer,
      via: [
        [11, 11],
        [12, 10],
      ],
    });
    expect(after('plain player', 'player becomes busy', 'player stops')).toEqual({
      ...plainPlayer,
      rooted: false,
    });
  });
  it('forgets everything when an entity is new', () => {
    expect(after('busy player')).toEqual(busyPlayer);
    expect(after('busy player', 'plain player')).toEqual(plainPlayer);
  });
  it('follows bosses and monsters', () => {
    expect(after('boss')).toEqual({ ...boss, boss: { state: 'choose', tiles: [], start: 0, end: 0 } });
    const tiles = [
      [4, 5],
      [5, 5],
    ];
    expect(after('boss', 'boss winds up')).toEqual({
      ...boss,
      hp: 250,
      target: PLAYER,
      boss: { state: 'windup', attack: 'boulder', tiles, start: 100, end: 105 },
    });
    expect(after('boss', 'boss winds up', 'boss strikes')).toEqual({
      ...boss,
      hp: 250,
      maxHp: 600,
      boss: { state: 'execute', attack: 'melee', tiles: [], start: 110, end: 112, target: PLAYER },
    });
    const boar = { id: '34', kind: 'monster', x: 1, y: 2, type: 'boar', hp: 5, maxHp: 8, target: PLAYER };
    expect(after('monster')).toEqual(boar);
  });
  it('follows nodes', () => {
    expect(after('depleted node')).toEqual(depletedNode);
    const shining = { ...depletedNode, glowing: true, rich: true };
    expect(after('glowing, rich node')).toEqual(shining);
    expect(after('depleted node', 'node glows and is rich')).toEqual(shining);
    const dull = { ...depletedNode, glowing: false, rich: false };
    expect(after('glowing, rich node', 'node is depleted')).toEqual(dull);
  });
  it('follows visitors and drops', () => {
    const at = { kind: 'npc', x: 5, y: 6 };
    expect(after('trader')).toEqual({ ...at, id: '15', type: 'trader', wants: 'copper_ore' });
    expect(after('genie')).toEqual({ ...at, id: '23', type: 'genie', wants: '' });
    expect(after('drop')).toEqual(drop);
    expect(after('drop', 'drop stays longer')).toEqual({ ...drop, until: 600 });
  });
  it('never changes the object it was given', () => {
    const known = Object.freeze(after('plain player'));
    expect(mergeEntity(known, message('player becomes busy'))).not.toBe(known);
    expect(known).toEqual(plainPlayer);
  });
  it.each(EntitySchema.fields)('does not ignore $localName', field => {
    const known = { ...after('plain player')!, id: 'another' };
    const matters = recorded.some(({ bytes }) => {
      const without = received(bytes);
      clearField(without, field);
      const result = mergeEntity(known, received(bytes));
      return JSON.stringify(result) !== JSON.stringify(mergeEntity(known, without));
    });
    expect(matters).toBe(true);
  });
});

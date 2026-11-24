import { type ClientMsg, type Entity, ITEMS, MONSTERS, NODES } from '@driftwake/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { state } from './net/state';
import { mainAction, nameOf, type Option, optionsFor, type Thing } from './things';

let sent: ClientMsg[];
const means = {
  send: (msg: ClientMsg) => void sent.push(msg),
  playerOptions: (name: string, id: string): Option[] => [[`Trade with ${name} ${id}`, () => {}]],
};

beforeEach(() => {
  sent = [];
  state.entities.clear();
});

const entity = (fields: Partial<Entity> & Pick<Entity, 'kind'>): Thing => ({
  kind: 'entity',
  entity: { id: '7', x: 0, y: 0, ...fields },
});

const nodeOf = (kind: 'rock' | 'tree' | 'plant') => {
  const [type, node] = Object.entries(NODES).find(([, n]) => n.kind === kind && n.skill)!;
  return {
    thing: { kind: 'node', id: 'n1', type } as Thing,
    label: `${node.name}  ${node.skill} ${node.level}`,
  };
};

/** Checks the action's text, that it is the only option, and what it sends. */
function expectAction(thing: Thing, label: string, msg: ClientMsg) {
  const [action] = optionsFor(thing, means);
  expect(optionsFor(thing, means)).toHaveLength(1);
  expect(mainAction(thing, means)![0]).toBe(label);
  expect(action[0]).toBe(label);
  expect(sent).toEqual([]);
  mainAction(thing, means)![1]();
  action[1]();
  expect(sent).toEqual([msg, msg]);
}

describe('nodes', () => {
  it.each([
    ['rock', 'Mine'],
    ['tree', 'Chop'],
    ['plant', 'Pick'],
  ] as const)('a %s is gathered, and shows its level', (kind, verb) => {
    const { thing, label } = nodeOf(kind);
    expectAction(thing, `${verb} ${label}`, { type: 'gather', id: 'n1' });
  });

  it('without a skill shows only its name', () => {
    const [type, { name }] = Object.entries(NODES).find(([, node]) => !node.skill)!;
    expect(mainAction({ kind: 'node', id: 'n1', type }, means)![0]).toMatch(new RegExp(`^\\w+ ${name}$`));
  });

  it('says whether it is glowing or rich, rich first', () => {
    const { thing, label } = nodeOf('rock');
    const report = (fields: Partial<Entity>) =>
      state.entities.set('n1', {
        entity: { id: 'n1', kind: 'node', x: 0, y: 0, ...fields },
        from: [0, 0],
        path: [],
        movedAt: 0,
      });
    report({ glowing: true });
    expect(mainAction(thing, means)![0]).toBe(`Mine glowing ${label}`);
    report({ glowing: true, rich: true });
    expect(mainAction(thing, means)![0]).toBe(`Mine rich ${label}`);
  });
});

describe('stations', () => {
  it('are used', () => {
    const bank: Thing = { kind: 'station', id: 's1', type: 'bank', map: 'island' };
    expectAction(bank, 'Use Bank chest', { type: 'station', id: 's1' });
  });

  it('a mine is entered, and is the way out when in a cave', () => {
    const mine: Thing = { kind: 'station', id: 's1', type: 'mine', map: 'island' };
    expectAction(mine, 'Enter Old mine', { type: 'station', id: 's1' });
    expect(nameOf({ ...mine, map: 'mine' })).toBe('Daylight');
  });
});

describe('entities', () => {
  it('a monster is attacked, and shows its level', () => {
    const [type, { name, level }] = Object.entries(MONSTERS)[0];
    const monster = entity({ kind: 'monster', type });
    expect(nameOf(monster)).toBe(name);
    expectAction(monster, `Attack ${name}  level ${level}`, { type: 'attack', id: '7' });
  });

  it('a drop is taken, and shows how many there are', () => {
    const [type, { name }] = Object.entries(ITEMS)[0];
    expect(nameOf(entity({ kind: 'drop', type, qty: 1 }))).toBe(name);
    expectAction(entity({ kind: 'drop', type, qty: 3 }), `Take ${name} (3)`, { type: 'pickup', id: '7' });
  });

  it.each([
    ['trader', 'Stranded trader'],
    ['genie', 'Genie'],
  ])('a %s is talked to', (type, name) => {
    expectAction(entity({ kind: 'npc', type }), `Talk to ${name}`, { type: 'npc', id: '7' });
  });

  it('a grave is recovered', () => {
    expectAction(entity({ kind: 'grave' }), 'Recover Your grave', { type: 'grave' });
  });

  it('a player has no main action, but has the options of players', () => {
    const player = entity({ kind: 'player', name: 'Wren' });
    expect(nameOf(player)).toBe('Wren');
    expect(mainAction(player, means)).toBeNull();
    expect(optionsFor(player, means).map(([label]) => label)).toEqual(['Trade with Wren 7']);
    expect(sent).toEqual([]);
  });
});

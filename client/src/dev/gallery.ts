// Dev-only page at /gallery.html for looking at models. Query parameters:
//   set   one of the sets below
//   death how far through the death pose the last column of the death set is, 0 to 1
//   t     milliseconds into the animation
//   name  whose face and hair to show    color  hair colour    ry  how far heads are turned
import { HAIRCUTS, ITEMS, MONSTERS, NODES } from '@driftwake/shared';
import * as THREE from 'three';
import {
  boatGeo,
  keeperOf,
  mesh,
  monsterModel,
  nodeGeo,
  npcModel,
  PoseBlend,
  playerModel,
  poseBoss,
  poseDeath,
  poseMonster,
  posePlayer,
  stationGeo,
} from '../models';
import { Ripples } from '../scene/ripples';

type Gear = (string | null)[];
interface Exhibit {
  object: THREE.Object3D;
  turn?: number;
}
interface GallerySet {
  columns: number;
  gap: number;
  exhibits: () => Exhibit[];
  /** Camera position and target; left out, the camera steps back to show everything. */
  camera?: { from: [number, number, number]; to: [number, number, number] };
}

const query = new URLSearchParams(location.search);
const time = Number(query.get('t') ?? 0);
const name = query.get('name') ?? 'Matts';
const UNARMED: Gear = [null, null, null, null];
const STILL = { moving: false, walk: 0, hit: 0, time };

interface Shown {
  action?: string;
  hit?: number;
  tool?: string;
  time?: number;
}

function poseOf(shown: Shown) {
  const moving = shown.action === 'walk';
  return { ...STILL, ...shown, action: moving ? undefined : shown.action, moving, walk: 1 };
}

function person(gear: Gear, shown: Shown, who = name) {
  const model = playerModel(who, gear);
  posePlayer(model, poseOf(shown));
  return model.root;
}

/** Someone who was in the pose `before` and began to take on the pose `after` so many milliseconds ago. */
function changing(gear: Gear, before: Shown, after: Shown, sinceMs: number) {
  const model = playerModel(name, gear);
  const blend = new PoseBlend();
  posePlayer(model, poseOf({ ...before, time: time - sinceMs }), blend);
  posePlayer(model, poseOf(after), blend);
  return model.root;
}

/** One of each kind of death, beside its shape in the monsters set. Bosses die their own way. */
const DYING: { id: string | null; boss?: boolean }[] = [
  { id: null },
  ...['wolf', 'chicken', 'wisp', 'spitter', 'golem', 'gnashclaw'].map(id => ({ id })),
  ...['gnashclaw', 'deepstone', 'colossus'].map(id => ({ id, boss: true })),
];
const DEATH_STEPS = [0, 0.2, 0.4, 0.6, 0.8, Number(query.get('death') ?? 1)];

/** A player or monster `progress` of the way through dying, standing where its holder is. */
function dying(id: string | null, progress: number, boss = false) {
  const model = id ? monsterModel(id) : playerModel(name, SWORD);
  if (!id) posePlayer(model, STILL);
  const holder = new THREE.Group();
  holder.add(model.root);
  poseDeath(model, progress, boss);
  return holder;
}

const ATTACK_MS = 550;
const SWORD: Gear = ['iron_sword', null, null, null, 'cape_mining'];

const SETS: Record<string, GallerySet> = {
  people: {
    columns: 6,
    gap: 1.9,
    exhibits: () => [
      { object: person(UNARMED, {}, 'Name0'), turn: 0.4 },
      { object: person(UNARMED, { action: 'mine', tool: 'copper_pickaxe' }, 'Name1'), turn: 1.3 },
      { object: person(UNARMED, { action: 'chop', tool: 'iron_axe' }, 'Name2'), turn: 1.3 },
      { object: person(UNARMED, { action: 'craft' }, 'Name3'), turn: 1.3 },
      { object: person(UNARMED, { action: 'pick' }, 'Name4'), turn: 1.1 },
      { object: person(['iron_sword', null, null, null], { action: 'walk' }, 'Name5'), turn: 1 },
      {
        object: person(['cobalt_sword', 'cobalt_helm', 'cobalt_plate', 'cobalt_greaves'], {
          action: 'melee',
          hit: 0.7,
        }),
        turn: 0.8,
      },
      {
        object: person(['oak_bow', 'leather_cowl_3', 'leather_jerkin_3', 'leather_chaps_3'], {
          action: 'ranged',
        }),
        turn: 0.6,
      },
      {
        object: person(['maple_staff', 'cloth_hood_4', 'cloth_robe_4', 'cloth_skirt_4'], {
          action: 'magic',
          hit: 0.4,
        }),
        turn: 0.6,
      },
      { object: person(['rootcleaver', null, 'adamantite_plate', null], {}) },
      { object: person(['briarstring', 'leather_cowl_5', 'leather_jerkin_5', null], {}) },
      { object: person(UNARMED, { action: 'eat' }, 'Name11') },
      { object: person(UNARMED, { action: 'fish', tool: 'worn_rod' }, 'Name12'), turn: 1.3 },
    ],
  },
  hair: {
    columns: HAIRCUTS.length,
    gap: 0.5,
    camera: { from: [0, 1.78, 2.1], to: [0, 1.66, 0] },
    exhibits: () =>
      HAIRCUTS.map((_, cut) => {
        const model = playerModel(name, UNARMED, { cut, color: Number(query.get('color') ?? 0) });
        posePlayer(model, STILL);
        return { object: model.root, turn: Number(query.get('ry') ?? 0.4) };
      }),
  },
  head: {
    columns: 6,
    gap: 0.6,
    camera: { from: [0, 1.62, 3.3], to: [0, 1.52, 0] },
    exhibits: () => [
      ...[0, 0.6, Math.PI / 2, 2.6].map(turn => ({ object: person(UNARMED, {}), turn })),
      ...['iron_helm', 'leather_cowl_3'].map(head => ({
        object: person([null, head, null, null], {}),
        turn: 0.4,
      })),
    ],
  },
  turn: {
    columns: 3,
    gap: 1,
    camera: { from: [0, 1.3, 4.6], to: [0, 0.88, 0] },
    exhibits: () => [0.35, Math.PI / 2, Math.PI].map(turn => ({ object: person(UNARMED, {}), turn })),
  },
  swing: {
    columns: 5,
    gap: 1.3,
    exhibits: () => [
      ...[0, 0.9, 0.65, 0.4].map(hit => ({
        object: person(['iron_sword', null, null, null], { action: 'melee', hit }),
        turn: 0.7,
      })),
      { object: person(['oak_bow', null, null, null], { action: 'ranged', hit: 0.5 }), turn: 0.7 },
      { object: person(['oak_staff', null, null, null], { action: 'magic', hit: 0.8 }), turn: 1.1 },
      { object: person(UNARMED, { action: 'mine', tool: 'iron_pickaxe' }), turn: 1.1 },
      { object: person(UNARMED, { action: 'pick' }), turn: 1.1 },
      { object: person(UNARMED, { action: 'walk' }), turn: 1.1 },
    ],
  },
  // The same fighter at moments between blows; nobody should look frozen.
  guard: {
    columns: 6,
    gap: 1.3,
    exhibits: () =>
      [
        ['iron_sword', 'melee'],
        ['oak_bow', 'ranged'],
        ['oak_staff', 'magic'],
      ].flatMap(([weapon, action]) =>
        [0, 1, 2, 3, 4, 5].map(i => ({
          object: person([weapon, null, null, null], { action, time: time + i * 400 }),
          turn: 0.9,
        })),
      ),
  },
  // Each row goes from one pose to another; the last two begin with a blow.
  blend: {
    columns: 6,
    gap: 1.9,
    exhibits: () => {
      const work = { action: 'mine', tool: 'iron_pickaxe' };
      const rows: [Gear, Shown, Shown][] = [
        [SWORD, {}, { action: 'walk' }],
        [SWORD, { action: 'walk' }, { action: 'melee' }],
        [UNARMED, { action: 'walk' }, work],
        [UNARMED, { action: 'pick' }, {}],
        [SWORD, { action: 'walk' }, { action: 'melee', hit: 1 }],
        [['oak_staff', null, null, null], {}, { action: 'magic', hit: 1 }],
      ];
      return rows.flatMap(([gear, before, after]) =>
        [0, 30, 60, 90, 120, 150].map(sinceMs => ({
          object: changing(
            gear,
            before,
            { ...after, hit: after.hit ? after.hit - sinceMs / ATTACK_MS : 0 },
            sinceMs,
          ),
          turn: 0.9,
        })),
      );
    },
  },
  monsters: {
    columns: 5,
    gap: 3,
    exhibits: () =>
      Object.values(MONSTERS).map(({ id, boss }) => {
        const model = monsterModel(id);
        if (!boss) poseMonster(model, { ...STILL, time: time + 300, phase: 0 });
        return { object: model.root };
      }),
  },
  // Each row is an attack of Gnashclaw's: idle, early and late in the wind-up, as it lands, and shut.
  claws: {
    columns: 5,
    gap: 4.2,
    exhibits: () =>
      ['snap', 'double_snap', 'jet'].flatMap(attack =>
        (
          [
            ['choose', 0],
            ['windup', 0.25],
            ['windup', 1],
            ['execute', 0],
            ['execute', 0.2],
          ] as const
        ).map(([state, progress]) => {
          const model = monsterModel('gnashclaw');
          const [start, end] = state === 'execute' ? [4, 6] : [1, 4];
          poseBoss(model, { state, attack, tiles: [], centres: [], start, end }, progress);
          return { object: model.root, turn: 0.2 };
        }),
      ),
  },
  // Each row is one kind of death, from the moment of death on the left to lying still on the right.
  death: {
    columns: DEATH_STEPS.length,
    gap: 3.2,
    exhibits: () =>
      DYING.flatMap(({ id, boss }) =>
        DEATH_STEPS.map(progress => ({ object: dying(id, progress, boss), turn: 0.9 })),
      ),
  },
  capes: {
    columns: 5,
    gap: 1.3,
    exhibits: () =>
      Object.values(ITEMS)
        .filter(item => item.slot === 'cape')
        .map(({ id }, i) => ({
          object: person(
            [null, null, i % 2 ? 'iron_plate' : null, null, id],
            i % 3 === 1 ? { action: 'walk' } : {},
          ),
          turn: i % 5 === 4 ? 0.5 : Math.PI + 0.4,
        })),
  },
  chicken: {
    columns: 3,
    gap: 1,
    camera: { from: [0, 0.8, 3.2], to: [0, 0.4, 0] },
    exhibits: () =>
      [0.5, Math.PI / 2, Math.PI].map(turn => {
        const model = monsterModel('chicken');
        poseMonster(model, { ...STILL, time, phase: 0 });
        return { object: model.root, turn };
      }),
  },
  nodes: {
    columns: 6,
    gap: 2.2,
    exhibits: () => Object.keys(NODES).map(id => ({ object: mesh(nodeGeo(id).whole) })),
  },
  // Fishing spots on water, from a perch spot to a shoal, and someone fishing at moments around a tug.
  shore: {
    columns: 4,
    gap: 2.4,
    exhibits: () => [
      ...['spot_1', 'spot_3', 'spot_5', 'shoal_2'].map(id => ({ object: onWater(id), turn: 0 })),
      ...[0, 900, 2700, 2950].map(ms => ({
        object: person(UNARMED, { action: 'fish', tool: 'worn_rod', time: time + ms }),
        turn: 1.3,
      })),
    ],
  },
  camp: {
    columns: 4,
    gap: 2.6,
    exhibits: () => [
      ...['bank', 'furnace', 'anvil', 'workbench', 'reaper', 'dock', 'shop', 'mine'].map(id => {
        const object = mesh(stationGeo(id));
        const keeper = keeperOf(id);
        if (keeper) object.add(keeper);
        return { object, turn: 0.3 };
      }),
      ...['trader', 'genie'].map(kind => ({ object: npcModel(kind).root, turn: 0.3 })),
      ...[0.3, 1].map(progress => ({ object: mesh(boatGeo(() => progress)), turn: 0.9 })),
    ],
  },
};

/** A fishing spot on a patch of water, with its ripples as they are at `time`. */
function onWater(id: string) {
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#3fb0bd', transparent: true, opacity: 0.85, roughness: 0.6 }),
  );
  patch.position.y = 0.02;
  const spot = mesh(nodeGeo(id).whole);
  spot.position.y = 0.02;
  const ripples = new Ripples();
  ripples.show(new Set([id]), () => ({ at: new THREE.Vector3(), size: NODES[id].size }));
  ripples.update(time, 0.02);
  const group = new THREE.Group();
  group.add(patch, spot, ripples.group);
  return group;
}

const set = SETS[query.get('set') ?? 'people'] ?? SETS.people;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

function buildStage() {
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.NeutralToneMapping;
  scene.background = new THREE.Color('#f6f3ef');
  const sun = new THREE.DirectionalLight('#fff0d6', 2.5);
  sun.position.set(5, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, bottom: -12, top: 12 });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#f4f2f0' }),
  );
  floor.receiveShadow = true;
  scene.add(sun, new THREE.HemisphereLight('#fff6ee', '#d8c2b4', 2.4), floor);
}

/** Lays exhibits out in rows and returns the number of rows. */
function placeExhibits({ columns, gap, exhibits }: GallerySet): number {
  const all = exhibits();
  for (const [i, { object, turn = 0.5 }] of all.entries()) {
    object.position.x = ((i % columns) - (columns - 1) / 2) * gap;
    object.position.z = -Math.floor(i / columns) * gap * 1.2;
    object.rotation.y = turn;
    scene.add(object);
  }
  return Math.ceil(all.length / columns);
}

function draw() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (set.camera) {
    camera.position.set(...set.camera.from);
    camera.lookAt(...set.camera.to);
  } else {
    const middle = ((rows - 1) * set.gap * 1.2) / 2;
    const extent = Math.max((set.columns * set.gap) / camera.aspect, rows * set.gap * 1.1);
    const distance = extent / 2 / Math.tan(0.262) + 2;
    camera.position.set(0, distance * 0.42 + 0.6, distance * 0.9 - middle);
    camera.lookAt(0, 0.7, -middle);
  }
  renderer.render(scene, camera);
}

buildStage();
const rows = placeExhibits(set);
draw();
addEventListener('resize', draw);

// Dev-only page at /gallery.html for looking at models. Query parameters:
//   set   one of the sets below
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
  playerModel,
  poseBoss,
  poseMonster,
  posePlayer,
  stationGeo,
} from '../models';

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

function person(
  gear: Gear,
  pose: { action?: string; hit?: number; tool?: string; time?: number },
  who = name,
) {
  const model = playerModel(who, gear);
  const moving = pose.action === 'walk';
  posePlayer(model, { ...STILL, ...pose, action: moving ? undefined : pose.action, moving, walk: 1 });
  return model.root;
}

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

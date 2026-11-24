// The fixed part of a map: ground, water, resource nodes, stations and the player's boat.
import {
  BOAT_PARTS,
  type GameMap,
  type MapNode,
  type MapStation,
  mulberry,
  NODES,
  type SelfState,
  type StationType,
} from '@magicka/shared';
import * as THREE from 'three';
import { MAT } from '../geo';
import { boatGeo, nodeGeo, stationGeo } from '../models';
import { groundDetail } from './groundDetail';
import { type Pick, pickBox } from './picking';
import { terrain } from './terrain';

const STATION_NAMES: Record<StationType, string> = {
  bank: 'Bank chest',
  furnace: 'Furnace',
  anvil: 'Anvil',
  workbench: 'Workbench',
  reaper: 'Reaper',
  dock: 'Shipwright',
};
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const WATER_LEVEL = -0.22;
/** Water beyond the edge of the map, in tiles. */
const WATER_MARGIN = 160;

/** One resource node, drawn either whole or depleted. */
interface NodeInstance {
  whole: THREE.InstancedMesh;
  depleted: THREE.InstancedMesh;
  index: number;
  placement: THREE.Matrix4;
  isDepleted: boolean;
}

export class WorldView {
  readonly group = new THREE.Group();
  readonly picks: Pick[] = [];
  private nodes = new Map<string, NodeInstance>();
  private water: THREE.Mesh;
  private boat: THREE.Mesh | null = null;
  private boatKey = '';

  constructor(readonly map: GameMap) {
    const random = mulberry(3);
    this.water = water(map);
    this.group.add(terrain(map), this.water);
    this.addNodes(random);
    for (const station of map.stations) this.addStation(station);
    this.group.add(...groundDetail(map, random));
  }

  dispose() {
    this.group.traverse(object => (object as THREE.Mesh).geometry?.dispose());
  }

  /** Where a node or station stands, in world units. */
  positionOf(id: string): THREE.Vector3 | null {
    return this.picks.find(pick => pick.id === id)?.box.min ?? null;
  }

  isDepleted(nodeId: string): boolean {
    return this.nodes.get(nodeId)?.isDepleted ?? false;
  }

  update(now: number, depletedIds: Set<string>, self: SelfState) {
    this.water.position.y = WATER_LEVEL + Math.sin(now / 1600) * 0.03;
    for (const [id, node] of this.nodes) setDepleted(node, depletedIds.has(id));
    this.updateBoat(self);
  }

  private addNodes(random: () => number) {
    for (const [type, nodes] of Object.entries(Object.groupBy(this.map.nodes, node => node.type))) {
      const shape = nodeGeo(type);
      const whole = new THREE.InstancedMesh(shape.whole, MAT, nodes!.length);
      const depleted = new THREE.InstancedMesh(shape.depleted, MAT, nodes!.length);
      for (const mesh of [whole, depleted]) {
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
      nodes!.forEach((node, index) => {
        const placement = nodePlacement(node, random);
        whole.setMatrixAt(index, placement);
        depleted.setMatrixAt(index, HIDDEN);
        this.nodes.set(node.id, { whole, depleted, index, placement, isDepleted: false });
        const box = pickBox(node.x, node.y, 1, shape.height);
        this.picks.push({ kind: 'node', id: node.id, name: NODES[type].name, type, box });
      });
      this.group.add(whole, depleted);
    }
  }

  private addStation({ id, type, x, y }: MapStation) {
    const mesh = new THREE.Mesh(stationGeo(type), MAT);
    mesh.position.set(x + 0.5, 0, y + 0.5);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    this.picks.push({ kind: 'station', id, name: STATION_NAMES[type], type, box: pickBox(x, y, 1, 1.5) });
  }

  /** Rebuilds the boat when its parts change. */
  private updateBoat(self: SelfState) {
    const key = JSON.stringify(self.boat);
    if (key === this.boatKey) return;
    this.boatKey = key;
    if (this.boat) {
      this.group.remove(this.boat);
      this.boat.geometry.dispose();
    }
    const required = (id: string) => BOAT_PARTS.find(p => p.id === id)!.qty;
    const dock = this.map.stations.find(station => station.type === 'dock')!;
    this.boat = new THREE.Mesh(
      boatGeo(id => Math.min(1, (self.boat[id] ?? 0) / required(id))),
      MAT,
    );
    this.boat.position.set(dock.x + 2.2, -0.05, dock.y + 2.4);
    this.boat.castShadow = true;
    this.group.add(this.boat);
  }
}

function water(map: GameMap): THREE.Mesh {
  const size = map.size + WATER_MARGIN;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#3fb0bd', transparent: true, opacity: 0.66, roughness: 0.6 }),
  );
  mesh.position.set(map.size / 2, WATER_LEVEL, map.size / 2);
  return mesh;
}

/** Nodes vary a little in size and direction. */
function nodePlacement(node: MapNode, random: () => number): THREE.Matrix4 {
  const scale = 0.9 + random() * 0.25;
  return new THREE.Matrix4().compose(
    new THREE.Vector3(node.x + 0.5, 0, node.y + 0.5),
    new THREE.Quaternion().setFromAxisAngle(UP, random() * 6.28),
    new THREE.Vector3(scale, scale, scale),
  );
}

function setDepleted(node: NodeInstance, isDepleted: boolean) {
  if (isDepleted === node.isDepleted) return;
  node.isDepleted = isDepleted;
  node.whole.setMatrixAt(node.index, isDepleted ? HIDDEN : node.placement);
  node.depleted.setMatrixAt(node.index, isDepleted ? node.placement : HIDDEN);
  node.whole.instanceMatrix.needsUpdate = node.depleted.instanceMatrix.needsUpdate = true;
}

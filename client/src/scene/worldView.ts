// The fixed part of a map: ground, water, resource nodes, stations and the player's boat.
import {
  BOAT_PARTS,
  type Entity,
  type GameMap,
  groundHeight,
  type MapNode,
  type MapStation,
  mulberry,
  NODES,
  type SelfState,
  type TilePos,
} from '@driftwake/shared';
import * as THREE from 'three';
import { MAT } from '../geo';
import { boatGeo, keeperOf, nodeGeo, stationGeo } from '../models';
import { FallingTrees } from './fallingTrees';
import { Glows } from './glows';
import { groundDetail } from './groundDetail';
import { paving } from './paving';
import { type FixedPick, pickBox } from './picking';
import { Ripples } from './ripples';
import { terrain } from './terrain';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
export const WATER_LEVEL = -0.22;
/** Water beyond the edge of the map, in tiles. */
const WATER_MARGIN = 160;

/** Trees fall in sight of the player, rather than being found already down. */
const FALL_RANGE = 14;

/** One resource node, drawn either whole or depleted. */
interface NodeInstance {
  node: MapNode;
  whole: THREE.InstancedMesh;
  depleted: THREE.InstancedMesh;
  index: number;
  placement: THREE.Matrix4;
  isDepleted: boolean;
}

export class WorldView {
  readonly group = new THREE.Group();
  readonly picks: FixedPick[] = [];
  private nodes = new Map<string, NodeInstance>();
  private water: THREE.Mesh;
  private glows = new Glows('#ffd27a');
  private veins = new Glows('#7fd0ff');
  private fallingTrees = new FallingTrees();
  private ripples = new Ripples();
  private boat: THREE.Mesh | null = null;
  private boatKey = '';

  constructor(
    readonly map: GameMap,
    /** 0 to 1: how much grass and pebbles to scatter. */
    groundDetailDensity = 1,
  ) {
    const random = mulberry(3);
    this.water = water(map);
    this.water.visible = !map.cave;
    this.group.add(terrain(map), this.water);
    const slabs = paving(map);
    if (slabs) this.group.add(slabs);
    this.addNodes(random);
    for (const station of map.stations) this.addStation(station);
    this.group.add(
      ...groundDetail(map, random, groundDetailDensity),
      this.glows.group,
      this.veins.group,
      this.fallingTrees.group,
      this.ripples.group,
    );
  }

  dispose() {
    this.group.traverse(object => (object as THREE.Mesh).geometry?.dispose());
  }

  /** The height of the ground at a point, in world units. */
  heightAt = (x: number, z: number) => groundHeight(this.map, x, z);

  /** The middle of a node or station, in world units. */
  centreOf(id: string): TilePos | null {
    const box = this.picks.find(pick => pick.id === id)?.box;
    return box ? [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2] : null;
  }

  isDepleted(nodeId: string): boolean {
    return this.nodes.get(nodeId)?.isDepleted ?? false;
  }

  /** `reported` are the nodes that are depleted, glowing or rich. */
  update(now: number, reported: Entity[], self: SelfState, me?: Entity) {
    this.water.position.y = WATER_LEVEL + Math.sin(now / 1600) * 0.03;
    const glowing = new Set(reported.filter(node => node.glowing).map(node => node.id));
    const rich = new Set(reported.filter(node => node.rich).map(node => node.id));
    const depleted = new Set(reported.map(node => node.id).filter(id => !glowing.has(id) && !rich.has(id)));
    for (const [id, node] of this.nodes) {
      if (depleted.has(id) && !node.isDepleted && me && isTree(node.node) && isNear(node.node, me))
        this.fallingTrees.add(node.whole.geometry, node.placement, node.node.x - me.x, node.node.y - me.y);
      setDepleted(node, depleted.has(id));
    }
    this.glows.show(glowing, id => this.nodes.get(id)!);
    this.veins.show(rich, id => this.nodes.get(id)!);
    this.glows.update(now);
    this.veins.update(now);
    this.fallingTrees.update(now);
    this.ripples.show(this.spotsHere(), id => {
      const { node, placement } = this.nodes.get(id)!;
      return { at: new THREE.Vector3().setFromMatrixPosition(placement), size: NODES[node.type].size };
    });
    this.ripples.update(now, this.water.position.y);
    this.updateBoat(self);
  }

  /** The fishing spots that are where they are drawn. */
  private spotsHere(): Set<string> {
    const here = new Set<string>();
    for (const [id, { node, isDepleted }] of this.nodes)
      if (!isDepleted && NODES[node.type].kind === 'spot') here.add(id);
    return here;
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
        const placement = nodePlacement(this.map, node, random);
        whole.setMatrixAt(index, placement);
        depleted.setMatrixAt(index, HIDDEN);
        this.nodes.set(node.id, { node, whole, depleted, index, placement, isDepleted: false });
        const base = placement.elements[13];
        const box = pickBox(node.x, node.y, NODES[type].size, shape.height, base);
        this.picks.push({ kind: 'node', id: node.id, type, box });
      });
      this.group.add(whole, depleted);
    }
  }

  private addStation({ id, type, x, y }: MapStation) {
    const mesh = new THREE.Mesh(stationGeo(type), MAT);
    const base = groundHeight(this.map, x + 0.5, y + 0.5);
    mesh.position.set(x + 0.5, base, y + 0.5);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    const keeper = keeperOf(type);
    if (keeper) mesh.add(keeper);
    this.picks.push({ kind: 'station', id, type, map: this.map.id, box: pickBox(x, y, 1, 1.5, base) });
  }

  /** Rebuilds the boat when its parts change. */
  private updateBoat(self: SelfState) {
    const dock = this.map.stations.find(station => station.type === 'dock');
    const key = JSON.stringify([self.boat, self.boatAway]);
    if (key === this.boatKey) return;
    this.boatKey = key;
    if (this.boat) {
      this.group.remove(this.boat);
      this.boat.geometry.dispose();
    }
    const required = (id: string) => BOAT_PARTS.find(p => p.id === id)!.qty;
    if (!dock || self.boatAway) return; // the boat is drawn where it is, among the others
    this.boat = new THREE.Mesh(
      boatGeo(id => Math.min(1, (self.boat[id] ?? 0) / required(id))),
      MAT,
    );
    const [boatX, boatZ] = [dock.x + 2.2, dock.y + 2.4];
    this.boat.position.set(boatX, groundHeight(this.map, boatX, boatZ) - 0.05, boatZ);
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
function nodePlacement(map: GameMap, node: MapNode, random: () => number): THREE.Matrix4 {
  const scale = 0.9 + random() * 0.25;
  const half = NODES[node.type].size / 2;
  const onWater = NODES[node.type].kind === 'spot';
  const base = onWater ? WATER_LEVEL : groundHeight(map, node.x + half, node.y + half);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(node.x + half, base, node.y + half),
    new THREE.Quaternion().setFromAxisAngle(UP, random() * 6.28),
    new THREE.Vector3(scale, scale, scale),
  );
}

const isTree = (node: MapNode) => NODES[node.type].kind === 'tree';

const isNear = (node: MapNode, me: Entity) =>
  Math.max(Math.abs(node.x - me.x), Math.abs(node.y - me.y)) <= FALL_RANGE;

function setDepleted(node: NodeInstance, isDepleted: boolean) {
  if (isDepleted === node.isDepleted) return;
  node.isDepleted = isDepleted;
  node.whole.setMatrixAt(node.index, isDepleted ? HIDDEN : node.placement);
  node.depleted.setMatrixAt(node.index, isDepleted ? node.placement : HIDDEN);
  node.whole.instanceMatrix.needsUpdate = node.depleted.instanceMatrix.needsUpdate = true;
}

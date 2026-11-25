import { type GameMap, groundHeight, T } from '@driftwake/shared';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type Pick, pickBox, picksOnRay, tileOnRay } from './picking';

const SIZE = 30;

/** Grass with a hill, 4 tiles high, whose top is at tile 15,15. */
function hillMap(): GameMap {
  const tiles = new Uint8Array(SIZE * SIZE).fill(T.GRASS);
  const heights = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) heights[y * SIZE + x] = Math.max(0, 16 - 4 * Math.hypot(x - 15, y - 15));
  return { size: SIZE, tiles, heights } as unknown as GameMap;
}

const rayFrom = (from: THREE.Vector3, to: THREE.Vector3) =>
  new THREE.Ray(from, to.clone().sub(from).normalize());

describe('tileOnRay', () => {
  it('finds the tile on flat ground', () => {
    const flat = {
      size: SIZE,
      tiles: new Uint8Array(SIZE * SIZE).fill(T.GRASS),
      heights: new Uint8Array(SIZE * SIZE),
    };
    const ray = rayFrom(new THREE.Vector3(5, 10, 20), new THREE.Vector3(8.4, 0, 12.2));
    expect(tileOnRay(ray, flat as unknown as GameMap)).toEqual([8, 12]);
  });
  it('finds the tile on a slope', () => {
    const map = hillMap();
    const target = new THREE.Vector3(13.5, 0, 15.5);
    target.y = groundHeight(map, target.x, target.z);
    expect(target.y).toBeGreaterThan(1.5);
    const ray = rayFrom(new THREE.Vector3(13.5, 14, 28), target);
    expect(tileOnRay(ray, map)).toEqual([13, 15]);
  });
  it('gives the hill, not the tile behind it', () => {
    const map = hillMap();
    const behind = new THREE.Vector3(15.5, 0, 6.5);
    const ray = rayFrom(new THREE.Vector3(15.5, 3.5, 29), behind);
    const [x, y] = tileOnRay(ray, map)!;
    expect(x).toBe(15);
    expect(y).toBeGreaterThan(6);
  });
  it('is null when the ray leaves the map', () => {
    const ray = rayFrom(new THREE.Vector3(5, 10, 20), new THREE.Vector3(5, 0, 40));
    expect(tileOnRay(ray, hillMap())).toBeNull();
  });
});

describe('picksOnRay', () => {
  const map = hillMap();
  const rockAt = (x: number, y: number): Pick => ({
    kind: 'node',
    id: `${x},${y}`,
    type: 'rock_1',
    box: pickBox(x, y, 1, 1, groundHeight(map, x + 0.5, y + 0.5)),
  });
  const seen = (from: THREE.Vector3, rock: Pick) =>
    picksOnRay(rayFrom(from, rock.box.getCenter(new THREE.Vector3())), [rock], map).length === 1;

  it('leaves out what a hill hides', () => {
    expect(seen(new THREE.Vector3(15.5, 3, 29), rockAt(15, 5))).toBe(false);
  });
  it('keeps what is in front of the hill, on its slope, or seen over its top', () => {
    expect(seen(new THREE.Vector3(15.5, 3, 29), rockAt(15, 22))).toBe(true);
    expect(seen(new THREE.Vector3(15.5, 8, 29), rockAt(15, 17))).toBe(true);
    expect(seen(new THREE.Vector3(15.5, 25, 29), rockAt(15, 5))).toBe(true);
  });
  it('keeps the foot of a thing that stands on a slope', () => {
    const rock = rockAt(15, 17);
    const foot = rock.box.getCenter(new THREE.Vector3()).setY(rock.box.min.y + 0.05);
    expect(picksOnRay(rayFrom(new THREE.Vector3(15.5, 14, 28), foot), [rock], map)).toHaveLength(1);
  });
});

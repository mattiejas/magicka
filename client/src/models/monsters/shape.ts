import type { Object3D } from 'three';

/** What a monster's builder returns. Joints without a parent are attached to the model's root. */
export interface MonsterShape {
  parts: Record<string, Object3D>;
  height: number;
  /** Size of the whole model; 1 when left out. */
  scale?: number;
}

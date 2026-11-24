import type { GameMap } from './map';
export const walkable = (m: GameMap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.size && y < m.size && !m.blocked[y * m.size + x];

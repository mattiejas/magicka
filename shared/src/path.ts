import type { GameMap } from './map';
export interface Rect { x: number; y: number; w: number; h: number }
export const rectDist = (x: number, y: number, r: Rect) =>
  Math.max(Math.max(r.x - x, 0, x - (r.x + r.w - 1)), Math.max(r.y - y, 0, y - (r.y + r.h - 1)));
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
export const walkable = (m: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.size && y < m.size && !m.blocked[y * m.size + x];
export function canStep(m: GameMap, x: number, y: number, dx: number, dy: number): boolean {
  if (!walkable(m, x + dx, y + dy)) return false;
  return !(dx && dy) || (walkable(m, x + dx, y) && walkable(m, x, y + dy));
}
export const inReach = (x: number, y: number, r: Rect, reach: number) => rectDist(x, y, r) <= reach;
/** A* to any tile within `reach` of the target; falls back to the reachable tile closest to it. */
export function findPath(m: GameMap, sx: number, sy: number, target: Rect, reach = 0): [number, number][] {
  const N = m.size, start = sy * N + sx;
  const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
  const heap: [number, number][] = [];
  const push = (f: number, c: number) => {
    let i = heap.push([f, c]) - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        let s = i; const l = 2 * i + 1, r = l + 1;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]]; i = s;
      }
    }
    return top[1];
  };
  const h = (x: number, y: number) => Math.max(0, rectDist(x, y, target) - reach);
  g[start] = 0; push(h(sx, sy), start);
  let best = start, bestH = h(sx, sy);
  while (heap.length) {
    const c = pop();
    if (closed[c]) continue;
    closed[c] = 1;
    const x = c % N, y = (c / N) | 0, hh = h(x, y);
    if (hh < bestH) { best = c; bestH = hh; }
    if (hh === 0) { best = c; break; }
    for (const [dx, dy] of DIRS) {
      if (!canStep(m, x, y, dx, dy)) continue;
      const n = (y + dy) * N + x + dx, ng = g[c] + (dx && dy ? 1.001 : 1);
      if (ng < g[n]) { g[n] = ng; from[n] = c; push(ng + h(x + dx, y + dy), n); }
    }
  }
  const out: [number, number][] = [];
  for (let c = best; c !== start; c = from[c]) out.push([c % N, (c / N) | 0]);
  return out.reverse();
}

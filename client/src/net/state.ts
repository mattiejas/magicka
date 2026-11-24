// Everything the client knows about the world. Only connection.ts writes to it.
import {
  type Entity,
  MONSTERS,
  type SelfState,
  TICK_MS,
  type TilePos,
  type TradeView,
} from '@driftwake/shared';

/** An entity together with the walk it is currently showing. */
export interface Track {
  entity: Entity;
  from: TilePos;
  path: TilePos[];
  movedAt: number;
}

export const state = {
  /** Own entity id; empty when not logged in. */
  me: '',
  self: null as SelfState | null,
  entities: new Map<string, Track>(),
  tick: 0,
  tickAt: 0,
  boss: { alive: false, nextTicks: 0, contribution: 0, online: 0, receivedAt: 0 },
  /** Coins taken by graves and the reaper from everyone, once the reaper has been asked. */
  feesTaken: null as number | null,
  trade: null as TradeView | null,
  connected: false,
};

export const myTrack = () => state.entities.get(state.me);

/** The current tick including the fraction that has passed since the last snapshot. */
export const tickNow = () => state.tick + Math.min(1, (performance.now() - state.tickAt) / TICK_MS);

/** Which step of a walk is being shown, and how far along it is. */
function walkProgress(track: Track) {
  const progress = Math.min(1, (performance.now() - track.movedAt) / TICK_MS) * track.path.length;
  const step = Math.min(track.path.length - 1, Math.floor(progress));
  const start = step ? track.path[step - 1] : track.from;
  return { start, end: track.path[step], fraction: Math.min(1, progress - step) };
}

/** Tile position, interpolated between ticks. */
export function positionOf(track: Track): TilePos {
  if (!track.path.length) return [track.entity.x, track.entity.y];
  const { start, end, fraction } = walkProgress(track);
  return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
}

/** Direction of the current step, or null when it does not go anywhere. */
export function walkDirection(track: Track): TilePos | null {
  const { start, end } = walkProgress(track);
  const direction: TilePos = [end[0] - start[0], end[1] - start[1]];
  return direction[0] || direction[1] ? direction : null;
}

/** A little longer than a tick, so a steady walk does not flicker between snapshots. */
const WALK_GRACE_MS = 40;
export const isMoving = (track: Track) =>
  track.path.length > 0 && performance.now() - track.movedAt < TICK_MS + WALK_GRACE_MS;

/** Width of an entity in tiles. */
export const sizeOf = (entity: Entity) => (entity.kind === 'monster' ? MONSTERS[entity.type!].size : 1);

/** Interpolated centre of an entity in world units. */
export function centreOf(track: Track): TilePos {
  const [x, y] = positionOf(track);
  const half = sizeOf(track.entity) / 2;
  return [x + half, y + half];
}

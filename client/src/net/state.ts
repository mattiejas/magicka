// Everything the client knows about the world. Only connection.ts writes to it.
import {
  type ChartUpdate,
  type Entity,
  MONSTERS,
  type SelfState,
  TICK_MS,
  type TilePos,
  type TradeView,
  type Voyage,
} from '@driftwake/shared';

/** An entity together with the walk it is currently showing. */
export interface Track {
  entity: Entity;
  from: TilePos;
  path: TilePos[];
  movedAt: number;
  /** When the boat's latest trail arrived, and the heading it had before. */
  sailedAt: number;
  headingFrom: number;
}

export const state = {
  /** Own entity id; empty when not logged in. */
  me: '',
  self: null as SelfState | null,
  entities: new Map<string, Track>(),
  tick: 0,
  tickAt: 0,
  boss: { alive: false, nextTicks: 0, contribution: 0, online: 0, next: '', receivedAt: 0 },
  /** Coins taken by graves and the reaper from everyone, once the reaper has been asked. */
  feesTaken: null as number | null,
  trade: null as TradeView | null,
  connected: false,
  /** While aboard: the boat's speed, course and arc. */
  voyage: null as Voyage | null,
  /** What the player has seen of the sea, kept by charts.ts. */
  chart: null as ChartUpdate | null,
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

/** Where a boat is between ticks, along the points it passed in the latest one, and its heading in degrees. */
export function boatAt(track: Track): { x: number; y: number; heading: number } | null {
  const { boat } = track.entity;
  if (!boat) return null;
  const fraction = Math.min(1, (performance.now() - track.sailedAt) / TICK_MS);
  const turned = ((((boat.heading - track.headingFrom) % 360) + 540) % 360) - 180;
  const heading = track.headingFrom + turned * fraction;
  const trail = boat.trail;
  if (!trail || trail.length < 2) return { x: boat.x, y: boat.y, heading };
  const along = fraction * (trail.length - 1);
  const step = Math.min(trail.length - 2, Math.floor(along));
  const [ax, ay] = trail[step];
  const [bx, by] = trail[step + 1];
  const u = along - step;
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, heading };
}

/** How far towards the stern from the middle of the boat its sailor stands, at the helm. */
const HELM_OFFSET = 0.75;

/** Tile position, interpolated between ticks. A sailor is where their boat is. */
export function positionOf(track: Track): TilePos {
  const boat = track.entity.boat?.aboard && boatAt(track);
  if (boat) {
    const radians = (boat.heading * Math.PI) / 180;
    return [boat.x - Math.sin(radians) * HELM_OFFSET - 0.5, boat.y + Math.cos(radians) * HELM_OFFSET - 0.5];
  }
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
  !track.entity.boat?.aboard &&
  track.path.length > 0 &&
  performance.now() - track.movedAt < TICK_MS + WALK_GRACE_MS;

/** Width of an entity in tiles. */
export const sizeOf = (entity: Entity) => (entity.kind === 'monster' ? MONSTERS[entity.type!].size : 1);

/** Interpolated centre of an entity in world units. */
export function centreOf(track: Track): TilePos {
  const [x, y] = positionOf(track);
  const half = sizeOf(track.entity) / 2;
  return [x + half, y + half];
}

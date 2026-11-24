// Where a panel belongs, so that it closes when its player walks away.
import { MAPS, type MapId, type StationType } from '@driftwake/shared';

type Position = { x: number; y: number };

/** Finds the place of a panel on a map. Nothing is found when the place is not there (any more). */
export type Place = 'anywhere' | ((map: MapId) => Position | undefined);

export const atStation =
  (type: StationType): Place =>
  map =>
    MAPS[map].stations.find(station => station.type === type);

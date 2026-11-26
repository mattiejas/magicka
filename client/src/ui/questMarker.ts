// Where the current quest step is done, for the minimap to mark.
import { type MapId, QUESTS, type Quest, type QuestPlace, type TilePos } from '@driftwake/shared';

/**
 * The place of the first step not yet done, of the first quest begun and not finished.
 * Nothing when that place is on another map, or the player is already there.
 */
export function questPlace(
  quests: Record<string, number>,
  map: MapId,
  [x, y]: TilePos,
  all: Quest[] = QUESTS,
): QuestPlace | undefined {
  for (const { id, steps } of all) {
    const place = steps[quests[id]]?.place;
    if (!place) continue;
    if (place.map !== map || Math.hypot(place.x - x, place.y - y) <= place.r) return;
    return place;
  }
}

/**
 * Where to draw a place seen from `centre`, in tiles: the place itself while it lies within `range`,
 * otherwise the point at that distance in its direction, so that it sits at the edge of the minimap.
 */
export function pullInside([x, y]: TilePos, [centreX, centreY]: TilePos, range: number) {
  const dx = x - centreX;
  const dy = y - centreY;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance <= range) return { at: [x, y] as TilePos, inside: true };
  const pull = range / distance;
  return { at: [centreX + dx * pull, centreY + dy * pull] as TilePos, inside: false };
}

// Moves the station panel down when the hint or the boss bar at the top centre would lie over it.
import { byId, uiRoot } from '../dom';
import { onUiScale, uiScale } from '../scale';

/** Room left between the panel and the hint, in scaled pixels. */
const GAP = 8;

/** Sets `--station-top` so that the panel starts below the top centre when the two would overlap. */
export function placeStation() {
  const top = byId('top');
  const station = byId('station');
  if (!top || !station) return;
  const scale = uiScale();
  const above = top.getBoundingClientRect();
  const panel = station.getBoundingClientRect();
  const overlaps = above.height > 0 && above.left < panel.right + GAP * scale;
  const root = uiRoot();
  if (overlaps) root.style.setProperty('--station-top', `${above.bottom / scale + GAP}px`);
  else root.style.removeProperty('--station-top');
}

let observer: ResizeObserver | undefined;

/** Places the panel again whenever the top centre, shown afresh with each game, changes size. */
export function keepStationClearOfTop() {
  if (!observer) {
    observer = new ResizeObserver(() => placeStation());
    addEventListener('resize', () => placeStation());
    onUiScale(placeStation);
  }
  observer.disconnect();
  const top = byId('top');
  if (top) observer.observe(top);
}

// Frames drawn each second, when the player wants to see it.
import { onSettings } from '../settings';
import { h } from './dom';

const UPDATE_MS = 500;

/** Call the returned function every frame. */
export function fpsCounter(): (now: number) => void {
  const element = h('div', { id: 'fps', class: 'panel num' });
  let frames = 0;
  let since = performance.now();
  onSettings(({ showFps }) => {
    element.hidden = !showFps;
    element.textContent = '';
    frames = 0;
    since = performance.now();
  });
  document.body.append(element); // outside the interface, which is rebuilt when signing in
  return now => {
    if (element.hidden) return;
    frames++;
    const elapsed = now - since;
    if (elapsed < UPDATE_MS) return;
    element.textContent = `${Math.round((frames * 1000) / elapsed)} FPS`;
    frames = 0;
    since = now;
  };
}

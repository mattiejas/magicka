import { GAME_NAME } from '@driftwake/shared';
import { bindInput } from './input';
import { onMessage } from './net/connection';
import { state } from './net/state';
import { Scene } from './scene/scene';
import { initUi } from './ui';
import { byId } from './ui/dom';

/** Longer pauses, such as a hidden tab, are treated as one frame of this many seconds. */
const MAX_FRAME_SECONDS = 0.1;

document.title = GAME_NAME;
const canvas = byId('view') as HTMLCanvasElement;
const scene = new Scene(canvas, byId('overlay')!);
const updateInput = bindInput(canvas, scene);
const updateUi = initUi();
onMessage(msg => {
  if (msg.type === 'snapshot') for (const event of msg.events) scene.handleEvent(event);
  if (msg.type === 'chat') scene.showChat(msg.id, msg.text);
  if (msg.type === 'welcome') scene.forgetChat();
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
  last = now;
  updateInput(dt);
  scene.frame(dt);
  updateUi(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For poking around in the browser console.
if (import.meta.env.DEV) Object.assign(window, { game: { state, scene } });

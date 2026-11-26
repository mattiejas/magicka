// What each level of a skill opens, as the skills tab lists it. The list itself comes from the content.
import { type Skill, UNLOCKS, type Unlock } from '@driftwake/shared';
import { h } from './dom';
import { icon } from './icons';
import { skillIcon } from './icons/skills';

/** Done: the player can already do it. Next: what the next level that opens anything opens. */
export type Reach = 'done' | 'next' | 'later';

export function reachOf(unlocks: readonly Unlock[], level: number): Reach[] {
  const next = unlocks.find(unlock => unlock.level > level)?.level;
  return unlocks.map(unlock => (unlock.level <= level ? 'done' : unlock.level === next ? 'next' : 'later'));
}

const capitalised = (text: string) => text[0].toUpperCase() + text.slice(1);

export function unlockList(skill: Skill, level: number): HTMLElement {
  const unlocks = UNLOCKS[skill];
  const reach = reachOf(unlocks, level);
  return h(
    'ol',
    { class: 'unlocks', 'aria-label': `What ${skill} opens` },
    ...unlocks.map((unlock, i) =>
      h(
        'li',
        { class: reach[i] },
        h('b', { class: 'num' }, String(unlock.level)),
        h('span', { class: 'unlock-icon', html: unlock.item ? icon(unlock.item) : skillIcon(skill, 'icon') }),
        h('span', {}, capitalised(unlock.text)),
        reach[i] === 'done' && h('span', { class: 'unlock-done', title: 'You can do this' }, '✓'),
      ),
    ),
  );
}

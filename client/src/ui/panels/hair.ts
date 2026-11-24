import { HAIR_COLORS, HAIRCUTS, type Look, type SelfState } from '@driftwake/shared';
import { send } from '../../net/connection';
import { h } from '../dom';
import { portrait } from '../portrait';
import type { Panel } from '.';

const PREVIEW_SIZE = 88;
const choose = (look: Look) => send({ type: 'look', look });

/** Props of a button that is one choice out of several. */
const choice = (selected: boolean, focus: string, look: Look) => ({
  class: selected ? 'on' : '',
  'aria-pressed': String(selected),
  'data-focus': focus,
  onclick: () => choose(look),
});

function cutButton({ name, look }: SelfState, cut: number) {
  const option = { ...look, cut };
  const preview = { src: portrait(name, option), alt: '', width: PREVIEW_SIZE, height: PREVIEW_SIZE };
  return h('button', choice(look.cut === cut, `cut${cut}`, option), h('img', preview), HAIRCUTS[cut].name);
}

function colorButton({ look }: SelfState, color: number) {
  const { name, color: value } = HAIR_COLORS[color];
  const props = choice(look.color === color, `color${color}`, { ...look, color });
  return h('button', { ...props, 'aria-label': name, title: name }, h('i', { style: `background:${value}` }));
}

export const hairPanel: Panel = {
  title: 'Hair',
  key: ({ name, look, equip }) => `${name},${look.cut},${look.color},${!!equip.head}`,
  render(self) {
    return [
      h('div', { class: 'cuts' }, ...HAIRCUTS.map((_, cut) => cutButton(self, cut))),
      h('div', { class: 'mute swatch-label' }, `Colour: ${HAIR_COLORS[self.look.color].name}`),
      h('div', { class: 'swatches' }, ...HAIR_COLORS.map((_, color) => colorButton(self, color))),
      ...(self.equip.head
        ? [h('p', { class: 'mute' }, 'Your headgear covers your hair while you wear it.')]
        : []),
    ];
  },
};

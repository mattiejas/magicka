import { SKILLS } from '@driftwake/shared';
import { send } from '../../net/connection';
import { h } from '../dom';
import { skillIcon } from '../icons/skills';
import { level } from '../items';
import { closePanel, type Panel } from '.';

export const lampPanel: Panel = {
  title: "Genie's lamp",
  place: 'anywhere',
  key: ({ xp }) => JSON.stringify(xp),
  render() {
    const choose = SKILLS.map(skill =>
      h('button', {
        type: 'button',
        class: 'skill-choice',
        html: `${skillIcon(skill, 'skill-icon')}${skill} ${level(skill)}`,
        onclick: () => {
          send({ type: 'useLamp', skill });
          closePanel();
        },
      }),
    );
    return [
      h('p', {}, 'Choose a skill. The lamp teaches what ten quiet minutes of practice would.'),
      h('div', { class: 'choices' }, ...choose),
    ];
  },
};

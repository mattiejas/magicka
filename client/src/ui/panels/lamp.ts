import { SKILLS } from '@driftwake/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { level } from '../items';
import { closePanel, type Panel } from '.';

export const lampPanel: Panel = {
  title: "Genie's lamp",
  key: ({ xp }) => JSON.stringify(xp),
  render() {
    const choose = SKILLS.map(skill =>
      button(`${skill} ${level(skill)}`, () => {
        send({ type: 'useLamp', skill });
        closePanel();
      }),
    );
    return [
      h('p', {}, 'Choose a skill. The lamp teaches what ten quiet minutes of practice would.'),
      h('div', { class: 'choices' }, ...choose),
    ];
  },
};

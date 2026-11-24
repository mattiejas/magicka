// The world boss timer and the health bar of a boss nearby.
import { type Entity, MAPS, MONSTERS, TICK_MS } from '@driftwake/shared';
import { state } from '../net/state';
import { bar, byId, h, renderIfChanged } from './dom';

export function updateBosses() {
  updateTimer();
  updateHealthBar();
}

function timeUntilBoss(): string {
  const { nextTicks, receivedAt } = state.boss;
  const milliseconds = nextTicks * TICK_MS - (performance.now() - receivedAt);
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateTimer() {
  const { self, boss } = state;
  const element = byId('mapcap');
  if (!element || !self) return;
  const status = boss.alive ? 'Awake now' : timeUntilBoss();
  renderIfChanged(element, `${status},${boss.online},${self.map}`, () => [
    h(
      'div',
      {},
      h('span', {}, MAPS[self.map].name),
      h('span', { class: 'mute num' }, `${boss.online} online`),
    ),
    h(
      'div',
      {},
      h('span', { class: 'mute' }, 'World boss'),
      h('span', { class: `num ${boss.alive ? 'k-boss' : ''}` }, status),
    ),
  ]);
}

/** A boss in view that is hurt or attacking. */
function engagedBoss(): Entity | undefined {
  return [...state.entities.values()]
    .map(track => track.entity)
    .find(({ boss, hp, maxHp }) => boss && (hp! < maxHp! || boss.state !== 'choose'));
}

function currentAttack({ type, boss }: Entity): string {
  if (boss!.state !== 'windup') return '';
  return MONSTERS[type!].boss!.attacks.find(attack => attack.id === boss!.attack)?.name ?? '';
}

function updateHealthBar() {
  const element = byId('boss');
  if (!element) return;
  const entity = engagedBoss();
  element.hidden = !entity;
  if (!entity) return;
  const { hp, maxHp, type } = entity;
  const { name, boss } = MONSTERS[type!];
  const attack = currentAttack(entity);
  const { contribution } = state.boss;
  const share =
    boss!.world && h('small', { class: 'num' }, `Contribution ${(contribution * 100).toFixed(1)}%`);
  renderIfChanged(element, `${type},${hp}/${maxHp},${attack},${contribution}`, () => [
    h('div', { class: 'row' }, h('h2', {}, name), h('span', { class: 'num' }, `${hp} / ${maxHp}`)),
    bar(hp! / maxHp!),
    h('div', { class: 'row' }, h('small', {}, attack || ' '), share),
  ]);
}

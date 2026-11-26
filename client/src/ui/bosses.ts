// The world boss timer and the health bar of a boss nearby.
import { type Entity, MAPS, MONSTERS, TICK_MS } from '@driftwake/shared';
import { state } from '../net/state';
import { DamageBar } from './damageBar';
import { byId, h, renderIfChanged } from './dom';

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
  const label = boss.next || 'World boss';
  renderIfChanged(element, `${status},${boss.online},${self.map},${label}`, () => [
    h(
      'div',
      {},
      h('span', {}, MAPS[self.map].name),
      h('span', { class: 'mute num' }, `${boss.online} online`),
    ),
    h(
      'div',
      {},
      h('span', { class: 'mute' }, label),
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

/** The parts of the boss panel kept between updates, so that its health bar can animate. */
interface BossPanel {
  heading: HTMLElement;
  footer: HTMLElement;
  bar?: DamageBar;
  /** The boss the bar belongs to; another boss gets a fresh bar, without red from the last one. */
  id?: string;
}
const panels = new WeakMap<HTMLElement, BossPanel>();

function panelOf(element: HTMLElement): BossPanel {
  let panel = panels.get(element);
  if (!panel) {
    panel = { heading: h('div', { class: 'row' }), footer: h('div', { class: 'row' }) };
    element.replaceChildren(panel.heading, panel.footer);
    panels.set(element, panel);
  }
  return panel;
}

function barFor(panel: BossPanel, id: string): DamageBar {
  if (panel.bar && panel.id === id) return panel.bar;
  const bar = new DamageBar(h('div', { class: 'bar' }), 'width');
  if (panel.bar) panel.bar.track.replaceWith(bar.track);
  else panel.heading.after(bar.track);
  panel.bar = bar;
  panel.id = id;
  return bar;
}

function updateHealthBar() {
  const element = byId('boss');
  if (!element) return;
  const entity = engagedBoss();
  element.hidden = !entity;
  if (!entity) return;
  const { id, hp, maxHp, type } = entity;
  const { name, boss } = MONSTERS[type!];
  const attack = currentAttack(entity);
  const { contribution } = state.boss;
  const panel = panelOf(element);
  renderIfChanged(panel.heading, `${type},${hp}/${maxHp}`, () => [
    h('h2', {}, name),
    h('span', { class: 'num' }, `${hp} / ${maxHp}`),
  ]);
  barFor(panel, id).set(hp! / maxHp!);
  renderIfChanged(panel.footer, `${attack},${boss!.world && contribution}`, () => {
    const parts = [h('small', {}, attack || ' ')];
    if (boss!.world)
      parts.push(h('small', { class: 'num' }, `Contribution ${(contribution * 100).toFixed(1)}%`));
    return parts;
  });
}

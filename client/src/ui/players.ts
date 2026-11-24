// What can be done about another player.
import { REPORT_REASONS, type ReportReason } from '@driftwake/shared';
import { send } from '../net/connection';
import { state } from '../net/state';
import { type MenuItem, showMenu } from './popups';

const REASONS: Record<ReportReason, string> = {
  language: 'Offensive language',
  scam: 'Scamming',
  cheating: 'Cheating',
  other: 'Something else',
};

export const isBlocked = (name: string) => !!state.self?.blocked.includes(name.toLowerCase());

export const setBlocked = (name: string, on: boolean) => send({ type: 'block', name, on });

/** Where the menu was opened, so that choosing a reason opens in the same place. */
interface Place {
  x: number;
  y: number;
}

function askReason(name: string, { x, y }: Place) {
  const reasons = REPORT_REASONS.map(
    (reason): MenuItem => [
      `Report ${name}: ${REASONS[reason]}`,
      () => send({ type: 'report', name, reason }),
    ],
  );
  showMenu(x, y, reasons);
}

/** Entries of a right-click menu. Without an id, the player is not in sight. */
export function playerMenu(name: string, id: string | undefined, place: Place): MenuItem[] {
  if (name === state.self?.name) return [];
  const blocked = isBlocked(name);
  return [
    ...(id ? [[`Trade with ${name}`, () => send({ type: 'trade', id })] as MenuItem] : []),
    [blocked ? `Unblock ${name}` : `Block ${name}`, () => setBlocked(name, !blocked)],
    [`Report ${name}`, () => askReason(name, place)],
  ];
}

export function playerInSight(name: string): string | undefined {
  for (const { entity } of state.entities.values())
    if (entity.kind === 'player' && entity.name === name) return entity.id;
}

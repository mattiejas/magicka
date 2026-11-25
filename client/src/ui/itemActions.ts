// What clicking, Shift-clicking or right-clicking an item in the inventory does. The open panel comes first.
import { type ClientMsg, ITEMS, type Stack } from '@driftwake/shared';
import type { Panel, PanelId } from './panels';

export type ItemAction = ClientMsg | { type: 'openPanel'; panel: PanelId };

/** Items that are used in a panel of their own. */
const OPENS: Record<string, PanelId> = { genie_lamp: 'lamp' };

/** Nothing for items that cannot be used. */
export function clickAction({ id }: Stack, slot: number, panel: Panel | null): ItemAction | undefined {
  const item = ITEMS[id];
  if (panel?.itemUse) return panel.itemUse.click(id);
  if (OPENS[id]) return { type: 'openPanel', panel: OPENS[id] };
  if (item.heal) return { type: 'eat', slot };
  if (item.slot) return { type: 'equip', slot };
}

/** What Shift and click does. Nothing for trophies, and nothing where a panel blocks it. */
export function quickDropAction({ id }: Stack, slot: number, panel: Panel | null): ItemAction | undefined {
  if (canDrop(id) && !panel?.itemUse?.blocksQuickDrop) return { type: 'drop', slot };
}

const canDrop = (id: string) => !ITEMS[id].trophy;

export function menuActions(
  { id }: Stack,
  slot: number,
  panel: Panel | null,
): [label: string, action: ItemAction][] {
  const item = ITEMS[id];
  const entries: [string, ItemAction][] = [];
  if (item.heal) entries.push([`Eat ${item.name}`, { type: 'eat', slot }]);
  if (item.slot) entries.push([`Equip ${item.name}`, { type: 'equip', slot }]);
  entries.push(...(panel?.itemUse?.menu(id) ?? []));
  if (canDrop(id)) entries.push([`Drop ${item.name}`, { type: 'drop', slot }]);
  return entries;
}

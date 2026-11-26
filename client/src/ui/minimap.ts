// The minimap: a pre-drawn picture of the map with moving dots on top.
import { type Entity, type GameMap, MAPS, MONSTERS, type QuestPlace, type TilePos } from '@driftwake/shared';
import { isAboard, steer } from '../helm';
import { send } from '../net/connection';
import { myTrack, positionOf, state } from '../net/state';
import { CAVE_COLOR, TILE_COLORS } from '../scene/palette';
import { settings } from '../settings';
import { chartTile, drawChart } from './chartMap';
import { byId, h } from './dom';
import { menuButtons } from './menuButtons';
import { pullInside, questPlace } from './questMarker';

const CANVAS_SIZE = 416;
/** Tiles shown from the centre to an edge. */
const RANGE = 26;
const SCALE = CANVAS_SIZE / (RANGE * 2);
/** Pixels per tile in the pre-drawn picture. */
const PICTURE_SCALE = 4;
/** How far in from the edge, in tiles, something out of range is drawn. */
const EDGE = 2;
/** One breath of the quest marker's pulse. */
const PULSE_MS = 1600;
const ARROW_SIZE = 14;

const COLORS = {
  self: '#f5f0e4',
  player: '#7cc0b1',
  monster: '#d9a05b',
  boss: '#c9604a',
  drop: '#e3c274',
  grave: '#222a30',
  npc: '#b48fd0',
  station: '#2a343b',
  tree: '#54703f',
  plant: '#b8bf6a',
  rock: '#5f5c57',
  spot: '#cfeef2',
  label: '#f5f0e4',
  labelEdge: 'rgba(34,42,48,.8)',
  quest: '255,214,102',
  questEdge: 'rgba(34,42,48,.9)',
};

let picture: { mapId: string; canvas: HTMLCanvasElement } | null = null;

export const minimapPanel = () =>
  h(
    'div',
    { id: 'map', class: 'panel' },
    h('canvas', { width: CANVAS_SIZE, height: CANVAS_SIZE, id: 'mm', onclick: walkToClick }),
    h('div', { class: 'cap', id: 'mapcap' }),
    menuButtons(),
  );

function walkToClick(event: MouseEvent) {
  const me = myTrack()?.entity;
  if (!me) return;
  if (state.self?.map === 'sea') {
    const tile = chartTile(event);
    if (isAboard()) steer(tile);
    return;
  }
  const box = (event.target as HTMLElement).getBoundingClientRect();
  const x = Math.round(me.x + ((event.clientX - box.left) / box.width - 0.5) * RANGE * 2);
  const y = Math.round(me.y + ((event.clientY - box.top) / box.height - 0.5) * RANGE * 2);
  if (x >= 0 && y >= 0) send({ type: 'move', x, y });
}

export function drawMinimap() {
  const { self } = state;
  const track = myTrack();
  const canvas = byId('mm') as HTMLCanvasElement | null;
  if (!self || !track || !canvas) return;
  const context = canvas.getContext('2d')!;
  if (self.map === 'sea') return drawChart(context);
  const centre = positionOf(track);
  const map = MAPS[self.map];
  drawPicture(context, map, centre);
  for (const { entity, position } of visibleEntities()) drawEntity(context, entity, position, centre);
  for (const label of map.labels) drawLabel(context, label.name, [label.x, label.y], centre);
  if (self.map === 'mainland' && state.boss.alive) drawWorldBoss(context, map, centre);
  if (settings().questMarker) drawQuestMarker(context, questPlace(self.quests, self.map, centre), centre);
}

const visibleEntities = () =>
  [...state.entities.values()].map(track => ({ entity: track.entity, position: positionOf(track) }));

const toCanvas = ([x, y]: TilePos, [centreX, centreY]: TilePos): TilePos => [
  (x - centreX + RANGE) * SCALE,
  (y - centreY + RANGE) * SCALE,
];

function drawPicture(context: CanvasRenderingContext2D, map: GameMap, [x, y]: TilePos) {
  if (picture?.mapId !== map.id) picture = { mapId: map.id, canvas: paintMap(map) };
  context.imageSmoothingEnabled = false;
  context.fillStyle = emptyColor(map);
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const left = (x + 0.5 - RANGE) * PICTURE_SCALE;
  const top = (y + 0.5 - RANGE) * PICTURE_SCALE;
  const size = RANGE * 2 * PICTURE_SCALE;
  context.drawImage(picture.canvas, left, top, size, size, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function paintMap(map: GameMap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = map.size * PICTURE_SCALE;
  const context = canvas.getContext('2d')!;
  const fill = (x: number, y: number, color: string, grow = 0) => {
    const size = PICTURE_SCALE + grow * 2;
    context.fillStyle = color;
    context.fillRect(x * PICTURE_SCALE - grow, y * PICTURE_SCALE - grow, size, size);
  };
  map.tiles.forEach((tile, i) => {
    fill(i % map.size, Math.floor(i / map.size), tile ? TILE_COLORS[tile] : emptyColor(map));
  });
  for (const node of map.nodes) fill(node.x, node.y, nodeColor(node.type));
  for (const station of map.stations) fill(station.x, station.y, COLORS.station, 1);
  return canvas;
}

const emptyColor = ({ cave }: GameMap) => (cave ? CAVE_COLOR : TILE_COLORS[0]);

/** Every place a fishing spot can be is shown, since spots move among them. */
function nodeColor(type: string): string {
  if (type.startsWith('tree')) return COLORS.tree;
  if (type.startsWith('spot') || type.startsWith('shoal')) return COLORS.spot;
  return type.startsWith('plant') || type === 'berry_bush' ? COLORS.plant : COLORS.rock;
}

function drawDot(context: CanvasRenderingContext2D, [x, y]: TilePos, color: string, radius: number) {
  context.fillStyle = color;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawEntity(context: CanvasRenderingContext2D, entity: Entity, position: TilePos, centre: TilePos) {
  const at = toCanvas(position, centre);
  switch (entity.kind) {
    case 'monster':
      return drawDot(context, at, entity.boss ? COLORS.boss : COLORS.monster, entity.boss ? 8 : 4);
    case 'player':
      return drawDot(context, at, entity.id === state.me ? COLORS.self : COLORS.player, 5);
    case 'drop':
      return drawDot(context, at, COLORS.drop, 3);
    case 'npc':
      return drawDot(context, at, COLORS.npc, 6);
    case 'grave':
      return drawDot(context, at, COLORS.grave, 6);
  }
}

function drawLabel(context: CanvasRenderingContext2D, text: string, position: TilePos, centre: TilePos) {
  const [x, y] = toCanvas(position, centre);
  context.font = '20px "Avenir Next","Segoe UI",sans-serif';
  context.textAlign = 'center';
  context.lineWidth = 4;
  context.strokeStyle = COLORS.labelEdge;
  context.strokeText(text, x, y);
  context.fillStyle = COLORS.label;
  context.fillText(text, x, y);
}

/** Marks the world boss, at the edge when it is out of range. */
function drawWorldBoss(context: CanvasRenderingContext2D, map: GameMap, centre: TilePos) {
  const boss = map.spawns.find(spawn => MONSTERS[spawn.type].boss?.world)!;
  const { at } = pullInside([boss.x, boss.y], centre, RANGE - EDGE);
  drawDot(context, toCanvas(at, centre), COLORS.boss, 8);
}

/** A soft pulse over the place of the current quest step, or an arrow at the edge towards it. */
function drawQuestMarker(context: CanvasRenderingContext2D, place: QuestPlace | undefined, centre: TilePos) {
  if (!place) return;
  const { at, inside } = pullInside([place.x, place.y], centre, RANGE - EDGE);
  const [x, y] = toCanvas(at, centre);
  if (!inside) return drawArrow(context, x, y, Math.atan2(place.y - centre[1], place.x - centre[0]));
  const phase = (performance.now() % PULSE_MS) / PULSE_MS;
  const radius = Math.max(place.r, 1) * SCALE;
  context.beginPath();
  context.arc(x, y, radius * (0.4 + 0.6 * phase), 0, Math.PI * 2);
  context.fillStyle = `rgba(${COLORS.quest},${0.35 * (1 - phase)})`;
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = `rgba(${COLORS.quest},${0.9 * (1 - phase)})`;
  context.stroke();
}

function drawArrow(context: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(ARROW_SIZE, 0);
  context.lineTo(-ARROW_SIZE * 0.7, -ARROW_SIZE * 0.75);
  context.lineTo(-ARROW_SIZE * 0.3, 0);
  context.lineTo(-ARROW_SIZE * 0.7, ARROW_SIZE * 0.75);
  context.closePath();
  context.lineWidth = 3;
  context.strokeStyle = COLORS.questEdge;
  context.stroke();
  context.fillStyle = `rgb(${COLORS.quest})`;
  context.fill();
  context.restore();
}

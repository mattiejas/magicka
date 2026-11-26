// The chart: at sea the minimap shows the whole sea as far as the player has seen it, and steers where it is clicked.
import { type ChartUpdate, MAPS, type TilePos } from '@driftwake/shared';
import { myTrack, positionOf, state } from '../net/state';
import { TILE_COLORS } from '../scene/palette';
import { isCharted } from '../scene/seaFog';

const FOG = '#5d6d72';
const COLORS = { self: '#f5f0e4', course: '#8fd0c0', label: '#f5f0e4', labelEdge: 'rgba(34,42,48,.85)' };
const sea = () => MAPS.sea;

let picture: { chart: ChartUpdate; canvas: HTMLCanvasElement } | null = null;
let middles: Map<string, TilePos> | null = null;

/** The tile of the sea under a point of the chart's canvas. */
export function chartTile(event: MouseEvent): TilePos {
  const box = (event.target as HTMLElement).getBoundingClientRect();
  const { size } = sea();
  return [
    Math.floor(((event.clientX - box.left) / box.width) * size),
    Math.floor(((event.clientY - box.top) / box.height) * size),
  ];
}

export function drawChart(context: CanvasRenderingContext2D) {
  const { chart, voyage } = state;
  const { width } = context.canvas;
  const scale = width / sea().size;
  context.imageSmoothingEnabled = false;
  if (chart && picture?.chart !== chart) picture = { chart, canvas: paintChart(chart) };
  context.fillStyle = FOG;
  context.fillRect(0, 0, width, width);
  if (picture) context.drawImage(picture.canvas, 0, 0, width, width);
  for (const id of chart?.found ?? []) {
    const middle = middleOf(id);
    if (middle)
      label(context, sea().places.find(p => p.id === id)!.name, middle[0] * scale, middle[1] * scale);
  }
  if (voyage?.course) {
    context.strokeStyle = COLORS.course;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(voyage.course[0] * scale, voyage.course[1] * scale, 5, 0, Math.PI * 2);
    context.stroke();
  }
  const track = myTrack();
  if (track) {
    const [x, y] = positionOf(track);
    context.fillStyle = COLORS.self;
    context.fillRect((x + 0.5) * scale - 4, (y + 0.5) * scale - 4, 8, 8);
  }
}

function paintChart(chart: ChartUpdate): HTMLCanvasElement {
  const map = sea();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = map.size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(map.size, map.size);
  const rgb = TILE_COLORS.map(hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)));
  const fog = [1, 3, 5].map(i => Number.parseInt(FOG.slice(i, i + 2), 16));
  for (let i = 0; i < map.tiles.length; i++) {
    const color = isCharted(map, chart, i) ? rgb[map.tiles[i]] : fog;
    image.data.set([...color, 255], i * 4);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** The middle of each place's land, where its name is written. */
function middleOf(id: string): TilePos | undefined {
  if (!middles) {
    const map = sea();
    const sums = map.places.map(() => [0, 0, 0]);
    map.placeOf.forEach((place, i) => {
      if (!place) return;
      const sum = sums[place - 1];
      sum[0] += i % map.size;
      sum[1] += Math.floor(i / map.size);
      sum[2]++;
    });
    middles = new Map(map.places.map((p, k) => [p.id, [sums[k][0] / sums[k][2], sums[k][1] / sums[k][2]]]));
  }
  return middles.get(id);
}

function label(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.font = '18px "Avenir Next","Segoe UI",sans-serif';
  context.textAlign = 'center';
  context.lineWidth = 4;
  context.strokeStyle = COLORS.labelEdge;
  context.strokeText(text, x, y);
  context.fillStyle = COLORS.label;
  context.fillText(text, x, y);
}

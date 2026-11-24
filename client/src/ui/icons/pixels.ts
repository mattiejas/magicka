// A small square of pixels to draw item icons on.
import { shade as darker } from './ramp';

export const SIZE = 24;
const OUTLINE = 0.34;
type Color = string | null | undefined | false;
export type Dot = [x: number, y: number];

export class Pixels {
  private dots: (string | null)[] = Array(SIZE * SIZE).fill(null);

  at = (x: number, y: number) => (x >= 0 && y >= 0 && x < SIZE && y < SIZE ? this.dots[y * SIZE + x] : null);

  set(x: number, y: number, color: Color) {
    if (color && x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.dots[y * SIZE + x] = color;
  }

  /** Colours every pixel the function returns a colour for. */
  paint(colorAt: (x: number, y: number) => Color): this {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) this.set(x, y, colorAt(x, y));
    return this;
  }

  /**
   * The same along the diagonal that weapons lie on: `along` runs from about -22 at the lower left to 22 at the
   * upper right, `across` from negative at the upper left to positive at the lower right.
   */
  diagonal(colorAt: (along: number, across: number) => Color): this {
    return this.paint((x, y) => colorAt(x - y, x + y - (SIZE - 1)));
  }

  /** A filled shape. `colorAt` may depend on the place inside it. */
  poly(corners: Dot[], colorAt: string | ((x: number, y: number) => Color)): this {
    return this.paint(
      (x, y) => inside(corners, x + 0.5, y + 0.5) && (typeof colorAt === 'string' ? colorAt : colorAt(x, y)),
    );
  }

  /** A filled shape, lit from the upper left. */
  lit(corners: Dot[], ramp: string[]): this {
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    const [left, top] = [Math.min(...xs), Math.min(...ys)];
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    return this.poly(corners, (x, y) => {
      const depth = ((x - left) / width) * 0.6 + ((y - top) / height) * 0.4;
      return ramp[depth < 0.2 ? 4 : depth < 0.42 ? 3 : depth < 0.68 ? 2 : 1];
    });
  }

  /** A ball, lit from the upper left. */
  ball(cx: number, cy: number, radius: number, ramp: string[]): this {
    return this.paint((x, y) => {
      if (Math.hypot(x - cx, y - cy) > radius) return null;
      const depth = Math.hypot(x - cx + radius * 0.4, y - cy + radius * 0.4) / radius;
      return ramp[depth < 0.4 ? 4 : depth < 0.75 ? 3 : depth < 1.1 ? 2 : 1];
    });
  }

  dotsOf(color: string, ...dots: Dot[]): this {
    for (const [x, y] of dots) this.set(x, y, color);
    return this;
  }

  line([x0, y0]: Dot, [x1, y1]: Dot, color: string): this {
    const steps = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++)
      this.set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
    return this;
  }

  /** Draws around everything in a dark shade of what it touches. */
  outline(): this {
    const before = [...this.dots];
    return this.paint((x, y) => {
      if (before[y * SIZE + x]) return null;
      const beside = [
        [x, y - 1],
        [x - 1, y],
        [x + 1, y],
        [x, y + 1],
      ].find(([i, j]) => i >= 0 && j >= 0 && i < SIZE && j < SIZE && before[j * SIZE + i]);
      return beside && darker(before[beside[1] * SIZE + beside[0]]!, OUTLINE);
    });
  }

  toDataUrl(): string {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const context = canvas.getContext('2d')!;
    this.dots.forEach((color, i) => {
      if (!color) return;
      context.fillStyle = color;
      context.fillRect(i % SIZE, Math.floor(i / SIZE), 1, 1);
    });
    return canvas.toDataURL();
  }
}

function inside(corners: Dot[], x: number, y: number): boolean {
  let result = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, yi] = corners[i];
    const [xj, yj] = corners[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
  }
  return result;
}

// How hard the renderer works. Lower levels cut pixel density, shadows and ground clutter.
export type Quality = 'low' | 'medium' | 'high';

export const QUALITIES: Quality[] = ['low', 'medium', 'high'];

export const QUALITY_LABEL: Record<Quality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface QualityProfile {
  /** Cap on devicePixelRatio. */
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  softShadows: boolean;
  /** Multiplier for grass, flowers and pebbles. */
  groundDetail: number;
}

export const PROFILE: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 1, shadows: false, shadowMapSize: 512, softShadows: false, groundDetail: 0.12 },
  medium: { pixelRatio: 1.25, shadows: true, shadowMapSize: 1024, softShadows: false, groundDetail: 0.45 },
  high: { pixelRatio: 2, shadows: true, shadowMapSize: 2048, softShadows: true, groundDetail: 1 },
};

export const isQuality = (value: unknown): value is Quality =>
  typeof value === 'string' && (QUALITIES as string[]).includes(value);

// Fog over the parts of the sea the player has not seen, and a dimmer look for what they only remember.
import type { ChartUpdate, GameMap } from '@driftwake/shared';
import * as THREE from 'three';
import { hasSeen } from '../net/chart';

/** Tiles a lookout sees, as the server counts them. */
export const LOOKOUT = 10;
const MIST = new THREE.Color('#b9c9cc');
/** How much darker remembered tiles beyond the lookout are. */
const REMEMBERED = 0.3;
const KNOWN = 255;

const uniforms = {
  seaFogOn: { value: 0 },
  seaFogMap: { value: new THREE.DataTexture(new Uint8Array(1), 1, 1, THREE.RedFormat) as THREE.DataTexture },
  seaFogSize: { value: 1 },
  seaFogCentre: { value: new THREE.Vector2() },
  seaFogLookout: { value: LOOKOUT },
  seaFogMist: { value: MIST },
};

/** Makes a material fade into fog where the chart says nothing is known. Materials outside the sea are untouched. */
export function fogMaterial(material: THREE.Material) {
  if (material.userData.seaFog) return;
  material.userData.seaFog = true;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    if (!shader.fragmentShader.includes('#include <dithering_fragment>')) return;
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSeaFog;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 seaFogAt = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          seaFogAt = instanceMatrix * seaFogAt;
        #endif
        vSeaFog = (modelMatrix * seaFogAt).xz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vSeaFog;
        uniform float seaFogOn, seaFogSize, seaFogLookout;
        uniform sampler2D seaFogMap;
        uniform vec2 seaFogCentre;
        uniform vec3 seaFogMist;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `if (seaFogOn > 0.5) {
          vec2 uv = vSeaFog / seaFogSize;
          bool inside = uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0;
          float known = inside ? smoothstep(0.15, 0.6, texture2D(seaFogMap, uv).r) : 0.0;
          float far = smoothstep(seaFogLookout - 1.5, seaFogLookout + 0.5, distance(vSeaFog, seaFogCentre));
          gl_FragColor.rgb *= 1.0 - far * ${REMEMBERED.toFixed(2)};
          gl_FragColor.rgb = mix(seaFogMist, gl_FragColor.rgb, known);
          gl_FragColor.a = mix(1.0, gl_FragColor.a, known);
        }
        #include <dithering_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'seaFog';
  material.needsUpdate = true;
}

/** Keeps the fog in step with the chart and the player. Only the sea has fog. */
export class SeaFog {
  private chart: ChartUpdate | null = null;
  private texture: THREE.DataTexture | null = null;

  constructor(private map: GameMap) {
    uniforms.seaFogOn.value = map.id === 'sea' ? 1 : 0;
    if (map.id !== 'sea') return;
    const data = new Uint8Array(map.size * map.size);
    this.texture = new THREE.DataTexture(data, map.size, map.size, THREE.RedFormat);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    uniforms.seaFogMap.value = this.texture;
    uniforms.seaFogSize.value = map.size;
  }

  get active() {
    return !!this.texture;
  }

  update(chart: ChartUpdate | null, centre: [number, number]) {
    uniforms.seaFogCentre.value.set(centre[0], centre[1]);
    if (!this.texture || chart === this.chart) return;
    this.chart = chart;
    const data = this.texture.image.data as Uint8Array;
    for (let i = 0; i < data.length; i++) data[i] = chart && isCharted(this.map, chart, i) ? KNOWN : 0;
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture?.dispose();
    uniforms.seaFogOn.value = 0;
  }
}

/** Whether a tile is on the chart: seen, or part of a place whose outline was sighted. */
export function isCharted(map: GameMap, chart: ChartUpdate, tile: number): boolean {
  return hasSeen(chart, tile) || placeIn(map, chart.found, tile);
}

/** Whether what stands on a tile is known: seen up close, or on a place gone ashore on. */
export function isSeenClose(map: GameMap, chart: ChartUpdate, tile: number): boolean {
  return hasSeen(chart, tile) || placeIn(map, chart.landed, tile);
}

function placeIn(map: GameMap, ids: string[], tile: number): boolean {
  const place = map.placeOf[tile];
  return place > 0 && ids.includes(map.places[place - 1].id);
}

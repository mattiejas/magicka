// The 3D view. Reads the state every frame and draws it.
import { type Entity, type GameEvent, groundHeight, MAPS, type TilePos } from '@driftwake/shared';
import * as THREE from 'three';
import { centreOf, isMoving, myTrack, positionOf, state } from '../net/state';
import { PROFILE, type Quality } from '../quality';
import { onSettings, settings } from '../settings';
import { Boats } from './boats';
import { CameraRig } from './cameraRig';
import { Effects, PROJECTILE_MS } from './effects';
import { EntityLayer } from './entityLayer';
import { Overlay } from './overlay';
import { CAVE_COLOR, SKY_COLOR } from './palette';
import { entityPicks, type Pick, picksOnRay, rayAt, tileOnRay } from './picking';
import { TileMarker } from './tileMarkers';
import { WorldView } from './worldView';

const SUNLIGHT = 2.5;
/** Half the width of the area around the camera that casts shadows. */
const SHADOW_RANGE = 24;

export class Scene {
  readonly rig = new CameraRig();
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private sun = createSun();
  private sky = new THREE.HemisphereLight('#fff6ee', '#d0b8a4');
  private world: WorldView | null = null;
  private effects = new Effects(this.scene, (x, z) => this.groundAt(x, z));
  private entities = new EntityLayer(this.scene, this.effects);
  private boats = new Boats();
  private overlay: Overlay;
  private hover = new TileMarker('#f0ead8', 0.55, 0.025);
  private destination = new TileMarker('#8fd0c0', 0.8, 0.03);
  private ownTile = new TileMarker('#8fd0c0', 0.28, 0.02);
  private quality = settings().quality;
  /** When quality changes the ground clutter, the map is rebuilt on the next frame. */
  private reloadWorld = false;

  constructor(canvas: HTMLCanvasElement, overlayRoot: HTMLElement) {
    this.renderer = createRenderer(canvas);
    this.scene.add(this.sky, this.sun, this.sun.target, this.boats.group);
    this.scene.add(this.hover.mesh, this.destination.mesh, this.ownTile.mesh);
    this.overlay = new Overlay(overlayRoot, this.project, id => this.entities.heightOf(id));
    this.applyQuality(this.quality);
    onSettings(({ quality }) => {
      if (quality === this.quality) return;
      const before = PROFILE[this.quality].groundDetail;
      this.applyQuality(quality);
      if (PROFILE[quality].groundDetail !== before) this.reloadWorld = true;
    });
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  frame(dt: number) {
    const { self } = state;
    if (self && state.me) this.update(dt, performance.now());
    this.renderer.render(this.scene, this.rig.camera);
    if (self && state.me) this.overlay.update(performance.now());
  }

  handleEvent(event: GameEvent) {
    if (event.type === 'hit') this.showHit(event);
    else if (event.type === 'impact') this.effects.impact(event);
    else if (event.type === 'death') this.entities.die(event.id);
    else if (event.type === 'levelUp') this.overlay.levelUp(event.player, event.skill, event.level);
  }

  showChat(speaker: string, text: string) {
    this.overlay.chat(speaker, text);
  }

  /** Signing in again, as someone else or after the connection dropped, starts with nobody speaking or levelling. */
  forgetOverhead() {
    this.overlay.forget();
  }

  /** What is under the mouse: things to click, nearest first, and the tile on the ground. */
  pick(mouseX: number, mouseY: number): { hits: Pick[]; tile: TilePos | null } {
    if (!this.world) return { hits: [], tile: null };
    const ray = rayAt(mouseX, mouseY, this.rig.camera);
    const fixed = this.world.picks.filter(pick => !this.world!.isDepleted(pick.id));
    const picks = [...fixed, ...entityPicks(this.world.map, id => this.entities.heightOf(id, 1))];
    return { hits: picksOnRay(ray, picks, this.world.map), tile: tileOnRay(ray, this.world.map) };
  }

  showDestination(tile: TilePos) {
    this.destination.show(tile, this.groundAt);
  }

  showHover(tile: TilePos | null) {
    if (tile) this.hover.show(tile, this.groundAt);
    else this.hover.hide();
  }

  /** The height of the ground at a point of the map in view, in world units. */
  private groundAt = (x: number, z: number) => (this.world ? groundHeight(this.world.map, x, z) : 0);

  /** World position to screen pixels. `height` is above the ground. */
  project = (x: number, z: number, height: number) => {
    const point = new THREE.Vector3(x, height + this.groundAt(x, z), z).project(this.rig.camera);
    return {
      x: ((point.x + 1) / 2) * innerWidth,
      y: ((1 - point.y) / 2) * innerHeight,
      visible: point.z < 1,
    };
  };

  private applyQuality(quality: Quality) {
    this.quality = quality;
    const profile = PROFILE[quality];
    this.renderer.setPixelRatio(Math.min(profile.pixelRatio, devicePixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = profile.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.sun.castShadow = profile.shadows;
    if (this.sun.shadow.mapSize.x !== profile.shadowMapSize) {
      this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  private resize() {
    const { pixelRatio } = PROFILE[this.quality];
    this.renderer.setPixelRatio(Math.min(pixelRatio, devicePixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.rig.resize(innerWidth, innerHeight);
  }

  private update(dt: number, now: number) {
    const self = state.self!;
    const world = this.worldFor(self.map);
    world.update(now, reportedNodes(), self, myTrack()?.entity);
    this.entities.update(world, now, dt);
    this.boats.update(now);
    this.followPlayer(dt);
    this.effects.update(now);
  }

  private worldFor(id: keyof typeof MAPS): WorldView {
    if (this.world?.map.id === id && !this.reloadWorld) return this.world;
    this.reloadWorld = false;
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.entities.clear();
    this.boats.clear();
    this.world = new WorldView(MAPS[id], PROFILE[this.quality].groundDetail);
    this.scene.add(this.world.group);
    this.setMood(this.world.map.cave);
    return this.world;
  }

  /** Daylight, or the dim of a cave. */
  private setMood(cave: boolean) {
    const color = new THREE.Color(cave ? CAVE_COLOR : SKY_COLOR);
    this.scene.background = color;
    this.scene.fog = cave ? new THREE.Fog(color, 18, 40) : new THREE.Fog(color, 32, 66);
    this.sky.intensity = cave ? 1.2 : 2.2;
    this.sun.intensity = cave ? 1.3 : SUNLIGHT;
  }

  private followPlayer(dt: number) {
    const track = myTrack();
    if (track) {
      const tile: TilePos = [track.entity.x, track.entity.y];
      const [x, y] = positionOf(track);
      this.rig.follow(x + 0.5, y + 0.5, this.groundAt(x + 0.5, y + 0.5), dt);
      if (track.entity.boat?.aboard) this.ownTile.hide();
      else this.ownTile.show(tile, this.groundAt);
      if (this.destination.isAt(tile) && !isMoving(track)) this.destination.hide();
    }
    this.rig.update(dt, this.groundAt);
    const { focus } = this.rig;
    this.sun.position.set(focus.x + 14, focus.y + 26, focus.z + 10);
    this.sun.target.position.copy(focus);
  }

  private showHit({ from, to, damage, style }: Extract<GameEvent, { type: 'hit' }>) {
    this.entities.noteAttack(from);
    // The figure, not the entity: after a killing blow the entity is gone, or a player is already in town.
    const target = state.entities.get(to);
    const at = this.entities.centreOf(to) ?? (target && centreOf(target));
    if (!at) return;
    const showDamage = () => this.overlay.damage(to, at, damage);
    const attacker = state.entities.get(from);
    if (attacker && (style === 'ranged' || style === 'magic')) {
      this.effects.projectile(centreOf(attacker), at, style);
      setTimeout(showDamage, PROJECTILE_MS);
    } else showDamage();
  }
}

function reportedNodes(): Entity[] {
  return [...state.entities.values()].flatMap(({ entity }) => (entity.kind === 'node' ? [entity] : []));
}

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function createSun(): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight('#fff0d6', SUNLIGHT);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.03;
  const { camera } = sun.shadow;
  camera.left = camera.bottom = -SHADOW_RANGE;
  camera.right = camera.top = SHADOW_RANGE;
  camera.far = 80;
  return sun;
}

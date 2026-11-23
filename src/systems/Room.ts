import * as THREE from 'three';
import { TrashManager } from './TrashManager.js';
import type { RoomData } from './HouseLayout.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HOUSE_LAYOUT, getFloorBounds, getAllWallSurfaces } from './HouseLayout.js';
import type { DoorData, WindowData } from './HouseLayout.js';
import { ModelLibrary } from '../world/ModelLibrary.js';
import { FIXTURE_PLACEMENTS } from '../world/FixtureLayout.js';
import { DECOR_PLACEMENTS } from '../world/DecorLayout.js';

const MODULE_HEIGHT = 3.0;
const WALL_HALF_THICKNESS = 0.065;

const ARCH = '/models/architecture/';
const WALL_MODULES = {
  white: ARCH + 'wall_1m.glb',
  cream: ARCH + 'wall_1m_cream.glb',
  wet: ARCH + 'wall_1m_wet.glb',
};
const FLOOR_MODULES = {
  planks: ARCH + 'floor_planks.glb',
  tile: ARCH + 'floor_tile.glb',
  tileSmall: ARCH + 'floor_tile_small.glb',
};
const CEILING_MODULE = ARCH + 'ceiling_plain.glb';
const SKIRTING = ARCH + 'skirting_modern.glb';
const CROWN = ARCH + 'crown_plain.glb';
const DOOR_FRAME = ARCH + 'door_frame_std.glb';
const DOOR_LEAF = ARCH + 'door_leaf_panel.glb';
const DOOR_HANDLE = ARCH + 'door_handle_lever.glb';
const WINDOW_FRAME = ARCH + 'window_frame_std.glb';
const WINDOW_GLASS = ARCH + 'window_glass.glb';
const WINDOW_SILL = ARCH + 'window_sill.glb';

const SHELL_ASSETS = [
  ...Object.values(WALL_MODULES),
  ...Object.values(FLOOR_MODULES),
  CEILING_MODULE,
  SKIRTING,
  CROWN,
  DOOR_FRAME,
  DOOR_LEAF,
  DOOR_HANDLE,
  WINDOW_FRAME,
  WINDOW_GLASS,
  WINDOW_SILL,
];

interface WallFrame {
  name: 'north' | 'south' | 'east' | 'west';
  width: number;
  rotY: number;
  origin: THREE.Vector3;
  axis: THREE.Vector3;
}

interface Opening {
  start: number;
  end: number;
  bottom: number;
  top: number;
}

function wallFrames(data: RoomData, cx: number, cz: number, halfW: number, halfD: number): WallFrame[] {
  return [
    { name: 'north', width: data.size.x, rotY: 0, origin: new THREE.Vector3(cx, 0, cz - halfD), axis: new THREE.Vector3(1, 0, 0) },
    { name: 'south', width: data.size.x, rotY: Math.PI, origin: new THREE.Vector3(cx, 0, cz + halfD), axis: new THREE.Vector3(-1, 0, 0) },
    { name: 'west', width: data.size.z, rotY: Math.PI / 2, origin: new THREE.Vector3(cx - halfW, 0, cz), axis: new THREE.Vector3(0, 0, 1) },
    { name: 'east', width: data.size.z, rotY: -Math.PI / 2, origin: new THREE.Vector3(cx + halfW, 0, cz), axis: new THREE.Vector3(0, 0, -1) },
  ];
}

function openingsOn(data: RoomData, frame: WallFrame): Opening[] {
  const openings: Opening[] = [];
  for (const door of data.doors.filter(d => d.wall === frame.name)) {
    const centre = (door.position - 0.5) * frame.width;
    openings.push({ start: centre - door.width / 2, end: centre + door.width / 2, bottom: 0, top: door.height });
  }
  for (const window of data.windows.filter(w => w.wall === frame.name)) {
    const centre = (window.position - 0.5) * frame.width;
    openings.push({
      start: centre - window.width / 2,
      end: centre + window.width / 2,
      bottom: window.heightFromFloor,
      top: window.heightFromFloor + window.height,
    });
  }
  return openings.sort((a, b) => a.start - b.start);
}

/** Full-height piers between openings. */
function piersBetween(openings: Opening[], width: number): Opening[] {
  const piers: Opening[] = [];
  let cursor = -width / 2;
  for (const opening of openings) {
    if (opening.start - cursor > 0.02) {
      piers.push({ start: cursor, end: opening.start, bottom: 0, top: Infinity });
    }
    cursor = Math.max(cursor, opening.end);
  }
  if (width / 2 - cursor > 0.02) {
    piers.push({ start: cursor, end: width / 2, bottom: 0, top: Infinity });
  }
  return piers;
}

/** Runs along a wall that skip a set of spans (doorways, for trim). */
function runsExcluding(spans: { start: number; end: number }[], width: number): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let cursor = -width / 2;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start - cursor > 0.15) runs.push({ start: cursor, end: span.start });
    cursor = Math.max(cursor, span.end);
  }
  if (width / 2 - cursor > 0.15) runs.push({ start: cursor, end: width / 2 });
  return runs;
}

export class Room {
  public floor!: THREE.Mesh;
  public walls: THREE.Mesh[] = [];
  public ceilings: THREE.Group[] = [];
  public doorFrames: THREE.Group[] = [];
  public windowFrames: THREE.Group[] = [];
  public baseboards: THREE.Mesh[] = [];
  public fixtures: THREE.Mesh[] = [];
  public decor: THREE.Mesh[] = [];
  public trashManager!: TrashManager;

  private scene: THREE.Scene;
  private houseGroup = new THREE.Group();
  private rooms = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async init(): Promise<void> {
    await ModelLibrary.preload(SHELL_ASSETS);
    this.createHouse();
    await this.createFixtures();
    await this.createDecor();
    this.scene.add(this.houseGroup);

    this.trashManager = new TrashManager(this.scene, this.floor);
    await this.trashManager.init();
  }

  private createHouse(): void {
    for (const roomData of HOUSE_LAYOUT) {
      const roomGroup = this.createRoom(roomData);
      this.houseGroup.add(roomGroup);
      this.rooms.set(roomData.name, roomGroup);
    }

    // Set the first floor as primary for raycasting compatibility
    const entranceRoom = this.rooms.get('entrance');
    if (entranceRoom) {
      // Find floor mesh in entrance
      entranceRoom.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
          if (!this.floor && obj.rotation.x === -Math.PI / 2) {
            this.floor = obj;
          }
        }
      });
    }
  }

  private createRoom(data: RoomData): THREE.Group {
    const group = new THREE.Group();
    group.name = `room_${data.name}`;

    const halfW = data.size.x / 2;
    const halfH = data.size.y / 2;
    const halfD = data.size.z / 2;
    const cx = data.position.x;
    const cy = data.position.y;
    const cz = data.position.z;
    const floorY = cy - halfH;

    const floor = this.buildFloor(data, cx, floorY, cz);
    floor.name = `floor_${data.name}`;
    group.add(floor);
    if (data.name === 'entrance') this.floor = floor;

    const ceiling = this.buildCeiling(data, cx, cy + halfH, cz);
    ceiling.name = `ceiling_${data.name}`;
    this.ceilings.push(ceiling);
    group.add(ceiling);

    this.createWallsWithOpenings(group, data, cx, cy, cz, halfW, halfH, halfD);
    this.createTrim(group, data, cx, cy, cz, halfW, halfH, halfD);
    this.createDoorFrames(group, data, cx, cy, cz, halfW, halfH, halfD);
    this.createWindowFrames(group, data, cx, cy, cz, halfW, halfH, halfD);

    return group;
  }

  private wallPathFor(data: RoomData): string {
    if (data.name.includes('bath') || data.name.includes('kitchen')) return WALL_MODULES.wet;
    if (data.name.includes('living') || data.name.includes('bed')) return WALL_MODULES.cream;
    return WALL_MODULES.white;
  }

  private floorPathFor(data: RoomData): string {
    if (data.name.includes('bath')) return FLOOR_MODULES.tileSmall;
    if (data.name.includes('kitchen')) return FLOOR_MODULES.tile;
    return FLOOR_MODULES.planks;
  }

  /** Merge every placement of one asset into as few meshes as the materials allow. */
  private buildPlacements(path: string, matrices: THREE.Matrix4[]): THREE.Group {
    const group = new THREE.Group();
    const template = ModelLibrary.clone(path);
    if (!template || matrices.length === 0) return group;

    template.updateMatrixWorld(true);
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    template.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      // include the node transform: exports are not guaranteed to be identity
      parts.push({ geometry: child.geometry.clone().applyMatrix4(child.matrixWorld), material });
    });

    const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
    for (const matrix of matrices) {
      for (const part of parts) {
        const key = part.material.uuid;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material: part.material, geometries: [] };
          buckets.set(key, bucket);
        }
        bucket.geometries.push(part.geometry.clone().applyMatrix4(matrix));
      }
    }

    for (const bucket of buckets.values()) {
      const merged = mergeGeometries(bucket.geometries, false);
      bucket.geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  /** A row of 1 m modules of `path` along one wall. */
  private buildRow(
    path: string,
    frame: WallFrame,
    u: number,
    width: number,
    baseY: number,
    options: { scaleY?: number; inset?: number; count?: number } = {}
  ): THREE.Group {
    const scaleY = options.scaleY ?? 1;
    const inset = options.inset ?? 0;
    const count = options.count ?? Math.min(16, Math.max(1, Math.round(width)));
    const moduleWidth = width / count;

    const normalX = Math.sin(frame.rotY);
    const normalZ = Math.cos(frame.rotY);
    const origin = new THREE.Vector3(
      frame.origin.x + frame.axis.x * u + normalX * inset,
      baseY,
      frame.origin.z + frame.axis.z * u + normalZ * inset
    );

    const matrices: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const local = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .multiply(new THREE.Matrix4().makeRotationY(frame.rotY))
        .multiply(new THREE.Matrix4().makeTranslation(-width / 2 + moduleWidth * (i + 0.5), 0, 0))
        .multiply(new THREE.Matrix4().makeScale(moduleWidth, scaleY, 1));
      matrices.push(local);
    }
    return this.buildPlacements(path, matrices);
  }

  private registerWall(group: THREE.Group, row: THREE.Group): void {
    group.add(row);
    row.traverse(child => {
      if (child instanceof THREE.Mesh) this.walls.push(child);
    });
  }

  private buildFloor(data: RoomData, cx: number, floorY: number, cz: number): THREE.Mesh {
    const countX = Math.max(1, Math.round(data.size.x));
    const countZ = Math.max(1, Math.round(data.size.z));
    const matrices: THREE.Matrix4[] = [];
    for (let i = 0; i < countX; i++) {
      for (let j = 0; j < countZ; j++) {
        matrices.push(
          new THREE.Matrix4()
            .makeTranslation(
              cx - data.size.x / 2 + (data.size.x / countX) * (i + 0.5),
              floorY,
              cz - data.size.z / 2 + (data.size.z / countZ) * (j + 0.5)
            )
            .multiply(new THREE.Matrix4().makeScale(data.size.x / countX, 1, data.size.z / countZ))
        );
      }
    }

    const built = this.buildPlacements(this.floorPathFor(data), matrices);
    const merged = built.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    if (merged) return merged;

    // Library empty (offline, blocked asset): keep the game playable.
    const fallback = new THREE.Mesh(new THREE.PlaneGeometry(data.size.x, data.size.z), data.floorMaterial.clone());
    fallback.rotation.x = -Math.PI / 2;
    fallback.position.set(cx, floorY, cz);
    fallback.receiveShadow = true;
    return fallback;
  }

  private buildCeiling(data: RoomData, cx: number, ceilingY: number, cz: number): THREE.Group {
    const countX = Math.max(1, Math.round(data.size.x));
    const countZ = Math.max(1, Math.round(data.size.z));
    const matrices: THREE.Matrix4[] = [];
    for (let i = 0; i < countX; i++) {
      for (let j = 0; j < countZ; j++) {
        matrices.push(
          new THREE.Matrix4()
            .makeTranslation(
              cx - data.size.x / 2 + (data.size.x / countX) * (i + 0.5),
              ceilingY,
              cz - data.size.z / 2 + (data.size.z / countZ) * (j + 0.5)
            )
            .multiply(new THREE.Matrix4().makeScale(data.size.x / countX, 1, data.size.z / countZ))
        );
      }
    }
    const group = this.buildPlacements(CEILING_MODULE, matrices);
    if (group.children.length === 0) {
      const fallback = new THREE.Mesh(new THREE.PlaneGeometry(data.size.x, data.size.z), data.ceilingMaterial.clone());
      fallback.rotation.x = Math.PI / 2;
      fallback.position.set(cx, ceilingY, cz);
      group.add(fallback);
    }
    group.traverse(child => {
      if (child instanceof THREE.Mesh) child.castShadow = true;
    });
    return group;
  }

  private createWallsWithOpenings(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const floorY = cy - halfH;
    const wallPath = this.wallPathFor(data);

    for (const frame of wallFrames(data, cx, cz, halfW, halfD)) {
      const openings = openingsOn(data, frame);

      // solid piers between the openings, full height
      for (const pier of piersBetween(openings, frame.width)) {
        this.registerWall(
          group,
          this.buildRow(wallPath, frame, (pier.start + pier.end) / 2, pier.end - pier.start, floorY, {
            scaleY: data.size.y / MODULE_HEIGHT,
          })
        );
      }

      // above every opening, and below the windows
      for (const opening of openings) {
        const width = opening.end - opening.start;
        const u = (opening.start + opening.end) / 2;
        if (opening.top < data.size.y - 0.02) {
          this.registerWall(
            group,
            this.buildRow(wallPath, frame, u, width, floorY + opening.top, {
              scaleY: (data.size.y - opening.top) / MODULE_HEIGHT,
            })
          );
        }
        if (opening.bottom > 0.02) {
          this.registerWall(
            group,
            this.buildRow(wallPath, frame, u, width, floorY, { scaleY: opening.bottom / MODULE_HEIGHT })
          );
        }
      }
    }
  }

  private createTrim(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const floorY = cy - halfH;
    const ceilingY = cy + halfH;

    for (const frame of wallFrames(data, cx, cz, halfW, halfD)) {
      const doorSpans = data.doors
        .filter(door => door.wall === frame.name)
        .map(door => {
          const centre = (door.position - 0.5) * frame.width;
          return { start: centre - door.width / 2 - 0.09, end: centre + door.width / 2 + 0.09 };
        });

      for (const run of runsExcluding(doorSpans, frame.width)) {
        const u = (run.start + run.end) / 2;
        const width = run.end - run.start;

        const skirting = this.buildRow(SKIRTING, frame, u, width, floorY, {
          inset: WALL_HALF_THICKNESS + 0.009,
        });
        group.add(skirting);
        skirting.traverse(child => {
          if (child instanceof THREE.Mesh) this.baseboards.push(child);
        });

        group.add(this.buildRow(CROWN, frame, u, width, ceilingY - 0.082, { inset: WALL_HALF_THICKNESS + 0.024 }));
      }
    }
  }

  private createDoorFrames(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const floorY = cy - halfH;
    const frames = wallFrames(data, cx, cz, halfW, halfD);

    for (const door of data.doors as DoorData[]) {
      const frame = frames.find(f => f.name === door.wall);
      if (!frame) continue;

      const u = (door.position - 0.5) * frame.width;
      const doorGroup = new THREE.Group();
      doorGroup.position.set(
        frame.origin.x + frame.axis.x * u,
        floorY,
        frame.origin.z + frame.axis.z * u
      );
      doorGroup.rotation.y = frame.rotY;

      const casing = ModelLibrary.clone(DOOR_FRAME);
      if (casing) {
        casing.scale.set(door.width / 0.9, door.height / 1.98, 1);
        doorGroup.add(casing);
      }

      // Leaf hinged on the left reveal, standing open at ~78 degrees so the
      // gap stays walkable and you can see the panels from inside.
      const leaf = ModelLibrary.clone(DOOR_LEAF);
      if (leaf) {
        leaf.position.set(-door.width / 2 + 0.01, 0.008, 0);
        leaf.rotation.y = -Math.PI * 0.43;
        leaf.scale.set(door.width / 0.762, door.height / 1.981, 1);

        const handle = ModelLibrary.clone(DOOR_HANDLE);
        if (handle) {
          handle.position.set(0.762 - 0.08, 1.03, 0.035 / 2 + 0.012);
          leaf.add(handle);
        }
        doorGroup.add(leaf);
      }

      this.doorFrames.push(doorGroup);
      group.add(doorGroup);
    }
  }

  private createWindowFrames(
    group: THREE.Group,
    data: RoomData,
    cx: number,
    cy: number,
    cz: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    const floorY = cy - halfH;
    const frames = wallFrames(data, cx, cz, halfW, halfD);

    for (const window of data.windows as WindowData[]) {
      const frame = frames.find(f => f.name === window.wall);
      if (!frame) continue;

      const u = (window.position - 0.5) * frame.width;
      const windowGroup = new THREE.Group();
      windowGroup.position.set(
        frame.origin.x + frame.axis.x * u,
        floorY + window.heightFromFloor + window.height / 2,
        frame.origin.z + frame.axis.z * u
      );
      windowGroup.rotation.y = frame.rotY;

      const casing = ModelLibrary.clone(WINDOW_FRAME);
      if (casing) {
        casing.scale.set(window.width / 1.2, window.height / 1.35, 1);
        windowGroup.add(casing);
      }

      const glass = ModelLibrary.clone(WINDOW_GLASS);
      if (glass) {
        glass.scale.set(window.width / 1.1, window.height / 1.25, 1);
        glass.traverse(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            const material = child.material.clone();
            material.transparent = true;
            material.opacity = 0.22;
            material.metalness = 0.1;
            material.roughness = 0.06;
            material.depthWrite = false;
            child.material = material;
            child.castShadow = false;
          }
        });
        windowGroup.add(glass);
      }

      const sill = ModelLibrary.clone(WINDOW_SILL);
      if (sill) {
        sill.scale.set(window.width / 1.1, 1, 1);
        sill.position.set(0, -window.height / 2 - 0.02, WALL_HALF_THICKNESS - 0.02);
        windowGroup.add(sill);
      }

      this.windowFrames.push(windowGroup);
      group.add(windowGroup);
    }
  }

  /** Kitchen, bathroom, laundry and radiators (§6), one clone per placement. */
  private async createFixtures(): Promise<void> {
    const paths = [...new Set(FIXTURE_PLACEMENTS.map(placement => placement.asset))].map(
      asset => `/models/fixtures/${asset}.glb`
    );
    await ModelLibrary.preload(paths);

    const group = new THREE.Group();
    group.name = 'fixtures';

    for (const placement of FIXTURE_PLACEMENTS) {
      const model = ModelLibrary.clone(`/models/fixtures/${placement.asset}.glb`);
      if (!model) continue;
      model.position.set(placement.x, placement.y, placement.z);
      model.rotation.y = placement.rotation;
      model.name = placement.asset;
      model.traverse(child => {
        if (child instanceof THREE.Mesh) this.fixtures.push(child);
      });
      group.add(model);
    }

    this.houseGroup.add(group);
  }

  /**
   * Props from §7, merged by material (FINALLY-3D.md §18).
   *
   * Placements are static, so instead of ~90 meshes the whole dressing of the
   * house becomes a dozen draw calls: one per shared material. That keeps the
   * phone profile inside its budget without dropping any props.
   */
  private async createDecor(): Promise<void> {
    const paths = [...new Set(DECOR_PLACEMENTS.map(placement => placement.asset))].map(
      asset => `/models/decor/${asset}.glb`
    );
    await ModelLibrary.preload(paths);

    const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
    const placementMatrix = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();

    for (const placement of DECOR_PLACEMENTS) {
      const template = ModelLibrary.clone(`/models/decor/${placement.asset}.glb`);
      if (!template) continue;
      template.updateMatrixWorld(true);
      placementMatrix
        .makeTranslation(placement.x, placement.y, placement.z)
        .multiply(new THREE.Matrix4().makeRotationY(placement.rotation));

      template.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        const key = material.name || material.uuid;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material, geometries: [] };
          buckets.set(key, bucket);
        }
        worldMatrix.copy(placementMatrix).multiply(child.matrixWorld);
        bucket.geometries.push(child.geometry.clone().applyMatrix4(worldMatrix));
      });
    }

    const group = new THREE.Group();
    group.name = 'decor';
    for (const bucket of buckets.values()) {
      const merged = mergeGeometries(bucket.geometries, false);
      bucket.geometries.forEach(geometry => geometry.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.decor.push(mesh);
      group.add(mesh);
    }
    this.houseGroup.add(group);
  }

  getCleanableSurfaces(): THREE.Mesh[] {
    return [...this.fixtures, ...this.decor, this.floor, ...this.walls];
  }

  getFloorBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
    return getFloorBounds();
  }

  getAllWallSurfaces(): ReturnType<typeof getAllWallSurfaces> {
    return getAllWallSurfaces();
  }

  getRoomAtPoint(point: THREE.Vector3): RoomData | null {
    for (const roomData of HOUSE_LAYOUT) {
      const bounds = this.getRoomBounds(roomData);
      if (
        point.x >= bounds.min.x &&
        point.x <= bounds.max.x &&
        point.y >= bounds.min.y &&
        point.y <= bounds.max.y &&
        point.z >= bounds.min.z &&
        point.z <= bounds.max.z
      ) {
        return roomData;
      }
    }
    return null;
  }

  private getRoomBounds(data: RoomData): { min: THREE.Vector3; max: THREE.Vector3 } {
    const halfW = data.size.x / 2;
    const halfH = data.size.y / 2;
    const halfD = data.size.z / 2;
    return {
      min: new THREE.Vector3(
        data.position.x - halfW,
        data.position.y - halfH,
        data.position.z - halfD
      ),
      max: new THREE.Vector3(
        data.position.x + halfW,
        data.position.y + halfH,
        data.position.z + halfD
      ),
    };
  }

  dispose(): void {
    this.houseGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.scene.remove(this.houseGroup);
  }
}

import * as THREE from 'three';
import { TrashItem, trashModelPath, type TrashType } from './TrashItem.js';
import { getFloorBounds, getRoomBounds, HOUSE_LAYOUT } from './HouseLayout.js';
import type { Job } from './JobSystem.js';
import { ModelLibrary } from '../world/ModelLibrary.js';

const TRASH_TYPES: TrashType[] = [
  { name: 'pizza_box', color: 0xd4a574, size: [0.35, 0.04, 0.35], mass: 0.2 },
  { name: 'beer_can', color: 0x88cc88, size: [0.06, 0.12, 0.06], mass: 0.03 },
  { name: 'takeout_bag', color: 0xf5e6c8, size: [0.15, 0.25, 0.1], mass: 0.1 },
  { name: 'condom_wrapper', color: 0xffddaa, size: [0.04, 0.005, 0.05], mass: 0.005 },
  { name: 'tissue', color: 0xffffff, size: [0.08, 0.01, 0.1], mass: 0.01 },
  { name: 'bottle', color: 0x4488aa, size: [0.07, 0.2, 0.07], mass: 0.15 },
  { name: 'magazine', color: 0xcc8866, size: [0.22, 0.03, 0.28], mass: 0.3 },
  { name: 'sock', color: 0x666688, size: [0.1, 0.02, 0.06], mass: 0.05 },
  { name: 'food_container', color: 0xddddaa, size: [0.12, 0.05, 0.12], mass: 0.08 },
  { name: 'hair_clump', color: 0x443322, size: [0.05, 0.02, 0.05], mass: 0.01 },
];

// Job-specific trash types
const JOB_TRASH_TYPES: Record<string, TrashType[]> = {
  post_party: [
    { name: 'red_solo_cup', color: 0xff4444, size: [0.08, 0.1, 0.08], mass: 0.02 },
    { name: 'beer_bottle', color: 0x226622, size: [0.06, 0.22, 0.06], mass: 0.18 },
    { name: 'chip_bag', color: 0xffff66, size: [0.15, 0.02, 0.2], mass: 0.03 },
    { name: 'confetti', color: 0xff66cc, size: [0.02, 0.002, 0.02], mass: 0.001 },
    { name: 'balloon', color: 0xff4444, size: [0.12, 0.15, 0.12], mass: 0.01 },
  ],
  hoarder: [
    { name: 'newspaper_stack', color: 0xaa8866, size: [0.3, 0.15, 0.22], mass: 1.5 },
    { name: 'cardboard_box', color: 0xbb9977, size: [0.4, 0.3, 0.4], mass: 0.5 },
    { name: 'plastic_bag', color: 0xdddddd, size: [0.25, 0.3, 0.15], mass: 0.1 },
    { name: 'old_magazine', color: 0x886644, size: [0.22, 0.04, 0.28], mass: 0.4 },
    { name: 'broken_item', color: 0x664433, size: [0.15, 0.1, 0.15], mass: 0.8 },
  ],
  renovation_prep: [
    { name: 'drywall_piece', color: 0xeeeeee, size: [0.3, 0.02, 0.2], mass: 0.8 },
    { name: 'sawdust_pile', color: 0xaa8855, size: [0.25, 0.03, 0.25], mass: 0.2 },
    { name: 'paint_can', color: 0xffffff, size: [0.15, 0.2, 0.15], mass: 2.0 },
    { name: 'tape_roll', color: 0xddddaa, size: [0.06, 0.02, 0.06], mass: 0.05 },
    { name: 'plastic_sheet', color: 0xeeeeee, size: [0.5, 0.01, 0.5], mass: 0.3 },
  ],
  emergency: [
    { name: 'wet_towel', color: 0x88aadd, size: [0.3, 0.02, 0.3], mass: 0.5 },
    { name: 'damaged_item', color: 0x443322, size: [0.2, 0.1, 0.2], mass: 1.0 },
    { name: 'debris', color: 0x665544, size: [0.15, 0.05, 0.15], mass: 0.3 },
  ],
  deep_clean: [
    { name: 'dust_bunny', color: 0xaaaa99, size: [0.08, 0.04, 0.08], mass: 0.02 },
    { name: 'cobweb', color: 0xffffff, size: [0.2, 0.01, 0.2], mass: 0.005 },
    { name: 'lint_ball', color: 0xddddcc, size: [0.05, 0.03, 0.05], mass: 0.01 },
  ],
};

/** Every model the spawners can ask for, loaded before the first item appears. */
export const TRASH_MODEL_PATHS: string[] = Array.from(
  new Set(
    [...TRASH_TYPES, ...Object.values(JOB_TRASH_TYPES).flat()].map(type =>
      trashModelPath(type.name)
    )
  )
);

export class TrashManager {
  public items: TrashItem[] = [];
  private scene: THREE.Scene;
  private floor: THREE.Mesh;
  private itemCount = 0;

  constructor(scene: THREE.Scene, floor: THREE.Mesh) {
    this.scene = scene;
    this.floor = floor;
  }

  async init(): Promise<void> {
    // 28 items can be any of 31 types, so the whole set is preloaded once:
    // 508 KB of models, and it keeps the first job's litter from popping in.
    await ModelLibrary.preload(TRASH_MODEL_PATHS);
    this.generateTrash(28);
  }

  /** Prefer a type whose model actually loaded; fall back to the full table. */
  private pickType(types: readonly TrashType[]): TrashType {
    const ready = types.filter(type => ModelLibrary.has(trashModelPath(type.name)));
    const pool = ready.length > 0 ? ready : types;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private generateTrash(count: number): void {
    const bounds = this.getFloorBounds();

    for (let i = 0; i < count; i++) {
      const type = this.pickType(TRASH_TYPES);
      const x = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random());
      const z = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random());
      const rotation = Math.random() * Math.PI * 2;

      const item = new TrashItem(type, { x, z, rotation });
      this.scene.add(item.object);
      this.items.push(item);
    }
    this.itemCount = this.items.length;
  }

  private getFloorBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
    return getFloorBounds();
  }

  /**
   * Generate trash specific to a job's rooms and type
   */
  generateJobTrash(job: Job): void {
    // Clear existing trash first
    this.reset();

    // Distribute trash across target rooms
    for (const detail of job.roomDetails) {
      const room = HOUSE_LAYOUT.find(r => r.name === detail.roomName);
      if (!room) continue;

      const bounds = getRoomBounds(room);
      const roomTrashCount = detail.trashCount;

      // Pick trash types based on job type
      const jobTypes = JOB_TRASH_TYPES[job.type] || TRASH_TYPES;
      const types = [...TRASH_TYPES, ...jobTypes];

      for (let i = 0; i < roomTrashCount; i++) {
        const type = this.pickType(types);
        const x = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random());
        const z = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random());
        const rotation = Math.random() * Math.PI * 2;

        const item = new TrashItem(type, { x, z, rotation });
        this.scene.add(item.object);
        this.items.push(item);
      }
    }
    this.itemCount = this.items.length;
  }

  getItems(): TrashItem[] {
    return this.items;
  }

  getActiveItems(): TrashItem[] {
    return this.items.filter(item => !item.collected);
  }

  removeItem(item: TrashItem): void {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
      this.scene.remove(item.object);
      item.dispose();
    }
  }

  getCollectedPercent(): number {
    if (this.itemCount === 0) return 100;
    const collected = this.items.filter(item => item.collected).length;
    return Math.round((collected / this.itemCount) * 100);
  }

  reset(): void {
    this.items.forEach(item => {
      this.scene.remove(item.object);
      item.dispose();
    });
    this.items = [];
    this.itemCount = 0;
    this.generateTrash(28);
  }
}

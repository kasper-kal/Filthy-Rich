import * as THREE from 'three';
import { ModelLibrary } from '../world/ModelLibrary.js';

/** Spawn-table row. Names and sizes come from FINALLY-3D.md §8 and must not change. */
export interface TrashType {
  name: string;
  color: number;
  size: [number, number, number];
  mass: number;
}

export function trashModelPath(name: string): string {
  return `/models/trash/${name}.glb`;
}

/**
 * One piece of litter on the floor.
 *
 * Since Phase 4 the object is a clone of a Blender-built GLB instead of a
 * coloured box, so `object` is a group rather than a mesh. Materials are cloned
 * per item: that keeps the highlight local to the piece under the crosshair and
 * lets `dispose()` free them safely. Geometry is shared with the cached asset
 * and must never be disposed here.
 */
export class TrashItem {
  public readonly object: THREE.Group;
  public collected = false;
  public readonly type: TrashType;
  public value = 0;

  private readonly materials: THREE.MeshStandardMaterial[] = [];

  constructor(type: TrashType, position: { x: number; z: number; rotation: number }) {
    this.type = type;
    this.value = Math.round(type.mass * 100 + Math.random() * 20);

    this.object = new THREE.Group();
    this.object.name = `trash_${type.name}`;
    this.object.userData.trashItem = this;

    const source = ModelLibrary.clone(trashModelPath(type.name));
    if (source) {
      source.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        const own = (material as THREE.MeshStandardMaterial).clone();
        own.emissive.setHex(0x000000);
        child.material = own;
        this.materials.push(own);
        // The trash bag picks whatever the ray hits, so every surface has to
        // carry the `trash_` prefix and point back at its owner.
        child.name = `trash_${type.name}`;
        child.userData.trashItem = this;
      });
      this.object.add(source);
    } else {
      console.warn(`[TrashItem] no model loaded for "${type.name}"`);
    }

    // Models are built with a bottom-centre origin, so they sit straight on the
    // floor; 2 mm of clearance stops the AO'd underside z-fighting with it.
    this.object.position.set(position.x, 0.002, position.z);
    this.object.rotation.y = position.rotation;
  }

  /** Walk up from a raycast hit to the litter it belongs to. */
  static fromObject(object: THREE.Object3D | null): TrashItem | null {
    let node: THREE.Object3D | null = object;
    while (node) {
      const item = node.userData.trashItem as TrashItem | undefined;
      if (item) return item;
      node = node.parent;
    }
    return null;
  }

  setHighlighted(highlighted: boolean): void {
    if (this.collected) return;
    for (const material of this.materials) {
      material.emissive.setHex(highlighted ? 0xffca5c : 0x000000);
      material.emissiveIntensity = highlighted ? 0.55 : 0;
    }
  }

  collect(): void {
    this.collected = true;
    this.setHighlighted(false);
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
  }
}

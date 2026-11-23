import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Shared cache for the Blender-built architecture kit (FINALLY-3D.md §16.2).
 *
 * Assets are tiny (a 1 m wall module is 4 KB) but a five-room house needs a few
 * hundred placements, so everything is loaded once and cloned per instance.
 * Clones share geometry and materials; the shell merges them by material, which
 * keeps a whole house at a couple of dozen draw calls.
 */
export class ModelLibrary {
  private static readonly loader = new GLTFLoader();
  private static readonly cache = new Map<string, THREE.Group>();
  private static readonly pending = new Map<string, Promise<THREE.Group>>();

  static has(path: string): boolean {
    return this.cache.has(path);
  }

  /** Load every path before the house is built. Failures are logged, not fatal. */
  static async preload(paths: readonly string[]): Promise<void> {
    await Promise.all(
      paths.map(async path => {
        try {
          await this.load(path);
        } catch (error) {
          console.warn(`[ModelLibrary] could not load ${path}`, error);
        }
      })
    );
  }

  static load(path: string): Promise<THREE.Group> {
    const cached = this.cache.get(path);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.pending.get(path);
    if (inFlight) return inFlight;

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      ModelLibrary.loader.load(
        path,
        gltf => {
          const root = gltf.scene;
          root.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          ModelLibrary.cache.set(path, root);
          ModelLibrary.pending.delete(path);
          resolve(root);
        },
        undefined,
        error => {
          ModelLibrary.pending.delete(path);
          reject(error);
        }
      );
    });

    this.pending.set(path, promise);
    return promise;
  }

  /** A fresh clone, or null when the asset is missing (the shell then skips it). */
  static clone(path: string): THREE.Group | null {
    const source = this.cache.get(path);
    if (!source) return null;
    return source.clone(true);
  }
}

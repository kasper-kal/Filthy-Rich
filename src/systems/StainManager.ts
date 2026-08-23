import * as THREE from 'three';
import { getFloorBounds, getAllWallSurfaces } from './HouseLayout.js';

export class Stain extends THREE.Mesh {
  constructor(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
    super(geometry, material);
    this.name = 'Stain';
    this.userData.phase = Math.random() * Math.PI * 2;
  }
}

export class StainManager {
  public stains: Stain[] = [];
  private scene: THREE.Scene;
  private floor: THREE.Mesh;
  private walls: THREE.Mesh[];
  private decalMaterial!: THREE.MeshStandardMaterial;
  private stainCount = 0;

  constructor(scene: THREE.Scene, floor: THREE.Mesh, walls: THREE.Mesh[]) {
    this.scene = scene;
    this.floor = floor;
    this.walls = walls;
  }

  async init(): Promise<void> {
    this.createDecalMaterial();
    this.generateStains(35); // Good number for a satisfying cleanup
  }

  private createDecalMaterial(): void {
    // We'll use a canvas texture for the stain decals
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Create a procedural stain pattern
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(60, 35, 15, 0.85)');
    gradient.addColorStop(0.3, 'rgba(80, 45, 20, 0.6)');
    gradient.addColorStop(0.6, 'rgba(100, 55, 25, 0.3)');
    gradient.addColorStop(1, 'rgba(120, 65, 30, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    // Add some noise/texture
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 30 + 5;
      const alpha = Math.random() * 0.3 + 0.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40, 25, 10, ${alpha})`;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    this.decalMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.9,
    });
  }

  private generateStains(count: number): void {
    const floorBounds = this.getFloorBounds();
    const wallSurfaces = getAllWallSurfaces();

    for (let i = 0; i < count; i++) {
      const onFloor = Math.random() < 0.65; // 65% on floor

      if (onFloor) {
        this.createFloorStain(floorBounds);
      } else if (wallSurfaces.length > 0) {
        this.createWallStainOnSurface(
          wallSurfaces[Math.floor(Math.random() * wallSurfaces.length)]
        );
      }
    }
  }

  private createFloorStain(bounds: { min: THREE.Vector2; max: THREE.Vector2 }): void {
    const x = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random());
    const z = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random());
    const size = THREE.MathUtils.lerp(0.3, 0.8, Math.random());
    const rotation = Math.random() * Math.PI * 2;

    const geometry = new THREE.PlaneGeometry(size, size);
    const stain = new Stain(geometry, this.decalMaterial.clone());
    stain.position.set(x, 0.015, z);
    stain.rotation.x = -Math.PI / 2;
    stain.rotation.z = rotation;
    const stainMat = stain.material as THREE.MeshStandardMaterial;
    stain.userData.originalOpacity = stainMat.opacity;
    stain.userData.cleanProgress = 0;
    stain.userData.scrubCount = 0;
    stain.userData.requiredScrubs = Math.floor(THREE.MathUtils.lerp(3, 8, Math.random()));
    stain.userData.type = 'floor';

    this.scene.add(stain);
    this.stains.push(stain);
  }

  private createWallStainOnSurface(surface: {
    room: any;
    wall: 'north' | 'south' | 'east' | 'west';
    center: THREE.Vector3;
    normal: THREE.Vector3;
    width: number;
    height: number;
  }): void {
    const x = THREE.MathUtils.lerp(
      -surface.width / 2 + 0.3,
      surface.width / 2 - 0.3,
      Math.random()
    );
    const y = THREE.MathUtils.lerp(0.3, surface.height - 0.3, Math.random());
    const size = THREE.MathUtils.lerp(0.25, 0.5, Math.random());

    const geometry = new THREE.PlaneGeometry(size, size);
    const stain = new Stain(geometry, this.decalMaterial.clone());

    // Position on wall using surface data
    const offset = 0.02;

    switch (surface.wall) {
      case 'north':
        stain.position.set(surface.center.x + x, y, surface.center.z + offset);
        stain.rotation.y = Math.PI;
        break;
      case 'south':
        stain.position.set(surface.center.x - x, y, surface.center.z - offset);
        break;
      case 'west':
        stain.position.set(surface.center.x + offset, y, surface.center.z - x);
        stain.rotation.y = -Math.PI / 2;
        break;
      case 'east':
        stain.position.set(surface.center.x - offset, y, surface.center.z + x);
        stain.rotation.y = Math.PI / 2;
        break;
    }

    const stainMat = stain.material as THREE.MeshStandardMaterial;
    stain.userData.originalOpacity = stainMat.opacity;
    stain.userData.cleanProgress = 0;
    stain.userData.scrubCount = 0;
    stain.userData.requiredScrubs = Math.floor(THREE.MathUtils.lerp(4, 10, Math.random()));
    stain.userData.type = 'wall';

    this.scene.add(stain);
    this.stains.push(stain);
  }

  private getFloorBounds(): { min: THREE.Vector2; max: THREE.Vector2 } {
    return getFloorBounds();
  }

  getStains(): Stain[] {
    return this.stains;
  }

  getActiveStains(): Stain[] {
    return this.stains.filter(s => !s.userData.cleaned);
  }

  removeStain(stain: Stain): void {
    const index = this.stains.indexOf(stain);
    if (index > -1) {
      this.stains.splice(index, 1);
      this.scene.remove(stain);
      stain.geometry.dispose();
      (stain.material as THREE.Material).dispose();
    }
  }

  getCleanlinessPercent(): number {
    if (this.stainCount === 0) return 100;
    const cleaned = this.stains.filter(s => s.userData.cleaned).length;
    return Math.round((cleaned / this.stainCount) * 100);
  }

  update(delta: number): void {
    // Animate stain shimmer
    this.stains.forEach(stain => {
      if (!stain.userData.cleaned) {
        const stainMat = stain.material as THREE.MeshStandardMaterial;
        stainMat.opacity =
          stain.userData.originalOpacity *
          (0.9 + Math.sin(performance.now() * 0.003 + stain.userData.phase) * 0.1);
      }
    });
  }

  reset(): void {
    this.stains.forEach(stain => {
      this.scene.remove(stain);
      stain.geometry.dispose();
      (stain.material as THREE.Material).dispose();
    });
    this.stains = [];
    this.stainCount = 0;
    this.generateStains(35);
  }
}

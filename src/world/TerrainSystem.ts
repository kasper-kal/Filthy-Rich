import * as THREE from 'three';
import type { SceneManager } from '../systems/SceneManager.js';

export class TerrainSystem {
  private sceneManager: SceneManager;
  private worldSeed: number;
  private worldSize: number;
  private terrainMesh: THREE.Mesh | null = null;
  private heightMap: Float32Array | null = null;
  private resolution = 1024; // heightmap resolution
  private terrainSize = 8192; // world size in meters

  // LOD meshes
  private lodMeshes: THREE.Mesh[] = [];
  private lodDistances = [500, 2000, 5000];

  constructor(sceneManager: SceneManager, worldSeed: number, worldSize: number) {
    this.sceneManager = sceneManager;
    this.worldSeed = worldSeed;
    this.worldSize = worldSize;
  }

  async init(): Promise<void> {
    await this.generateTerrain();
    this.createTerrainMesh();
    this.createLODMeshes();
  }

  private async generateTerrain(): Promise<void> {
    // Generate heightmap using deterministic noise
    this.heightMap = new Float32Array(this.resolution * this.resolution);

    // Use multiple octaves of noise for realistic terrain
    for (let z = 0; z < this.resolution; z++) {
      for (let x = 0; x < this.resolution; x++) {
        const wx = (x / this.resolution - 0.5) * this.terrainSize;
        const wz = (z / this.resolution - 0.5) * this.terrainSize;

        let height = 0;
        let amplitude = 1;
        let frequency = 0.0005;
        const persistence = 0.5;

        // 5 octaves
        for (let o = 0; o < 5; o++) {
          height += this.noise2D(wx * frequency, wz * frequency) * amplitude;
          amplitude *= persistence;
          frequency *= 2;
        }

        // Add some large-scale features
        height += this.noise2D(wx * 0.00005, wz * 0.00005) * 50; // Large hills
        height += this.noise2D(wx * 0.00001, wz * 0.00001) * 100; // Mountains

        // Flatten near roads (would integrate with road network)
        // Flatten near origin for starting area
        const distFromOrigin = Math.sqrt(wx * wx + wz * wz);
        if (distFromOrigin < 500) {
          height *= Math.max(0, (distFromOrigin - 100) / 400);
        }

        this.heightMap[z * this.resolution + x] = height;
      }
    }
  }

  private createTerrainMesh(): void {
    if (!this.heightMap) return;

    const geometry = new THREE.PlaneGeometry(
      this.terrainSize,
      this.terrainSize,
      this.resolution - 1,
      this.resolution - 1
    );
    geometry.rotateX(-Math.PI / 2);

    // Apply heightmap
    const positions = geometry.attributes['position'] as THREE.BufferAttribute;
    const heightMap = this.heightMap!;
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, heightMap[i] ?? 0);
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    // Create splat map material
    const material = new THREE.MeshStandardMaterial({
      color: 0x8a7a65,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = true;
    this.terrainMesh.frustumCulled = true;

    this.sceneManager.scene.add(this.terrainMesh);
  }

  private createLODMeshes(): void {
    // Create lower resolution LOD meshes
    if (!this.heightMap) return;

    for (let i = 0; i < this.lodDistances.length; i++) {
      const lodResolution = Math.max(64, this.resolution >> (i + 1));
      const geometry = new THREE.PlaneGeometry(
        this.terrainSize,
        this.terrainSize,
        lodResolution - 1,
        lodResolution - 1
      );
      geometry.rotateX(-Math.PI / 2);

      // Sample heightmap at lower resolution
      const positions = geometry.attributes['position'] as THREE.BufferAttribute;
      const step = this.resolution / lodResolution;
      const heightMap = this.heightMap!;

      for (let z = 0; z < lodResolution; z++) {
        for (let x = 0; x < lodResolution; x++) {
          const srcX = Math.floor(x * step);
          const srcZ = Math.floor(z * step);
          const idx = srcZ * this.resolution + srcX;
          const lodIdx = z * lodResolution + x;
          positions.setY(lodIdx, heightMap[idx] ?? 0);
        }
      }

      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color: 0x8a7a65,
        roughness: 0.9,
        metalness: 0.0,
      });

      const lodMesh = new THREE.Mesh(geometry, material);
      lodMesh.receiveShadow = true;
      lodMesh.visible = false;
      this.sceneManager.scene.add(lodMesh);
      this.lodMeshes.push(lodMesh);
    }
  }

  updateLOD(cameraPosition: THREE.Vector3): void {
    if (!this.terrainMesh) return;

    const dist = cameraPosition.distanceTo(this.terrainMesh.position);

    // Show/hide LOD meshes
    const lodDist0 = this.lodDistances[0] ?? 500;
    this.terrainMesh.visible = dist < lodDist0;

    for (let i = 0; i < this.lodMeshes.length; i++) {
      const lodMesh = this.lodMeshes[i];
      if (!lodMesh) continue;
      const lodDistI = this.lodDistances[i] ?? 500;
      const nextDist = i < this.lodDistances.length - 1 ? this.lodDistances[i + 1]! : Infinity;
      lodMesh.visible = dist >= lodDistI && dist < nextDist;
    }
  }

  getHeightAt(x: number, z: number): number {
    if (!this.heightMap) return 0;

    // Convert world coords to heightmap coords
    const hx = Math.floor(((x + this.terrainSize / 2) / this.terrainSize) * this.resolution);
    const hz = Math.floor(((z + this.terrainSize / 2) / this.terrainSize) * this.resolution);

    if (hx < 0 || hx >= this.resolution || hz < 0 || hz >= this.resolution) return 0;

    // Bilinear interpolation
    const fx = ((x + this.terrainSize / 2) / this.terrainSize) * this.resolution - hx;
    const fz = ((z + this.terrainSize / 2) / this.terrainSize) * this.resolution - hz;

    const heightMap = this.heightMap;
    const h00 = heightMap[hz * this.resolution + hx] ?? 0;
    const h10 = heightMap[hz * this.resolution + Math.min(hx + 1, this.resolution - 1)] ?? 0;
    const h01 = heightMap[Math.min(hz + 1, this.resolution - 1) * this.resolution + hx] ?? 0;
    const h11 =
      heightMap[
        Math.min(hz + 1, this.resolution - 1) * this.resolution +
          Math.min(hx + 1, this.resolution - 1)
      ] ?? 0;

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;

    return h0 * (1 - fz) + h1 * fz;
  }

  getNormalAt(x: number, z: number): THREE.Vector3 {
    const eps = 10; // 10 meters
    const h = this.getHeightAt(x, z);
    const hx = this.getHeightAt(x + eps, z);
    const hz = this.getHeightAt(x, z + eps);

    const normal = new THREE.Vector3(h - hx, eps, h - hz).normalize();
    return normal;
  }

  // Deterministic 2D noise
  private noise2D(x: number, z: number): number {
    const n = Math.sin(x * 12.9898 + z * 78.233 + this.worldSeed * 0.001) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  getTerrainMesh(): THREE.Mesh | null {
    return this.terrainMesh;
  }

  getHeightMap(): Float32Array | null {
    return this.heightMap;
  }

  serialize(): any {
    return {
      worldSeed: this.worldSeed,
      worldSize: this.worldSize,
      terrainSize: this.terrainSize,
      resolution: this.resolution,
    };
  }
}

import * as THREE from 'three';

/**
 * WorldGrid - Spatial indexing and chunk coordinate system
 *
 * World is divided into square chunks. Each chunk is 200x200 meters.
 * Chunks are identified by integer coordinates (chunkX, chunkZ).
 *
 * Deterministic seeding: worldSeed + chunk coords = unique chunk seed
 * This allows infinite procedural generation without storing chunk data.
 */

export const CHUNK_SIZE = 200; // meters
export const CHUNK_HALF = CHUNK_SIZE / 2;
export const LOD_DISTANCES = {
  FULL: 50, // 0-50m: Full detail, interior accessible
  SIMPLIFIED: 150, // 50-150m: Exterior only, simplified geometry
  IMPOSTER: 500, // 150-500m: Billboard imposter
  CULLED: Infinity, // 500m+: Not rendered
};

export type LODLevel = 'FULL' | 'SIMPLIFIED' | 'IMPOSTER' | 'CULLED';

export interface ChunkCoord {
  x: number;
  z: number;
}

export interface ChunkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldPosition {
  x: number;
  z: number;
}

/**
 * Convert world position to chunk coordinates
 */
export function worldToChunk(pos: WorldPosition): ChunkCoord {
  return {
    x: Math.floor(pos.x / CHUNK_SIZE),
    z: Math.floor(pos.z / CHUNK_SIZE),
  };
}

/**
 * Convert chunk coordinates to world position (chunk center)
 */
export function chunkToWorld(chunk: ChunkCoord): WorldPosition {
  return {
    x: chunk.x * CHUNK_SIZE + CHUNK_HALF,
    z: chunk.z * CHUNK_SIZE + CHUNK_HALF,
  };
}

/**
 * Get chunk bounds in world space
 */
export function getChunkBounds(chunk: ChunkCoord): ChunkBounds {
  return {
    minX: chunk.x * CHUNK_SIZE,
    maxX: (chunk.x + 1) * CHUNK_SIZE,
    minZ: chunk.z * CHUNK_SIZE,
    maxZ: (chunk.z + 1) * CHUNK_SIZE,
  };
}

/**
 * Get chunk key for Map/Set storage
 */
export function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.x},${chunk.z}`;
}

/**
 * Parse chunk key back to coordinates
 */
export function parseChunkKey(key: string): ChunkCoord | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const z = Number(parts[1]);
  if (Number.isNaN(x) || Number.isNaN(z)) return null;
  return { x, z };
}

/**
 * Get all chunks within radius of a position
 */
export function getChunksInRadius(center: WorldPosition, radius: number): ChunkCoord[] {
  const centerChunk = worldToChunk(center);
  const chunkRadius = Math.ceil(radius / CHUNK_SIZE);
  const chunks: ChunkCoord[] = [];

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const chunk = { x: centerChunk.x + dx, z: centerChunk.z + dz };
      const chunkCenter = chunkToWorld(chunk);
      const dist = Math.hypot(chunkCenter.x - center.x, chunkCenter.z - center.z);
      if (dist <= radius + CHUNK_HALF) {
        chunks.push(chunk);
      }
    }
  }

  return chunks;
}

/**
 * Get chunks in view frustum (approximate with cone)
 */
export function getChunksInViewFrustum(
  position: WorldPosition,
  direction: THREE.Vector3,
  fov: number,
  far: number
): ChunkCoord[] {
  const chunks: ChunkCoord[] = [];
  const centerChunk = worldToChunk(position);
  const chunkRadius = Math.ceil(far / CHUNK_SIZE);
  const halfAngle = (fov / 2) * (Math.PI / 180);

  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      const chunk = { x: centerChunk.x + dx, z: centerChunk.z + dz };
      const chunkCenter = chunkToWorld(chunk);
      const toChunk = new THREE.Vector2(chunkCenter.x - position.x, chunkCenter.z - position.z);
      const dist = toChunk.length();

      if (dist > far + CHUNK_HALF) continue;

      // Check if in view cone
      if (dist > 0.1) {
        const forward = new THREE.Vector2(direction.x, direction.z).normalize();
        const dot = toChunk.dot(forward) / dist;
        if (dot < Math.cos(halfAngle)) continue;
      }

      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Calculate LOD level for a chunk based on distance from viewer
 */
export function getChunkLOD(chunk: ChunkCoord, viewerPos: WorldPosition): LODLevel {
  const chunkCenter = chunkToWorld(chunk);
  const dist = Math.hypot(chunkCenter.x - viewerPos.x, chunkCenter.z - viewerPos.z);

  if (dist <= LOD_DISTANCES.FULL) return 'FULL';
  if (dist <= LOD_DISTANCES.SIMPLIFIED) return 'SIMPLIFIED';
  if (dist <= LOD_DISTANCES.IMPOSTER) return 'IMPOSTER';
  return 'CULLED';
}

/**
 * Deterministic hash for procedural generation
 * Uses splitmix32 for good distribution
 */
export function hashChunk(chunk: ChunkCoord, worldSeed: number): number {
  let x = chunk.x + 0x9e3779b9;
  let z = chunk.z + 0x9e3779b9;
  let seed = worldSeed;

  // Splitmix32
  seed = (seed + 0x9e3779b9) | 0;
  let h = Math.imul(seed ^ (seed >>> 15), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = h ^ (h >>> 15);

  x = (x + h) | 0;
  z = (z + h) | 0;

  seed = (x + 0x9e3779b9) | 0;
  h = Math.imul(seed ^ (seed >>> 15), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = h ^ (h >>> 15);

  z = (z + h) | 0;

  seed = (z + 0x9e3779b9) | 0;
  h = Math.imul(seed ^ (seed >>> 15), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Seeded random number generator (mulberry32)
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  nextBoolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(array: T[]): T {
    const index = Math.floor(this.next() * array.length);
    return array[index]!;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }
}

/**
 * Create a seeded random generator for a specific chunk
 */
export function createChunkRandom(chunk: ChunkCoord, worldSeed: number): SeededRandom {
  const seed = hashChunk(chunk, worldSeed);
  return new SeededRandom(seed);
}

/**
 * Neighbor chunk offsets (including diagonals)
 */
export const NEIGHBOR_OFFSETS: ChunkCoord[] = [
  { x: -1, z: -1 },
  { x: 0, z: -1 },
  { x: 1, z: -1 },
  { x: -1, z: 0 },
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 1 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
];

/**
 * Get neighbor chunks
 */
export function getNeighborChunks(chunk: ChunkCoord): ChunkCoord[] {
  return NEIGHBOR_OFFSETS.map(offset => ({
    x: chunk.x + offset.x,
    z: chunk.z + offset.z,
  }));
}

/**
 * Spiral iteration from center chunk outward
 * Useful for priority loading
 */
export function* spiralChunks(center: ChunkCoord, maxRadius: number): Generator<ChunkCoord> {
  yield center;

  for (let radius = 1; radius <= maxRadius; radius++) {
    const x = center.x + radius;
    const z = center.z - radius + 1;

    // Right edge (down)
    for (let i = 0; i < radius * 2; i++) {
      yield { x, z: z + i };
    }
    // Bottom edge (left)
    for (let i = 0; i < radius * 2; i++) {
      yield { x: x - i, z: z + radius * 2 - 1 };
    }
    // Left edge (up)
    for (let i = 0; i < radius * 2; i++) {
      yield { x: x - radius * 2 + 1, z: z + radius * 2 - 1 - i };
    }
    // Top edge (right)
    for (let i = 0; i < radius * 2; i++) {
      yield { x: x - radius * 2 + 1 + i, z: z - 1 };
    }
  }
}

/**
 * Terrain Worker - Off-main-thread heightmap and terrain generation
 * Uses Comlink for RPC communication with main thread
 */

import * as Comlink from 'comlink';

// ============================================
// SIMPLEX NOISE IMPLEMENTATION
// ============================================

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1,
  0, 1, -1, 0, -1, -1,
]);

const PERM = new Uint8Array(512);
const PERM_MOD12 = new Uint8Array(512);

function initPermutation(seed: number): void {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
    PERM_MOD12[i] = PERM[i] % 12;
  }
}

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

function simplex2D(xin: number, yin: number): number {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1, j1;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = i & 255;
  const jj = j & 255;
  const gi0 = PERM_MOD12[ii + PERM[jj]];
  const gi1 = PERM_MOD12[ii + i1 + PERM[jj + j1]];
  const gi2 = PERM_MOD12[ii + 1 + PERM[jj + 1]];

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  let n0 = 0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * (GRAD3[gi0 * 3] * x0 + GRAD3[gi0 * 3 + 1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  let n1 = 0;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * (GRAD3[gi1 * 3] * x1 + GRAD3[gi1 * 3 + 1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  let n2 = 0;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * (GRAD3[gi2 * 3] * x2 + GRAD3[gi2 * 3 + 1] * y2);
  }

  return 70.0 * (n0 + n1 + n2);
}

function simplex3D(xin: number, yin: number, zin: number): number {
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;
  const z0 = zin - Z0;

  let i1, j1, k1;
  let i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) {
      i1 = 1;
      j1 = 0;
      k1 = 0;
      i2 = 1;
      j2 = 1;
      k2 = 0;
    } else if (x0 >= z0) {
      i1 = 1;
      j1 = 0;
      k1 = 0;
      i2 = 1;
      j2 = 0;
      k2 = 1;
    } else {
      i1 = 0;
      j1 = 0;
      k1 = 1;
      i2 = 1;
      j2 = 0;
      k2 = 1;
    }
  } else {
    if (y0 < z0) {
      i1 = 0;
      j1 = 0;
      k1 = 1;
      i2 = 0;
      j2 = 1;
      k2 = 1;
    } else if (x0 < z0) {
      i1 = 0;
      j1 = 1;
      k1 = 0;
      i2 = 0;
      j2 = 1;
      k2 = 1;
    } else {
      i1 = 0;
      j1 = 1;
      k1 = 0;
      i2 = 1;
      j2 = 1;
      k2 = 0;
    }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  const gi0 = PERM_MOD12[ii + PERM[jj + PERM[kk]]];
  const gi1 = PERM_MOD12[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]];
  const gi2 = PERM_MOD12[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]];
  const gi3 = PERM_MOD12[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]];

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  let n0 = 0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * (GRAD3[gi0 * 3] * x0 + GRAD3[gi0 * 3 + 1] * y0 + GRAD3[gi0 * 3 + 2] * z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  let n1 = 0;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * (GRAD3[gi1 * 3] * x1 + GRAD3[gi1 * 3 + 1] * y1 + GRAD3[gi1 * 3 + 2] * z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  let n2 = 0;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * (GRAD3[gi2 * 3] * x2 + GRAD3[gi2 * 3 + 1] * y2 + GRAD3[gi2 * 3 + 2] * z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  let n3 = 0;
  if (t3 >= 0) {
    t3 *= t3;
    n3 = t3 * t3 * (GRAD3[gi3 * 3] * x3 + GRAD3[gi3 * 3 + 1] * y3 + GRAD3[gi3 * 3 + 2] * z3);
  }

  return 32.0 * (n0 + n1 + n2 + n3);
}

// ============================================
// TERRAIN GENERATION
// ============================================

export interface TerrainGenerationParams {
  seed: number;
  width: number; // vertices per side (e.g., 256)
  depth: number;
  scale: number; // world units per vertex
  heightScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  offsetX: number;
  offsetZ: number;
}

export interface TerrainGenerationResult {
  heightMap: Float32Array; // length = width * depth
  normals: Float32Array; // length = width * depth * 3
  biomes: Uint8Array; // length = width * depth (0=plains, 1=hills, 2=mountains, 3=water)
  minHeight: number;
  maxHeight: number;
}

function fbm2D(
  x: number,
  z: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplex2D(x * frequency, z * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

function getBiome(height: number, moisture: number): number {
  if (height < 0.15) return 3; // water
  if (height < 0.25) return 0; // plains/beach
  if (height < 0.5) return 1; // hills
  if (height < 0.75) return 1; // hills
  return 2; // mountains
}

const TerrainWorker = {
  init(seed: number): void {
    initPermutation(seed);
  },

  generate(params: TerrainGenerationParams): TerrainGenerationResult {
    initPermutation(params.seed);

    const { width, depth, scale, heightScale, octaves, persistence, lacunarity, offsetX, offsetZ } =
      params;
    const heightMap = new Float32Array(width * depth);
    const normals = new Float32Array(width * depth * 3);
    const biomes = new Uint8Array(width * depth);

    let minHeight = Infinity;
    let maxHeight = -Infinity;

    // First pass: generate heightmap
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const worldX = (x + offsetX) * scale;
        const worldZ = (z + offsetZ) * scale;

        const noiseX = worldX / 1000;
        const noiseZ = worldZ / 1000;

        let h = fbm2D(noiseX, noiseZ, octaves, persistence, lacunarity);

        // Add large-scale variation
        const largeScale = fbm2D(noiseX * 0.01, noiseZ * 0.01, 4, 0.5, 2.0);
        h = h * 0.7 + largeScale * 0.3;

        // Add ridges for mountains
        const ridge = 1 - Math.abs(fbm2D(noiseX * 0.5, noiseZ * 0.5, 4, 0.5, 2.0));
        h += ridge * 0.15;

        // Moisture for biome
        const moisture = fbm2D(noiseX * 2, noiseZ * 2, 2, 0.5, 2.0);

        const finalHeight = h * heightScale;
        heightMap[z * width + x] = finalHeight;

        minHeight = Math.min(minHeight, finalHeight);
        maxHeight = Math.max(maxHeight, finalHeight);

        biomes[z * width + x] = getBiome(h, moisture);
      }
    }

    // Second pass: calculate normals
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;

        // Sample neighbors
        const hl = x > 0 ? heightMap[z * width + (x - 1)] : heightMap[idx];
        const hr = x < width - 1 ? heightMap[z * width + (x + 1)] : heightMap[idx];
        const hd = z > 0 ? heightMap[(z - 1) * width + x] : heightMap[idx];
        const hu = z < depth - 1 ? heightMap[(z + 1) * width + x] : heightMap[idx];

        // Normal = cross((1, hr-hl, 0), (0, hu-hd, 1))
        const nx = hl - hr;
        const ny = 2 * scale;
        const nz = hd - hu;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) {
          normals[idx * 3] = nx / len;
          normals[idx * 3 + 1] = ny / len;
          normals[idx * 3 + 2] = nz / len;
        } else {
          normals[idx * 3] = 0;
          normals[idx * 3 + 1] = 1;
          normals[idx * 3 + 2] = 0;
        }
      }
    }

    return { heightMap, normals, biomes, minHeight, maxHeight };
  },

  generateChunk(
    seed: number,
    chunkX: number,
    chunkZ: number,
    chunkSize: number,
    scale: number,
    heightScale: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ): TerrainGenerationResult {
    return this.generate({
      seed,
      width: chunkSize,
      depth: chunkSize,
      scale,
      heightScale,
      octaves,
      persistence,
      lacunarity,
      offsetX: chunkX * chunkSize,
      offsetZ: chunkZ * chunkSize,
    });
  },

  sampleHeight(
    seed: number,
    x: number,
    z: number,
    scale: number,
    heightScale: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ): number {
    initPermutation(seed);
    const noiseX = x / 1000;
    const noiseZ = z / 1000;
    let h = fbm2D(noiseX * scale, noiseZ * scale, octaves, persistence, lacunarity);
    const largeScale = fbm2D(noiseX * 0.01, noiseZ * 0.01, 4, 0.5, 2.0);
    h = h * 0.7 + largeScale * 0.3;
    const ridge = 1 - Math.abs(fbm2D(noiseX * 0.5, noiseZ * 0.5, 4, 0.5, 2.0));
    h += ridge * 0.15;
    return h * heightScale;
  },
};

export type TerrainWorkerAPI = typeof TerrainWorker;

Comlink.expose(TerrainWorker);

console.log('[TerrainWorker] Initialized and ready');

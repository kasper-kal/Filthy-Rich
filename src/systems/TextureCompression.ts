/**
 * Texture Compression System - KTX2/BasisU support for web
 * Provides GPU-compressed texture loading with fallback
 */

import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// ============================================
// TYPES
// ============================================

export interface CompressedTextureOptions {
  url: string;
  fallbackUrl?: string; // Uncompressed fallback (jpg/png)
  format?: 'ktx2' | 'auto';
  generateMipmaps?: boolean;
  colorSpace?: THREE.ColorSpace;
  flipY?: boolean;
  anisotropy?: number;
}

export interface TextureCompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  loadTime: number;
}

// ============================================
// TEXTURE COMPRESSION MANAGER
// ============================================

export class TextureCompressionManager {
  private ktx2Loader: KTX2Loader | null = null;
  private transcodePending: Promise<void> | null = null;
  private stats = new Map<string, TextureCompressionStats>();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.initLoaders();
  }

  private async initLoaders(): Promise<void> {
    // Initialize KTX2 loader with WASM transcoder
    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/basis/');
    this.ktx2Loader.detectSupport(this.renderer);

    // Wait for transcoder to be ready (transcoderPending is a Promise)
    this.transcodePending = this.ktx2Loader.transcoderPending!;
    if (this.transcodePending) {
      await this.transcodePending;
      console.log('[TextureCompression] KTX2 transcoder ready');
    }
  }

  /**
   * Wait for transcoders to be initialized
   */
  async ready(): Promise<void> {
    if (this.transcodePending) {
      await this.transcodePending;
    }
  }

  /**
   * Load a compressed texture with automatic format detection and fallback
   */
  async loadTexture(
    options: CompressedTextureOptions
  ): Promise<THREE.CompressedTexture | THREE.Texture> {
    const startTime = performance.now();
    const {
      url,
      fallbackUrl,
      format = 'auto',
      generateMipmaps = true,
      colorSpace = THREE.SRGBColorSpace,
      flipY = false,
      anisotropy = 4,
    } = options;

    await this.ready();

    // Currently only KTX2 is supported in three.js
    const detectedFormat = 'ktx2';

    try {
      let texture: THREE.CompressedTexture | THREE.Texture;

      if (this.ktx2Loader) {
        texture = await this.loadKTX2(url);
      } else {
        throw new Error('KTX2 loader not initialized');
      }

      // Configure texture
      texture.colorSpace = colorSpace;
      texture.flipY = flipY;
      texture.anisotropy = Math.min(anisotropy, this.renderer.capabilities.getMaxAnisotropy());

      if (generateMipmaps && texture instanceof THREE.CompressedTexture) {
        // Mipmaps are embedded in KTX2
        texture.mipmaps = texture.mipmaps || [];
      }

      const loadTime = performance.now() - startTime;
      this.recordStats(url, texture, detectedFormat, loadTime);

      console.log(
        `[TextureCompression] Loaded ${detectedFormat.toUpperCase()}: ${url} (${loadTime.toFixed(1)}ms)`
      );
      return texture;
    } catch (error: unknown) {
      console.warn(`[TextureCompression] Failed to load ${detectedFormat}:`, error);

      // Fallback to uncompressed texture
      if (fallbackUrl) {
        console.log(`[TextureCompression] Falling back to: ${fallbackUrl}`);
        return this.loadFallback(fallbackUrl, options);
      }

      throw error;
    }
  }

  /**
   * Load KTX2 texture
   */
  private loadKTX2(url: string): Promise<THREE.CompressedTexture> {
    return new Promise((resolve, reject) => {
      this.ktx2Loader!.load(
        url,
        (texture: THREE.CompressedTexture) => {
          resolve(texture);
        },
        undefined,
        (error: unknown) => {
          reject(
            new Error(
              `Failed to load KTX2: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      );
    });
  }

  /**
   * Load fallback uncompressed texture
   */
  private loadFallback(url: string, options: CompressedTextureOptions): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture: THREE.Texture) => {
          texture.colorSpace = options.colorSpace || THREE.SRGBColorSpace;
          texture.flipY = options.flipY ?? false;
          texture.anisotropy = Math.min(
            options.anisotropy || 4,
            this.renderer.capabilities.getMaxAnisotropy()
          );
          if (options.generateMipmaps) {
            texture.generateMipmaps = true;
          }
          resolve(texture);
        },
        undefined,
        (error: unknown) => {
          reject(
            new Error(
              `Failed to load fallback texture: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      );
    });
  }

  /**
   * Record compression statistics
   */
  private recordStats(
    url: string,
    texture: THREE.Texture | THREE.CompressedTexture,
    format: string,
    loadTime: number
  ): void {
    // For compressed textures, we can estimate original size from mipmaps
    let originalSize = 0;
    let compressedSize = 0;

    if (texture instanceof THREE.CompressedTexture && texture.mipmaps.length > 0) {
      // Estimate: base mip level size * format bytes per block
      const baseMip = texture.mipmaps[0];
      const width = baseMip.width;
      const height = baseMip.height;
      // BC7/ASTC approx 1 byte per pixel compressed vs 4 bytes uncompressed
      compressedSize = width * height;
      originalSize = width * height * 4;
    }

    this.stats.set(url, {
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? originalSize / compressedSize : 0,
      format,
      loadTime,
    });
  }

  /**
   * Get compression statistics
   */
  getStats(url: string): TextureCompressionStats | undefined {
    return this.stats.get(url);
  }

  /**
   * Get all statistics
   */
  getAllStats(): TextureCompressionStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get total memory savings
   */
  getTotalSavings(): { original: number; compressed: number; ratio: number } {
    let original = 0;
    let compressed = 0;
    for (const stat of this.stats.values()) {
      original += stat.originalSize;
      compressed += stat.compressedSize;
    }
    return { original, compressed, ratio: original > 0 ? original / compressed : 0 };
  }

  /**
   * Preload multiple textures
   */
  async preloadTextures(
    urls: string[],
    fallbackMap = new Map<string, string>()
  ): Promise<Map<string, THREE.Texture>> {
    const results = new Map<string, THREE.Texture>();

    await Promise.all(
      urls.map(async url => {
        try {
          const fallbackUrl = fallbackMap.get(url);
          const texture = await this.loadTexture({ url, fallbackUrl });
          results.set(url, texture);
        } catch (error) {
          console.warn(`[TextureCompression] Failed to preload: ${url}`, error);
        }
      })
    );

    return results;
  }

  /**
   * Create compressed texture from image data (for runtime compression)
   * Note: This requires server-side or build-time compression
   * This method is a placeholder for future integration
   */
  async createCompressedTexture(
    _imageData: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
    _options: { format: 'ktx2' | 'basis'; quality: number }
  ): Promise<Uint8Array> {
    // This would require a WebAssembly compressor (e.g., basisu encoder)
    // For now, compression should be done at build time
    throw new Error(
      'Runtime texture compression not implemented. Use build-time compression with basisu CLI.'
    );
  }

  /**
   * Dispose of all loaders
   */
  dispose(): void {
    this.ktx2Loader?.dispose();
    this.stats.clear();
  }
}

// ============================================
// UTILITY: Generate KTX2/Basis URLs from base texture name
// ============================================

export function generateCompressedTextureUrls(
  baseName: string,
  basePath = '/textures/'
): {
  ktx2: string;
  fallback: string;
} {
  // Remove extension if present
  const name = baseName.replace(/\.(jpg|jpeg|png|webp)$/i, '');

  return {
    ktx2: `${basePath}${name}.ktx2`,
    fallback: `${basePath}${name}.jpg`,
  };
}

// ============================================
// UTILITY: Build-time texture compression helper
// ============================================

/**
 * Configuration for basisu CLI (run at build time)
 * Example usage:
 *   basisu -ktx2 -uastc -q 128 -mipmap -file texture.png -output_path dist/textures/
 */
export const BASISU_BUILD_CONFIG = {
  // Quality settings
  quality: 128, // 1-255 (higher = better quality, larger file)
  uastc: true, // Use UASTC format (better quality than ETC1S)
  ktx2: true, // Output KTX2 container
  mipmap: true, // Generate mipmaps
  normalMap: false, // Set true for normal maps
  srgb: true, // Input is sRGB
  linear: false, // Input is linear

  // Advanced
  endpointRDO: 50, // Endpoint RDO threshold (0-255)
  selectorRDO: 50, // Selector RDO threshold (0-255)
  noEndpointRDO: false,
  noSelectorRDO: false,

  // Output
  outputPath: 'dist/textures/',
  filePattern: '*.png', // Input files
};

/**
 * Generate basisu command for package.json scripts
 */
export function generateBasisuCommand(
  config: typeof BASISU_BUILD_CONFIG = BASISU_BUILD_CONFIG
): string {
  const args = [
    'basisu',
    config.ktx2 ? '-ktx2' : '-basis',
    config.uastc ? '-uastc' : '-etc1s',
    `-q ${config.quality}`,
    config.mipmap ? '-mipmap' : '',
    config.normalMap ? '-normal_map' : '',
    config.srgb ? '-srgb' : '-linear',
    config.endpointRDO > 0 ? `-endpoint_rdo ${config.endpointRDO}` : '',
    config.selectorRDO > 0 ? `-selector_rdo ${config.selectorRDO}` : '',
    `-output_path ${config.outputPath}`,
    config.filePattern,
  ]
    .filter(Boolean)
    .join(' ');

  return args;
}

// ============================================
// THREE.JS INTEGRATION HELPERS
// ============================================

/**
 * Apply compressed texture to material with proper setup
 */
export function applyCompressedTexture(
  material: THREE.Material,
  mapType: 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap' | 'emissiveMap',
  texture: THREE.CompressedTexture | THREE.Texture
): void {
  if (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial ||
    material instanceof THREE.MeshBasicMaterial
  ) {
    (material as any)[mapType] = texture;
    material.needsUpdate = true;

    // For compressed textures, ensure proper encoding
    if (texture instanceof THREE.CompressedTexture) {
      // Compressed textures handle their own mipmaps
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
  }
}

/**
 * Create a material with compressed textures
 */
export async function createCompressedMaterial(
  manager: TextureCompressionManager,
  textures: {
    map?: CompressedTextureOptions;
    normalMap?: CompressedTextureOptions;
    roughnessMap?: CompressedTextureOptions;
    metalnessMap?: CompressedTextureOptions;
    aoMap?: CompressedTextureOptions;
    emissiveMap?: CompressedTextureOptions;
  },
  materialOptions: THREE.MeshStandardMaterialParameters = {}
): Promise<THREE.MeshStandardMaterial> {
  const loadedTextures: Record<string, THREE.Texture | THREE.CompressedTexture> = {};

  // Load all textures in parallel
  await Promise.all(
    Object.entries(textures).map(async ([key, options]) => {
      if (options) {
        loadedTextures[key] = await manager.loadTexture(options);
      }
    })
  );

  const material = new THREE.MeshStandardMaterial({
    ...materialOptions,
    ...loadedTextures,
  });

  // Set proper filters for compressed textures
  for (const texture of Object.values(loadedTextures)) {
    if (texture instanceof THREE.CompressedTexture) {
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
  }

  return material;
}

// ============================================
// TEXTURE STREAMING INTEGRATION
// ============================================

export interface StreamingTextureOptions extends CompressedTextureOptions {
  priority: 'critical' | 'high' | 'normal' | 'low';
  maxDistance?: number; // Distance at which to load
}

export class StreamingTextureManager {
  private loadQueue: {
    options: StreamingTextureOptions;
    resolve: (t: THREE.Texture) => void;
    reject: (e: Error) => void;
  }[] = [];
  private loading = false;
  private activeLoads = 0;
  private maxConcurrent = 4;

  constructor(private compressionManager: TextureCompressionManager) {}

  /**
   * Request a texture with priority-based loading
   */
  requestTexture(options: StreamingTextureOptions): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.loadQueue.push({ options, resolve, reject });
      this.loadQueue.sort(
        (a, b) => this.priorityValue(b.options.priority) - this.priorityValue(a.options.priority)
      );
      this.processQueue();
    });
  }

  private priorityValue(priority: string): number {
    switch (priority) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.loading || this.activeLoads >= this.maxConcurrent) return;
    if (this.loadQueue.length === 0) return;

    this.loading = true;

    while (this.loadQueue.length > 0 && this.activeLoads < this.maxConcurrent) {
      const item = this.loadQueue.shift()!;
      this.activeLoads++;

      this.compressionManager
        .loadTexture(item.options)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeLoads--;
          this.processQueue();
        });
    }

    this.loading = false;
  }

  /**
   * Cancel all pending loads
   */
  cancelAll(): void {
    for (const item of this.loadQueue) {
      item.reject(new Error('Cancelled'));
    }
    this.loadQueue = [];
  }

  /**
   * Set max concurrent loads
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processQueue();
  }
}

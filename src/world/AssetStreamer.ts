import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * AssetStreamer - Priority-based asset loading with memory budget management
 * Supports GLTF models, textures (KTX2/BasisU), and other assets
 */

export type AssetPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND'
export type AssetType = 'gltf' | 'texture' | 'ktx2' | 'audio' | 'json' | 'binary'

export interface AssetRequest {
  id: string
  url: string
  type: AssetType
  priority: AssetPriority
  timestamp: number
  resolve: (asset: any) => void
  reject: (error: Error) => void
  options?: AssetLoadOptions
}

export interface AssetLoadOptions {
  /** For GLTF: whether to load as draco compressed */
  dracoDecoderPath?: string
  /** For textures: generate mipmaps */
  generateMipmaps?: boolean
  /** For textures: color space */
  colorSpace?: THREE.ColorSpace
  /** For ktx2: transcoder path */
  ktx2TranscoderPath?: string
  /** Callback for progress */
  onProgress?: (progress: number) => void
  /** Cache key override */
  cacheKey?: string
}

export interface LoadedAsset {
  id: string
  url: string
  type: AssetType
  data: any
  size: number // estimated memory in bytes
  lastAccessed: number
  referenceCount: number
}

export interface AssetStreamerConfig {
  memoryBudget: number // bytes
  maxConcurrentLoads: number
  maxCacheSize: number // number of assets
  defaultPriority: AssetPriority
  enableKTX2: boolean
  enableMeshopt: boolean
  dracoDecoderPath: string
  ktx2TranscoderPath: string
}

const DEFAULT_CONFIG: AssetStreamerConfig = {
  memoryBudget: 512 * 1024 * 1024, // 512MB for assets
  maxConcurrentLoads: 4,
  maxCacheSize: 200,
  defaultPriority: 'NORMAL',
  enableKTX2: true,
  enableMeshopt: true,
  dracoDecoderPath: 'https://unpkg.com/three@latest/examples/jsm/libs/draco/',
  ktx2TranscoderPath: 'https://unpkg.com/three@latest/examples/jsm/libs/basis/'
}

export class AssetStreamer {
  private config: AssetStreamerConfig
  private cache: Map<string, LoadedAsset> = new Map()
  private loadQueue: AssetRequest[] = []
  private loading: Set<string> = new Set()
  private currentMemoryUsage = 0
  private loadersInitialized = false

  // Loaders
  private gltfLoader: GLTFLoader | null = null
  private ktx2Loader: KTX2Loader | null = null
  private textureLoader: THREE.TextureLoader
  private audioLoader: THREE.AudioLoader
  private fileLoader: THREE.FileLoader

  // Callbacks
  onAssetLoaded?: (asset: LoadedAsset) => void
  onAssetUnloaded?: (assetId: string) => void
  onMemoryPressure?: (usage: number, budget: number) => void

  constructor(config?: Partial<AssetStreamerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.textureLoader = new THREE.TextureLoader()
    this.audioLoader = new THREE.AudioLoader()
    this.fileLoader = new THREE.FileLoader()
    this.fileLoader.setResponseType('arraybuffer')
  }

  /**
   * Initialize loaders (must be called after Three.js is ready)
   */
  async init(): Promise<void> {
    if (this.loadersInitialized) return

    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.setDRACOLoader(this.createDracoLoader())
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder)

    if (this.config.enableKTX2) {
      this.ktx2Loader = new KTX2Loader()
      this.ktx2Loader.setTranscoderPath(this.config.ktx2TranscoderPath)
      // KTX2Loader will auto-detect GPU on first load
    }

    this.loadersInitialized = true
  }

  private createDracoLoader(): any {
    // Would create DRACOLoader if needed
    return null
  }

  /**
   * Request an asset to be loaded
   */
  load<T = any>(
    url: string,
    type: AssetType,
    priority: AssetPriority = this.config.defaultPriority,
    options?: AssetLoadOptions
  ): Promise<T> {
    const cacheKey = options?.cacheKey || url
    const cached = this.cache.get(cacheKey)

    if (cached) {
      cached.lastAccessed = Date.now()
      cached.referenceCount++
      return Promise.resolve(cached.data as T)
    }

    return new Promise((resolve, reject) => {
      const request: AssetRequest = {
        id: cacheKey,
        url,
        type,
        priority,
        timestamp: Date.now(),
        resolve: resolve as (asset: any) => void,
        reject,
        options
      }

      this.loadQueue.push(request)
      this.sortQueue()
      this.processQueue()
    })
  }

  /**
   * Load multiple assets at once
   */
  loadMultiple(requests: Array<{ url: string; type: AssetType; priority?: AssetPriority; options?: AssetLoadOptions }>): Promise<any[]> {
    return Promise.all(requests.map(r =>
      this.load(r.url, r.type, r.priority, r.options)
    ))
  }

  /**
   * Preload assets (LOW priority)
   */
  preload(urls: string[], type: AssetType): Promise<void[]> {
    return Promise.all(urls.map(url =>
      this.load(url, type, 'LOW').catch(() => {}) // Ignore errors for preload
    ))
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    const priorityOrder: Record<AssetPriority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
      BACKGROUND: 4
    }

    this.loadQueue.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      return a.timestamp - b.timestamp
    })
  }

  /**
   * Process the load queue
   */
  private async processQueue(): Promise<void> {
    if (this.loading.size >= this.config.maxConcurrentLoads) return
    if (this.loadQueue.length === 0) return

    while (this.loadQueue.length > 0 && this.loading.size < this.config.maxConcurrentLoads) {
      const request = this.loadQueue.shift()!
      this.loading.add(request.id)

      try {
        const asset = await this.loadAsset(request)
        this.cacheAsset(request, asset)
        request.resolve(asset.data)
        this.onAssetLoaded?.(asset)
      } catch (error) {
        request.reject(error as Error)
      } finally {
        this.loading.delete(request.id)
      }
    }

    // Continue processing if queue not empty
    if (this.loadQueue.length > 0) {
      setTimeout(() => this.processQueue(), 0)
    }
  }

  /**
   * Load a single asset based on type
   */
  private async loadAsset(request: AssetRequest): Promise<LoadedAsset> {
    const { url, type, options } = request

    let data: any
    let size = 0

    switch (type) {
      case 'gltf':
        data = await this.loadGLTF(url, options)
        size = this.estimateGLTFSize(data)
        break
      case 'texture':
        data = await this.loadTexture(url, options)
        size = this.estimateTextureSize(data)
        break
      case 'ktx2':
        data = await this.loadKTX2(url, options)
        size = this.estimateTextureSize(data)
        break
      case 'audio':
        data = await this.loadAudio(url)
        size = this.estimateAudioSize(data)
        break
      case 'json':
        data = await this.loadJSON(url)
        size = JSON.stringify(data).length
        break
      case 'binary':
        data = await this.loadBinary(url)
        size = data.byteLength
        break
      default:
        throw new Error(`Unknown asset type: ${type}`)
    }

    return {
      id: request.id,
      url,
      type,
      data,
      size,
      lastAccessed: Date.now(),
      referenceCount: 1
    }
  }

  /**
   * Load GLTF model
   */
  private loadGLTF(url: string, options?: AssetLoadOptions): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      if (!this.gltfLoader) {
        reject(new Error('GLTFLoader not initialized'))
        return
      }

      this.gltfLoader.load(
        url,
        (gltf) => {
          const group = gltf.scene
          group.name = url.split('/').pop() || 'gltf'

          // Apply optimizations
          group.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.frustumCulled = true
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => this.optimizeMaterial(m))
                } else {
                  this.optimizeMaterial(child.material)
                }
              }
            }
          })

          // Animation mixer if animations exist
          if (gltf.animations.length > 0) {
            (group as any).animations = gltf.animations
          }

          resolve(group)
        },
        (xhr) => {
          if (options?.onProgress) {
            options.onProgress(xhr.loaded / xhr.total)
          }
        },
        reject
      )
    })
  }

  /**
   * Load regular texture
   */
  private loadTexture(url: string, options?: AssetLoadOptions): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          if (options?.generateMipmaps !== false) {
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.generateMipmaps = true
          }
          if (options?.colorSpace) {
            texture.colorSpace = options.colorSpace
          }
          texture.needsUpdate = true
          resolve(texture)
        },
        (xhr) => {
          if (options?.onProgress) {
            options.onProgress(xhr.loaded / xhr.total)
          }
        },
        reject
      )
    })
  }

  /**
   * Load KTX2 compressed texture
   */
  private loadKTX2(url: string, options?: AssetLoadOptions): Promise<THREE.CompressedTexture> {
    return new Promise((resolve, reject) => {
      if (!this.ktx2Loader) {
        reject(new Error('KTX2Loader not initialized'))
        return
      }

      this.ktx2Loader.load(
        url,
        (texture) => {
          if (options?.generateMipmaps !== false) {
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.generateMipmaps = true
          }
          if (options?.colorSpace) {
            texture.colorSpace = options.colorSpace
          }
          texture.needsUpdate = true
          resolve(texture)
        },
        (xhr) => {
          if (options?.onProgress) {
            options.onProgress(xhr.loaded / xhr.total)
          }
        },
        reject
      )
    })
  }

  /**
   * Load audio buffer
   */
  private loadAudio(url: string): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(url, resolve, undefined, reject)
    })
  }

  /**
   * Load JSON
   */
  private loadJSON(url: string): Promise<any> {
    return fetch(url).then(r => r.json())
  }

  /**
   * Load binary data
   */
  private loadBinary(url: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      this.fileLoader.load(url, (data: string | ArrayBuffer) => {
        if (data instanceof ArrayBuffer) {
          resolve(data)
        } else {
          // Convert string to ArrayBuffer (base64 or text)
          const encoder = new TextEncoder()
          resolve(encoder.encode(data).buffer)
        }
      }, undefined, reject)
    })
  }

  /**
   * Cache loaded asset
   */
  private cacheAsset(request: AssetRequest, asset: LoadedAsset): void {
    // Check memory budget
    this.evictIfNeeded(asset.size)

    this.cache.set(request.id, asset)
    this.currentMemoryUsage += asset.size
  }

  /**
   * Evict least recently used assets if over budget
   */
  private evictIfNeeded(requiredSize: number): void {
    if (this.currentMemoryUsage + requiredSize <= this.config.memoryBudget) return

    // Also enforce max cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLRU(this.cache.size - this.config.maxCacheSize + 1)
      return
    }

    // Evict until we have space
    const targetUsage = this.config.memoryBudget - requiredSize
    const sorted = Array.from(this.cache.values())
      .filter(a => a.referenceCount === 0) // Only evict unreferenced
      .sort((a, b) => a.lastAccessed - b.lastAccessed)

    for (const asset of sorted) {
      if (this.currentMemoryUsage <= targetUsage) break
      this.evictAsset(asset.id)
    }

    // If still over budget, force evict referenced assets (last resort)
    if (this.currentMemoryUsage > targetUsage) {
      const allSorted = Array.from(this.cache.values())
        .sort((a, b) => a.lastAccessed - b.lastAccessed)

      for (const asset of allSorted) {
        if (this.currentMemoryUsage <= targetUsage) break
        this.evictAsset(asset.id)
      }
    }
  }

  /**
   * Evict specific number of LRU assets
   */
  private evictLRU(count: number): void {
    const sorted = Array.from(this.cache.values())
      .filter(a => a.referenceCount === 0)
      .sort((a, b) => a.lastAccessed - b.lastAccessed)

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      this.evictAsset(sorted[i].id)
    }
  }

  /**
   * Evict a single asset
   */
  private evictAsset(assetId: string): void {
    const asset = this.cache.get(assetId)
    if (!asset) return

    // Dispose of Three.js resources
    this.disposeAssetData(asset.data, asset.type)

    this.currentMemoryUsage -= asset.size
    this.cache.delete(assetId)
    this.onAssetUnloaded?.(assetId)
  }

  /**
   * Dispose Three.js asset data
   */
  private disposeAssetData(data: any, type: AssetType): void {
    if (!data) return

    switch (type) {
      case 'gltf':
        if (data instanceof THREE.Object3D) {
          data.traverse(obj => {
            if (obj instanceof THREE.Mesh) {
              obj.geometry.dispose()
              if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose())
              } else {
                obj.material.dispose()
              }
            }
          })
        }
        break
      case 'texture':
      case 'ktx2':
        if (data instanceof THREE.Texture) {
          data.dispose()
        }
        break
      case 'audio':
        // AudioBuffer doesn't need explicit disposal
        break
    }
  }

  /**
   * Release reference to asset (call when done using)
   */
  release(assetId: string): void {
    const asset = this.cache.get(assetId)
    if (asset) {
      asset.referenceCount = Math.max(0, asset.referenceCount - 1)
      asset.lastAccessed = Date.now()
    }
  }

  /**
   * Retain reference to asset (call when starting to use)
   */
  retain(assetId: string): void {
    const asset = this.cache.get(assetId)
    if (asset) {
      asset.referenceCount++
      asset.lastAccessed = Date.now()
    }
  }

  /**
   * Get asset from cache (increments ref count)
   */
  get<T = any>(assetId: string): T | null {
    const asset = this.cache.get(assetId)
    if (asset) {
      asset.referenceCount++
      asset.lastAccessed = Date.now()
      return asset.data as T
    }
    return null
  }

  /**
   * Check if asset is cached
   */
  has(assetId: string): boolean {
    return this.cache.has(assetId)
  }

  /**
   * Optimize material for rendering
   */
  private optimizeMaterial(material: THREE.Material): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      // Enable instancing-friendly settings
      material.flatShading = false
    }
  }

  /**
   * Estimate GLTF memory size
   */
  private estimateGLTFSize(gltf: THREE.Group): number {
    let bytes = 0
    gltf.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        bytes += this.estimateGeometryMemory(obj.geometry)
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            bytes += obj.material.reduce((sum, m) => sum + this.estimateMaterialMemory(m), 0)
          } else {
            bytes += this.estimateMaterialMemory(obj.material)
          }
        }
      }
    })
    return bytes
  }

  /**
   * Estimate texture memory size
   */
  private estimateTextureSize(texture: THREE.Texture): number {
    if (!texture.image) return 1024 * 1024 // 1MB default

    const img = texture.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap
    let width = 0, height = 0

    if ('width' in img && 'height' in img) {
      width = img.width
      height = img.height
    }

    if (width === 0 || height === 0) return 1024 * 1024

    // RGBA = 4 bytes per pixel, plus mipmaps (~33%)
    return width * height * 4 * 1.33
  }

  /**
   * Estimate audio memory size
   */
  private estimateAudioSize(buffer: AudioBuffer): number {
    return buffer.length * buffer.numberOfChannels * 4 // float32
  }

  private estimateGeometryMemory(geometry: THREE.BufferGeometry): number {
    let bytes = 0
    for (const attr of Object.values(geometry.attributes)) {
      bytes += attr.array.byteLength
    }
    if (geometry.index) bytes += geometry.index.array.byteLength
    return bytes
  }

  private estimateMaterialMemory(material: THREE.Material): number {
    let bytes = 1024 // base
    if ((material as any).map) bytes += this.estimateTextureSize((material as any).map)
    if ((material as any).normalMap) bytes += this.estimateTextureSize((material as any).normalMap)
    if ((material as any).roughnessMap) bytes += this.estimateTextureSize((material as any).roughnessMap)
    if ((material as any).metalnessMap) bytes += this.estimateTextureSize((material as any).metalnessMap)
    if ((material as any).aoMap) bytes += this.estimateTextureSize((material as any).aoMap)
    if ((material as any).emissiveMap) bytes += this.estimateTextureSize((material as any).emissiveMap)
    if ((material as any).alphaMap) bytes += this.estimateTextureSize((material as any).alphaMap)
    return bytes
  }

  /**
   * Get current memory usage
   */
  getMemoryStats(): { used: number; budget: number; percentage: number; assetCount: number } {
    return {
      used: this.currentMemoryUsage,
      budget: this.config.memoryBudget,
      percentage: (this.currentMemoryUsage / this.config.memoryBudget) * 100,
      assetCount: this.cache.size
    }
  }

  /**
   * Set memory budget
   */
  setMemoryBudget(bytes: number): void {
    this.config.memoryBudget = bytes
    this.evictIfNeeded(0)
  }

  /**
   * Clear cache
   */
  clear(): void {
    for (const [id, asset] of this.cache) {
      this.disposeAssetData(asset.data, asset.type)
    }
    this.cache.clear()
    this.currentMemoryUsage = 0
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clear()
    this.loadQueue.length = 0
    this.loading.clear()

    if (this.gltfLoader) {
      // GLTFLoader doesn't have dispose
    }
    if (this.ktx2Loader) {
      this.ktx2Loader.dispose()
    }
  }
}

/**
 * AssetManifest - For loading asset manifests (lists of assets to load)
 */
export interface AssetManifest {
  version: number
  assets: AssetManifestEntry[]
}

export interface AssetManifestEntry {
  id: string
  url: string
  type: AssetType
  priority: AssetPriority
  size?: number
  tags?: string[]
}

export class AssetManifestLoader {
  private streamer: AssetStreamer

  constructor(streamer: AssetStreamer) {
    this.streamer = streamer
  }

  /**
   * Load and process asset manifest
   */
  async loadManifest(url: string): Promise<void> {
    const manifest = await this.streamer.load<AssetManifest>(url, 'json', 'CRITICAL')
    await this.processManifest(manifest)
  }

  /**
   * Process manifest and queue assets
   */
  async processManifest(manifest: AssetManifest): Promise<void> {
    const promises: Promise<void>[] = []

    for (const entry of manifest.assets) {
      const promise = this.streamer.load(entry.url, entry.type, entry.priority)
        .then(() => {})
        .catch(err => console.warn(`Failed to load asset ${entry.id}:`, err))
      promises.push(promise)
    }

    await Promise.allSettled(promises)
  }

  /**
   * Load assets by tag
   */
  async loadByTag(manifest: AssetManifest, tag: string, priority: AssetPriority = 'NORMAL'): Promise<void> {
    const entries = manifest.assets.filter(a => a.tags?.includes(tag))
    await Promise.allSettled(entries.map(e =>
      this.streamer.load(e.url, e.type, priority)
    ))
  }
}
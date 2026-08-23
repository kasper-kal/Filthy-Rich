import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ChunkCoord, CHUNK_SIZE, chunkKey } from './WorldGrid.js'
import { HouseInstance } from './HouseGenerator.js'

/**
 * ImposterSystem - Creates and manages billboard/low-poly imposters for distant houses
 * Uses billboards that always face camera, with pre-rendered textures or simple geometry
 */

export interface ImposterConfig {
  maxDistance: number
  atlasSize: number
  billboardSize: number
  updateInterval: number // ms
  fadeDistance: number // distance over which to fade in/out
}

const DEFAULT_CONFIG: ImposterConfig = {
  maxDistance: 500,
  atlasSize: 1024,
  billboardSize: 20,
  updateInterval: 1000,
  fadeDistance: 50
}

export class ImposterSystem {
  private scene: THREE.Scene
  private camera: THREE.Camera
  private config: ImposterConfig
  private houseImposters: Map<string, THREE.Mesh> = new Map()
  private chunkImposters: Map<string, THREE.Mesh> = new Map()
  private lastUpdate = 0
  private renderTarget: THREE.WebGLRenderTarget | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private imposterCamera: THREE.OrthographicCamera | null = null

  // Shader material for billboard imposters
  private billboardMaterial: THREE.ShaderMaterial | null = null

  constructor(scene: THREE.Scene, camera: THREE.Camera, config?: Partial<ImposterConfig>) {
    this.scene = scene
    this.camera = camera
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.createBillboardMaterial()
  }

  /**
   * Create the billboard shader material
   */
  private createBillboardMaterial(): void {
    this.billboardMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: null },
        alphaMap: { value: null },
        color: { value: new THREE.Color(0xffffff) },
        opacity: { value: 1.0 },
        cameraPosition: { value: new THREE.Vector3() },
        billboardSize: { value: new THREE.Vector2(this.config.billboardSize, this.config.billboardSize) },
        fadeNear: { value: this.config.maxDistance - this.config.fadeDistance },
        fadeFar: { value: this.config.maxDistance }
      },
      vertexShader: `
        uniform vec2 billboardSize;
        uniform vec3 cameraPosition;

        attribute vec3 offset;
        attribute vec2 uvOffset;

        varying vec2 vUv;
        varying float vFade;

        void main() {
          vUv = uv + uvOffset;

          // Billboard: rotate to face camera
          vec3 pos = position + offset;
          vec3 toCamera = normalize(cameraPosition - (modelMatrix * vec4(pos, 1.0)).xyz);

          // Create billboard quad in vertex shader
          vec3 right = normalize(cross(toCamera, vec3(0.0, 1.0, 0.0)));
          vec3 up = cross(right, toCamera);

          vec3 billboardPos = pos +
            (uv.x - 0.5) * billboardSize.x * right +
            (uv.y - 0.5) * billboardSize.y * up;

          vec4 mvPosition = modelViewMatrix * vec4(billboardPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Fade based on distance
          float dist = length(mvPosition.xyz);
          vFade = smoothstep(400.0, 500.0, dist);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform sampler2D alphaMap;
        uniform vec3 color;
        uniform float opacity;

        varying vec2 vUv;
        varying float vFade;

        void main() {
          vec4 texColor = texture2D(map, vUv);
          float alpha = texture2D(alphaMap, vUv).r;

          // Apply color tint
          vec3 finalColor = texColor.rgb * color;

          // Fade out at distance
          float finalAlpha = alpha * opacity * (1.0 - vFade);

          if (finalAlpha < 0.01) discard;

          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `
    })
  }

  /**
   * Initialize renderer for imposter texture generation
   */
  initializeRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer
    this.renderTarget = new THREE.WebGLRenderTarget(this.config.atlasSize, this.config.atlasSize, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true
    })

    // Orthographic camera for rendering house to texture
    this.imposterCamera = new THREE.OrthographicCamera(
      -20, 20, 20, -20, 0.1, 100
    )
  }

  /**
   * Create imposter for a single house
   */
  createHouseImposter(house: HouseInstance): THREE.Mesh | null {
    if (!this.renderer || !this.renderTarget || !this.imposterCamera || !this.billboardMaterial) {
      // Fallback: simple colored plane
      return this.createFallbackImposter(house)
    }

    const templateKey = house.template
    const existingKey = `house_${templateKey}`

    // Check if we already have an imposter texture for this template
    let texture = (this.billboardMaterial.uniforms.map.value as THREE.Texture)

    if (!texture) {
      // Would render house to texture here
      // For now, create procedural imposter
      texture = this.createProceduralImposterTexture(house)
      this.billboardMaterial.uniforms.map.value = texture
    }

    // Create billboard mesh
    const geometry = new THREE.PlaneGeometry(this.config.billboardSize, this.config.billboardSize)
    const mesh = new THREE.Mesh(geometry, this.billboardMaterial.clone())
    mesh.name = `imposter_${house.id}`
    mesh.renderOrder = -100
    mesh.frustumCulled = false // Billboards should always render if in frustum

    // Position at house center, slightly above ground
    const bounds = house.bounds
    const centerX = (bounds.min.x + bounds.max.x) / 2
    const centerZ = (bounds.min.z + bounds.max.z) / 2
    const height = bounds.max.y - bounds.min.y
    mesh.position.set(centerX, height * 0.5, centerZ)

    // Store reference
    this.houseImposters.set(house.id, mesh)

    return mesh
  }

  /**
   * Create fallback imposter (simple colored box)
   */
  private createFallbackImposter(house: HouseInstance): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(
      house.bounds.max.x - house.bounds.min.x,
      house.bounds.max.y - house.bounds.min.y,
      house.bounds.max.z - house.bounds.min.z
    )
    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `imposter_fallback_${house.id}`
    mesh.renderOrder = -100

    const centerX = (house.bounds.min.x + house.bounds.max.x) / 2
    const centerZ = (house.bounds.min.z + house.bounds.max.z) / 2
    const centerY = (house.bounds.min.y + house.bounds.max.y) / 2
    mesh.position.set(centerX, centerY, centerZ)

    this.houseImposters.set(house.id, mesh)
    return mesh
  }

  /**
   * Create procedural imposter texture for a house type
   */
  private createProceduralImposterTexture(house: HouseInstance): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    // Draw simplified house silhouette
    ctx.fillStyle = '#888888'
    ctx.fillRect(0, 0, 256, 256)

    // Roof
    ctx.fillStyle = '#6b2a2a'
    ctx.beginPath()
    ctx.moveTo(32, 128)
    ctx.lineTo(128, 32)
    ctx.lineTo(224, 128)
    ctx.closePath()
    ctx.fill()

    // Walls
    ctx.fillStyle = '#e8dcc8'
    ctx.fillRect(48, 128, 160, 100)

    // Door
    ctx.fillStyle = '#8b0000'
    ctx.fillRect(118, 178, 20, 50)

    // Windows
    ctx.fillStyle = '#87ceeb'
    ctx.fillRect(68, 148, 30, 30)
    ctx.fillRect(158, 148, 30, 30)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    texture.colorSpace = THREE.SRGBColorSpace

    // Also create alpha map
    const alphaCanvas = document.createElement('canvas')
    alphaCanvas.width = 256
    alphaCanvas.height = 256
    const alphaCtx = alphaCanvas.getContext('2d')!
    alphaCtx.fillStyle = '#ffffff'
    alphaCtx.fillRect(0, 0, 256, 256)
    // Transparent areas would be black
    const alphaTexture = new THREE.CanvasTexture(alphaCanvas)
    alphaTexture.minFilter = THREE.LinearMipmapLinearFilter
    alphaTexture.magFilter = THREE.LinearFilter
    alphaTexture.generateMipmaps = true

    this.billboardMaterial!.uniforms.alphaMap.value = alphaTexture

    return texture
  }

  /**
   * Create imposter for entire chunk (combined mesh for all houses)
   */
  createChunkImposter(chunk: ChunkCoord, houses: HouseInstance[]): THREE.Mesh | null {
    const key = chunkKey(chunk)
    const existing = this.chunkImposters.get(key)
    if (existing) return existing

    if (!this.renderer || !this.renderTarget) {
      return this.createFallbackChunkImposter(chunk, houses)
    }

    // For chunk imposter, we'd render all houses to a single texture
    // For now, create a simple combined mesh
    const group = new THREE.Group()
    group.name = `chunk_imposter_${key}`

    for (const house of houses) {
      const imposter = this.createHouseImposter(house)
      if (imposter) {
        group.add(imposter)
      }
    }

    // Create a single merged geometry for performance
    const geometries: THREE.BufferGeometry[] = []
    group.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        const geo = obj.geometry.clone()
        geo.applyMatrix4(obj.matrixWorld)
        geometries.push(geo)
      }
    })

    if (geometries.length === 0) return null

    const mergedGeometry = mergeGeometries(geometries, false)
    if (!mergedGeometry) return null

    const material = this.billboardMaterial!.clone()
    const mesh = new THREE.Mesh(mergedGeometry, material)
    mesh.name = `chunk_imposter_${key}`
    mesh.renderOrder = -100
    mesh.frustumCulled = true

    this.chunkImposters.set(key, mesh)

    // Clean up geometries
    for (const g of geometries) g.dispose()

    return mesh
  }

  private createFallbackChunkImposter(chunk: ChunkCoord, houses: HouseInstance[]): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
    const material = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(
      chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2,
      0.1,
      chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2
    )
    mesh.name = `chunk_imposter_fallback_${chunkKey(chunk)}`
    mesh.renderOrder = -100

    this.chunkImposters.set(chunkKey(chunk), mesh)
    return mesh
  }

  /**
   * Add house imposter to scene
   */
  addHouseImposter(house: HouseInstance): THREE.Mesh | undefined {
    let imposter = this.houseImposters.get(house.id)
    if (!imposter) {
      imposter = this.createHouseImposter(house) || undefined
    }
    if (imposter && !imposter.parent) {
      this.scene.add(imposter)
    }
    return imposter
  }

  /**
   * Remove house imposter from scene
   */
  removeHouseImposter(house: HouseInstance): void {
    const imposter = this.houseImposters.get(house.id)
    if (imposter && imposter.parent) {
      imposter.parent.remove(imposter)
    }
  }

  /**
   * Add chunk imposter to scene
   */
  addChunkImposter(chunk: ChunkCoord, houses: HouseInstance[]): THREE.Mesh | undefined {
    let imposter = this.chunkImposters.get(chunkKey(chunk))
    if (!imposter) {
      imposter = this.createChunkImposter(chunk, houses) || undefined
    }
    if (imposter && !imposter.parent) {
      this.scene.add(imposter)
    }
    return imposter
  }

  /**
   * Remove chunk imposter from scene
   */
  removeChunkImposter(chunk: ChunkCoord): void {
    const key = chunkKey(chunk)
    const imposter = this.chunkImposters.get(key)
    if (imposter && imposter.parent) {
      imposter.parent.remove(imposter)
    }
  }

  /**
   * Update all imposters (billboard rotation, fading)
   */
  update(delta: number): void {
    const now = performance.now()
    if (now - this.lastUpdate < this.config.updateInterval) return
    this.lastUpdate = now

    if (!this.billboardMaterial) return

    // Update camera position uniform
    this.billboardMaterial.uniforms.cameraPosition.value.copy(this.camera.position)

    // Update fade distances
    this.billboardMaterial.uniforms.fadeNear.value = this.config.maxDistance - this.config.fadeDistance
    this.billboardMaterial.uniforms.fadeFar.value = this.config.maxDistance

    // Billboards are rotated in vertex shader, but we could also
    // do CPU-side rotation for non-shader billboards
  }

  /**
   * Set imposter visibility based on distance
   */
  setImposterVisibility(house: HouseInstance, visible: boolean): void {
    const imposter = this.houseImposters.get(house.id)
    if (imposter) {
      imposter.visible = visible
    }
  }

  /**
   * Set chunk imposter visibility
   */
  setChunkImposterVisibility(chunk: ChunkCoord, visible: boolean): void {
    const imposter = this.chunkImposters.get(chunkKey(chunk))
    if (imposter) {
      imposter.visible = visible
    }
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): number {
    let bytes = 0
    for (const mesh of this.houseImposters.values()) {
      if (mesh.geometry) bytes += this.estimateGeometryMemory(mesh.geometry)
      if (mesh.material) bytes += this.estimateMaterialMemory(mesh.material)
    }
    for (const mesh of this.chunkImposters.values()) {
      if (mesh.geometry) bytes += this.estimateGeometryMemory(mesh.geometry)
      if (mesh.material) bytes += this.estimateMaterialMemory(mesh.material)
    }
    if (this.renderTarget) {
      bytes += this.config.atlasSize * this.config.atlasSize * 4 * 2 // RGBA + mipmaps
    }
    return bytes
  }

  private estimateGeometryMemory(geometry: THREE.BufferGeometry): number {
    let bytes = 0
    for (const attr of Object.values(geometry.attributes)) {
      bytes += attr.array.byteLength
    }
    if (geometry.index) bytes += geometry.index.array.byteLength
    return bytes
  }

  private estimateMaterialMemory(material: THREE.Material | THREE.Material[]): number {
    if (Array.isArray(material)) {
      return material.reduce((sum, m) => sum + this.estimateMaterialMemory(m), 0)
    }
    let bytes = 1024 // base
    if ((material as any).map) bytes += 256 * 256 * 4
    if ((material as any).alphaMap) bytes += 256 * 256 * 4
    return bytes
  }

  /**
   * Dispose all imposters
   */
  dispose(): void {
    for (const mesh of this.houseImposters.values()) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose())
      } else {
        mesh.material.dispose()
      }
    }
    this.houseImposters.clear()

    for (const mesh of this.chunkImposters.values()) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose())
      } else {
        mesh.material.dispose()
      }
    }
    this.chunkImposters.clear()

    if (this.renderTarget) {
      this.renderTarget.dispose()
      this.renderTarget = null
    }

    if (this.billboardMaterial) {
      this.billboardMaterial.dispose()
      this.billboardMaterial = null
    }
  }
}

/**
 * BillboardImposter - Simple billboard for individual objects (trees, props)
 */
export class BillboardImposter {
  private mesh: THREE.Mesh
  private camera: THREE.Camera

  constructor(texture: THREE.Texture, size: THREE.Vector2, camera: THREE.Camera) {
    this.camera = camera

    const geometry = new THREE.PlaneGeometry(size.x, size.y)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      depthTest: true,
      depthWrite: false
    })

    // Use Sprite for automatic billboarding
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(size.x, size.y, 1)
    this.mesh = sprite as unknown as THREE.Mesh
  }

  setPosition(pos: THREE.Vector3): void {
    this.mesh.position.copy(pos)
  }

  getMesh(): THREE.Mesh {
    return this.mesh
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose())
    } else {
      this.mesh.material.dispose()
    }
  }
}
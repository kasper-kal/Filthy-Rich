import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EconomySystem, FurnitureItem } from './EconomySystem.js'
import { ParticleSystem } from './ParticleSystem.js'
import { HOUSE_LAYOUT, getRoomBounds, getFloorBounds } from './HouseLayout.js'

interface LoadedModel {
  id: string
  group: THREE.Group
  boundingBox: THREE.Box3
  height: number
}

interface PlacementData {
  itemId: string
  position: THREE.Vector3
  rotation: number
  roomName: string
}

const FURNITURE_MODEL_PATHS: Record<string, string> = {
  // Seating
  armchair: '/models/furniture/armchair.glb',
  sofa: '/models/furniture/sofa.glb',
  office_chair: '/models/furniture/office_chair.glb',
  beanbag: '/models/furniture/beanbag.glb',
  dining_chair: '/models/furniture/dining_chair.glb',

  // Storage
  bookshelf: '/models/furniture/bookshelf.glb',
  wardrobe: '/models/furniture/wardrobe.glb',
  tv_stand: '/models/furniture/tv_stand.glb',
  sideboard: '/models/furniture/sideboard.glb',

  // Decor
  rug: '/models/furniture/rug.glb',
  plant_large: '/models/furniture/plant_large.glb',
  plant_small: '/models/furniture/plant_small.glb',
  art_large: '/models/furniture/art_large.glb',
  mirror: '/models/furniture/mirror.glb',

  // Lighting
  floor_lamp: '/models/furniture/floor_lamp.glb',
  table_lamp: '/models/furniture/table_lamp.glb',
  pendant: '/models/furniture/pendant.glb',

  // Bed
  bed_frame: '/models/furniture/bed_frame.glb',
  nightstand: '/models/furniture/nightstand.glb',

  // Table
  dining_table: '/models/furniture/dining_table.glb',
  coffee_table: '/models/furniture/coffee_table.glb',
  desk: '/models/furniture/desk.glb',
}

const DEFAULT_MODEL_SCALE: Record<string, number> = {
  armchair: 1.0,
  sofa: 1.0,
  office_chair: 1.0,
  beanbag: 1.0,
  dining_chair: 1.0,
  bookshelf: 1.0,
  wardrobe: 1.0,
  tv_stand: 1.0,
  sideboard: 1.0,
  rug: 1.0,
  plant_large: 1.0,
  plant_small: 1.0,
  art_large: 1.0,
  mirror: 1.0,
  floor_lamp: 1.0,
  table_lamp: 1.0,
  pendant: 1.0,
  bed_frame: 1.0,
  nightstand: 1.0,
  dining_table: 1.0,
  coffee_table: 1.0,
  desk: 1.0,
}

const MODEL_Y_OFFSET: Record<string, number> = {
  rug: 0.01,
  plant_large: 0,
  plant_small: 0,
  art_large: 0,
  mirror: 0,
  floor_lamp: 0,
  table_lamp: 0,
  pendant: 0,
  bed_frame: 0,
  nightstand: 0,
  dining_table: 0,
  coffee_table: 0,
  desk: 0,
  armchair: 0,
  sofa: 0,
  office_chair: 0,
  beanbag: 0,
  dining_chair: 0,
  bookshelf: 0,
  wardrobe: 0,
  tv_stand: 0,
  sideboard: 0,
}

export class FurnitureManager {
  private scene: THREE.Scene
  private furniture: Map<string, THREE.Group> = new Map()
  private economySystem: EconomySystem
  private particleSystem: ParticleSystem
  private gltfLoader: GLTFLoader
  private dracoLoader: DRACOLoader
  private loadedModels: Map<string, LoadedModel> = new Map()
  private loadingPromises: Map<string, Promise<LoadedModel>> = new Map()
  private placementMode = false
  private previewMesh: THREE.Group | null = null
  private previewItem: FurnitureItem | null = null
  private currentRotation = 0
  private placementGridSize = 0.25
  private collisionBoxes: THREE.Box3[] = []

  // Placement callbacks
  onPlacementUpdate?: (valid: boolean, roomName: string) => void
  onPlacementConfirm?: (data: PlacementData) => void
  onPlacementCancel?: () => void

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.economySystem = new EconomySystem()
    this.particleSystem = new ParticleSystem(scene)

    // Setup GLTF loader with DRACO
    this.gltfLoader = new GLTFLoader()
    this.dracoLoader = new DRACOLoader()
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    this.gltfLoader.setDRACOLoader(this.dracoLoader)

    // Load placed furniture from save
    this.loadPlacedFurniture()
  }

  async init(): Promise<void> {
    // Preload commonly used models
    await this.preloadModels(['armchair', 'sofa', 'bed_frame', 'dining_table', 'bookshelf', 'rug'])
  }

  private async preloadModels(modelIds: string[]): Promise<void> {
    await Promise.allSettled(modelIds.map(id => this.loadModel(id)))
  }

  private async loadModel(modelId: string): Promise<LoadedModel> {
    // Return cached if already loaded
    if (this.loadedModels.has(modelId)) {
      return this.loadedModels.get(modelId)!
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(modelId)) {
      return this.loadingPromises.get(modelId)!
    }

    const path = FURNITURE_MODEL_PATHS[modelId]
    if (!path) {
      throw new Error(`No model path for ${modelId}`)
    }

    const promise = this.loadGLTF(path, modelId)
    this.loadingPromises.set(modelId, promise)

    try {
      const model = await promise
      this.loadedModels.set(modelId, model)
      return model
    } finally {
      this.loadingPromises.delete(modelId)
    }
  }

  private async loadGLTF(path: string, modelId: string): Promise<LoadedModel> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const group = new THREE.Group()
          group.name = `furniture_${modelId}`

          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true
              child.receiveShadow = true
              // Ensure materials are proper for our lighting
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.envMapIntensity = 1.0
              }
            }
          })

          group.add(gltf.scene)

          // Apply default scale
          const scale = DEFAULT_MODEL_SCALE[modelId] || 1.0
          group.scale.setScalar(scale)

          // Apply Y offset
          const yOffset = MODEL_Y_OFFSET[modelId] || 0
          group.position.y = yOffset

          // Compute bounding box
          const boundingBox = new THREE.Box3().setFromObject(group)
          const height = boundingBox.max.y - boundingBox.min.y

          const loadedModel: LoadedModel = {
            id: modelId,
            group,
            boundingBox,
            height,
          }

          resolve(loadedModel)
        },
        undefined,
        (error) => {
          console.warn(`Failed to load model ${modelId} from ${path}:`, error)
          // Fall back to procedural generation
          resolve(this.createProceduralFallback(modelId))
        }
      )
    })
  }

  private createProceduralFallback(modelId: string): LoadedModel {
    const group = new THREE.Group()
    group.name = `furniture_${modelId}_fallback`

    // Simple procedural fallback - a colored box with label
    const colors: Record<string, number> = {
      armchair: 0x8b0000, sofa: 0x4a0e0e, office_chair: 0x222222,
      beanbag: 0x556677, dining_chair: 0x6b4f2b,
      bookshelf: 0x8b5a2b, wardrobe: 0x8b5a2b, tv_stand: 0x8b5a2b, sideboard: 0x8b5a2b,
      rug: 0xcc8866, plant_large: 0x2d8a3d, plant_small: 0x2d8a3d,
      art_large: 0x8844aa, mirror: 0xeeeeff,
      floor_lamp: 0xfff5dd, table_lamp: 0xfff5dd, pendant: 0xfff5dd,
      bed_frame: 0x778899, nightstand: 0x778899,
      dining_table: 0x9b7a5b, coffee_table: 0x9b7a5b, desk: 0x9b7a5b,
    }

    const mat = new THREE.MeshStandardMaterial({
      color: colors[modelId] || 0x999999,
      roughness: 0.7,
      metalness: 0.1,
    })

    // Rough dimensions based on type
    let width = 1, height = 1, depth = 1
    if (modelId === 'sofa') { width = 2; depth = 1; height = 0.9 }
    else if (modelId === 'bed_frame') { width = 2; depth = 1.6; height = 1.0 }
    else if (modelId === 'dining_table') { width = 1.8; depth = 1.0; height = 0.75 }
    else if (modelId === 'bookshelf') { width = 1; depth = 0.35; height = 2.0 }
    else if (modelId === 'wardrobe') { width = 1.2; depth = 0.6; height = 2.0 }
    else if (modelId === 'rug') { width = 2.5; depth = 1.8; height = 0.02 }

    const geo = new THREE.BoxGeometry(width, height, depth)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = height / 2
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)

    const boundingBox = new THREE.Box3().setFromObject(group)

    return {
      id: modelId,
      group,
      boundingBox,
      height,
    }
  }

  async createFurnitureModel(item: FurnitureItem): Promise<THREE.Group> {
    // Try to load the GLB model
    try {
      const loadedModel = await this.loadModel(item.modelType)
      // Clone the group for placement
      const instance = loadedModel.group.clone(true)
      instance.name = `furniture_${item.id}_${Date.now()}`

      // Recompute bounding box for this instance
      const bbox = new THREE.Box3().setFromObject(instance)

      // Store reference to original model for collision
      instance.userData.modelId = item.modelType
      instance.userData.boundingBox = bbox

      return instance
    } catch (e) {
      console.warn(`Failed to load model for ${item.id}, using fallback`)
      const fallback = this.createProceduralFallback(item.modelType)
      const instance = fallback.group.clone(true)
      instance.name = `furniture_${item.id}_${Date.now()}`
      instance.userData.modelId = item.modelType
      instance.userData.boundingBox = new THREE.Box3().setFromObject(instance)
      return instance
    }
  }

  // Furniture Placement System
  async startPlacement(item: FurnitureItem): Promise<void> {
    if (this.placementMode) return

    this.placementMode = true
    this.previewItem = item
    this.currentRotation = 0

    // Create preview mesh
    this.previewMesh = await this.createFurnitureModel(item)
    this.previewMesh.name = 'furniture_preview'

    // Make preview transparent
    this.previewMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material
        if (Array.isArray(mat)) {
          mat.forEach(m => {
            m.transparent = true
            m.opacity = 0.5
            m.depthWrite = false
          })
        } else {
          mat.transparent = true
          mat.opacity = 0.5
          mat.depthWrite = false
        }
      }
    })

    this.scene.add(this.previewMesh)
    this.updateCollisionBoxes()
  }

  exitPlacementMode(): void {
    this.placementMode = false
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh)
      this.disposeGroup(this.previewMesh)
      this.previewMesh = null
    }
    this.previewItem = null
    this.onPlacementCancel?.()
  }

  updatePlacement(raycaster: THREE.Raycaster, camera: THREE.Camera): void {
    if (!this.placementMode || !this.previewMesh || !this.previewItem) return

    // Raycast against floor
    const floorMeshes: THREE.Mesh[] = []
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith('floor_')) {
        floorMeshes.push(obj)
      }
    })

    if (floorMeshes.length === 0) return

    const intersects = raycaster.intersectObjects(floorMeshes)
    if (intersects.length === 0) return

    const hitPoint = intersects[0].point

    // Snap to grid
    const snappedX = Math.round(hitPoint.x / this.placementGridSize) * this.placementGridSize
    const snappedZ = Math.round(hitPoint.z / this.placementGridSize) * this.placementGridSize

    // Determine which room we're in
    const roomName = this.getRoomAtPoint(new THREE.Vector3(snappedX, hitPoint.y, snappedZ))

    // Check collision
    const valid = this.checkPlacementValid(snappedX, hitPoint.y, snappedZ, this.currentRotation)

    // Update preview position
    this.previewMesh.position.set(snappedX, hitPoint.y, snappedZ)
    this.previewMesh.rotation.y = this.currentRotation

    // Update preview color based on validity
    const color = valid ? 0x2ecc71 : 0xe74c3c
    this.previewMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material
        if (Array.isArray(mat)) {
          mat.forEach(m => {
            m.color.setHex(color)
            m.emissive.setHex(color)
            m.emissiveIntensity = 0.3
          })
        } else {
          mat.color.setHex(color)
          if (mat.emissive) {
            mat.emissive.setHex(color)
            mat.emissiveIntensity = 0.3
          }
        }
      }
    })

    this.onPlacementUpdate?.(valid, roomName || 'outside')
  }

  rotatePreview(delta: number = Math.PI / 2): void {
    if (!this.placementMode) return
    this.currentRotation = (this.currentRotation + delta) % (Math.PI * 2)
  }

  async confirmPlacement(): Promise<void> {
    if (!this.placementMode || !this.previewMesh || !this.previewItem) return

    const position = this.previewMesh.position.clone()
    const rotation = this.currentRotation

    // Final validity check
    const valid = this.checkPlacementValid(position.x, position.y, position.z, rotation)
    if (!valid) return

    // Check if player can afford
    if (!this.economySystem.canAfford(this.previewItem.price)) {
      // TODO: Show "can't afford" feedback
      return
    }

    // Spend budget
    this.economySystem.spendBudget(this.previewItem.price)

    // Create real furniture instance (opaque)
    const realFurniture = await this.createFurnitureModel(this.previewItem)
    realFurniture.position.copy(position)
    realFurniture.rotation.y = rotation

    // Generate unique ID
    const id = this.generateId()
    realFurniture.name = `furniture_${id}`

    this.scene.add(realFurniture)
    this.furniture.set(id, realFurniture)

    // Save placement
    const roomName = this.getRoomAtPoint(position) || 'unknown'
    this.economySystem.placeFurniture(this.previewItem.id, { x: position.x, y: position.y, z: position.z }, rotation)

    // Update collision boxes
    this.updateCollisionBoxes()

    // Particle effect
    this.particleSystem.emitFurniturePlaced(position)
    window.dispatchEvent(new CustomEvent('furniture-placed'))

    // Call callback
    this.onPlacementConfirm?.({ itemId: this.previewItem.id, position, rotation, roomName })

    // Exit placement mode
    this.exitPlacementMode()
  }

  private checkPlacementValid(x: number, y: number, z: number, rotation: number): boolean {
    if (!this.previewItem) return false

    // Check bounds - must be inside house
    const bounds = getFloorBounds()
    if (x < bounds.min.x || x > bounds.max.x || z < bounds.min.y || z > bounds.max.y) {
      return false
    }

    // Check room bounds - furniture must be fully inside a room
    const room = this.getRoomAtPointDetailed(new THREE.Vector3(x, y, z))
    if (!room) return false

    // Check collision with existing furniture
    const previewBox = new THREE.Box3().setFromObject(this.previewMesh!)
    const previewBoxWorld = previewBox.clone().translate(new THREE.Vector3(x, 0, z))

    for (const box of this.collisionBoxes) {
      if (previewBoxWorld.intersectsBox(box)) {
        return false
      }
    }

    // Check distance from walls (keep away from walls by at least 0.3m)
    const roomBounds = getRoomBounds(room)
    const margin = 0.3
    const halfW = (room.size.x - margin * 2) / 2
    const halfD = (room.size.z - margin * 2) / 2

    const localX = x - room.position.x
    const localZ = z - room.position.z

    if (Math.abs(localX) > halfW || Math.abs(localZ) > halfD) {
      return false
    }

    return true
  }

  private getRoomAtPoint(point: THREE.Vector3): string | null {
    for (const room of HOUSE_LAYOUT) {
      const bounds = getRoomBounds(room)
      if (
        point.x >= bounds.min.x && point.x <= bounds.max.x &&
        point.z >= bounds.min.z && point.z <= bounds.max.z
      ) {
        return room.name
      }
    }
    return null
  }

  private getRoomAtPointDetailed(point: THREE.Vector3): typeof HOUSE_LAYOUT[0] | null {
    for (const room of HOUSE_LAYOUT) {
      const bounds = getRoomBounds(room)
      if (
        point.x >= bounds.min.x && point.x <= bounds.max.x &&
        point.z >= bounds.min.z && point.z <= bounds.max.z
      ) {
        return room
      }
    }
    return null
  }

  private updateCollisionBoxes(): void {
    this.collisionBoxes = []
    this.furniture.forEach(group => {
      const box = new THREE.Box3().setFromObject(group)
      // Expand slightly for comfortable navigation
      box.expandByScalar(0.15)
      this.collisionBoxes.push(box)
    })
  }

  private loadPlacedFurniture(): void {
    // This will be called after EconomySystem loads from localStorage
    // Actual placement happens in Game.ts after init
  }

  async placeSavedFurniture(itemId: string, position: { x: number; y: number; z: number }, rotation: number): Promise<void> {
    const catalog = this.economySystem.getCatalog()
    const item = catalog.find(f => f.id === itemId)
    if (!item) return

    const furniture = await this.createFurnitureModel(item)
    furniture.position.set(position.x, position.y, position.z)
    furniture.rotation.y = rotation

    const id = this.generateId()
    furniture.name = `furniture_${id}`
    furniture.userData.savedPlacement = true

    this.scene.add(furniture)
    this.furniture.set(id, furniture)
    this.updateCollisionBoxes()
  }

  removeFurniture(id: string): void {
    const group = this.furniture.get(id)
    if (group) {
      this.scene.remove(group)
      this.disposeGroup(group)
      this.furniture.delete(id)
      this.updateCollisionBoxes()
    }
  }

  clearAll(): void {
    this.furniture.forEach((group, id) => {
      this.scene.remove(group)
      this.disposeGroup(group)
    })
    this.furniture.clear()
    this.updateCollisionBoxes()
  }

  private generateId(): string {
    return `furniture_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse(obj => {
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

  update(delta: number): void {
    this.particleSystem.update(delta)
  }

  getFurnitureCount(): number {
    return this.furniture.size
  }

  isInPlacementMode(): boolean {
    return this.placementMode
  }

  getPreviewMesh(): THREE.Group | null {
    return this.previewMesh
  }

  // Enable/disable placement mode from external state machine
  setPlacementModeEnabled(enabled: boolean): void {
    if (!enabled && this.placementMode) {
      this.exitPlacementMode()
    }
  }
}
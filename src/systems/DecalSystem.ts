import * as THREE from 'three'
import { SceneManager } from './SceneManager.js'
import { HOUSE_LAYOUT, getRoomBounds } from './HouseLayout.js'
import { Job } from './JobSystem.js'

export interface DecalData {
  id: string
  mesh: THREE.Mesh
  surfaceNormal: THREE.Vector3
  surfacePoint: THREE.Vector3
  surfaceObject: THREE.Object3D
  roomName: string
  type: StainType
  age: number // 0-1, how long stain has been there
  cleanedAmount: number // 0-1, how much has been cleaned
}

export type StainType = 'grease' | 'dirt' | 'mold' | 'wine' | 'coffee' | 'blood' | 'oil' | 'dust' | 'pet' | 'ink' | 'paint' | 'rust'

const STAIN_TEXTURES: Record<StainType, { color: number; roughness: number; metalness: number; emissive?: number }> = {
  grease: { color: 0x2a1a0a, roughness: 0.3, metalness: 0.4 },
  dirt: { color: 0x3d2e1c, roughness: 0.9, metalness: 0.0 },
  mold: { color: 0x1a3a1a, roughness: 0.7, metalness: 0.05 },
  wine: { color: 0x4a0a1a, roughness: 0.5, metalness: 0.1 },
  coffee: { color: 0x2a150a, roughness: 0.6, metalness: 0.05 },
  blood: { color: 0x3a0a0a, roughness: 0.4, metalness: 0.1 },
  oil: { color: 0x1a1a0a, roughness: 0.2, metalness: 0.5 },
  dust: { color: 0x5a5a4a, roughness: 0.95, metalness: 0.0 },
  pet: { color: 0x3a2a1a, roughness: 0.8, metalness: 0.0 },
  ink: { color: 0x0a0a2a, roughness: 0.5, metalness: 0.1 },
  paint: { color: 0x2a1a2a, roughness: 0.4, metalness: 0.2 },
  rust: { color: 0x5a2a0a, roughness: 0.9, metalness: 0.3 },
}

const STAIN_NAMES: Record<StainType, string> = {
  grease: 'Grease Stain',
  dirt: 'Dirt Stain',
  mold: 'Mold Patch',
  wine: 'Wine Stain',
  coffee: 'Coffee Stain',
  blood: 'Blood Stain',
  oil: 'Oil Spill',
  dust: 'Dust Buildup',
  pet: 'Pet Stain',
  ink: 'Ink Stain',
  paint: 'Paint Splatter',
  rust: 'Rust Stain',
}

const SURFACE_TYPES = ['floor', 'wall', 'ceiling', 'furniture'] as const
type SurfaceType = typeof SURFACE_TYPES[number]

interface SurfaceInfo {
  object: THREE.Object3D
  normal: THREE.Vector3
  point: THREE.Vector3
  roomName: string
  type: SurfaceType
  distance: number
}

export class DecalSystem {
  private scene: THREE.Scene
  private sceneManager: SceneManager
  private decals: Map<string, DecalData> = new Map()
  private decalGeometry: THREE.BufferGeometry
  private decalMaterial: THREE.MeshStandardMaterial
  private nextId = 0

  // Decal projection settings
  private readonly DECAL_SIZE_MIN = 0.15
  private readonly DECAL_SIZE_MAX = 0.45
  private readonly DECAL_DEPTH = 0.02
  private readonly MAX_DECALS = 200

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager
    this.scene = sceneManager.scene

    // Create shared geometry for decals (a thin box that we'll project)
    this.decalGeometry = new THREE.BoxGeometry(1, this.DECAL_DEPTH, 1)
    this.decalGeometry.translate(0, this.DECAL_DEPTH / 2, 0) // Align bottom to origin

    // Base decal material - will be customized per stain
    this.decalMaterial = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })

    this.generateInitialStains()
  }

  private generateInitialStains(): void {
    // Generate stains across all rooms
    for (const room of HOUSE_LAYOUT) {
      const bounds = getRoomBounds(room)
      const stainCount = this.getStainCountForRoom(room.name, room.size.x * room.size.z)

      for (let i = 0; i < stainCount; i++) {
        this.placeRandomStainInRoom(room)
      }
    }
  }

  private getStainCountForRoom(roomName: string, area: number): number {
    // Base stains on room area, with variation
    const baseDensity = 0.8 // stains per square meter
    const variation = 0.5 + Math.random()
    return Math.floor(area * baseDensity * variation)
  }

  private placeRandomStainInRoom(room: typeof HOUSE_LAYOUT[0]): void {
    const bounds = getRoomBounds(room)
    const surfaceType = this.pickSurfaceType()
    const surfaceInfo = this.findSurfaceInRoom(room, surfaceType)

    if (!surfaceInfo) return

    // Add some random offset within the surface
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      0,
      (Math.random() - 0.5) * 0.8
    )

    const stainPoint = surfaceInfo.point.clone().add(offset)
    const stainNormal = surfaceInfo.normal.clone()

    this.createDecalAtPoint(stainPoint, stainNormal, surfaceInfo.object, room.name)
  }

  private pickSurfaceType(): SurfaceType {
    const weights = [0.5, 0.3, 0.05, 0.15] // floor, wall, ceiling, furniture
    const rand = Math.random()
    let sum = 0
    for (let i = 0; i < weights.length; i++) {
      sum += weights[i]
      if (rand < sum) return SURFACE_TYPES[i]
    }
    return 'floor'
  }

  private findSurfaceInRoom(room: typeof HOUSE_LAYOUT[0], surfaceType: SurfaceType): SurfaceInfo | null {
    const bounds = getRoomBounds(room)
    const candidates: SurfaceInfo[] = []

    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return

      const name = obj.name.toLowerCase()
      const isInRoom = this.isObjectInRoom(obj, bounds)

      if (!isInRoom) return

      let matchesType = false
      let normal = new THREE.Vector3(0, 1, 0)

      switch (surfaceType) {
        case 'floor':
          matchesType = name.includes('floor') || name.includes('ground')
          normal.set(0, 1, 0)
          break
        case 'wall':
          matchesType = name.includes('wall') || name.includes('baseboard')
          // Determine wall normal based on position
          const center = new THREE.Vector3()
          obj.getWorldPosition(center)
          const roomCenter = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, 0, (bounds.min.z + bounds.max.z) / 2)
          const toCenter = roomCenter.clone().sub(center).normalize()
          normal.copy(toCenter)
          break
        case 'ceiling':
          matchesType = name.includes('ceiling')
          normal.set(0, -1, 0)
          break
        case 'furniture':
          matchesType = name.startsWith('furniture_')
          normal.set(0, 1, 0) // Top surface
          break
      }

      if (matchesType) {
        // Get a random point on the surface
        const box = new THREE.Box3().setFromObject(obj)
        const point = new THREE.Vector3()
        box.getCenter(point)

        // For walls, project to surface
        if (surfaceType === 'wall') {
          const localPoint = obj.worldToLocal(point.clone())
          const geometry = obj.geometry
          if (geometry) {
            const positionAttr = geometry.getAttribute('position')
            if (positionAttr) {
              // Find closest vertex on the facing side
              let closestDist = Infinity
              let closestVertex = new THREE.Vector3()
              for (let i = 0; i < positionAttr.count; i++) {
                const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i)
                obj.localToWorld(v)
                const dist = v.distanceTo(point)
                if (dist < closestDist) {
                  closestDist = dist
                  closestVertex.copy(v)
                }
              }
              point.copy(closestVertex)
            }
          }
        }

        candidates.push({
          object: obj,
          normal,
          point,
          roomName: room.name,
          type: surfaceType,
          distance: 0,
        })
      }
    })

    if (candidates.length === 0) return null

    // Pick random candidate
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  private isObjectInRoom(obj: THREE.Object3D, bounds: { min: THREE.Vector3; max: THREE.Vector3 }): boolean {
    const box = new THREE.Box3().setFromObject(obj)
    const center = new THREE.Vector3()
    box.getCenter(center)
    return (
      center.x >= bounds.min.x && center.x <= bounds.max.x &&
      center.z >= bounds.min.z && center.z <= bounds.max.z
    )
  }

  createDecalAtPoint(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    surfaceObject: THREE.Object3D,
    roomName: string
  ): DecalData | null {
    if (this.decals.size >= this.MAX_DECALS) return null

    // Create stain type based on room and surface
    const stainType = this.pickStainType(roomName, surfaceObject.name)
    const stainConfig = STAIN_TEXTURES[stainType]

    // Random size
    const size = THREE.MathUtils.lerp(this.DECAL_SIZE_MIN, this.DECAL_SIZE_MAX, Math.random())
    const age = Math.random() // How old/stubborn the stain is

    // Create decal mesh
    const decalMesh = new THREE.Mesh(this.decalGeometry, this.decalMaterial.clone())
    decalMesh.name = `decal_${this.nextId++}`

    // Position and orient the decal on the surface
    this.positionDecalOnSurface(decalMesh, point, normal)

    // Apply stain appearance
    this.applyStainAppearance(decalMesh, stainType, age)

    decalMesh.userData = {
      stainType,
      age,
      cleanedAmount: 0,
      roomName,
      surfaceObject: surfaceObject.uuid,
    }

    this.scene.add(decalMesh)

    const decalData: DecalData = {
      id: decalMesh.name,
      mesh: decalMesh,
      surfaceNormal: normal.clone(),
      surfacePoint: point.clone(),
      surfaceObject,
      roomName,
      type: stainType,
      age,
      cleanedAmount: 0,
    }

    this.decals.set(decalData.id, decalData)
    return decalData
  }

  private positionDecalOnSurface(decal: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3): void {
    decal.position.copy(point)

    // Orient decal to surface normal
    const up = new THREE.Vector3(0, 1, 0)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal)
    decal.quaternion.copy(quaternion)

    // Slight offset to prevent z-fighting
    decal.position.addScaledVector(normal, 0.002)
  }

  private applyStainAppearance(decal: THREE.Mesh, stainType: StainType, age: number): void {
    const config = STAIN_TEXTURES[stainType]
    const material = decal.material as THREE.MeshStandardMaterial

    // Age affects darkness and saturation
    const ageFactor = 0.5 + age * 0.5
    const color = new THREE.Color(config.color)
    color.multiplyScalar(ageFactor)

    material.color.copy(color)
    material.roughness = config.roughness
    material.metalness = config.metalness
    material.opacity = 0.85 + age * 0.1

    // Add subtle emissive for fresh stains
    if (age < 0.3) {
      material.emissive.setHex(config.color)
      material.emissiveIntensity = 0.02
    }
  }

  private pickStainType(roomName: string, surfaceName: string): StainType {
    const roomStains: Record<string, StainType[]> = {
      kitchen: ['grease', 'oil', 'coffee', 'wine'],
      bathroom: ['mold', 'dirt', 'dust'],
      bedroom: ['dust', 'dirt', 'coffee'],
      living_room: ['dirt', 'dust', 'wine', 'grease'],
      hallway: ['dirt', 'dust', 'grease'],
      office: ['coffee', 'dust', 'dirt'],
      dining_room: ['wine', 'grease', 'coffee', 'dirt'],
      utility: ['oil', 'dirt', 'grease', 'mold'],
    }

    const stains = roomStains[roomName] || ['dirt', 'dust', 'grease']
    return stains[Math.floor(Math.random() * stains.length)]
  }

  // === Cleaning Interaction ===

  /**
   * Apply cleaning to a decal at the given world position with the given tool.
   * Returns the amount cleaned (0-1) and whether the stain was fully removed.
   */
  cleanAtPosition(
    position: THREE.Vector3,
    toolType: 'spray' | 'mop' | 'vacuum',
    pressure: number = 1.0,
    radius: number = 0.2
  ): { cleaned: number; removed: boolean; stainType?: StainType } {
    let bestDecal: DecalData | null = null
    let bestDistance = Infinity

    // Find closest decal within radius
    for (const decal of this.decals.values()) {
      if (decal.cleanedAmount >= 1) continue

      const dist = decal.surfacePoint.distanceTo(position)
      if (dist < radius && dist < bestDistance) {
        bestDistance = dist
        bestDecal = decal
      }
    }

    if (!bestDecal) return { cleaned: 0, removed: false }

    // Calculate cleaning effectiveness based on tool and stain type
    const effectiveness = this.getToolEffectiveness(bestDecal.type, toolType)
    const ageResistance = 0.3 + bestDecal.age * 0.7 // Older stains harder to clean
    const pressureFactor = THREE.MathUtils.clamp(pressure, 0.3, 1.5)

    const cleanAmount = effectiveness * pressureFactor * (1 - ageResistance * 0.5) * 0.15

    bestDecal.cleanedAmount = THREE.MathUtils.clamp(bestDecal.cleanedAmount + cleanAmount, 0, 1)

    // Update visual appearance
    this.updateDecalVisuals(bestDecal)

    const removed = bestDecal.cleanedAmount >= 1
    if (removed) {
      this.removeDecal(bestDecal.id)
    }

    return { cleaned: cleanAmount, removed, stainType: bestDecal.type }
  }

  private getToolEffectiveness(stainType: StainType, toolType: 'spray' | 'mop' | 'vacuum'): number {
    // Tool effectiveness matrix (House Flipper style)
    const effectiveness: Record<StainType, Record<string, number>> = {
      grease: { spray: 0.9, mop: 0.7, vacuum: 0.1 },
      dirt: { spray: 0.5, mop: 0.9, vacuum: 0.6 },
      mold: { spray: 0.8, mop: 0.6, vacuum: 0.1 },
      wine: { spray: 0.7, mop: 0.8, vacuum: 0.1 },
      coffee: { spray: 0.6, mop: 0.8, vacuum: 0.1 },
      blood: { spray: 0.8, mop: 0.7, vacuum: 0.1 },
      oil: { spray: 0.9, mop: 0.5, vacuum: 0.1 },
      dust: { spray: 0.2, mop: 0.4, vacuum: 1.0 },
      pet: { spray: 0.7, mop: 0.5, vacuum: 0.8 },
      ink: { spray: 0.8, mop: 0.6, vacuum: 0.1 },
      paint: { spray: 0.4, mop: 0.9, vacuum: 0.1 },
      rust: { spray: 0.9, mop: 0.4, vacuum: 0.1 },
    }

    return effectiveness[stainType]?.[toolType] || 0.3
  }

  private updateDecalVisuals(decal: DecalData): void {
    const material = decal.mesh.material as THREE.MeshStandardMaterial
    const config = STAIN_TEXTURES[decal.type]

    // Fade out as cleaned
    const remaining = 1 - decal.cleanedAmount
    material.opacity = THREE.MathUtils.lerp(0.1, 0.85, remaining)

    // Lighten color as cleaned
    const color = new THREE.Color(config.color)
    const cleanColor = new THREE.Color(0xffffff)
    color.lerp(cleanColor, decal.cleanedAmount * 0.7)
    material.color.copy(color)

    // Reduce emissive
    if (material.emissiveIntensity > 0) {
      material.emissiveIntensity *= (1 - decal.cleanedAmount)
    }

    // Scale down slightly as cleaned
    const scale = THREE.MathUtils.lerp(0.3, 1, remaining)
    decal.mesh.scale.setScalar(scale)
  }

  removeDecal(id: string): void {
    const decal = this.decals.get(id)
    if (decal) {
      this.scene.remove(decal.mesh)
      decal.mesh.geometry.dispose()
      ;(decal.mesh.material as THREE.Material).dispose()
      this.decals.delete(id)
    }
  }

  // === Raycasting for Interaction ===

  /**
   * Find the closest decal under the crosshair
   */
  getDecalUnderCursor(raycaster: THREE.Raycaster): DecalData | null {
    const decalMeshes: THREE.Mesh[] = []
    this.decals.forEach(decal => decalMeshes.push(decal.mesh))

    const intersects = raycaster.intersectObjects(decalMeshes, false)
    if (intersects.length === 0) return null

    const hitMesh = intersects[0].object as THREE.Mesh
    return this.decals.get(hitMesh.name) || null
  }

  /**
   * Get all decals in a room (for progress tracking)
   */
  getDecalsInRoom(roomName: string): DecalData[] {
    const result: DecalData[] = []
    this.decals.forEach(decal => {
      if (decal.roomName === roomName) result.push(decal)
    })
    return result
  }

  /**
   * Get total decal count and cleaned count for progress
   */
  getProgress(): { total: number; cleaned: number; percent: number } {
    let total = 0
    let cleaned = 0
    this.decals.forEach(decal => {
      total++
      if (decal.cleanedAmount >= 1) cleaned++
      else cleaned += decal.cleanedAmount
    })
    return { total, cleaned, percent: total > 0 ? (cleaned / total) * 100 : 100 }
  }

  getAllDecals(): DecalData[] {
    return Array.from(this.decals.values())
  }

  getDecalCount(): number {
    return this.decals.size
  }

  // === Dynamic Stain Generation (for new jobs) ===

  generateJobStains(job: Job): void {
    // Clear existing decals first
    this.clearAllDecals()

    for (const detail of job.roomDetails) {
      const room = HOUSE_LAYOUT.find(r => r.name === detail.roomName)
      if (!room) continue

      // Generate regular stains based on count
      for (let i = 0; i < detail.stainCount; i++) {
        this.placeRandomStainInRoom(room)
      }

      // Generate special stains
      for (const specialStain of detail.specialStains) {
        this.createSpecialStain(room, specialStain)
      }
    }
  }

  private createSpecialStain(room: typeof HOUSE_LAYOUT[0], specialStain: Job['roomDetails'][0]['specialStains'][0]): void {
    const bounds = getRoomBounds(room)

    // Find appropriate surface
    let surfaceInfo = this.findSurfaceInRoom(room, specialStain.surface)
    if (!surfaceInfo) {
      // Fallback to floor
      surfaceInfo = this.findSurfaceInRoom(room, 'floor')
    }
    if (!surfaceInfo) return

    // Position at the special stain's position (relative to room)
    const stainPoint = specialStain.position.clone()
    const stainNormal = surfaceInfo.normal.clone()

    const decalData = this.createDecalAtPoint(stainPoint, stainNormal, surfaceInfo.object, room.name)
    if (decalData) {
      // Override with special stain properties
      decalData.type = specialStain.type
      decalData.age = specialStain.difficulty / 3 // Higher difficulty = older/more stubborn

      // Apply special stain appearance
      const material = decalData.mesh.material as THREE.MeshStandardMaterial
      const config = STAIN_TEXTURES[specialStain.type] || STAIN_TEXTURES.dirt
      material.color.setHex(config.color)
      material.roughness = config.roughness
      material.metalness = config.metalness
      material.opacity = 0.9
      material.emissive.setHex(config.color)
      material.emissiveIntensity = 0.05
      material.needsUpdate = true

      // Make special stains larger
      decalData.mesh.scale.setScalar(1.5)
    }
  }

  clearAllDecals(): void {
    this.decals.forEach(decal => {
      this.scene.remove(decal.mesh)
      decal.mesh.geometry.dispose()
      ;(decal.mesh.material as THREE.Material).dispose()
    })
    this.decals.clear()
  }

  update(delta: number): void {
    // Animate decal subtle pulsing for fresh stains
    this.decals.forEach(decal => {
      if (decal.age < 0.3 && decal.cleanedAmount < 0.5) {
        const pulse = Math.sin(performance.now() * 0.003 + decal.id.charCodeAt(0)) * 0.02 + 1
        decal.mesh.scale.setScalar(pulse * (1 - decal.cleanedAmount * 0.5))
      }
    })
  }

  dispose(): void {
    this.clearAllDecals()
    this.decalGeometry.dispose()
    this.decalMaterial.dispose()
  }
}